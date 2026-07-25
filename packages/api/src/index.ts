// ============================================================
// SUPER RESERVATION PLATFORM — Fastify API Entry Point
// Base URL: https://api.reservr.eg/v1
// Rate limits: 100 req/min (unauth) | 300 req/min (authed)
// ============================================================

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';

import { env } from './config/env.js';
import databasePlugin from './plugins/database.js';
import redisPlugin from './plugins/redis.js';
import authPlugin from './plugins/auth.js';
import firebasePlugin from './plugins/firebase.js';
import { errorHandler, notFoundHandler } from './plugins/error-handler.js';

import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import searchRoutes from './routes/search.js';
import bookingRoutes from './routes/bookings.js';
import businessRoutes from './routes/business.js';
import adminRoutes from './routes/admin.js';

import { startNoShowDetectionJob, startSlotHoldExpiryJob } from './jobs/no-show-detection.js';
import { startDailyPayoutJob } from './jobs/payout.js';
import { startDailySummaryJob } from './jobs/daily-summary.js';
import { startReviewModerationJob } from './jobs/review-moderation.js';
import { startLoyaltyExpiryJob } from './jobs/loyalty-expiry.js';
import { startFeaturedExpiryJob } from './jobs/featured-expiry.js';
import { startPiiPurgeJob } from './jobs/pii-purge.js';
import { startNotificationWorker } from './workers/notification-worker.js';

const fastify = Fastify({
  logger:
    env.NODE_ENV === 'development'
      ? { level: 'debug', transport: { target: 'pino-pretty' } }
      : { level: 'info' },
});

async function buildApp() {
  // ── Security ───────────────────────────────────────────────

  await fastify.register(helmet, {
    contentSecurityPolicy: false, // Handled at CDN/API Gateway
  });

  const defaultProdOrigins = ['https://hagez.app', 'https://www.hagez.app'];
  const rawOrigins = env.NODE_ENV === 'production'
    ? (env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map((o) => o.trim()) : defaultProdOrigins)
    : null;

  // Each entry may be a literal origin ("https://hagez.app") or contain
  // "*" as a wildcard for any path segment ("https://*.vercel.app").
  const originMatchers: (string | RegExp)[] | true = rawOrigins
    ? rawOrigins.map((entry) => {
        if (entry.includes('*')) {
          const pattern =
            '^' + entry.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^.]+') + '$';
          return new RegExp(pattern);
        }
        return entry;
      })
    : true;

  await fastify.register(cors, {
    origin: originMatchers,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // ── Rate Limiting ──────────────────────────────────────────

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request) =>
      (request.user as any)?.sub ?? request.ip,
  });

  // ── Authentication ─────────────────────────────────────────

  await fastify.register(jwt, {
    secret: {
      private: env.JWT_ACCESS_SECRET,
      public: env.JWT_ACCESS_SECRET,
    },
  });

  // ── Infrastructure Plugins ─────────────────────────────────

  await fastify.register(databasePlugin);
  await fastify.register(redisPlugin);
  await fastify.register(authPlugin);
  await fastify.register(firebasePlugin);

  // ── Health Check (unauthenticated) ─────────────────────────

  fastify.get('/health', async () => ({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  }));

  // ── Global Error / Not-Found Handlers ──────────────────────
  //
  // MUST be registered BEFORE the route plugins below. `await
  // fastify.register(...)` builds each plugin's encapsulated context
  // immediately, and a context captures the error handler present at the
  // moment it is created — so setting the handler afterwards leaves every
  // already-registered route on Fastify's built-in handler instead.
  //
  // That was previously the case here (handlers were set after the six
  // register calls), with two consequences observed in production:
  //   1. Unhandled errors returned Fastify's default body, which includes the
  //      raw internal `message` — leaking Prisma/driver detail to callers
  //      rather than the generic text the handler is written to return.
  //   2. Schema validation rejections returned Fastify's shape
  //      ({statusCode, code: 'FST_ERR_VALIDATION', error, message}) instead of
  //      the app's {error:{code,message,message_ar}} envelope that every
  //      client parses, and echoed the internal schema pattern back.

  fastify.setErrorHandler(errorHandler);
  fastify.setNotFoundHandler(notFoundHandler);

  // ── API Routes (all prefixed with /v1) ─────────────────────

  await fastify.register(authRoutes, { prefix: '/v1' });
  await fastify.register(usersRoutes, { prefix: '/v1' });
  await fastify.register(searchRoutes, { prefix: '/v1' });
  await fastify.register(bookingRoutes, { prefix: '/v1' });
  await fastify.register(businessRoutes, { prefix: '/v1' });
  await fastify.register(adminRoutes, { prefix: '/v1' });

  return fastify;
}

// ── Start Server ───────────────────────────────────────────

async function start() {
  try {
    const app = await buildApp();
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`🚀 API server running on port ${env.PORT}`);
    app.log.info(`📡 Base URL: http://localhost:${env.PORT}/v1`);
    app.log.info(`❤️  Health check: http://localhost:${env.PORT}/health`);

    // Start background jobs
    const db = app.db;
    startNoShowDetectionJob(db);
    startSlotHoldExpiryJob(db);
    startDailyPayoutJob(db);           // US-036: 23:00 Africa/Cairo
    startDailySummaryJob(db);          // US-059: 09:00 Africa/Cairo daily email
    startReviewModerationJob(db);      // US-076: every 10 min — auto-approve / spam-reject reviews
    startLoyaltyExpiryJob(db);         // US-113 (EP-16): 02:00 Africa/Cairo — expire 18-month-old points
    startFeaturedExpiryJob(db);        // US-116 (EP-17): hourly — expire featured listings past end date
    startPiiPurgeJob(db);              // US-084 (EP-19): 1st of month 02:00 — PDPL 24-month PII purge
    startNotificationWorker(db);       // US-050: SQS notification delivery worker
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
