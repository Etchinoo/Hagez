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

      if (status !== 'completed' && status !== 'no_show') {
        return reply.code(400).send({ error: { code: 'INVALID_STATUS', message: 'Status must be "completed" or "no_show".', message_ar: 'الحالة يجب أن تكون "مكتمل" أو "غياب".' } });
      }

      // H5: only a confirmed booking can be completed / no-show'd, and the
      // transition is claimed atomically (updateMany where status='confirmed'),
      // so a duplicate request cannot trigger the deposit payout twice.
      const invalidState = () => reply.code(409).send({ error: { code: 'INVALID_STATE', message: 'Only a confirmed booking can be updated.', message_ar: 'يمكن تحديث الحجوزات المؤكدة فقط.' } });
      if (booking.status !== 'confirmed') return invalidState();

      if (status === 'completed') {
        const claim = await fastify.db.booking.updateMany({
          where: { id: booking.id, status: 'confirmed' },
          data: { status: 'completed', completed_at: now, escrow_status: 'released_to_business' },
        });
        if (claim.count === 0) return invalidState();

        const depositAmount = Number(booking.deposit_amount);
        if (depositAmount > 0) {
          // US-030: pending payout record — picked up by the daily payout job (US-036)
          await fastify.db.payment.create({
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
          });
        }

        await scheduleReviewPrompt(fastify.db, booking.id);
        return reply.send({ booking_ref: booking.booking_ref, new_status: 'completed', payout_triggered: true });
      }

      // status === 'no_show'
      const noShowClaim = await fastify.db.booking.updateMany({
        where: { id: booking.id, status: 'confirmed' },
        data: { status: 'no_show', no_show_detected_at: now },
      });
      if (noShowClaim.count === 0) return invalidState();
      return reply.send({ booking_ref: booking.booking_ref, new_status: 'no_show', payout_triggered: true });
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

      // M7: the slot must belong to the caller's own business — otherwise a
      // business could book against (and inflate booked_count on) a competitor's slot.
      const slot = await fastify.db.slot.findFirst({ where: { id: slot_id, business_id: business.id } });
      if (!slot) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Slot not found.', message_ar: 'الوقت غير موجود.' } });
      }

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
    {
      preHandler: fastify.requireRole(['business_owner']),
      schema: {
        body: {
          type: 'object',
          required: ['rules'],
          additionalProperties: false,
          properties: {
            rules: {
              type: 'array',
              minItems: 1,
              maxItems: 7,
              items: {
                type: 'object',
                required: ['day_of_week', 'open_time', 'close_time', 'slot_duration_min', 'capacity'],
                additionalProperties: false,
                properties: {
                  day_of_week: { type: 'integer', minimum: 0, maximum: 6 },
                  // HH:MM, 00:00–23:59, plus 24:00 (midnight close used by the dashboard)
                  open_time: { type: 'string', pattern: '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$' },
                  close_time: { type: 'string', pattern: '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$' },
                  // minimum 5 prevents the slot-generation loop from spinning forever (DoS)
                  slot_duration_min: { type: 'integer', minimum: 5, maximum: 1440 },
                  capacity: { type: 'integer', minimum: 1, maximum: 1000 },
                  deposit_amount: { type: 'number', minimum: 0, maximum: 100000 },
                  weeks_ahead: { type: 'integer', minimum: 1, maximum: 12 },
                },
              },
            },
          },
        },
      },
    },
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
    {
      preHandler: fastify.requireRole(['business_owner']),
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            period: { type: 'string', maxLength: 20 },
            month: { type: 'string', pattern: '^[0-9]{4}-(0[1-9]|1[0-2])$' },
          },
        },
      },
    },
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
      deposit_type: 'fixed' | 'percentage';
      deposit_value: number;
      cancellation_window_hours: number;
      payout_method?: 'bank_transfer' | 'paymob_wallet';
    };
  }>(
    '/business/policy',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });

      const { deposit_type, deposit_value, cancellation_window_hours, payout_method } = request.body;

      if (!['fixed', 'percentage'].includes(deposit_type)) {
        return reply.code(400).send({ error: { code: 'INVALID_DEPOSIT_TYPE', message: 'deposit_type must be "fixed" or "percentage".', message_ar: 'نوع العربون يجب أن يكون "fixed" أو "percentage".' } });
      }
      if (deposit_type === 'percentage' && (deposit_value < 0 || deposit_value > 100)) {
        return reply.code(400).send({ error: { code: 'INVALID_DEPOSIT_VALUE', message: 'Percentage must be 0–100.', message_ar: 'النسبة المئوية يجب أن تكون بين 0 و 100.' } });
      }
      if (cancellation_window_hours < 0 || cancellation_window_hours > 168) {
        return reply.code(400).send({ error: { code: 'INVALID_WINDOW', message: 'Cancellation window must be 0–168 hours.', message_ar: 'نافذة الإلغاء يجب أن تكون بين 0 و 168 ساعة.' } });
      }

      const updated = await fastify.db.business.update({
        where: { id: business.id },
        data: {
          policy_deposit_type: deposit_type,
          policy_deposit_value: deposit_value,
          policy_cancellation_window_hours: cancellation_window_hours,
          ...(payout_method ? { payout_method } : {}),
        },
        select: {
          policy_deposit_type: true,
          policy_deposit_value: true,
          policy_cancellation_window_hours: true,
          payout_method: true,
        },
      });

      return reply.send({
        ...updated,
        policy_deposit_value: Number(updated.policy_deposit_value),
        // Consumer-facing preview of the policy (Arabic)
        policy_preview_ar: buildPolicyPreviewAr(
          deposit_type,
          Number(updated.policy_deposit_value),
          cancellation_window_hours
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
        policy_preview_ar: buildPolicyPreviewAr(
          business.policy_deposit_type,
          Number(business.policy_deposit_value),
          business.policy_cancellation_window_hours
        ),
      });
    }
  );
  // ── GET /business/gaming-config ───────────────────────────

  fastify.get(
    '/business/gaming-config',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });

      const config = await fastify.db.gamingConfig.findUnique({ where: { business_id: business.id } });
      return reply.send({ gaming_config: config });
    }
  );

  // ── PATCH /business/gaming-config ─────────────────────────

  fastify.patch<{
    Body: {
      station_types?: string[];
      has_group_rooms?: boolean;
      group_room_capacity?: number;
      min_players_group_room?: number;
      genre_options?: string[];
      slot_duration_options?: number[];
      default_slot_duration_min?: number;
    };
  }>(
    '/business/gaming-config',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });

      // M9: whitelist fields — never spread req.body into Prisma. An injected
      // `business_id` (or any unknown field) must not reach the write and repoint
      // the config at another tenant.
      const {
        station_types, has_group_rooms, group_room_capacity,
        min_players_group_room, genre_options, slot_duration_options,
        default_slot_duration_min,
      } = request.body;
      const data = {
        ...(station_types !== undefined ? { station_types } : {}),
        ...(has_group_rooms !== undefined ? { has_group_rooms } : {}),
        ...(group_room_capacity !== undefined ? { group_room_capacity } : {}),
        ...(min_players_group_room !== undefined ? { min_players_group_room } : {}),
        ...(genre_options !== undefined ? { genre_options } : {}),
        ...(slot_duration_options !== undefined ? { slot_duration_options } : {}),
        ...(default_slot_duration_min !== undefined ? { default_slot_duration_min } : {}),
      };

      const config = await fastify.db.gamingConfig.upsert({
        where: { business_id: business.id },
        create: { business_id: business.id, ...data },
        update: data,
      });

      return reply.send({ gaming_config: config });
    }
  );

  // ── GET /business/stations ─────────────────────────────────

  fastify.get(
    '/business/stations',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });

      const stations = await fastify.db.resource.findMany({
        where: { business_id: business.id, type: 'station' },
        orderBy: { created_at: 'asc' },
      });

      return reply.send({ stations });
    }
  );

  // ── POST /business/stations ────────────────────────────────

  fastify.post<{
    Body: {
      name_ar: string;
      name_en?: string;
      station_type: string;  // stored in specialisations[0]: PC | Console | VR | Group Room
      capacity?: number;
    };
  }>(
    '/business/stations',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });

      const { name_ar, name_en, station_type, capacity = 1 } = request.body;

      const station = await fastify.db.resource.create({
        data: {
          business_id: business.id,
          type: 'station',
          name_ar,
          name_en: name_en ?? null,
          capacity,
          specialisations: [station_type],
          is_active: true,
        },
      });

      return reply.code(201).send({ station });
    }
  );

  // ── PATCH /business/stations/:id ──────────────────────────

  fastify.patch<{
    Params: { id: string };
    Body: {
      name_ar?: string;
      name_en?: string;
      station_type?: string;
      capacity?: number;
      is_active?: boolean;
    };
  }>(
    '/business/stations/:id',
    { preHandler: fastify.requireRole(['business_owner']) },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const business = await getAuthenticatedBusiness(user.sub);
      if (!business) return reply.code(404).send({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No business found.', message_ar: 'لا يوجد نشاط تجاري.' } });

      const station = await fastify.db.resource.findFirst({ where: { id: request.params.id, business_id: business.id, type: 'station' } });
      if (!station) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Station not found.', message_ar: 'المحطة غير موجودة.' } });

      const { name_ar, name_en, station_type, capacity, is_active } = request.body;

      const updated = await fastify.db.resource.update({
        where: { id: station.id },
        data: {
          ...(name_ar !== undefined && { name_ar }),
          ...(name_en !== undefined && { name_en }),
          ...(station_type !== undefined && { specialisations: [station_type] }),
          ...(capacity !== undefined && { capacity }),
          ...(is_active !== undefined && { is_active }),
        },
      });

      return reply.send({ station: updated });
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
