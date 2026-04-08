// ============================================================
// SUPER RESERVATION PLATFORM — User Profile Routes
// GET    /users/me                         — fetch profile
// PATCH  /users/me                         — update full_name, language_pref
// POST   /users/me/payment-token           — US-031: save Paymob card token
// DELETE /users/me/payment-token           — US-031: remove saved card
// PATCH  /users/me/notification-prefs      — US-046: update opt-outs
// GET    /users/me/loyalty                 — US-110: balance, tier, progress
// GET    /users/me/loyalty/history         — US-110: paginated transaction log
// POST   /users/me/privacy-accept          — US-081 (EP-19): record PDPL consent
// DELETE /users/me                         — US-082 (EP-19): PII erasure
// POST   /users/me/data-export             — US-083 (EP-19): queue data export
// GET    /users/me/data-export             — US-083 (EP-19): check export status
// ============================================================

import type { FastifyPluginAsync } from 'fastify';
import { buildLoyaltySummary } from '../services/loyalty.js';
import type { JwtAccessPayload } from '../types/index.js';

// Current published policy version — bump on any material change
const CURRENT_POLICY_VERSION = '1.0';

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
          loyalty_balance: true,
          loyalty_tier: true,
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

  // ── GET /users/me/loyalty (US-110) ────────────────────────
  // Returns balance, tier, progress to next tier, redemption value.

  fastify.get(
    '/users/me/loyalty',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { sub } = request.user as JwtAccessPayload;

      const user = await fastify.db.user.findUnique({
        where: { id: sub },
        select: { loyalty_balance: true, loyalty_tier: true },
      });

      if (!user) return reply.code(404).send({ error: { code: 'USER_NOT_FOUND' } });

      return reply.send(buildLoyaltySummary(user as any));
    }
  );

  // ── GET /users/me/loyalty/history (US-110) ────────────────
  // Paginated list of earn / redeem / expire transactions.

  fastify.get<{
    Querystring: { page?: string; limit?: string };
  }>(
    '/users/me/loyalty/history',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { sub } = request.user as JwtAccessPayload;
      const page  = Math.max(1, parseInt(request.query.page  ?? '1'));
      const limit = Math.min(50, Math.max(1, parseInt(request.query.limit ?? '20')));
      const offset = (page - 1) * limit;

      const [transactions, total] = await Promise.all([
        fastify.db.loyaltyPoint.findMany({
          where:   { user_id: sub },
          orderBy: { created_at: 'desc' },
          skip:    offset,
          take:    limit,
          select: {
            id: true,
            points: true,
            transaction_type: true,
            description_ar: true,
            expires_at: true,
            created_at: true,
            booking: {
              select: {
                booking_ref: true,
                business: { select: { name_ar: true, category: true } },
              },
            },
          },
        }),
        fastify.db.loyaltyPoint.count({ where: { user_id: sub } }),
      ]);

      return reply.send({
        transactions: transactions.map((t) => ({
          id: t.id,
          points: t.points,
          transaction_type: t.transaction_type,
          description_ar: t.description_ar,
          expires_at: t.expires_at?.toISOString() ?? null,
          created_at: t.created_at.toISOString(),
          booking_ref: t.booking?.booking_ref ?? null,
          business_name_ar: t.booking?.business?.name_ar ?? null,
          category: t.booking?.business?.category ?? null,
        })),
        total,
        page,
        has_more: offset + transactions.length < total,
      });
    }
  );

  // ── POST /users/me/privacy-accept (US-081, EP-19) ────────────
  // Records consumer consent to the current privacy policy version.
  // Re-called when policy_version changes (consumer is re-prompted on login).

  fastify.post<{ Body: { policy_version?: string }; Headers: { 'x-forwarded-for'?: string } }>(
    '/users/me/privacy-accept',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { sub } = request.user as JwtAccessPayload;
      const version   = request.body?.policy_version ?? CURRENT_POLICY_VERSION;
      const ipAddress = request.headers['x-forwarded-for']?.split(',')[0]?.trim()
        ?? (request.socket as any)?.remoteAddress
        ?? null;

      await fastify.db.$transaction([
        fastify.db.privacyPolicyAcceptance.create({
          data: { user_id: sub, policy_version: version, ip_address: ipAddress },
        }),
        fastify.db.user.update({
          where: { id: sub },
          data:  { privacy_accepted_version: version, privacy_accepted_at: new Date() },
        }),
      ]);

      return reply.send({
        accepted: true,
        policy_version: version,
        accepted_at: new Date().toISOString(),
        message_ar: 'تم قبول سياسة الخصوصية.',
      });
    }
  );

  // ── DELETE /users/me (US-082, EP-19) ─────────────────────────
  // PDPL 2020 Article 17 — right to erasure.
  // Nulls PII fields; retains anonymised booking history for audit.
  // Consumer must confirm with the word 'حذف'.

  fastify.delete<{ Body: { confirmation: string } }>(
    '/users/me',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { sub } = request.user as JwtAccessPayload;
      const { confirmation } = request.body ?? {};

      if (confirmation !== 'حذف') {
        return reply.code(400).send({
          error: {
            code: 'CONFIRMATION_REQUIRED',
            message: 'Type "حذف" to confirm account deletion.',
            message_ar: 'اكتب "حذف" لتأكيد حذف الحساب.',
          },
        });
      }

      const user = await fastify.db.user.findUnique({ where: { id: sub } });
      if (!user || user.status === 'deleted') {
        return reply.code(404).send({ error: { code: 'USER_NOT_FOUND', message_ar: 'المستخدم غير موجود.' } });
      }

      // Check for active bookings (no deletion with pending/confirmed bookings)
      const activeBookings = await fastify.db.booking.count({
        where: { consumer_id: sub, status: { in: ['pending_payment', 'confirmed'] } },
      });
      if (activeBookings > 0) {
        return reply.code(409).send({
          error: {
            code: 'ACTIVE_BOOKINGS',
            message_ar: 'لا يمكن حذف الحساب مع وجود حجوزات نشطة. يُرجى إلغاؤها أولاً.',
          },
        });
      }

      const now = new Date();
      const anonymisedPhone = `deleted_${sub.slice(0, 8)}`;

      // PII erasure — null/hash sensitive fields; retain booking skeleton for audit
      await fastify.db.$transaction([
        fastify.db.user.update({
          where: { id: sub },
          data: {
            phone:             anonymisedPhone,
            full_name:         'حساب محذوف',
            email:             null,
            profile_photo_url: null,
            paymob_card_token: null,
            fcm_token:         null,
            social_id:         null,
            status:            'deleted',
            deletion_requested_at: now,
          },
        }),
        // Null special_requests on all past bookings (PII)
        fastify.db.booking.updateMany({
          where:  { consumer_id: sub },
          data:   { special_requests: null },
        }),
        // Audit log
        fastify.db.auditLog.create({
          data: {
            actor_id:    sub,
            actor_type:  'consumer',
            action:      'account_deleted',
            target_type: 'user',
            target_id:   sub,
            metadata:    { reason: 'consumer_self_deletion', timestamp: now.toISOString() },
          },
        }),
      ]);

      return reply.send({
        deleted: true,
        message_ar: 'تم حذف حسابك وبياناتك الشخصية. تاريخ حجوزاتك محفوظ بشكل مجهول الهوية لأغراض المحاسبة.',
      });
    }
  );

  // ── POST /users/me/data-export (US-083, EP-19) ───────────────
  // PDPL 2020 Article 16 — right to access.
  // Queues an async data export. Max 1 request per 30 days.

  fastify.post(
    '/users/me/data-export',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { sub } = request.user as JwtAccessPayload;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const recentRequest = await fastify.db.dataExportRequest.findFirst({
        where: { user_id: sub, created_at: { gte: thirtyDaysAgo } },
        orderBy: { created_at: 'desc' },
      });

      if (recentRequest) {
        const nextAllowed = new Date(recentRequest.created_at.getTime() + 30 * 24 * 60 * 60 * 1000);
        return reply.code(429).send({
          error: {
            code:       'EXPORT_RATE_LIMITED',
            message_ar: 'يمكنك طلب تصدير بياناتك مرة واحدة كل ٣٠ يوماً.',
            next_allowed_at: nextAllowed.toISOString(),
          },
        });
      }

      const exportReq = await fastify.db.dataExportRequest.create({
        data: { user_id: sub, status: 'pending' },
      });

      // Fire-and-forget: process export asynchronously
      // In production this would enqueue to SQS; here we resolve inline for simplicity
      setImmediate(() => processDataExport(fastify.db, sub, exportReq.id).catch(console.error));

      return reply.code(202).send({
        request_id: exportReq.id,
        status:     'pending',
        message_ar: 'جاري إعداد ملف بياناتك. ستصلك رسالة واتساب خلال ٢٤ ساعة بمجرد الانتهاء.',
      });
    }
  );

  // ── GET /users/me/data-export (US-083, EP-19) ────────────────
  // Check status of most recent export request.

  fastify.get(
    '/users/me/data-export',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { sub } = request.user as JwtAccessPayload;

      const latest = await fastify.db.dataExportRequest.findFirst({
        where:   { user_id: sub },
        orderBy: { created_at: 'desc' },
      });

      if (!latest) {
        return reply.send({ has_request: false });
      }

      const isExpired = latest.expires_at && latest.expires_at < new Date();

      return reply.send({
        has_request:  true,
        request_id:   latest.id,
        status:       latest.status,
        download_url: isExpired ? null : latest.download_url,
        expires_at:   latest.expires_at?.toISOString() ?? null,
        created_at:   latest.created_at.toISOString(),
        is_expired:   !!isExpired,
      });
    }
  );
};

