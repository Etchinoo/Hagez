// ============================================================
// SUPER RESERVATION PLATFORM — Fastify API Entry Point
// Base URL: https://api.reservr.eg/v1
// Rate limits: 100 req/min (unauth) | 300 req/min (authed)
// ============================================================

import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';

import { env } from './config/env.js';
import databasePlugin from './plugins/database.js';
import redisPlugin from './plugins/redis.js';
import authPlugin from './plugins/auth.js';

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

  await fastify.register(cors, {
    origin: env.NODE_ENV === 'production'
      ? ['https://app.reservr.eg', 'https://dashboard.reservr.eg', 'https://admin.reservr.eg']
      : true,
    credentials: true,
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

  // ── Health Check (unauthenticated) ─────────────────────────

  fastify.get('/health', async () => ({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  }));

  // ── API Routes (all prefixed with /v1) ─────────────────────

  await fastify.register(authRoutes, { prefix: '/v1' });
  await fastify.register(usersRoutes, { prefix: '/v1' });
  await fastify.register(searchRoutes, { prefix: '/v1' });
  await fastify.register(bookingRoutes, { prefix: '/v1' });
  await fastify.register(businessRoutes, { prefix: '/v1' });
  await fastify.register(adminRoutes, { prefix: '/v1' });

  // ── Global Error Handler ───────────────────────────────────

  fastify.setErrorHandler((error: FastifyError, _request, reply) => {
    fastify.log.error(error);

    if (error.validation) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data.',
          message_ar: 'بيانات الطلب غير صحيحة.',
          details: error.validation,
        },
      });
    }

    return reply.code(error.statusCode ?? 500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
        message_ar: 'حدث خطأ غير متوقع.',
      },
    });
  });

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
