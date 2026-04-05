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

      // Generate 6-digit OTP
      const otp = Array.from({ length: env.OTP_LENGTH }, () => Math.floor(Math.random() * 10)).join('');
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

      // TODO: Send OTP via Twilio SMS
      // In development, log OTP to console
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