// ── Data export processor (US-083) ───────────────────────────
// Builds a JSON export of all user data. In production, uploads
// to S3 and generates a 48-hour presigned URL. Here we generate
// the payload and store as a download_url stub for the dev/test env.

async function processDataExport(
  db: any,
  userId: string,
  requestId: string
): Promise<void> {
  try {
    await db.dataExportRequest.update({
      where: { id: requestId },
      data:  { status: 'processing' },
    });

    const [user, bookings, reviews] = await Promise.all([
      db.user.findUnique({
        where:  { id: userId },
        select: { id: true, phone: true, full_name: true, email: true, created_at: true, loyalty_balance: true, loyalty_tier: true },
      }),
      db.booking.findMany({
        where:   { consumer_id: userId },
        select:  { id: true, booking_ref: true, status: true, created_at: true, deposit_amount: true, platform_fee: true },
        orderBy: { created_at: 'desc' },
      }),
      db.review.findMany({
        where:   { consumer_id: userId },
        select:  { rating: true, body: true, created_at: true },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    const exportPayload = {
      exported_at:  new Date().toISOString(),
      policy:       'PDPL 2020 — Article 16 Data Access Request',
      profile:      user,
      bookings,
      reviews,
    };

    // In production: upload JSON to S3, generate presigned URL
    // For dev: store payload reference inline
    const s3Key       = `exports/${userId}/${requestId}.json`;
    const expiresAt   = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const downloadUrl = `https://cdn.reservr.eg/${s3Key}?export_token=${requestId}`; // stub

    await db.dataExportRequest.update({
      where: { id: requestId },
      data: {
        status:       'completed',
        s3_key:       s3Key,
        download_url: downloadUrl,
        expires_at:   expiresAt,
        completed_at: new Date(),
        metadata:     { booking_count: bookings.length, review_count: reviews.length } as any,
      },
    });
  } catch (err: any) {
    await db.dataExportRequest.update({
      where: { id: requestId },
      data:  { status: 'failed', error_message: err?.message?.slice(0, 500) },
    });
  }
}

export default usersRoutes;
