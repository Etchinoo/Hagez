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

const adminRoutes: FastifyPluginAsync = async (fastify) => {
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

  // ── POST /admin/disputes/:id/resolve ──────────────────────

  fastify.post<{
    Params: { id: string };
    Body: { resolution: 'uphold' | 'reverse' | 'partial'; refund_amount?: number; reason: string };
  }>(
    '/admin/disputes/:id/resolve',
    { preHandler: fastify.requireRole(['admin', 'super_admin']) },
    async (request, reply) => {
      const { id } = request.params;
      const { resolution, refund_amount, reason } = request.body;

      const booking = await fastify.db.booking.findUnique({ where: { id } });
      if (!booking || booking.status !== 'disputed') {
        return reply.code(404).send({
          error: { code: 'DISPUTE_NOT_FOUND', message: 'Dispute not found or already resolved.', message_ar: 'النزاع غير موجود أو تم حله بالفعل.' },
        });
      }

      let newStatus: string;
      let payoutTriggered = false;

      if (resolution === 'uphold') {
        // Ops upholds the no-show — business keeps the split
        newStatus = 'no_show';
        payoutTriggered = true;
      } else if (resolution === 'reverse') {
        // Ops reverses the charge — consumer gets full refund
        newStatus = 'completed';
        payoutTriggered = true;
      } else {
        // Partial — custom refund amount
        newStatus = 'completed';
        payoutTriggered = true;
      }

      await fastify.db.booking.update({
        where: { id },
        data: { status: newStatus as any },
      });

      fastify.log.info({ booking_id: id, resolution, reason, refund_amount }, 'Dispute resolved by admin');

      return reply.send({ dispute_id: id, resolution, payout_triggered: payoutTriggered });
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
