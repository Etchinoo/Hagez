// ============================================================
// SUPER RESERVATION PLATFORM — Business Dashboard Routes
// GET  /business/bookings
// PATCH /business/bookings/:id/status
// POST /business/bookings (manual/walk-in)
// GET  /business/slots
// POST /business/slots/bulk
// PATCH /business/slots/:id/block
// GET  /business/analytics/summary
// ============================================================

import type { FastifyPluginAsync } from 'fastify';
import { cancelBooking } from '../services/booking-engine.js';
import { scheduleReviewPrompt } from '../services/notification.js';
import type { JwtAccessPayload } from '../types/index.js';

const businessRoutes: FastifyPluginAsync = async (fastify) => {
  // Helper: get the authenticated user's active business
  async function getAuthenticatedBusiness(userId: string) {
    return fastify.db.business.findFirst({
      where: { owner_user_id: userId, status: { in: ['active', 'pending'] } },
    });
  }

  // ── GET /business/bookings ─────────────────────────────────

  fastify.get<{ Querystring: { date?: string; view?: string } }>(
    '/business/bookings',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found for this account.', message_ar: 'لا يوجد نشاط تجاري مرتبط بهذا الحساب.' } });

      const { date, view = 'day' } = request.query;
      const baseDate = date ? new Date(date) : new Date();

      let startDate = baseDate;
      let endDate = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);

      if (view === 'week') {
        const dayOfWeek = baseDate.getDay();
        startDate = new Date(baseDate.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
        endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      }

      const bookings = await fastify.db.booking.findMany({
        where: {
          business_id: business.id,
          slot: { start_time: { gte: startDate, lt: endDate } },
          status: { notIn: ['expired'] },
        },
        include: {
          consumer: { select: { full_name: true, phone: true, no_show_count: true } },
          slot: true,
          resource: true,
        },
        orderBy: { slot: { start_time: 'asc' } },
      });

      return reply.send({ bookings });
    }
  );

  // ── PATCH /business/bookings/:id/status ───────────────────

  fastify.patch<{
    Params: { id: string };
    Body: { status: 'completed' | 'no_show' };
  }>(
    '/business/bookings/:id/status',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });

      const booking = await fastify.db.booking.findUnique({ where: { id: request.params.id } });
      if (!booking || booking.business_id !== business.id) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Booking not found.', message_ar: 'الحجز غير موجود.' } });
      }

      const { status } = request.body;
      const now = new Date();

      if (status === 'completed') {
        await fastify.db.booking.update({
          where: { id: booking.id },
          data: { status: 'completed', completed_at: now, escrow_status: 'released_to_business' },
        });
        // Schedule review prompt
        await scheduleReviewPrompt(fastify.db, booking.id);
        return reply.send({ booking_ref: booking.booking_ref, new_status: 'completed', payout_triggered: true });
      }

      if (status === 'no_show') {
        await fastify.db.booking.update({
          where: { id: booking.id },
          data: { status: 'no_show', no_show_detected_at: now },
        });
        return reply.send({ booking_ref: booking.booking_ref, new_status: 'no_show', payout_triggered: true });
      }

      return reply.code(400).send({ error: { code: 'INVALID_STATUS', message: 'Status must be "completed" or "no_show".', message_ar: 'الحالة يجب أن تكون "مكتمل" أو "غياب".' } });
    }
  );

  // ── POST /business/bookings (manual/walk-in) ───────────────

  fastify.post<{
    Body: {
      slot_id: string;
      consumer_name: string;
      consumer_phone: string;
      party_size?: number;
      deposit_waived?: boolean;
      special_requests?: string;
    };
  }>(
    '/business/bookings',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });

      const { slot_id, consumer_name, consumer_phone, party_size = 1, deposit_waived = true, special_requests } = request.body;

      // Find or create a placeholder consumer account
      let consumer = await fastify.db.user.findUnique({ where: { phone: consumer_phone } });
      if (!consumer) {
        consumer = await fastify.db.user.create({
          data: { phone: consumer_phone, full_name: consumer_name, language_pref: 'ar' },
        });
      }

      const slot = await fastify.db.slot.findUniqueOrThrow({ where: { id: slot_id } });

      // Generate booking ref
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const suffix = Math.random().toString(36).substring(2, 7).toUpperCase();
      const booking_ref = `BK-${date}-${suffix}`;

      const booking = await fastify.db.booking.create({
        data: {
          booking_ref,
          consumer_id: consumer.id,
          business_id: business.id,
          slot_id,
          party_size,
          special_requests: special_requests ?? null,
          status: 'confirmed',
          deposit_amount: deposit_waived ? 0 : slot.deposit_amount,
          platform_fee: 0,  // No platform fee for walk-ins
          escrow_status: 'holding',
        },
      });

      await fastify.db.slot.update({
        where: { id: slot_id },
        data: { booked_count: { increment: party_size } },
      });

      return reply.code(201).send({ booking_ref: booking.booking_ref });
    }
  );

  // ── GET /business/slots ────────────────────────────────────

  fastify.get<{ Querystring: { start?: string; end?: string } }>(
    '/business/slots',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });

      const { start, end } = request.query;
      const startDate = start ? new Date(start) : new Date();
      const endDate = end ? new Date(end) : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      const slots = await fastify.db.slot.findMany({
        where: { business_id: business.id, start_time: { gte: startDate, lt: endDate } },
        include: { resource: { select: { name_ar: true, name_en: true } } },
        orderBy: { start_time: 'asc' },
      });

      return reply.send({
        slots: slots.map((s) => ({
          ...s,
          available_capacity: s.capacity - s.booked_count,
          deposit_amount: Number(s.deposit_amount),
        })),
      });
    }
  );

  // ── POST /business/slots/bulk ──────────────────────────────

  fastify.post<{
    Body: {
      rules: Array<{
        day_of_week: number;
        open_time: string;   // e.g. "09:00"
        close_time: string;  // e.g. "22:00"
        slot_duration_min: number;
        capacity: number;
        deposit_amount?: number;
        weeks_ahead?: number;
      }>;
    };
  }>(
    '/business/slots/bulk',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });

      const { rules } = request.body;
      const slotsToCreate = [];
      const weeksAhead = rules[0]?.weeks_ahead ?? 4;

      for (const rule of rules) {
        const { day_of_week, open_time, close_time, slot_duration_min, capacity, deposit_amount = 0 } = rule;

        // Generate slots for `weeksAhead` weeks
        for (let week = 0; week < weeksAhead; week++) {
          const now = new Date();
          const dayOffset = (day_of_week - now.getDay() + 7) % 7 + week * 7;
          const slotDate = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);

          const [openH, openM] = open_time.split(':').map(Number);
          const [closeH, closeM] = close_time.split(':').map(Number);

          let currentMinutes = openH! * 60 + openM!;
          const closeMinutes = closeH! * 60 + closeM!;

          while (currentMinutes + slot_duration_min <= closeMinutes) {
            const startTime = new Date(slotDate);
            startTime.setHours(Math.floor(currentMinutes / 60), currentMinutes % 60, 0, 0);
            const endTime = new Date(startTime.getTime() + slot_duration_min * 60 * 1000);

            slotsToCreate.push({
              business_id: business.id,
              start_time: startTime,
              end_time: endTime,
              duration_minutes: slot_duration_min,
              capacity,
              deposit_amount,
              status: 'available' as const,
            });

            currentMinutes += slot_duration_min;
          }
        }
      }

      await fastify.db.slot.createMany({ data: slotsToCreate, skipDuplicates: true });

      return reply.code(201).send({ slots_created: slotsToCreate.length });
    }
  );

  // ── PATCH /business/slots/:id/block ───────────────────────

  fastify.patch<{ Params: { id: string }; Body: { reason?: string } }>(
    '/business/slots/:id/block',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      const slot = await fastify.db.slot.findUnique({ where: { id: request.params.id } });

      if (!slot || slot.business_id !== business?.id) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Slot not found.', message_ar: 'الوقت غير موجود.' } });
      }

      await fastify.db.slot.update({ where: { id: slot.id }, data: { status: 'blocked' } });
      return reply.send({ slot_id: slot.id, status: 'blocked' });
    }
  );

  // ── GET /business/analytics/summary ───────────────────────

  fastify.get<{ Querystring: { period?: string; month?: string } }>(
    '/business/analytics/summary',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });

      const { month } = request.query;
      const targetMonth = month ? new Date(month + '-01') : new Date();
      const startOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
      const endOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59);

      const bookings = await fastify.db.booking.findMany({
        where: {
          business_id: business.id,
          created_at: { gte: startOfMonth, lte: endOfMonth },
          status: { notIn: ['expired', 'pending_payment'] },
        },
      });

      const completed = bookings.filter((b) => b.status === 'completed');
      const noShows = bookings.filter((b) => b.status === 'no_show');
      const depositRevenue = noShows.reduce((sum, b) => sum + Number(b.deposit_amount) * 0.75, 0);
      const revenueProtected = noShows.reduce((sum, b) => sum + Number(b.deposit_amount), 0);

      return reply.send({
        period: `${targetMonth.getFullYear()}-${String(targetMonth.getMonth() + 1).padStart(2, '0')}`,
        bookings_total: bookings.length,
        bookings_confirmed: bookings.filter((b) => b.status === 'confirmed').length,
        bookings_completed: completed.length,
        bookings_cancelled: bookings.filter((b) => b.status.startsWith('cancelled')).length,
        bookings_no_show: noShows.length,
        deposit_revenue_egp: depositRevenue,
        no_shows_prevented: completed.filter((b) => Number(b.deposit_amount) > 0).length,
        revenue_protected_egp: revenueProtected,
        no_show_rate_pct: bookings.length > 0 ? Math.round((noShows.length / bookings.length) * 100) : 0,
      });
    }
  );
};

export default businessRoutes;
