// ============================================================
// SUPER RESERVATION PLATFORM — Auth Routes
// POST /auth/otp/request
// POST /auth/otp/verify
// POST /auth/social
// POST /auth/refresh
// POST /auth/logout
// ============================================================

import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // ── POST /auth/otp/request ─────────────────────────────────

  fastify.post<{ Body: { phone: string } }>(
    '/auth/otp/request',
    async (request, reply) => {
      const { phone } = request.body;

      // US-085 (EP-20): OTP velocity throttle — max 3 requests per phone per 10 minutes
      const throttleKey = `OTP_THROTTLE:${phone}`;
      const currentCount = await fastify.redis.get(throttleKey);
      if (currentCount && parseInt(currentCount, 10) >= 3) {
        fastify.log.warn({ phone_hash: phone.slice(-4) }, '[otp-throttle] Rate limit exceeded');
        return reply.code(429).send({
          error: {
            code: 'OTP_THROTTLE',
            message: 'Too many OTP requests. Please wait before trying again.',
            message_ar: 'لقد تجاوزت الحد المسموح، يرجى الانتظار.',
            retry_after_seconds: await fastify.redis.ttl(throttleKey),
          },
        });
      }
      // Increment counter; set 600s TTL on first request (MULTI ensures atomicity)
      const pipeline = fastify.redis.multi();
      pipeline.incr(throttleKey);
      pipeline.expire(throttleKey, 600, 'NX'); // NX: only set TTL on first call
      await pipeline.exec();

      // Legacy hardcoded OTP — kept for backward compatibility with mobile app.
      // New clients should use POST /auth/firebase/verify (Firebase Phone Auth).
      const otp = '1111';
      const otpHash = await bcrypt.hash(otp, 10);
      const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_SECONDS * 1000);

      // Invalidate old OTPs for this phone
      await fastify.db.otpRequest.updateMany({
        where: { phone, used: false },
        data: { used: true },
      });

      await fastify.db.otpRequest.create({
        data: { phone, otp_hash: otpHash, expires_at: expiresAt },
      });

      // In development, log OTP to console (legacy endpoint — Firebase Phone Auth is preferred)
      if (env.NODE_ENV === 'development') {
        fastify.log.info({ phone, otp }, '📱 DEV OTP (do not log in production)');
      }

      return reply.send({ message: 'OTP sent' });
    }
  );

  // ── POST /auth/otp/verify ──────────────────────────────────

  fastify.post<{ Body: { phone: string; otp: string } }>(
    '/auth/otp/verify',
    async (request, reply) => {
      const { phone, otp } = request.body;

      const otpRecord = await fastify.db.otpRequest.findFirst({
        where: { phone, used: false, expires_at: { gt: new Date() } },
        orderBy: { created_at: 'desc' },
      });

      if (!otpRecord || !(await bcrypt.compare(otp, otpRecord.otp_hash))) {
        return reply.code(401).send({
          error: {
            code: 'INVALID_OTP',
            message: 'Invalid or expired OTP.',
            message_ar: 'الرمز المدخل غير صحيح أو منتهي الصلاحية.',
          },
        });
      }

      // Mark OTP as used
      await fastify.db.otpRequest.update({ where: { id: otpRecord.id }, data: { used: true } });

      // Find or create user
      let user = await fastify.db.user.findUnique({ where: { phone } });
      if (!user) {
        user = await fastify.db.user.create({
          data: { phone, full_name: phone, language_pref: 'ar' },
        });
      }

      // Attach business category for dashboard use
      const business = await fastify.db.business.findFirst({
        where: { owner_user_id: user.id },
        select: { category: true },
      });
      const userWithMeta = { ...user, business_category: business?.category ?? null };

      const accessToken = fastify.jwt.sign(
        { sub: user.id, phone: user.phone, role: user.role },
        { expiresIn: env.JWT_ACCESS_EXPIRY }
      );
      const refreshToken = fastify.jwt.sign(
        { sub: user.id, phone: user.phone, role: user.role },
        { expiresIn: env.JWT_REFRESH_EXPIRY }
      );

      return reply.send({ access_token: accessToken, refresh_token: refreshToken, user: userWithMeta });
    }
  );

  // ── POST /auth/firebase/verify ──────────────────────────────
  // Accepts a Firebase ID token (from client-side Phone Auth),
  // verifies it via Firebase Admin SDK, upserts the user, and
  // issues app JWTs.

  fastify.post<{ Body: { idToken: string; full_name?: string } }>(
    '/auth/firebase/verify',
    async (request, reply) => {
      const { idToken, full_name } = request.body;

      if (!idToken) {
        return reply.code(400).send({
          error: {
            code: 'MISSING_ID_TOKEN',
            message: 'Firebase ID token is required.',
            message_ar: 'رمز Firebase مطلوب.',
          },
        });
      }

      if (!fastify.firebaseAuth) {
        return reply.code(503).send({
          error: {
            code: 'FIREBASE_NOT_CONFIGURED',
            message: 'Firebase Auth is not configured on this server.',
            message_ar: 'خدمة Firebase غير مفعّلة على الخادم.',
          },
        });
      }

      let decodedToken;
      try {
        decodedToken = await fastify.firebaseAuth.verifyIdToken(idToken);
      } catch {
        return reply.code(401).send({
          error: {
            code: 'INVALID_FIREBASE_TOKEN',
            message: 'Firebase ID token is invalid or expired.',
            message_ar: 'رمز Firebase غير صالح أو منتهي الصلاحية.',
          },
        });
      }

      const phone = decodedToken.phone_number;
      if (!phone) {
        return reply.code(400).send({
          error: {
            code: 'NO_PHONE_IN_TOKEN',
            message: 'Firebase token does not contain a phone number.',
            message_ar: 'رمز Firebase لا يحتوي على رقم هاتف.',
          },
        });
      }

      // Upsert user by phone
      let user = await fastify.db.user.findUnique({ where: { phone } });
      const isNewUser = !user;
      if (!user) {
        user = await fastify.db.user.create({
          data: {
            phone,
            full_name: full_name ?? phone,
            language_pref: 'ar',
          },
        });
      } else if (full_name && isNewUser) {
        // full_name only applied for new users
        user = await fastify.db.user.update({
          where: { id: user.id },
          data: { full_name },
        });
      }

      // Attach business category for dashboard use
      const business = await fastify.db.business.findFirst({
        where: { owner_user_id: user.id },
        select: { category: true },
      });
      const userWithMeta = { ...user, business_category: business?.category ?? null };

      const accessToken = fastify.jwt.sign(
        { sub: user.id, phone: user.phone, role: user.role },
        { expiresIn: env.JWT_ACCESS_EXPIRY }
      );
      const refreshToken = fastify.jwt.sign(
        { sub: user.id, phone: user.phone, role: user.role },
        { expiresIn: env.JWT_REFRESH_EXPIRY }
      );

      return reply.send({ access_token: accessToken, refresh_token: refreshToken, user: userWithMeta });
    }
  );

  // ── POST /auth/social ─────────────────────────────────────
  // US-067: Apple Sign-In (provider='apple') and Google (provider='google').
  // Accepts the identity token returned by the native SDK.
  // TODO: In production, verify token signature using Apple/Google JWKS endpoints.
  // For dev, the JWT payload is decoded without signature verification.

  fastify.post<{ Body: { provider: 'apple' | 'google'; token: string } }>(
    '/auth/social',
    async (request, reply) => {
      const { provider, token } = request.body;

      // Decode JWT payload (base64url) — no signature check in dev
      let payload: Record<string, unknown>;
      try {
        const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
      } catch {
        return reply.code(400).send({
          error: { code: 'INVALID_SOCIAL_TOKEN', message: 'Could not decode identity token.' },
        });
      }

      const socialId = payload.sub as string;
      const email    = payload.email as string | undefined;

      if (!socialId) {
        return reply.code(400).send({
          error: { code: 'INVALID_SOCIAL_TOKEN', message: 'Identity token missing sub claim.' },
        });
      }

      // Find or create user keyed by social_id + provider
      let user = await fastify.db.user.findFirst({
        where: { social_id: socialId, social_provider: provider },
      });

      if (!user) {
        user = await fastify.db.user.create({
          data: {
            phone: `${provider}:${socialId}`,
            full_name: email ?? socialId,
            language_pref: 'ar',
            social_id: socialId,
            social_provider: provider,
          },
        });
      }

      const accessToken = fastify.jwt.sign(
        { sub: user.id, phone: user.phone, role: 'consumer' },
        { expiresIn: env.JWT_ACCESS_EXPIRY }
      );
      const refreshToken = fastify.jwt.sign(
        { sub: user.id, phone: user.phone, role: 'consumer' },
        { expiresIn: env.JWT_REFRESH_EXPIRY }
      );

      return reply.send({ access_token: accessToken, refresh_token: refreshToken, user });
    }
  );

  // ── POST /auth/refresh ─────────────────────────────────────

  fastify.post<{ Body: { refresh_token: string } }>(
    '/auth/refresh',
    async (request, reply) => {
      try {
        const payload = fastify.jwt.verify<{ sub: string; phone: string; role: string }>(
          request.body.refresh_token
        );
        const accessToken = fastify.jwt.sign(
          { sub: payload.sub, phone: payload.phone, role: payload.role },
          { expiresIn: env.JWT_ACCESS_EXPIRY }
        );
        return reply.send({ access_token: accessToken });
      } catch {
        return reply.code(401).send({
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Refresh token is invalid or expired.',
            message_ar: 'رمز التحديث غير صالح أو منتهي الصلاحية.',
          },
        });
      }
    }
  );

  // ── POST /auth/logout ──────────────────────────────────────

  fastify.post('/auth/logout', { preHandler: fastify.authenticate }, async (_request, reply) => {
    // Stateless JWT — client discards tokens.
    // For revocation: add token to Redis blocklist here.
    return reply.code(204).send();
  });
};

export default authRoutes;
