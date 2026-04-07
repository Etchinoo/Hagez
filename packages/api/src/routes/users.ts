// ============================================================
// SUPER RESERVATION PLATFORM — User Profile Routes
// GET  /users/me                          — fetch profile
// PATCH /users/me                         — update full_name, language_pref
// POST  /users/me/payment-token           — US-031: save Paymob card token
// DELETE /users/me/payment-token          — US-031: remove saved card
// PATCH /users/me/notification-prefs      — US-046: update opt-outs
// ============================================================

import type { FastifyPluginAsync } from 'fastify';
import type { JwtAccessPayload } from '../types/index.js';

const usersRoutes: FastifyPluginAsync = async (fastify) => {
  // ── GET /users/me ──────────────────────────────────────────

  fastify.get(
    '/users/me',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { sub } = request.user as JwtAccessPayload;

      const user = await fastify.db.user.findUnique({
        where: { id: sub },
        select: {
          id: true,
          phone: true,
          full_name: true,
          email: true,
          language_pref: true,
          profile_photo_url: true,
          no_show_count: true,
          deposit_mandatory: true,
          notify_whatsapp: true,
          notify_push: true,
          status: true,
          created_at: true,
        },
      });

      if (!user || user.status === 'deleted') {
        return reply.code(404).send({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found.',
            message_ar: 'المستخدم غير موجود.',
          },
        });
      }

      return reply.send(user);
    }
  );

  // ── PATCH /users/me ────────────────────────────────────────

  fastify.patch<{
    Body: { full_name?: string; language_pref?: string };
  }>(
    '/users/me',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { sub } = request.user as JwtAccessPayload;
      const { full_name, language_pref } = request.body;

      if (!full_name && !language_pref) {
        return reply.code(400).send({
          error: {
            code: 'NO_FIELDS_PROVIDED',
            message: 'Provide at least one field to update.',
            message_ar: 'يجب تقديم حقل واحد على الأقل للتحديث.',
          },
        });
      }

      const updated = await fastify.db.user.update({
        where: { id: sub },
        data: {
          ...(full_name ? { full_name } : {}),
          ...(language_pref ? { language_pref } : {}),
        },
        select: {
          id: true,
          phone: true,
          full_name: true,
          email: true,
          language_pref: true,
          profile_photo_url: true,
          no_show_count: true,
          deposit_mandatory: true,
        },
      });

      return reply.send(updated);
    }
  );

  // ── POST /users/me/payment-token (US-031) ──────────────────
  // Consumer opts in to card-on-file for no-show protection.
  // Paymob handles tokenisation on their side; we store the token ID only.

  fastify.post<{
    Body: { paymob_card_token: string };
  }>(
    '/users/me/payment-token',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { sub } = request.user as JwtAccessPayload;
      const { paymob_card_token } = request.body;

      if (!paymob_card_token || paymob_card_token.length < 8) {
        return reply.code(400).send({
          error: { code: 'INVALID_TOKEN', message: 'Invalid card token.', message_ar: 'رمز البطاقة غير صالح.' },
        });
      }

      await fastify.db.user.update({
        where: { id: sub },
        data: { paymob_card_token },
      });

      return reply.send({ card_on_file: true, message_ar: 'تم حفظ البطاقة بنجاح للحماية من الغياب.' });
    }
  );

  // ── DELETE /users/me/payment-token (US-031) ────────────────
  // Consumer removes their saved card.

  fastify.delete(
    '/users/me/payment-token',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { sub } = request.user as JwtAccessPayload;

      await fastify.db.user.update({
        where: { id: sub },
        data: { paymob_card_token: null },
      });

      return reply.send({ card_on_file: false, message_ar: 'تم إزالة البطاقة المحفوظة.' });
    }
  );

  // ── PATCH /users/me/notification-prefs (US-046) ────────────
  // Consumer updates WhatsApp / push notification opt-outs.

  fastify.patch<{
    Body: { notify_whatsapp?: boolean; notify_push?: boolean };
  }>(
    '/users/me/notification-prefs',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { sub } = request.user as JwtAccessPayload;
      const { notify_whatsapp, notify_push } = request.body;

      if (notify_whatsapp === undefined && notify_push === undefined) {
        return reply.code(400).send({
          error: { code: 'NO_FIELDS', message: 'Provide at least one preference to update.', message_ar: 'يجب تحديد إعداد واحد على الأقل.' },
        });
      }

      const updated = await fastify.db.user.update({
        where: { id: sub },
        data: {
          ...(notify_whatsapp !== undefined ? { notify_whatsapp } : {}),
          ...(notify_push !== undefined ? { notify_push } : {}),
        },
        select: { notify_whatsapp: true, notify_push: true },
      });

      return reply.send({ ...updated, message_ar: 'تم تحديث إعدادات الإشعارات.' });
    }
  );
};

export default usersRoutes;
