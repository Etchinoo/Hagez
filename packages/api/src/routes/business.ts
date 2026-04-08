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
import { scheduleReviewPrompt, sendCancellationConfirmed, sendPayoutFailedAlert } from '../services/notification.js';
import { initiateRefund } from '../services/payment.js';
import { annotateSlotPrices, getPricingAnalytics } from '../services/pricing-engine.js';
import { earnPoints } from '../services/loyalty.js';
import type { JwtAccessPayload } from '../types/index.js';
import { env } from '../config/env.js';

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
        const depositAmount = Number(booking.deposit_amount);

        await fastify.db.$transaction([
          fastify.db.booking.update({
            where: { id: booking.id },
            data: { status: 'completed', completed_at: now, escrow_status: 'released_to_business' },
          }),
          // US-030: Create pending payout record — picked up by daily payout job (US-036)
          ...(depositAmount > 0
            ? [fastify.db.payment.create({
                data: {
                  booking_id: booking.id,
                  type: 'deposit',
                  direction: 'outbound',
                  amount: depositAmount,
                  currency: 'EGP',
                  status: 'pending',
                  recipient_type: 'business',
                  recipient_id: booking.business_id,
                },
              })]
            : []),
        ]);

        // US-108 (EP-16): Award loyalty points via loyalty service (tier-aware, with expiry)
        await earnPoints(fastify.db, booking.consumer_id, booking.id, depositAmount, business.name_ar);

        // Schedule review prompt 2h after slot end
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

      // EP-14: annotate each slot with effective pricing
      const pricingMap = await annotateSlotPrices(fastify.db, business.id, slots);

      return reply.send({
        slots: slots.map((s) => {
          const pricing = pricingMap.get(s.id);
          return {
            ...s,
            available_capacity: s.capacity - s.booked_count,
            deposit_amount: Number(s.deposit_amount),
            effective_deposit: pricing?.effective_deposit ?? Number(s.deposit_amount),
            pricing_multiplier: pricing?.multiplier ?? 1.0,
            pricing_badge_ar: pricing?.badge_ar ?? null,
          };
        }),
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
  // ── PUT /business/policy (US-033) ─────────────────────────
  // Business owner sets their deposit + cancellation policy.
  // Changes apply to NEW slots only — existing bookings grandfathered.

  fastify.put<{
    Body: {
      deposit_type?: 'fixed' | 'percentage';
      deposit_value?: number;
      cancellation_window_hours?: number;
      payout_method?: 'bank_transfer' | 'paymob_wallet';
      payout_threshold_egp?: number;
      // US-049: notification preferences
      notify_new_booking_push?: boolean;
      notify_cancellation_push?: boolean;
      notify_payout_whatsapp?: boolean;
    };
  }>(
    '/business/policy',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });

      const {
        deposit_type, deposit_value, cancellation_window_hours, payout_method, payout_threshold_egp,
        notify_new_booking_push, notify_cancellation_push, notify_payout_whatsapp,
      } = request.body;

      if (deposit_type !== undefined && !['fixed', 'percentage'].includes(deposit_type)) {
        return reply.code(400).send({ error: { code: 'INVALID_DEPOSIT_TYPE', message: 'deposit_type must be "fixed" or "percentage".', message_ar: 'نوع العربون يجب أن يكون "fixed" أو "percentage".' } });
      }
      if (deposit_type === 'percentage' && deposit_value !== undefined && (deposit_value < 0 || deposit_value > 100)) {
        return reply.code(400).send({ error: { code: 'INVALID_DEPOSIT_VALUE', message: 'Percentage must be 0–100.', message_ar: 'النسبة المئوية يجب أن تكون بين 0 و 100.' } });
      }
      if (cancellation_window_hours !== undefined && (cancellation_window_hours < 0 || cancellation_window_hours > 168)) {
        return reply.code(400).send({ error: { code: 'INVALID_WINDOW', message: 'Cancellation window must be 0–168 hours.', message_ar: 'نافذة الإلغاء يجب أن تكون بين 0 و 168 ساعة.' } });
      }

      const updated = await fastify.db.business.update({
        where: { id: business.id },
        data: {
          ...(deposit_type !== undefined ? { policy_deposit_type: deposit_type } : {}),
          ...(deposit_value !== undefined ? { policy_deposit_value: deposit_value } : {}),
          ...(cancellation_window_hours !== undefined ? { policy_cancellation_window_hours: cancellation_window_hours } : {}),
          ...(payout_method !== undefined ? { payout_method } : {}),
          ...(payout_threshold_egp !== undefined ? { payout_threshold_egp } : {}),
          ...(notify_new_booking_push !== undefined ? { notify_new_booking_push } : {}),
          ...(notify_cancellation_push !== undefined ? { notify_cancellation_push } : {}),
          ...(notify_payout_whatsapp !== undefined ? { notify_payout_whatsapp } : {}),
        },
        select: {
          policy_deposit_type: true,
          policy_deposit_value: true,
          policy_cancellation_window_hours: true,
          payout_method: true,
          payout_threshold_egp: true,
          notify_new_booking_push: true,
          notify_cancellation_push: true,
          notify_payout_whatsapp: true,
        },
      });

      return reply.send({
        deposit_type: updated.policy_deposit_type,
        deposit_value: Number(updated.policy_deposit_value),
        cancellation_window_hours: updated.policy_cancellation_window_hours,
        payout_method: updated.payout_method,
        payout_threshold_egp: Number(updated.payout_threshold_egp),
        notify_new_booking_push: updated.notify_new_booking_push,
        notify_cancellation_push: updated.notify_cancellation_push,
        notify_payout_whatsapp: updated.notify_payout_whatsapp,
        policy_preview_ar: buildPolicyPreviewAr(
          updated.policy_deposit_type,
          Number(updated.policy_deposit_value),
          updated.policy_cancellation_window_hours
        ),
      });
    }
  );

  // ── GET /business/policy ───────────────────────────────────

  fastify.get(
    '/business/policy',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });

      return reply.send({
        deposit_type: business.policy_deposit_type,
        deposit_value: Number(business.policy_deposit_value),
        cancellation_window_hours: business.policy_cancellation_window_hours,
        payout_method: business.payout_method,
        payout_threshold_egp: Number(business.payout_threshold_egp),
        notify_new_booking_push: business.notify_new_booking_push,
        notify_cancellation_push: business.notify_cancellation_push,
        notify_payout_whatsapp: business.notify_payout_whatsapp,
        policy_preview_ar: buildPolicyPreviewAr(
          business.policy_deposit_type,
          Number(business.policy_deposit_value),
          business.policy_cancellation_window_hours
        ),
      });
    }
  );

  // ── PATCH /business/bookings/:id/notes (US-055) ───────────
  // Business owner adds/updates internal notes on a booking.

  fastify.patch<{
    Params: { id: string };
    Body: { internal_notes: string };
  }>(
    '/business/bookings/:id/notes',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });

      const booking = await fastify.db.booking.findUnique({ where: { id: request.params.id } });
      if (!booking || booking.business_id !== business.id) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Booking not found.', message_ar: 'الحجز غير موجود.' } });
      }

      const updated = await fastify.db.booking.update({
        where: { id: request.params.id },
        data: { internal_notes: request.body.internal_notes?.slice(0, 1000) ?? null },
        select: { id: true, internal_notes: true },
      });

      return reply.send(updated);
    }
  );

  // ── GET /business/staff (US-057) ──────────────────────────
  // Lists all staff members (Resources with type=staff).

  fastify.get(
    '/business/staff',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });

      const staff = await fastify.db.resource.findMany({
        where: { business_id: business.id, type: 'staff' },
        orderBy: { created_at: 'asc' },
      });

      return reply.send({ staff });
    }
  );

  // ── POST /business/staff (US-057) ─────────────────────────

  fastify.post<{
    Body: { name_ar: string; name_en?: string; specialisations?: string[]; photo_url?: string };
  }>(
    '/business/staff',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });

      const { name_ar, name_en, specialisations = [], photo_url } = request.body;
      if (!name_ar || name_ar.trim().length < 2) {
        return reply.code(400).send({ error: { code: 'INVALID_NAME', message: 'Staff name is required.', message_ar: 'اسم الموظف مطلوب.' } });
      }

      const staff = await fastify.db.resource.create({
        data: {
          business_id: business.id,
          type: 'staff',
          name_ar: name_ar.trim(),
          name_en: name_en?.trim() ?? null,
          specialisations,
          photo_url: photo_url ?? null,
          capacity: 1,
        },
      });

      return reply.code(201).send(staff);
    }
  );

  // ── PATCH /business/staff/:id (US-057) ────────────────────

  fastify.patch<{
    Params: { id: string };
    Body: { name_ar?: string; name_en?: string; specialisations?: string[]; photo_url?: string; is_active?: boolean };
  }>(
    '/business/staff/:id',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });

      const resource = await fastify.db.resource.findUnique({ where: { id: request.params.id } });
      if (!resource || resource.business_id !== business.id || resource.type !== 'staff') {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Staff member not found.', message_ar: 'الموظف غير موجود.' } });
      }

      const { name_ar, name_en, specialisations, photo_url, is_active } = request.body;
      const updated = await fastify.db.resource.update({
        where: { id: request.params.id },
        data: {
          ...(name_ar ? { name_ar } : {}),
          ...(name_en !== undefined ? { name_en } : {}),
          ...(specialisations !== undefined ? { specialisations } : {}),
          ...(photo_url !== undefined ? { photo_url } : {}),
          ...(is_active !== undefined ? { is_active } : {}),
        },
      });

      return reply.send(updated);
    }
  );

  // ── GET /business/services (US-058) ───────────────────────

  fastify.get(
    '/business/services',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });

      const services = await fastify.db.businessService.findMany({
        where: { business_id: business.id },
        orderBy: { created_at: 'asc' },
      });

      return reply.send({ services });
    }
  );

  // ── POST /business/services (US-058) ──────────────────────

  fastify.post<{
    Body: { name_ar: string; name_en?: string; price_egp: number; duration_min: number };
  }>(
    '/business/services',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });

      const { name_ar, name_en, price_egp, duration_min } = request.body;
      if (!name_ar || name_ar.trim().length < 2) {
        return reply.code(400).send({ error: { code: 'INVALID_NAME', message: 'Service name is required.', message_ar: 'اسم الخدمة مطلوب.' } });
      }

      const service = await fastify.db.businessService.create({
        data: {
          business_id: business.id,
          name_ar: name_ar.trim(),
          name_en: name_en?.trim() ?? null,
          price_egp,
          duration_min,
        },
      });

      return reply.code(201).send(service);
    }
  );

  // ── PATCH /business/services/:id (US-058) ─────────────────

  fastify.patch<{
    Params: { id: string };
    Body: { name_ar?: string; name_en?: string; price_egp?: number; duration_min?: number; is_active?: boolean };
  }>(
    '/business/services/:id',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });

      const service = await fastify.db.businessService.findUnique({ where: { id: request.params.id } });
      if (!service || service.business_id !== business.id) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Service not found.', message_ar: 'الخدمة غير موجودة.' } });
      }

      const { name_ar, name_en, price_egp, duration_min, is_active } = request.body;
      const updated = await fastify.db.businessService.update({
        where: { id: request.params.id },
        data: {
          ...(name_ar ? { name_ar } : {}),
          ...(name_en !== undefined ? { name_en } : {}),
          ...(price_egp !== undefined ? { price_egp } : {}),
          ...(duration_min !== undefined ? { duration_min } : {}),
          ...(is_active !== undefined ? { is_active } : {}),
        },
      });

      return reply.send(updated);
    }
  );

  // ── GET /business/sections (US-060) ───────────────────────

  fastify.get(
    '/business/sections',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });

      const sections = await fastify.db.businessSection.findMany({
        where: { business_id: business.id },
        orderBy: { created_at: 'asc' },
      });

      return reply.send({ sections });
    }
  );

  // ── POST /business/sections (US-060) ──────────────────────

  fastify.post<{
    Body: { name_ar: string; name_en?: string; capacity: number };
  }>(
    '/business/sections',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });

      const { name_ar, name_en, capacity } = request.body;
      const section = await fastify.db.businessSection.create({
        data: { business_id: business.id, name_ar, name_en: name_en ?? null, capacity },
      });

      return reply.code(201).send(section);
    }
  );

  // ── PATCH /business/sections/:id (US-060) ─────────────────

  fastify.patch<{
    Params: { id: string };
    Body: { name_ar?: string; name_en?: string; capacity?: number; is_active?: boolean };
  }>(
    '/business/sections/:id',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });

      const section = await fastify.db.businessSection.findUnique({ where: { id: request.params.id } });
      if (!section || section.business_id !== business.id) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Section not found.', message_ar: 'القسم غير موجود.' } });
      }

      const updated = await fastify.db.businessSection.update({
        where: { id: request.params.id },
        data: request.body,
      });

      return reply.send(updated);
    }
  );

  // ── GET /business/analytics/trend (US-054) ────────────────
  // 30-day daily booking counts for trend chart.

  fastify.get<{ Querystring: { days?: string } }>(
    '/business/analytics/trend',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });

      const days = Math.min(parseInt(request.query.days ?? '30'), 90);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const bookings = await fastify.db.booking.findMany({
        where: {
          business_id: business.id,
          created_at: { gte: since },
          status: { notIn: ['expired'] },
        },
        select: { created_at: true, status: true, deposit_amount: true },
        orderBy: { created_at: 'asc' },
      });

      // Bucket by date
      const buckets: Record<string, { date: string; bookings: number; revenue: number }> = {};
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().slice(0, 10);
        buckets[key] = { date: key, bookings: 0, revenue: 0 };
      }

      for (const b of bookings) {
        const key = b.created_at.toISOString().slice(0, 10);
        if (buckets[key]) {
          buckets[key].bookings++;
          if (b.status === 'completed' || b.status === 'no_show') {
            buckets[key].revenue += Number(b.deposit_amount);
          }
        }
      }

      return reply.send({ days, trend: Object.values(buckets) });
    }
  );

  // ── GET /business/pricing-rules (US-101) ─────────────────
  // List all pricing rules for the authenticated business.

  fastify.get(
    '/business/pricing-rules',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message_ar: 'لا يوجد نشاط تجاري.' } });

      const rules = await fastify.db.pricingRule.findMany({
        where: { business_id: business.id },
        orderBy: { created_at: 'asc' },
      });

      return reply.send({ rules });
    }
  );

  // ── POST /business/pricing-rules (US-101) ────────────────

  fastify.post<{
    Body: {
      rule_type: 'surge' | 'last_minute' | 'demand';
      name_ar: string;
      multiplier?: number;
      max_multiplier?: number;
      days_of_week?: number[];
      hour_start?: number;
      hour_end?: number;
      minutes_before?: number;
      discount_pct?: number;
      fill_rate_pct?: number;
    };
  }>(
    '/business/pricing-rules',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message_ar: 'لا يوجد نشاط تجاري.' } });

      const { rule_type, name_ar, multiplier, max_multiplier, days_of_week,
              hour_start, hour_end, minutes_before, discount_pct, fill_rate_pct } = request.body;

      if (!name_ar || !rule_type) {
        return reply.code(400).send({ error: { code: 'MISSING_FIELDS', message_ar: 'نوع القاعدة والاسم مطلوبان.' } });
      }

      if (rule_type === 'surge' && (!multiplier || multiplier < 1.0 || multiplier > 5.0)) {
        return reply.code(400).send({ error: { code: 'INVALID_MULTIPLIER', message_ar: 'معامل التسعير يجب أن يكون بين 1.0 و 5.0.' } });
      }

      if (rule_type === 'last_minute' && (!discount_pct || discount_pct <= 0 || discount_pct > 80)) {
        return reply.code(400).send({ error: { code: 'INVALID_DISCOUNT', message_ar: 'نسبة الخصم يجب أن تكون بين 1% و 80%.' } });
      }

      const rule = await fastify.db.pricingRule.create({
        data: {
          business_id: business.id,
          rule_type,
          name_ar,
          multiplier: multiplier ?? null,
          max_multiplier: max_multiplier ?? null,
          days_of_week: days_of_week ?? [],
          hour_start: hour_start ?? null,
          hour_end: hour_end ?? null,
          minutes_before: minutes_before ?? null,
          discount_pct: discount_pct ?? null,
          fill_rate_pct: fill_rate_pct ?? null,
        },
      });

      return reply.code(201).send(rule);
    }
  );

  // ── PATCH /business/pricing-rules/:id (US-101) ───────────

  fastify.patch<{
    Params: { id: string };
    Body: { is_active?: boolean; multiplier?: number; discount_pct?: number; name_ar?: string };
  }>(
    '/business/pricing-rules/:id',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message_ar: 'لا يوجد نشاط تجاري.' } });

      const rule = await fastify.db.pricingRule.findUnique({ where: { id: request.params.id } });
      if (!rule || rule.business_id !== business.id) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message_ar: 'القاعدة غير موجودة.' } });
      }

      const updated = await fastify.db.pricingRule.update({
        where: { id: request.params.id },
        data: request.body,
      });

      return reply.send(updated);
    }
  );

  // ── DELETE /business/pricing-rules/:id (US-101) ──────────

  fastify.delete<{ Params: { id: string } }>(
    '/business/pricing-rules/:id',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message_ar: 'لا يوجد نشاط تجاري.' } });

      const rule = await fastify.db.pricingRule.findUnique({ where: { id: request.params.id } });
      if (!rule || rule.business_id !== business.id) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message_ar: 'القاعدة غير موجودة.' } });
      }

      await fastify.db.pricingRule.update({
        where: { id: request.params.id },
        data: { is_active: false },   // soft delete — preserve audit trail
      });

      return reply.code(204).send();
    }
  );

  // ── GET /business/analytics/pricing (US-106) ─────────────
  // Revenue impact of dynamic pricing rules.

  fastify.get<{ Querystring: { days?: string } }>(
    '/business/analytics/pricing',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message_ar: 'لا يوجد نشاط تجاري.' } });

      const days = Math.min(parseInt(request.query.days ?? '30'), 90);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const analytics = await getPricingAnalytics(fastify.db, business.id, since);

      return reply.send({ days, ...analytics });
    }
  );

  // ── GET /business/analytics/loyalty (US-114) ─────────────────
  // Loyalty program stats from the business side:
  // how many confirmed bookings used points, redemption rate, avg points per booking.

  fastify.get<{ Querystring: { days?: string } }>(
    '/business/analytics/loyalty',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message_ar: 'لا يوجد نشاط تجاري.' } });

      const days = Math.min(parseInt(request.query.days ?? '30'), 90);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [bookingsWithPoints, totalConfirmed] = await Promise.all([
        fastify.db.booking.findMany({
          where: {
            business_id: business.id,
            created_at: { gte: since },
            status: { in: ['confirmed', 'completed'] },
            redeemed_points: { gt: 0 },
          },
          select: { redeemed_points: true, points_discount_egp: true },
        }),
        fastify.db.booking.count({
          where: {
            business_id: business.id,
            created_at: { gte: since },
            status: { in: ['confirmed', 'completed'] },
          },
        }),
      ]);

      const totalRedemptions      = bookingsWithPoints.length;
      const totalPointsRedeemed   = bookingsWithPoints.reduce((s, b) => s + b.redeemed_points, 0);
      const totalDiscountEgp      = bookingsWithPoints.reduce((s, b) => s + Number(b.points_discount_egp), 0);
      const redemptionRatePct     = totalConfirmed > 0 ? Math.round((totalRedemptions / totalConfirmed) * 100) : 0;
      const avgPointsPerRedemption = totalRedemptions > 0 ? Math.round(totalPointsRedeemed / totalRedemptions) : 0;

      return reply.send({
        days,
        total_confirmed_bookings: totalConfirmed,
        bookings_with_redemption: totalRedemptions,
        redemption_rate_pct:      redemptionRatePct,
        total_points_redeemed:    totalPointsRedeemed,
        total_discount_egp:       Math.round(totalDiscountEgp * 100) / 100,
        avg_points_per_redemption: avgPointsPerRedemption,
      });
    }
  );

  // ── GET /business/gaming-config (US-094) ─────────────────────
  // Returns the GamingConfig for the authenticated gaming cafe business.

  fastify.get(
    '/business/gaming-config',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });
      // Category guard removed — tab visibility is controlled by the frontend based on profile category.

      const config = await fastify.db.gamingConfig.findUnique({ where: { business_id: business.id } });
      return reply.send({ gaming_config: config });
    }
  );

  // ── PATCH /business/gaming-config (US-094) ───────────────────
  // Upsert GamingConfig — station types, group rooms, genre options, duration options.

  fastify.patch<{
    Body: {
      station_types?: string[];
      has_group_rooms?: boolean;
      group_room_capacity?: number;
      genre_options?: string[];
      slot_duration_options?: number[];
      default_slot_duration_minutes?: number;
    };
  }>(
    '/business/gaming-config',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });
      // Category guard removed — tab visibility is controlled by the frontend based on profile category.

      const { station_types, has_group_rooms, group_room_capacity, genre_options, slot_duration_options, default_slot_duration_minutes } = request.body;

      const config = await fastify.db.gamingConfig.upsert({
        where: { business_id: business.id },
        create: {
          business_id: business.id,
          station_types: station_types ?? [],
          has_group_rooms: has_group_rooms ?? false,
          group_room_capacity: group_room_capacity ?? 6,
          genre_options: genre_options ?? [],
          slot_duration_options: slot_duration_options ?? [60],
          default_slot_duration_minutes: default_slot_duration_minutes ?? 60,
        },
        update: {
          ...(station_types !== undefined ? { station_types } : {}),
          ...(has_group_rooms !== undefined ? { has_group_rooms } : {}),
          ...(group_room_capacity !== undefined ? { group_room_capacity } : {}),
          ...(genre_options !== undefined ? { genre_options } : {}),
          ...(slot_duration_options !== undefined ? { slot_duration_options } : {}),
          ...(default_slot_duration_minutes !== undefined ? { default_slot_duration_minutes } : {}),
        },
      });

      return reply.send({ gaming_config: config });
    }
  );

  // ── GET /business/stations (US-093) ───────────────────────────
  // Lists all station Resources for the authenticated gaming cafe.

  fastify.get(
    '/business/stations',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });
      // Category guard removed — tab visibility is controlled by the frontend based on profile category.

      const stations = await fastify.db.resource.findMany({
        where: { business_id: business.id, type: 'station' },
        orderBy: { created_at: 'asc' },
      });

      return reply.send({ stations });
    }
  );

  // ── POST /business/stations (US-093) ──────────────────────────
  // Creates a new station Resource.

  fastify.post<{
    Body: { name_ar: string; name_en?: string; station_type: string; capacity?: number };
  }>(
    '/business/stations',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });
      // Category guard removed — tab visibility is controlled by the frontend based on profile category.

      const { name_ar, name_en, station_type, capacity = 1 } = request.body;
      if (!name_ar?.trim()) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Arabic name is required.', message_ar: 'الاسم بالعربية مطلوب.' } });

      const station = await fastify.db.resource.create({
        data: {
          business_id: business.id,
          type: 'station',
          name_ar: name_ar.trim(),
          name_en: name_en?.trim() ?? null,
          capacity,
          specialisations: station_type ? [station_type] : [],
        },
      });

      return reply.code(201).send(station);
    }
  );

  // ── PATCH /business/stations/:id (US-093) ─────────────────────
  // Updates a station Resource.

  fastify.patch<{
    Params: { id: string };
    Body: { name_ar?: string; name_en?: string; capacity?: number; is_active?: boolean };
  }>(
    '/business/stations/:id',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });

      const station = await fastify.db.resource.findUnique({ where: { id: request.params.id } });
      if (!station || station.business_id !== business.id || station.type !== 'station') {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Station not found.', message_ar: 'المحطة غير موجودة.' } });
      }

      const { name_ar, name_en, capacity, is_active } = request.body;
      const updated = await fastify.db.resource.update({
        where: { id: request.params.id },
        data: {
          ...(name_ar ? { name_ar } : {}),
          ...(name_en !== undefined ? { name_en } : {}),
          ...(capacity !== undefined ? { capacity } : {}),
          ...(is_active !== undefined ? { is_active } : {}),
        },
      });

      return reply.send(updated);
    }
  );

  // ── GET /business/court-config (US-087) ──────────────────────
  // Returns the CourtConfig for the authenticated court business.

  fastify.get(
    '/business/court-config',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });
      // Category guard removed — tab visibility is controlled by the frontend based on profile category.

      const config = await fastify.db.courtConfig.findUnique({ where: { business_id: business.id } });
      return reply.send({ court_config: config });
    }
  );

  // ── PATCH /business/court-config (US-087) ──────────────────
  // Upsert CourtConfig — sport types, equipment, duration options, surface, lighting.

  fastify.patch<{
    Body: {
      sport_types?: string[];
      court_type?: string;
      surface_type?: string;
      has_lighting?: boolean;
      equipment_available?: string[];
      slot_duration_options?: number[];
      default_slot_duration_minutes?: number;
    };
  }>(
    '/business/court-config',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });
      // Category guard removed — tab visibility is controlled by the frontend based on profile category.

      const { sport_types, court_type, surface_type, has_lighting, equipment_available, slot_duration_options, default_slot_duration_minutes } = request.body;

      const config = await fastify.db.courtConfig.upsert({
        where: { business_id: business.id },
        create: {
          business_id: business.id,
          sport_types: sport_types ?? [],
          court_type: court_type ?? 'outdoor',
          surface_type: surface_type ?? null,
          has_lighting: has_lighting ?? false,
          equipment_available: equipment_available ?? [],
          slot_duration_options: slot_duration_options ?? [60],
          default_slot_duration_minutes: default_slot_duration_minutes ?? 60,
        },
        update: {
          ...(sport_types !== undefined ? { sport_types } : {}),
          ...(court_type !== undefined ? { court_type } : {}),
          ...(surface_type !== undefined ? { surface_type } : {}),
          ...(has_lighting !== undefined ? { has_lighting } : {}),
          ...(equipment_available !== undefined ? { equipment_available } : {}),
          ...(slot_duration_options !== undefined ? { slot_duration_options } : {}),
          ...(default_slot_duration_minutes !== undefined ? { default_slot_duration_minutes } : {}),
        },
      });

      return reply.send({ court_config: config });
    }
  );

  // ── GET /business/courts (US-086) ─────────────────────────
  // Lists all court Resources for the authenticated court business.

  fastify.get(
    '/business/courts',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });
      // Category guard removed — tab visibility is controlled by the frontend based on profile category.

      const courts = await fastify.db.resource.findMany({
        where: { business_id: business.id, type: 'court' },
        orderBy: { created_at: 'asc' },
      });

      return reply.send({ courts });
    }
  );

  // ── POST /business/courts (US-086) ────────────────────────
  // Creates a new court Resource.

  fastify.post<{
    Body: { name_ar: string; name_en?: string; capacity?: number };
  }>(
    '/business/courts',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });
      // Category guard removed — tab visibility is controlled by the frontend based on profile category.

      const { name_ar, name_en, capacity = 1 } = request.body;
      if (!name_ar?.trim()) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Arabic name is required.', message_ar: 'الاسم بالعربية مطلوب.' } });

      const court = await fastify.db.resource.create({
        data: {
          business_id: business.id,
          type: 'court',
          name_ar: name_ar.trim(),
          name_en: name_en?.trim() ?? null,
          capacity,
        },
      });

      return reply.code(201).send(court);
    }
  );

  // ── PATCH /business/courts/:id (US-086) ───────────────────
  // Updates a court Resource (name, capacity, active status).

  fastify.patch<{
    Params: { id: string };
    Body: { name_ar?: string; name_en?: string; capacity?: number; is_active?: boolean };
  }>(
    '/business/courts/:id',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });

      const court = await fastify.db.resource.findUnique({ where: { id: request.params.id } });
      if (!court || court.business_id !== business.id || court.type !== 'court') {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Court not found.', message_ar: 'الملعب غير موجود.' } });
      }

      const { name_ar, name_en, capacity, is_active } = request.body;
      const updated = await fastify.db.resource.update({
        where: { id: request.params.id },
        data: {
          ...(name_ar ? { name_ar } : {}),
          ...(name_en !== undefined ? { name_en } : {}),
          ...(capacity !== undefined ? { capacity } : {}),
          ...(is_active !== undefined ? { is_active } : {}),
        },
      });

      return reply.send(updated);
    }
  );

  // ── GET /business/car-wash-config (US-101) ─────────────────
  // Returns CarWashConfig for the authenticated car_wash business.

  fastify.get(
    '/business/car-wash-config',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });
      // Category guard removed — tab visibility is controlled by the frontend based on profile category.

      const config = await fastify.db.carWashConfig.findUnique({ where: { business_id: business.id } });
      return reply.send({ car_wash_config: config });
    }
  );

  // ── PATCH /business/car-wash-config (US-101) ───────────────
  // Upserts CarWashConfig for the authenticated car_wash business.

  fastify.patch<{
    Body: {
      vehicle_types?: string[];
      service_packages?: object;
      allows_drop_off?: boolean;
      allows_wait?: boolean;
      estimated_duration_minutes?: number;
      slot_duration_options?: number[];
      default_slot_duration_minutes?: number;
    };
  }>(
    '/business/car-wash-config',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });
      // Category guard removed — tab visibility is controlled by the frontend based on profile category.

      const {
        vehicle_types, service_packages, allows_drop_off, allows_wait,
        estimated_duration_minutes, slot_duration_options, default_slot_duration_minutes,
      } = request.body;

      const config = await fastify.db.carWashConfig.upsert({
        where: { business_id: business.id },
        create: {
          business_id: business.id,
          vehicle_types:                vehicle_types ?? [],
          service_packages:             service_packages ?? [],
          allows_drop_off:              allows_drop_off ?? true,
          allows_wait:                  allows_wait ?? true,
          estimated_duration_minutes:   estimated_duration_minutes ?? 30,
          slot_duration_options:        slot_duration_options ?? [],
          default_slot_duration_minutes: default_slot_duration_minutes ?? 30,
        },
        update: {
          ...(vehicle_types !== undefined                ? { vehicle_types } : {}),
          ...(service_packages !== undefined             ? { service_packages } : {}),
          ...(allows_drop_off !== undefined              ? { allows_drop_off } : {}),
          ...(allows_wait !== undefined                  ? { allows_wait } : {}),
          ...(estimated_duration_minutes !== undefined   ? { estimated_duration_minutes } : {}),
          ...(slot_duration_options !== undefined        ? { slot_duration_options } : {}),
          ...(default_slot_duration_minutes !== undefined ? { default_slot_duration_minutes } : {}),
        },
      });

      return reply.send({ car_wash_config: config });
    }
  );

  // ── GET /business/bays (US-100) ────────────────────────────
  // Lists bay Resources for the authenticated car_wash business.

  fastify.get(
    '/business/bays',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });
      // Category guard removed — tab visibility is controlled by the frontend based on profile category.

      const bays = await fastify.db.resource.findMany({
        where: { business_id: business.id, type: 'bay' },
        orderBy: { created_at: 'asc' },
      });

      return reply.send({ bays });
    }
  );

  // ── POST /business/bays (US-100) ───────────────────────────
  // Creates a new bay Resource for the authenticated car_wash business.

  fastify.post<{
    Body: { name_ar: string; name_en?: string; capacity?: number };
  }>(
    '/business/bays',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });
      // Category guard removed — tab visibility is controlled by the frontend based on profile category.

      const { name_ar, name_en, capacity = 1 } = request.body;
      if (!name_ar?.trim()) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'name_ar is required.', message_ar: 'الاسم العربي مطلوب.' } });

      const bay = await fastify.db.resource.create({
        data: {
          business_id: business.id,
          type: 'bay',
          name_ar,
          name_en: name_en ?? null,
          capacity,
          is_active: true,
        },
      });

      return reply.code(201).send(bay);
    }
  );

  // ── PATCH /business/bays/:id (US-100) ──────────────────────
  // Updates a bay Resource (name, capacity, active status).

  fastify.patch<{
    Params: { id: string };
    Body: { name_ar?: string; name_en?: string; capacity?: number; is_active?: boolean };
  }>(
    '/business/bays/:id',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });

      const bay = await fastify.db.resource.findUnique({ where: { id: request.params.id } });
      if (!bay || bay.business_id !== business.id || bay.type !== 'bay') {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Bay not found.', message_ar: 'البيه غير موجود.' } });
      }

      const { name_ar, name_en, capacity, is_active } = request.body;
      const updated = await fastify.db.resource.update({
        where: { id: request.params.id },
        data: {
          ...(name_ar ? { name_ar } : {}),
          ...(name_en !== undefined ? { name_en } : {}),
          ...(capacity !== undefined ? { capacity } : {}),
          ...(is_active !== undefined ? { is_active } : {}),
        },
      });

      return reply.send(updated);
    }
  );

  // ── Featured Listings (EP-17, US-116) ────────────────────────

  const FEATURED_PLANS = {
    starter_7:  { days: 7,  price_egp: 299 },
    growth_14:  { days: 14, price_egp: 499 },
    pro_30:     { days: 30, price_egp: 799 },
  } as const;

  // GET /business/featured — current listing status
  fastify.get(
    '/business/featured',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message_ar: 'لا يوجد نشاط تجاري.' } });

      const active = await fastify.db.featuredListing.findFirst({
        where: { business_id: business.id, status: 'active' },
        orderBy: { ends_at: 'desc' },
      });

      const history = await fastify.db.featuredListing.findMany({
        where: { business_id: business.id },
        orderBy: { created_at: 'desc' },
        take: 10,
      });

      return reply.send({
        is_featured:     business.is_featured,
        featured_until:  business.featured_until?.toISOString() ?? null,
        active_listing:  active ?? null,
        plans:           FEATURED_PLANS,
        history,
      });
    }
  );

  // POST /business/featured — submit a featured placement request
  fastify.post<{ Body: { plan: 'starter_7' | 'growth_14' | 'pro_30' } }>(
    '/business/featured',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message_ar: 'لا يوجد نشاط تجاري.' } });

      const { plan } = request.body;
      if (!FEATURED_PLANS[plan]) {
        return reply.code(400).send({ error: { code: 'INVALID_PLAN', message_ar: 'الخطة غير صالحة. اختر: starter_7 أو growth_14 أو pro_30.' } });
      }

      // Block if already has an active listing
      const existing = await fastify.db.featuredListing.findFirst({
        where: { business_id: business.id, status: { in: ['active', 'pending_payment'] } },
      });
      if (existing) {
        return reply.code(409).send({ error: { code: 'ALREADY_FEATURED', message_ar: 'لديك بالفعل خطة مميزة نشطة أو قيد المراجعة.' } });
      }

      const listing = await fastify.db.featuredListing.create({
        data: {
          business_id: business.id,
          plan,
          price_egp:   FEATURED_PLANS[plan].price_egp,
          status:      'pending_payment',
        },
      });

      return reply.code(201).send({
        listing_id:  listing.id,
        plan,
        price_egp:   FEATURED_PLANS[plan].price_egp,
        days:        FEATURED_PLANS[plan].days,
        status:      'pending_payment',
        message_ar:  'تم إرسال طلب الإبراز. سيتم مراجعته من قِبل الفريق.',
      });
    }
  );

  // ── EP-21: GET /car-wash/vehicle-types ─────────────────────
  // Reference data for car wash checkout Step 1 vehicle picker.
  // Public (unauthenticated) — non-sensitive reference data.
  fastify.get(
    '/car-wash/vehicle-types',
    async (_request, reply) => {
      const vehicleTypes = await fastify.db.vehicleType.findMany({
        orderBy: { name_en: 'asc' },
      });
      return reply.send({ vehicle_types: vehicleTypes });
    }
  );

  // ── GET /business/profile ──────────────────────────────────

  fastify.get(
    '/business/profile',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await fastify.db.business.findFirst({
        where: { owner_user_id: user.sub },
      });
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.' } });

      const owner = await fastify.db.user.findUnique({
        where: { id: user.sub },
        select: { full_name: true, phone: true },
      });

      return reply.send({ business, owner });
    }
  );

  // ── PUT /business/profile ──────────────────────────────────

  fastify.put<{
    Body: {
      name_ar?: string;
      name_en?: string;
      description_ar?: string;
      description_en?: string;
      district?: string;
      category?: string;
    };
  }>(
    '/business/profile',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await fastify.db.business.findFirst({
        where: { owner_user_id: user.sub },
      });
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.' } });

      const { name_ar, name_en, description_ar, description_en, district, category } = request.body;

      const updated = await fastify.db.business.update({
        where: { id: business.id },
        data: {
          ...(name_ar        ? { name_ar }        : {}),
          ...(name_en        !== undefined ? { name_en }        : {}),
          ...(description_ar !== undefined ? { description_ar } : {}),
          ...(description_en !== undefined ? { description_en } : {}),
          ...(district       ? { district }       : {}),
          ...(category       ? { category: category as any } : {}),
        },
      });

      return reply.send({ business: updated });
    }
  );

  // ── PATCH /business/owner ──────────────────────────────────

  fastify.patch<{ Body: { full_name: string } }>(
    '/business/owner',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const { full_name } = request.body;
      if (!full_name?.trim()) return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'full_name is required.' } });

      const updated = await fastify.db.user.update({
        where: { id: user.sub },
        data: { full_name: full_name.trim() },
        select: { full_name: true, phone: true },
      });

      return reply.send({ owner: updated });
    }
  );

  // ── POST /business/plan-change-request ────────────────────

  fastify.post<{
    Body: { action: 'upgrade' | 'downgrade' | 'cancel'; target_tier?: string };
  }>(
    '/business/plan-change-request',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await fastify.db.business.findFirst({
        where: { owner_user_id: user.sub },
      });
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.' } });

      const { action, target_tier } = request.body;

      // Log the request via an admin notification so the Hagez team can act on it
      fastify.log.info({
        event: 'plan_change_request',
        business_id: business.id,
        owner_id: user.sub,
        action,
        target_tier: target_tier ?? null,
        current_tier: business.subscription_tier,
      });

      return reply.send({
        ok: true,
        message: 'Plan change request received. The Hagez team will contact you within 24 hours.',
      });
    }
  );

  // ── POST /business/signup ──────────────────────────────────
  // Self-registration for new business owners.
  // Called after OTP verify; user has 'consumer' role at this point.
  // Creates business with 'pending' status for admin review, then re-issues
  // a JWT with the updated 'business_owner' role.

  fastify.post<{
    Body: {
      full_name: string;
      name_ar: string;
      name_en?: string;
      category: string;
      district: string;
      description_ar?: string;
    };
  }>(
    '/business/signup',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const userId = (request.user as JwtAccessPayload).sub;
      const phone  = (request.user as JwtAccessPayload).phone;
      const { full_name, name_ar, category, district, name_en, description_ar } = request.body;

      if (!full_name || !name_ar || !category || !district) {
        return reply.code(400).send({
          error: { code: 'INVALID_INPUT', message: 'full_name, name_ar, category, and district are required.' },
        });
      }

      // Prevent duplicate business registrations
      const existing = await fastify.db.business.findFirst({ where: { owner_user_id: userId } });
      if (existing) {
        return reply.code(409).send({
          error: { code: 'BUSINESS_EXISTS', message: 'A business already exists for this account. Please log in.' },
        });
      }

      // Promote user to business_owner and set their name
      const updatedUser = await fastify.db.user.update({
        where: { id: userId },
        data: { full_name, role: 'business_owner' },
      });

      // Create business with pending status (awaiting admin approval)
      const business = await fastify.db.business.create({
        data: {
          owner_user_id:  userId,
          name_ar,
          name_en:        name_en ?? null,
          category:       category as any,
          district,
          lat:            30.0444,
          lng:            31.2357,
          status:         'pending',
          subscription_tier: 'free',
          description_ar: description_ar ?? null,
        },
      });

      // Re-issue JWT with updated role so the new token works immediately
      const accessToken = fastify.jwt.sign(
        { sub: userId, phone, role: 'business_owner' },
        { expiresIn: env.JWT_ACCESS_EXPIRY }
      );
      const refreshToken = fastify.jwt.sign(
        { sub: userId, phone, role: 'business_owner' },
        { expiresIn: env.JWT_REFRESH_EXPIRY }
      );

      return reply.code(201).send({
        business,
        access_token:  accessToken,
        refresh_token: refreshToken,
        user: { ...updatedUser, business_category: category },
      });
    }
  );
};

// ── Helper: Build Arabic policy preview string ─────────────

function buildPolicyPreviewAr(
  depositType: string,
  depositValue: number,
  cancellationWindowHours: number
): string {
  const depositText = depositType === 'fixed'
    ? `${depositValue} ج.م`
    : `${depositValue}% من قيمة الخدمة`;

  if (cancellationWindowHours === 0) {
    return `يُطلب عربون ${depositText}. سياسة الإلغاء: العربون غير قابل للاسترداد.`;
  }

  return `يُطلب عربون ${depositText}. يمكن الإلغاء مجاناً قبل ${cancellationWindowHours} ساعة من الموعد. الإلغاء بعد ذلك يُفقدك العربون.`;
}

export default businessRoutes;
