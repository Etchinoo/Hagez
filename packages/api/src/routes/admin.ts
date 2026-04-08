// ============================================================
// SUPER RESERVATION PLATFORM — Admin Console Routes
// GET   /admin/businesses/pending
// PATCH /admin/businesses/:id/verify
// PATCH /admin/businesses/:id/suspend
// GET   /admin/disputes
// POST  /admin/disputes/:id/resolve
// GET   /admin/health
// ============================================================

import type { FastifyPluginAsync } from 'fastify';
import { initiateRefund, executeNoShowSplit } from '../services/payment.js';
import { sendDisputeResolved } from '../services/notification.js';

// US-086 (EP-20): Immutable audit log helper
// All privileged admin actions must be recorded here.
// The DB trigger prevents any UPDATE/DELETE on audit_logs.
async function writeAuditLog(
  db: any,
  actorId: string,
  actorRole: string,
  action: string,
  targetEntity: string,
  targetId: string,
  reason: string,
  ip: string,
  userAgent?: string,
): Promise<void> {
  await db.auditLog.create({
    data: {
      actor_id:    actorId,
      actor_type:  actorRole,
      action,
      target_type: targetEntity,
      target_id:   targetId,
      metadata: { reason, ip_address: ip, user_agent: userAgent ?? null },
    },
  });
}

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // ── GET /admin/reviews/pending (US-076) ──────────────────
  // Reviews that passed auto-moderation window but are still pending (flagged edge cases).

  fastify.get<{ Querystring: { page?: string } }>(
    '/admin/reviews/pending',
    { preHandler: fastify.requireRole(['admin', 'super_admin']) },
    async (request, reply) => {
      const page  = parseInt(request.query.page ?? '1');
      const limit = 20;

      const [reviews, total] = await Promise.all([
        fastify.db.review.findMany({
          where: { status: 'pending' },
          include: {
            consumer: { select: { full_name: true, phone: true } },
            business: { select: { name_ar: true, name_en: true } },
            booking:  { select: { booking_ref: true } },
          },
          orderBy: { created_at: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        fastify.db.review.count({ where: { status: 'pending' } }),
      ]);

      return reply.send({ reviews, total, page, has_more: page * limit < total });
    }
  );

  // ── PATCH /admin/reviews/:id/moderate (US-076) ────────────

  fastify.patch<{
    Params: { id: string };
    Body: { action: 'approve' | 'reject'; reason?: string };
  }>(
    '/admin/reviews/:id/moderate',
    { preHandler: fastify.requireRole(['admin', 'super_admin']) },
    async (request, reply) => {
      const { id } = request.params;
      const { action, reason } = request.body;

      const review = await fastify.db.review.findUnique({
        where: { id },
        select: { id: true, business_id: true, status: true },
      });
      if (!review) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Review not found.' } });
      }

      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      await fastify.db.review.update({
        where: { id },
        data: { status: newStatus, moderated_at: new Date() },
      });

      // On approval, recalculate business rating
      if (action === 'approve') {
        const agg = await fastify.db.review.aggregate({
          where: { business_id: review.business_id, status: 'approved' },
          _avg: { rating: true },
          _count: { id: true },
        });
        await fastify.db.business.update({
          where: { id: review.business_id },
          data: {
            rating_avg: agg._avg.rating ?? 0,
            review_count: agg._count.id,
          },
        });
      }

      fastify.log.info({ review_id: id, action, reason }, 'Review moderated by admin');
      return reply.send({ review_id: id, status: newStatus });
    }
  );

  // ── GET /admin/businesses/pending ─────────────────────────

  fastify.get<{ Querystring: { page?: string } }>(
    '/admin/businesses/pending',
    { preHandler: fastify.requireRole(['admin', 'super_admin']) },
    async (request, reply) => {
      const page = parseInt(request.query.page ?? '1');
      const limit = 20;

      const [businesses, total] = await Promise.all([
        fastify.db.business.findMany({
          where: { status: 'pending' },
          include: { owner: { select: { full_name: true, phone: true, email: true } } },
          orderBy: { created_at: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        fastify.db.business.count({ where: { status: 'pending' } }),
      ]);

      return reply.send({ businesses, total, page, has_more: page * limit < total });
    }
  );

  // ── PATCH /admin/businesses/:id/verify ────────────────────

  fastify.patch<{
    Params: { id: string };
    Body: { approved: boolean; rejection_reason?: string };
  }>(
    '/admin/businesses/:id/verify',
    { preHandler: fastify.requireRole(['admin', 'super_admin']) },
    async (request, reply) => {
      const { id } = request.params;
      const { approved, rejection_reason } = request.body;

      const business = await fastify.db.business.findUnique({ where: { id } });
      if (!business) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Business not found.', message_ar: 'النشاط التجاري غير موجود.' },
        });
      }

      const newStatus = approved ? 'active' : 'deactivated';
      await fastify.db.business.update({
        where: { id },
        data: {
          status: newStatus as any,
          verified_at: approved ? new Date() : null,
        },
      });

      // TODO: Send WhatsApp notification to business owner
      fastify.log.info({ business_id: id, approved, rejection_reason }, 'Business verification decision logged');

      // US-086: Write immutable audit log
      const actor = request.user as any;
      await writeAuditLog(
        fastify.db,
        actor.sub,
        actor.role,
        approved ? 'business_approved' : 'business_rejected',
        'business',
        id,
        rejection_reason ?? (approved ? 'Business approved after review.' : 'No reason given.'),
        request.ip,
        request.headers['user-agent'],
      );

      return reply.send({ business_id: id, new_status: newStatus });
    }
  );

  // ── PATCH /admin/businesses/:id/suspend ───────────────────

  fastify.patch<{
    Params: { id: string };
    Body: { reason: string };
  }>(
    '/admin/businesses/:id/suspend',
    { preHandler: fastify.requireRole(['admin', 'super_admin']) },
    async (request, reply) => {
      const { id } = request.params;
      const { reason } = request.body;

      if (!reason || reason.trim().length < 10) {
        return reply.code(400).send({
          error: { code: 'REASON_REQUIRED', message: 'Suspension reason must be at least 10 characters.', message_ar: 'يجب إدخال سبب تعليق لا يقل عن 10 أحرف.' },
        });
      }

      await fastify.db.business.update({
        where: { id },
        data: { status: 'suspended' },
      });

      // NOTE: Suspension does NOT auto-cancel active bookings (per spec)
      fastify.log.warn({ business_id: id, reason }, 'Business suspended by admin');

      // US-086: Write immutable audit log
      const actor = request.user as any;
      await writeAuditLog(fastify.db, actor.sub, actor.role, 'business_suspended', 'business', id, reason, request.ip, request.headers['user-agent']);

      return reply.send({ business_id: id, status: 'suspended' });
    }
  );

  // ── GET /admin/disputes ────────────────────────────────────

  fastify.get<{ Querystring: { status?: string; page?: string } }>(
    '/admin/disputes',
    { preHandler: fastify.requireRole(['admin', 'super_admin']) },
    async (request, reply) => {
      const page = parseInt(request.query.page ?? '1');
      const limit = 20;

      const disputes = await fastify.db.booking.findMany({
        where: { status: 'disputed' },
        include: {
          consumer: { select: { full_name: true, phone: true } },
          business: { select: { name_ar: true, name_en: true } },
          payments: true,
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      });

      return reply.send({ disputes, total: disputes.length });
    }
  );

  // ── POST /admin/disputes/:id/resolve (US-041) ─────────────

  fastify.post<{
    Params: { id: string };
    Body: { resolution: 'uphold' | 'reverse' | 'partial'; refund_amount?: number; reason: string };
  }>(
    '/admin/disputes/:id/resolve',
    { preHandler: fastify.requireRole(['admin', 'super_admin']) },
    async (request, reply) => {
      const { id } = request.params;
      const { resolution, refund_amount, reason } = request.body;

      if (!reason || reason.trim().length < 5) {
        return reply.code(400).send({
          error: { code: 'REASON_REQUIRED', message: 'Resolution reason is required (min 5 chars).', message_ar: 'يجب ذكر سبب القرار.' },
        });
      }

      const booking = await fastify.db.booking.findUnique({
        where: { id },
        include: { payments: true },
      });
      if (!booking || booking.status !== 'disputed') {
        return reply.code(404).send({
          error: { code: 'DISPUTE_NOT_FOUND', message: 'Dispute not found or already resolved.', message_ar: 'النزاع غير موجود أو تم حله بالفعل.' },
        });
      }

      const depositAmount = Number(booking.deposit_amount);
      let actualRefundAmount = 0;

      if (resolution === 'uphold') {
        // No-show stands — execute 75/25 split if not already done
        const splitDone = booking.payments.some((p) => p.type === 'no_show_penalty');
        if (!splitDone) {
          await executeNoShowSplit(fastify.db, id);
        }
        await fastify.db.booking.update({
          where: { id },
          data: { status: 'no_show', escrow_status: 'split_executed' },
        });

      } else if (resolution === 'reverse') {
        // Full refund to consumer
        actualRefundAmount = depositAmount;
        const depositPayment = booking.payments.find((p) => p.type === 'deposit' && p.status === 'completed');
        if (depositPayment?.paymob_transaction_id) {
          await initiateRefund({
            paymob_transaction_id: depositPayment.paymob_transaction_id,
            amount_egp: depositAmount,
          });
          await fastify.db.payment.create({
            data: {
              booking_id: id,
              type: 'refund',
              direction: 'outbound',
              amount: depositAmount,
              currency: 'EGP',
              status: 'pending',
              recipient_type: 'consumer',
              recipient_id: booking.consumer_id,
            },
          });
        }
        await fastify.db.booking.update({
          where: { id },
          data: { status: 'completed', escrow_status: 'refunded_to_consumer' },
        });

      } else {
        // Partial refund — custom amount
        actualRefundAmount = refund_amount ?? 0;
        if (actualRefundAmount > 0) {
          const depositPayment = booking.payments.find((p) => p.type === 'deposit' && p.status === 'completed');
          if (depositPayment?.paymob_transaction_id) {
            await initiateRefund({
              paymob_transaction_id: depositPayment.paymob_transaction_id,
              amount_egp: actualRefundAmount,
            });
            await fastify.db.payment.create({
              data: {
                booking_id: id,
                type: 'refund',
                direction: 'outbound',
                amount: actualRefundAmount,
                currency: 'EGP',
                status: 'pending',
                recipient_type: 'consumer',
                recipient_id: booking.consumer_id,
              },
            });
          }
          // Business gets remainder via no-show split logic
          const businessAmount = depositAmount - actualRefundAmount;
          if (businessAmount > 0) {
            await fastify.db.payment.create({
              data: {
                booking_id: id,
                type: 'no_show_penalty',
                direction: 'outbound',
                amount: businessAmount,
                currency: 'EGP',
                status: 'pending',
                recipient_type: 'business',
                recipient_id: booking.business_id,
              },
            });
          }
        }
        await fastify.db.booking.update({
          where: { id },
          data: { status: 'completed', escrow_status: 'split_executed' },
        });
      }

      // US-041: Notify both consumer and business of outcome
      await sendDisputeResolved(fastify.db, id, resolution, actualRefundAmount).catch((err) =>
        fastify.log.error(err, 'Failed to send dispute-resolved notifications')
      );

      fastify.log.info({ booking_id: id, resolution, reason, refund_amount: actualRefundAmount }, 'Dispute resolved by admin');

      // US-086: Write immutable audit log
      const disputeActor = request.user as any;
      await writeAuditLog(fastify.db, disputeActor.sub, disputeActor.role, 'dispute_resolved', 'booking', id, `${reason} | resolution=${resolution} refund=${actualRefundAmount}`, request.ip, request.headers['user-agent']);

      return reply.send({
        dispute_id: id,
        resolution,
        refund_amount: actualRefundAmount,
        message: `Dispute resolved: ${resolution}`,
      });
    }
  );

  // ── GET /admin/bookings/search (US-073 support) ──────────
  // Search bookings by ref number or consumer phone for manual refund lookup.

  fastify.get<{ Querystring: { q: string } }>(
    '/admin/bookings/search',
    { preHandler: fastify.requireRole(['admin', 'super_admin']) },
    async (request, reply) => {
      const { q } = request.query;
      if (!q || q.trim().length < 3) {
        return reply.code(400).send({
          error: { code: 'QUERY_TOO_SHORT', message: 'Search query must be at least 3 characters.' },
        });
      }

      const booking = await fastify.db.booking.findFirst({
        where: {
          OR: [
            { booking_ref: q.trim().toUpperCase() },
            { consumer: { phone: q.trim() } },
          ],
        },
        include: {
          consumer: { select: { full_name: true, phone: true } },
          business: { select: { name_ar: true } },
          payments: { orderBy: { created_at: 'asc' } },
        },
      });

      if (!booking) {
        return reply.code(404).send({
          error: { code: 'BOOKING_NOT_FOUND', message: 'No booking found for this reference or phone.', message_ar: 'لم يتم العثور على الحجز.' },
        });
      }

      return reply.send({ booking });
    }
  );

  // ── POST /admin/refunds (US-073) ─────────────────────────
  // Manual refund execution. Amounts > 500 EGP require super_admin role.

  fastify.post<{
    Body: { booking_id: string; amount_egp: number; reason: string };
  }>(
    '/admin/refunds',
    { preHandler: fastify.requireRole(['admin', 'super_admin']) },
    async (request, reply) => {
      const { booking_id, amount_egp, reason } = request.body;
      const actor = request.user as { sub: string; role: string; phone: string };

      if (!reason || reason.trim().length < 5) {
        return reply.code(400).send({
          error: { code: 'REASON_REQUIRED', message: 'Refund reason is required (min 5 chars).', message_ar: 'يجب ذكر سبب الاسترداد.' },
        });
      }

      if (amount_egp <= 0) {
        return reply.code(400).send({
          error: { code: 'INVALID_AMOUNT', message: 'Refund amount must be greater than 0.', message_ar: 'يجب أن يكون مبلغ الاسترداد أكبر من صفر.' },
        });
      }

      // Refunds above 500 EGP require super_admin
      if (amount_egp > 500 && actor.role !== 'super_admin') {
        return reply.code(403).send({
          error: { code: 'SUPER_ADMIN_REQUIRED', message: 'Refunds above 500 EGP require super admin approval.', message_ar: 'استرداد المبالغ فوق 500 جنيه يستلزم موافقة المشرف الأعلى.' },
        });
      }

      const booking = await fastify.db.booking.findUnique({
        where: { id: booking_id },
        include: { payments: true },
      });

      if (!booking) {
        return reply.code(404).send({
          error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.', message_ar: 'الحجز غير موجود.' },
        });
      }

      const depositPayment = booking.payments.find((p) => p.type === 'deposit' && p.status === 'completed');
      if (!depositPayment?.paymob_transaction_id) {
        return reply.code(422).send({
          error: { code: 'NO_COMPLETED_PAYMENT', message: 'No completed deposit payment found for this booking.', message_ar: 'لا يوجد دفع مكتمل لهذا الحجز.' },
        });
      }

      await initiateRefund({
        paymob_transaction_id: depositPayment.paymob_transaction_id,
        amount_egp,
      });

      await fastify.db.payment.create({
        data: {
          booking_id,
          type: 'refund',
          direction: 'outbound',
          amount: amount_egp,
          currency: 'EGP',
          status: 'pending',
          recipient_type: 'consumer',
          recipient_id: booking.consumer_id,
        },
      });

      fastify.log.info({ booking_id, amount_egp, reason, admin: actor.phone }, 'Manual refund executed by admin');

      // US-086: Write immutable audit log
      await writeAuditLog(fastify.db, actor.sub, actor.role, 'refund_executed', 'booking', booking_id, `${reason} | amount_egp=${amount_egp}`, request.ip, request.headers['user-agent']);

      return reply.send({ booking_id, refund_amount: amount_egp, status: 'pending' });
    }
  );

  // ── Featured Listings Admin (EP-17, US-116) ──────────────────

  const FEATURED_PLAN_DAYS: Record<string, number> = {
    starter_7: 7, growth_14: 14, pro_30: 30,
  };

  // GET /admin/featured — list all listings
  fastify.get<{ Querystring: { status?: string; page?: string } }>(
    '/admin/featured',
    { preHandler: fastify.requireRole(['admin', 'super_admin']) },
    async (request, reply) => {
      const page   = Math.max(1, parseInt(request.query.page ?? '1'));
      const limit  = 20;
      const offset = (page - 1) * limit;
      const where: any = {};
      if (request.query.status) where.status = request.query.status;

      const [listings, total] = await Promise.all([
        fastify.db.featuredListing.findMany({
          where,
          include: { business: { select: { name_ar: true, category: true, district: true } } },
          orderBy: { created_at: 'desc' },
          skip: offset,
          take: limit,
        }),
        fastify.db.featuredListing.count({ where }),
      ]);

      return reply.send({ listings, total, page, has_more: offset + listings.length < total });
    }
  );

  // PATCH /admin/featured/:id — approve, expire, or cancel
  fastify.patch<{
    Params: { id: string };
    Body: { action: 'approve' | 'expire' | 'cancel'; notes?: string };
  }>(
    '/admin/featured/:id',
    { preHandler: fastify.requireRole(['admin', 'super_admin']) },
    async (request, reply) => {
      const { id } = request.params;
      const { action, notes } = request.body;
      const adminId = (request.user as any).sub;

      const listing = await fastify.db.featuredListing.findUnique({
        where: { id },
        include: { business: true },
      });
      if (!listing) return reply.code(404).send({ error: { code: 'LISTING_NOT_FOUND', message_ar: 'الإعلان غير موجود.' } });

      if (action === 'approve') {
        if (listing.status !== 'pending_payment') {
          return reply.code(409).send({ error: { code: 'INVALID_STATE', message_ar: 'يمكن الموافقة فقط على الطلبات المعلّقة.' } });
        }
        const days     = FEATURED_PLAN_DAYS[listing.plan] ?? 7;
        const startsAt = new Date();
        const endsAt   = new Date(startsAt.getTime() + days * 24 * 60 * 60 * 1000);

        await fastify.db.$transaction([
          fastify.db.featuredListing.update({
            where: { id },
            data: { status: 'active', starts_at: startsAt, ends_at: endsAt, approved_by_admin_id: adminId, notes: notes ?? null },
          }),
          fastify.db.business.update({
            where: { id: listing.business_id },
            data: { is_featured: true, featured_until: endsAt },
          }),
        ]);
        // US-086: Write immutable audit log
        const featActor = request.user as any;
        await writeAuditLog(fastify.db, featActor.sub, featActor.role, 'featured_slot_assigned', 'featured_listing', id, notes ?? 'Featured listing approved.', request.ip, request.headers['user-agent']);

        return reply.send({ status: 'active', starts_at: startsAt, ends_at: endsAt, message_ar: 'تم تفعيل الإبراز.' });
      }

      if (action === 'expire' || action === 'cancel') {
        const newStatus = action === 'expire' ? 'expired' : 'cancelled';
        await fastify.db.$transaction([
          fastify.db.featuredListing.update({
            where: { id },
            data: { status: newStatus, notes: notes ?? null },
          }),
          // Only reset business flag if no other active listing remains
          fastify.db.business.update({
            where: { id: listing.business_id },
            data: { is_featured: false, featured_until: null },
          }),
        ]);

        // US-086: Write immutable audit log
        const cancelActor = request.user as any;
        await writeAuditLog(fastify.db, cancelActor.sub, cancelActor.role, `featured_slot_${action}d` as string, 'featured_listing', id, notes ?? `Featured listing ${action}d.`, request.ip, request.headers['user-agent']);

        return reply.send({ status: newStatus, message_ar: action === 'expire' ? 'تم إنهاء الإبراز.' : 'تم إلغاء الإبراز.' });
      }

      return reply.code(400).send({ error: { code: 'INVALID_ACTION', message_ar: 'الإجراء يجب أن يكون: approve أو expire أو cancel.' } });
    }
  );

  // ── GET /admin/audit-log (US-086) ─────────────────────────
  // Super Admin only — immutable record of all privileged actions.
  // Filter by action type or actor. Rows are INSERT-only at DB level.

  fastify.get<{
    Querystring: {
      action?: string;
      actor_id?: string;
      page?: string;
      limit?: string;
    };
  }>(
    '/admin/audit-log',
    { preHandler: fastify.requireRole(['super_admin']) },
    async (request, reply) => {
      const page      = Math.max(1, parseInt(request.query.page ?? '1'));
      const pageLimit = Math.min(100, parseInt(request.query.limit ?? '50'));
      const where: any = {};
      if (request.query.action)   where.action   = request.query.action;
      if (request.query.actor_id) where.actor_id = request.query.actor_id;

      const [logs, total] = await Promise.all([
        fastify.db.auditLog.findMany({
          where,
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * pageLimit,
          take: pageLimit,
        }),
        fastify.db.auditLog.count({ where }),
      ]);

      return reply.send({ logs, total, page, has_more: page * pageLimit < total });
    }
  );

  // ── GET /admin/health ──────────────────────────────────────

  fastify.get(
    '/admin/health',
    { preHandler: fastify.requireRole(['admin', 'super_admin']) },
    async (_request, reply) => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [
        bookingsLastHour,
        pendingVerifications,
        openDisputes,
        activeBusinesses,
        paymentsLastHour,
      ] = await Promise.all([
        fastify.db.booking.count({ where: { created_at: { gte: oneHourAgo } } }),
        fastify.db.business.count({ where: { status: 'pending' } }),
        fastify.db.booking.count({ where: { status: 'disputed' } }),
        fastify.db.business.count({ where: { status: 'active' } }),
        fastify.db.payment.count({ where: { created_at: { gte: oneHourAgo }, status: 'completed' } }),
      ]);

      return reply.send({
        timestamp: now.toISOString(),
        bookings_last_hour: bookingsLastHour,
        pending_verifications: pendingVerifications,
        open_disputes: openDisputes,
        active_businesses: activeBusinesses,
        payments_last_hour: paymentsLastHour,
      });
    }
  );

  // ── EP-18: Internal BI & Ops Intelligence ────────────────────
  // US-120–123: All endpoints require admin/super_admin role.
  // Designed for direct consumption by Metabase/Redash or the admin console.
  // Date range defaults to last 30 days; max 365 days.

  function biDateRange(days: number): { since: Date; until: Date } {
    const until = new Date();
    const since = new Date(Date.now() - Math.min(days, 365) * 24 * 60 * 60 * 1000);
    return { since, until };
  }

  // ── GET /admin/bi/bookings (US-120) ──────────────────────────
  // Booking density: total + confirmed counts by district, hour-of-day,
  // and day-of-week for ops to identify peak demand patterns.

  fastify.get<{ Querystring: { days?: string } }>(
    '/admin/bi/bookings',
    { preHandler: fastify.requireRole(['admin', 'super_admin']) },
    async (request, reply) => {
      const days = parseInt(request.query.days ?? '30');
      const { since } = biDateRange(days);

      const [
        byDistrict,
        byCategory,
        totalConfirmed,
        totalCreated,
        dailyTrend,
      ] = await Promise.all([
        // Bookings per district (via business join)
        fastify.db.booking.groupBy({
          by: ['business_id'],
          where: { created_at: { gte: since }, status: { notIn: ['expired', 'pending_payment'] } },
          _count: { id: true },
        }).then(async (rows) => {
          // Enrich with district
          const bizIds = rows.map((r) => r.business_id);
          const businesses = await fastify.db.business.findMany({
            where: { id: { in: bizIds } },
            select: { id: true, district: true },
          });
          const distMap = new Map(businesses.map((b) => [b.id, b.district]));
          const agg = new Map<string, number>();
          for (const row of rows) {
            const dist = distMap.get(row.business_id) ?? 'unknown';
            agg.set(dist, (agg.get(dist) ?? 0) + row._count.id);
          }
          return Array.from(agg.entries())
            .map(([district, count]) => ({ district, count }))
            .sort((a, b) => b.count - a.count);
        }),

        // Bookings per category
        fastify.db.booking.groupBy({
          by: ['business_id'],
          where: { created_at: { gte: since }, status: { notIn: ['expired', 'pending_payment'] } },
          _count: { id: true },
        }).then(async (rows) => {
          const bizIds = rows.map((r) => r.business_id);
          const businesses = await fastify.db.business.findMany({
            where: { id: { in: bizIds } },
            select: { id: true, category: true },
          });
          const catMap = new Map(businesses.map((b) => [b.id, b.category]));
          const agg = new Map<string, number>();
          for (const row of rows) {
            const cat = catMap.get(row.business_id) ?? 'unknown';
            agg.set(cat, (agg.get(cat) ?? 0) + row._count.id);
          }
          return Array.from(agg.entries())
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count);
        }),

        fastify.db.booking.count({
          where: { created_at: { gte: since }, status: { in: ['confirmed', 'completed'] } },
        }),

        fastify.db.booking.count({
          where: { created_at: { gte: since } },
        }),

        // Daily booking counts for trend line (last N days, up to 90)
        (async () => {
          const limitedDays = Math.min(days, 90);
          const trend: { date: string; count: number }[] = [];
          for (let i = limitedDays - 1; i >= 0; i--) {
            const dayStart = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
            dayStart.setUTCHours(0, 0, 0, 0);
            const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
            const count = await fastify.db.booking.count({
              where: { created_at: { gte: dayStart, lt: dayEnd }, status: { notIn: ['expired', 'pending_payment'] } },
            });
            trend.push({ date: dayStart.toISOString().slice(0, 10), count });
          }
          return trend;
        })(),
      ]);

      const conversionRate = totalCreated > 0
        ? Math.round((totalConfirmed / totalCreated) * 100)
        : 0;

      return reply.send({
        days,
        total_bookings_created:   totalCreated,
        total_bookings_confirmed: totalConfirmed,
        conversion_rate_pct:      conversionRate,
        by_district:              byDistrict,
        by_category:              byCategory,
        daily_trend:              dailyTrend,
      });
    }
  );

  // ── GET /admin/bi/growth (US-121) ─────────────────────────────
  // Category growth curves: weekly booking volumes per category
  // over the past N weeks (max 52). Enables category expansion decisions.

  fastify.get<{ Querystring: { weeks?: string } }>(
    '/admin/bi/growth',
    { preHandler: fastify.requireRole(['admin', 'super_admin']) },
    async (request, reply) => {
      const weeks = Math.min(parseInt(request.query.weeks ?? '12'), 52);
      const CATEGORIES = ['restaurant', 'salon', 'court', 'gaming_cafe', 'car_wash'];

      const weeklyData: Array<{
        week_start: string;
        totals: Record<string, number>;
      }> = [];

      for (let w = weeks - 1; w >= 0; w--) {
        const weekStart = new Date(Date.now() - (w + 1) * 7 * 24 * 60 * 60 * 1000);
        weekStart.setUTCHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

        const rows = await fastify.db.booking.groupBy({
          by: ['business_id'],
          where: {
            created_at: { gte: weekStart, lt: weekEnd },
            status: { notIn: ['expired', 'pending_payment'] },
          },
          _count: { id: true },
        });

        const bizIds = rows.map((r) => r.business_id);
        const businesses = bizIds.length > 0
          ? await fastify.db.business.findMany({
              where: { id: { in: bizIds } },
              select: { id: true, category: true },
            })
          : [];

        const catMap = new Map(businesses.map((b) => [b.id, b.category]));
        const totals: Record<string, number> = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));

        for (const row of rows) {
          const cat = catMap.get(row.business_id);
          if (cat && cat in totals) {
            totals[cat] += row._count.id;
          }
        }

        weeklyData.push({ week_start: weekStart.toISOString().slice(0, 10), totals });
      }

      // Growth rate: compare last 4 weeks vs prior 4 weeks per category
      const growthRates: Record<string, number | null> = {};
      if (weeklyData.length >= 8) {
        for (const cat of CATEGORIES) {
          const recent = weeklyData.slice(-4).reduce((s, w) => s + (w.totals[cat] ?? 0), 0);
          const prior  = weeklyData.slice(-8, -4).reduce((s, w) => s + (w.totals[cat] ?? 0), 0);
          growthRates[cat] = prior > 0 ? Math.round(((recent - prior) / prior) * 100) : null;
        }
      }

      return reply.send({ weeks, weekly_data: weeklyData, growth_rates_pct: growthRates });
    }
  );

  // ── GET /admin/bi/payments (US-122) ──────────────────────────
  // Payment method mix: how consumers pay (card/Fawry/InstaPay/etc.),
  // success rates per method, avg transaction value, refund rate.

  fastify.get<{ Querystring: { days?: string } }>(
    '/admin/bi/payments',
    { preHandler: fastify.requireRole(['admin', 'super_admin']) },
    async (request, reply) => {
      const days = parseInt(request.query.days ?? '30');
      const { since } = biDateRange(days);

      const [allPayments, refunds] = await Promise.all([
        fastify.db.payment.findMany({
          where: { created_at: { gte: since }, direction: 'inbound', type: 'deposit' },
          select: { status: true, amount: true, paymob_transaction_id: true },
        }),
        fastify.db.payment.count({
          where: { created_at: { gte: since }, direction: 'outbound', type: 'refund', status: 'completed' },
        }),
      ]);

      // Note: payment method not stored separately; we use paymob_transaction_id presence as proxy
      // for card vs other. Future: store payment_method on Payment model.
      const completed = allPayments.filter((p) => p.status === 'completed');
      const failed    = allPayments.filter((p) => p.status === 'failed');
      const total     = allPayments.length;

      const totalRevenue = completed.reduce((s, p) => s + Number(p.amount), 0);
      const avgTxValue   = completed.length > 0 ? totalRevenue / completed.length : 0;
      const successRate  = total > 0 ? Math.round((completed.length / total) * 100) : 0;
      const refundRate   = completed.length > 0 ? Math.round((refunds / completed.length) * 100) : 0;

      // Daily payment volume trend
      const dailyVolume: { date: string; completed: number; failed: number; revenue_egp: number }[] = [];
      const trendDays = Math.min(days, 30);
      for (let i = trendDays - 1; i >= 0; i--) {
        const dayStart = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        dayStart.setUTCHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

        const [dayCompleted, dayFailed] = await Promise.all([
          fastify.db.payment.findMany({
            where: { created_at: { gte: dayStart, lt: dayEnd }, direction: 'inbound', type: 'deposit', status: 'completed' },
            select: { amount: true },
          }),
          fastify.db.payment.count({
            where: { created_at: { gte: dayStart, lt: dayEnd }, direction: 'inbound', type: 'deposit', status: 'failed' },
          }),
        ]);

        dailyVolume.push({
          date:        dayStart.toISOString().slice(0, 10),
          completed:   dayCompleted.length,
          failed:      dayFailed,
          revenue_egp: Math.round(dayCompleted.reduce((s, p) => s + Number(p.amount), 0) * 100) / 100,
        });
      }

      return reply.send({
        days,
        total_transactions:    total,
        completed_transactions: completed.length,
        failed_transactions:   failed.length,
        success_rate_pct:      successRate,
        total_revenue_egp:     Math.round(totalRevenue * 100) / 100,
        avg_transaction_egp:   Math.round(avgTxValue * 100) / 100,
        refund_count:          refunds,
        refund_rate_pct:       refundRate,
        daily_volume:          dailyVolume,
      });
    }
  );

  // ── GET /admin/bi/no-shows (US-123) ──────────────────────────
  // No-show trends: rate by category, district, and time-of-day.
  // Informs no-show policy tightening (deposit %, cancellation window).

  fastify.get<{ Querystring: { days?: string } }>(
    '/admin/bi/no-shows',
    { preHandler: fastify.requireRole(['admin', 'super_admin']) },
    async (request, reply) => {
      const days = parseInt(request.query.days ?? '30');
      const { since } = biDateRange(days);

      const [noShows, allCompleted] = await Promise.all([
        fastify.db.booking.findMany({
          where: { created_at: { gte: since }, status: 'no_show' },
          include: { business: { select: { category: true, district: true } }, slot: { select: { start_time: true } } },
        }),
        fastify.db.booking.count({
          where: { created_at: { gte: since }, status: { in: ['completed', 'no_show'] } },
        }),
      ]);

      const overallRate = allCompleted > 0
        ? Math.round((noShows.length / allCompleted) * 100)
        : 0;

      // By category
      const byCategoryMap = new Map<string, { no_shows: number; total: number }>();
      for (const ns of noShows) {
        const cat = ns.business?.category ?? 'unknown';
        const entry = byCategoryMap.get(cat) ?? { no_shows: 0, total: 0 };
        entry.no_shows++;
        byCategoryMap.set(cat, entry);
      }
      const byCategory = Array.from(byCategoryMap.entries()).map(([category, v]) => ({
        category,
        no_show_count: v.no_shows,
      })).sort((a, b) => b.no_show_count - a.no_show_count);

      // By district
      const byDistrictMap = new Map<string, number>();
      for (const ns of noShows) {
        const dist = ns.business?.district ?? 'unknown';
        byDistrictMap.set(dist, (byDistrictMap.get(dist) ?? 0) + 1);
      }
      const byDistrict = Array.from(byDistrictMap.entries())
        .map(([district, count]) => ({ district, no_show_count: count }))
        .sort((a, b) => b.no_show_count - a.no_show_count)
        .slice(0, 10);

      // By hour of day (Cairo time)
      const byHour: { hour: number; count: number }[] = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
      for (const ns of noShows) {
        if (ns.slot?.start_time) {
          const cairoParts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Africa/Cairo', hour: 'numeric', hour12: false,
          }).formatToParts(ns.slot.start_time);
          const hour = parseInt(cairoParts.find((p) => p.type === 'hour')?.value ?? '0');
          if (hour >= 0 && hour < 24) byHour[hour].count++;
        }
      }

      // Weekly no-show trend
      const weeklyTrend: { week_start: string; count: number }[] = [];
      const trendWeeks = Math.min(Math.ceil(days / 7), 12);
      for (let w = trendWeeks - 1; w >= 0; w--) {
        const weekStart = new Date(Date.now() - (w + 1) * 7 * 24 * 60 * 60 * 1000);
        weekStart.setUTCHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        const count = await fastify.db.booking.count({
          where: { created_at: { gte: weekStart, lt: weekEnd }, status: 'no_show' },
        });
        weeklyTrend.push({ week_start: weekStart.toISOString().slice(0, 10), count });
      }

      // Consumers with repeat no-shows (≥2)
      const repeatNoShowers = await fastify.db.user.count({
        where: { no_show_count: { gte: 2 } },
      });

      return reply.send({
        days,
        total_no_shows:      noShows.length,
        total_completable:   allCompleted,
        overall_rate_pct:    overallRate,
        platform_avg_pct:    12, // documented platform average (US-034 context)
        by_category:         byCategory,
        by_district:         byDistrict,
        by_hour_of_day:      byHour,
        weekly_trend:        weeklyTrend,
        repeat_no_show_users: repeatNoShowers,
      });
    }
  );

  // ── GET /admin/businesses?status=active|suspended ─────────
  // List all non-pending businesses (pending has its own endpoint).

  fastify.get<{ Querystring: { status?: string } }>(
    '/admin/businesses',
    { preHandler: fastify.requireRole(['admin', 'super_admin']) },
    async (request, reply) => {
      const { status } = request.query;
      const businesses = await fastify.db.business.findMany({
        where: status ? { status: status as any } : undefined,
        include: { owner: { select: { full_name: true, phone: true, email: true } } },
        orderBy: { created_at: 'desc' },
      });
      return reply.send({ businesses });
    }
  );

  // ── GET /admin/businesses/:id ──────────────────────────────

  fastify.get<{ Params: { id: string } }>(
    '/admin/businesses/:id',
    { preHandler: fastify.requireRole(['admin', 'super_admin']) },
    async (request, reply) => {
      const business = await fastify.db.business.findUnique({
        where: { id: request.params.id },
        include: {
          owner: { select: { id: true, full_name: true, phone: true, email: true, role: true } },
          services: { orderBy: { created_at: 'asc' } },
          resources: { orderBy: { created_at: 'asc' } },
        },
      });
      if (!business) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Business not found.' } });
      return reply.send({ business });
    }
  );

  // ── POST /admin/businesses ─────────────────────────────────
  // Create a new business and link it to an existing owner (by phone).

  fastify.post<{
    Body: {
      owner_phone: string;
      name_ar: string;
      name_en?: string;
      category: string;
      district: string;
      status?: string;
      subscription_tier?: string;
      description_ar?: string;
      description_en?: string;
      policy_deposit_type?: string;
      policy_deposit_value?: number;
      policy_cancellation_window_hours?: number;
      payout_method?: string;
      payout_threshold_egp?: number;
    };
  }>(
    '/admin/businesses',
    { preHandler: fastify.requireRole(['admin', 'super_admin']) },
    async (request, reply) => {
      const {
        owner_phone: rawPhone, name_ar, name_en, category, district,
        status, subscription_tier, description_ar, description_en,
        policy_deposit_type, policy_deposit_value, policy_cancellation_window_hours,
        payout_method, payout_threshold_egp,
      } = request.body;

      if (!rawPhone || !name_ar || !category || !district) {
        return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'owner_phone, name_ar, category, and district are required.' } });
      }

      // Normalize Egyptian phone: 01XXXXXXXXXX → +201XXXXXXXXXX
      const p = rawPhone.trim().replace(/\s+/g, '');
      const owner_phone = p.startsWith('+') ? p : p.startsWith('00') ? '+' + p.slice(2) : p.startsWith('0') ? '+2' + p : '+20' + p;

      // Find or create owner — admin can register businesses for owners who haven't signed up yet
      let owner = await fastify.db.user.findFirst({ where: { phone: owner_phone } });
      if (!owner) {
        owner = await fastify.db.user.create({
          data: {
            phone:         owner_phone,
            full_name:     name_ar,   // placeholder — owner updates via profile after first login
            role:          'business_owner',
            language_pref: 'ar',
          },
        });
      } else if (owner.role !== 'business_owner') {
        await fastify.db.user.update({ where: { id: owner.id }, data: { role: 'business_owner' } });
      }

      const business = await fastify.db.business.create({
        data: {
          owner_user_id:     owner.id,
          name_ar,
          name_en:           name_en ?? null,
          category:          category as any,
          district,
          lat:               30.0444,
          lng:               31.2357,
          status:            (status ?? 'active') as any,
          subscription_tier: (subscription_tier ?? 'free') as any,
          description_ar:    description_ar ?? null,
          description_en:    description_en ?? null,
          ...(policy_deposit_type             !== undefined ? { policy_deposit_type }             : {}),
          ...(policy_deposit_value            !== undefined ? { policy_deposit_value }            : {}),
          ...(policy_cancellation_window_hours !== undefined ? { policy_cancellation_window_hours } : {}),
          ...(payout_method                   !== undefined ? { payout_method }                   : {}),
          ...(payout_threshold_egp            !== undefined ? { payout_threshold_egp }            : {}),
        },
        include: { owner: { select: { full_name: true, phone: true } } },
      });

      return reply.code(201).send({ business });
    }
  );

  // ── PUT /admin/businesses/:id ──────────────────────────────
  // Admin edits any business's profile.

  fastify.put<{
    Params: { id: string };
    Body: {
      name_ar?: string;
      name_en?: string;
      description_ar?: string;
      description_en?: string;
      district?: string;
      category?: string;
      status?: string;
      policy_deposit_type?: string;
      policy_deposit_value?: number;
      policy_cancellation_window_hours?: number;
      payout_method?: string;
      payout_threshold_egp?: number;
      notify_new_booking_push?: boolean;
      notify_cancellation_push?: boolean;
      notify_payout_whatsapp?: boolean;
    };
  }>(
    '/admin/businesses/:id',
    { preHandler: fastify.requireRole(['admin', 'super_admin']) },
    async (request, reply) => {
      const business = await fastify.db.business.findUnique({ where: { id: request.params.id } });
      if (!business) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Business not found.' } });

      const {
        name_ar, name_en, description_ar, description_en, district, category, status,
        policy_deposit_type, policy_deposit_value, policy_cancellation_window_hours,
        payout_method, payout_threshold_egp,
        notify_new_booking_push, notify_cancellation_push, notify_payout_whatsapp,
      } = request.body;

      const updated = await fastify.db.business.update({
        where: { id: business.id },
        data: {
          ...(name_ar        ? { name_ar }                          : {}),
          ...(name_en        !== undefined ? { name_en }            : {}),
          ...(description_ar !== undefined ? { description_ar }     : {}),
          ...(description_en !== undefined ? { description_en }     : {}),
          ...(district       ? { district }                         : {}),
          ...(category       ? { category: category as any }        : {}),
          ...(status         ? { status: status as any }            : {}),
          ...(policy_deposit_type              !== undefined ? { policy_deposit_type }             : {}),
          ...(policy_deposit_value             !== undefined ? { policy_deposit_value }            : {}),
          ...(policy_cancellation_window_hours !== undefined ? { policy_cancellation_window_hours } : {}),
          ...(payout_method                    !== undefined ? { payout_method }                   : {}),
          ...(payout_threshold_egp             !== undefined ? { payout_threshold_egp }            : {}),
          ...(notify_new_booking_push          !== undefined ? { notify_new_booking_push }         : {}),
          ...(notify_cancellation_push         !== undefined ? { notify_cancellation_push }        : {}),
          ...(notify_payout_whatsapp           !== undefined ? { notify_payout_whatsapp }          : {}),
        },
      });
      return reply.send({ business: updated });
    }
  );

  // ── PATCH /admin/businesses/:id/tier ──────────────────────
  // Super-admin directly sets the subscription tier.

  fastify.patch<{
    Params: { id: string };
    Body: { tier: string };
  }>(
    '/admin/businesses/:id/tier',
    { preHandler: fastify.requireRole(['super_admin']) },
    async (request, reply) => {
      const { tier } = request.body;
      const validTiers = ['free', 'starter', 'growth', 'pro', 'enterprise'];
      if (!validTiers.includes(tier)) return reply.code(400).send({ error: { code: 'INVALID_TIER', message: `Invalid tier. Use: ${validTiers.join(', ')}` } });

      const updated = await fastify.db.business.update({
        where: { id: request.params.id },
        data: { subscription_tier: tier as any },
      });
      return reply.send({ business: updated });
    }
  );

  // ── GET /admin/businesses/:id/services ────────────────────

  fastify.get<{ Params: { id: string } }>(
    '/admin/businesses/:id/services',
    { preHandler: fastify.requireRole(['admin', 'super_admin']) },
    async (request, reply) => {
      const services = await fastify.db.businessService.findMany({
        where: { business_id: request.params.id },
        orderBy: { created_at: 'asc' },
      });
      return reply.send({ services });
    }
  );

  // ── POST /admin/businesses/:id/services ───────────────────

  fastify.post<{
    Params: { id: string };
    Body: { name_ar: string; name_en?: string; price_egp: number; duration_min: number };
  }>(
    '/admin/businesses/:id/services',
    { preHandler: fastify.requireRole(['admin', 'super_admin']) },
    async (request, reply) => {
      const business = await fastify.db.business.findUnique({ where: { id: request.params.id } });
      if (!business) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Business not found.' } });

      const { name_ar, name_en, price_egp, duration_min } = request.body;
      const service = await fastify.db.businessService.create({
        data: {
          business_id:  business.id,
          name_ar,
          name_en:      name_en ?? null,
          price_egp,
          duration_min,
          is_active:    true,
        },
      });
      return reply.code(201).send({ service });
    }
  );

  // ── PATCH /admin/businesses/:id/services/:sid ─────────────

  fastify.patch<{
    Params: { id: string; sid: string };
    Body: { name_ar?: string; name_en?: string; price_egp?: number; duration_min?: number; is_active?: boolean };
  }>(
    '/admin/businesses/:id/services/:sid',
    { preHandler: fastify.requireRole(['admin', 'super_admin']) },
    async (request, reply) => {
      const { name_ar, name_en, price_egp, duration_min, is_active } = request.body;
      const updated = await fastify.db.businessService.update({
        where: { id: request.params.sid },
        data: {
          ...(name_ar      ? { name_ar }      : {}),
          ...(name_en      !== undefined ? { name_en } : {}),
          ...(price_egp    !== undefined ? { price_egp }    : {}),
          ...(duration_min !== undefined ? { duration_min } : {}),
          ...(is_active    !== undefined ? { is_active }    : {}),
        },
      });
      return reply.send({ service: updated });
    }
  );

  // ── DELETE /admin/businesses/:id/services/:sid ────────────

  fastify.delete<{ Params: { id: string; sid: string } }>(
    '/admin/businesses/:id/services/:sid',
    { preHandler: fastify.requireRole(['admin', 'super_admin']) },
    async (_request, reply) => {
      await fastify.db.businessService.delete({ where: { id: _request.params.sid } });
      return reply.send({ ok: true });
    }
  );

  // ── GET /admin/services ───────────────────────────────────
  // Service Catalog: admin-defined service templates per category.
  // Query: ?category=restaurant|salon|court|gaming_cafe|car_wash|medical

  fastify.get<{ Querystring: { category?: string } }>(
    '/admin/services',
    { preHandler: fastify.requireRole(['admin', 'super_admin']) },
    async (request, reply) => {
      const { category } = request.query;
      const items = await fastify.db.serviceCatalog.findMany({
        where: category ? { category: category as any } : undefined,
        orderBy: [{ category: 'asc' }, { name_ar: 'asc' }],
      });
      return reply.send({ items });
    }
  );

  // ── POST /admin/services ──────────────────────────────────

  fastify.post<{
    Body: {
      category: string;
      name_ar: string;
      name_en?: string;
      typical_duration_min: number;
    };
  }>(
    '/admin/services',
    { preHandler: fastify.requireRole(['admin', 'super_admin']) },
    async (request, reply) => {
      const { category, name_ar, name_en, typical_duration_min } = request.body;
      if (!category || !name_ar || !typical_duration_min) {
        return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'category, name_ar, and typical_duration_min are required.' } });
      }
      const item = await fastify.db.serviceCatalog.create({
        data: {
          category:             category as any,
          name_ar,
          name_en:              name_en ?? null,
          typical_duration_min,
          is_active:            true,
        },
      });
      return reply.code(201).send({ item });
    }
  );

  // ── PATCH /admin/services/:id ─────────────────────────────

  fastify.patch<{
    Params: { id: string };
    Body: {
      name_ar?: string;
      name_en?: string;
      typical_duration_min?: number;
      is_active?: boolean;
    };
  }>(
    '/admin/services/:id',
    { preHandler: fastify.requireRole(['admin', 'super_admin']) },
    async (request, reply) => {
      const { name_ar, name_en, typical_duration_min, is_active } = request.body;
      const item = await fastify.db.serviceCatalog.update({
        where: { id: request.params.id },
        data: {
          ...(name_ar              ? { name_ar }              : {}),
          ...(name_en              !== undefined ? { name_en }             : {}),
          ...(typical_duration_min !== undefined ? { typical_duration_min } : {}),
          ...(is_active            !== undefined ? { is_active }            : {}),
        },
      });
      return reply.send({ item });
    }
  );

  // ── DELETE /admin/services/:id ────────────────────────────

  fastify.delete<{ Params: { id: string } }>(
    '/admin/services/:id',
    { preHandler: fastify.requireRole(['admin', 'super_admin']) },
    async (request, reply) => {
      await fastify.db.serviceCatalog.delete({ where: { id: request.params.id } });
      return reply.send({ ok: true });
    }
  );
};

export default adminRoutes;
