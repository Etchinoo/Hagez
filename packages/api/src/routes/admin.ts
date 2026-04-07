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

      return reply.send({ booking_id, refund_amount: amount_egp, status: 'pending' });
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
};

export default adminRoutes;
