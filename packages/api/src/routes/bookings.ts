// ============================================================
// SUPER RESERVATION PLATFORM — Consumer Booking Routes
// POST   /bookings
// POST   /bookings/:id/pay
// GET    /bookings/:id
// GET    /bookings
// PATCH  /bookings/:id/reschedule
// PATCH  /bookings/:id/cancel
// POST   /bookings/:id/reviews
// POST   /webhooks/paymob (Paymob payment webhook)
// ============================================================

import type { FastifyPluginAsync } from 'fastify';
import {
  createBookingWithHold,
  confirmBooking,
  cancelBooking,
  BookingEngineError,
  BOOKING_ERROR_MESSAGES,
} from '../services/booking-engine.js';
import {
  createPaymobOrder,
  generatePaymentKey,
  verifyPaymobWebhook,
  isTransactionAlreadyProcessed,
  executeNoShowSplit,
} from '../services/payment.js';
import {
  sendBookingConfirmation,
  scheduleReminders,
  scheduleReviewPrompt,
} from '../services/notification.js';
import type { JwtAccessPayload } from '../types/index.js';

const bookingRoutes: FastifyPluginAsync = async (fastify) => {
  // ── POST /bookings ─────────────────────────────────────────

  fastify.post<{
    Body: {
      slot_id: string;
      business_id: string;
      party_size?: number;
      resource_id?: string;
      occasion?: string;
      special_requests?: string;
    };
  }>(
    '/bookings',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const { slot_id, business_id, party_size = 1, resource_id, occasion, special_requests } = request.body;

      try {
        const result = await createBookingWithHold(fastify.db, fastify.redis, {
          consumer_id: user.sub,
          business_id,
          slot_id,
          resource_id,
          party_size,
          occasion,
          special_requests,
        });

        // Create Paymob order and payment key
        const consumer = await fastify.db.user.findUniqueOrThrow({ where: { id: user.sub } });
        const booking = await fastify.db.booking.findUniqueOrThrow({
          where: { id: result.booking_id },
          include: { business: true },
        });

        const totalAmount = Number(booking.deposit_amount) + Number(booking.platform_fee);

        const { order_id } = await createPaymobOrder({
          booking_ref: result.booking_ref,
          amount_egp: totalAmount,
          consumer_name: consumer.full_name,
          consumer_phone: consumer.phone,
          consumer_email: consumer.email ?? undefined,
        });

        // Store paymob order ID
        await fastify.db.booking.update({
          where: { id: result.booking_id },
          data: { paymob_order_id: order_id },
        });

        return reply.code(201).send({
          booking_id: result.booking_id,
          booking_ref: result.booking_ref,
          slot_hold_expires_at: result.slot_hold_expires_at.toISOString(),
          paymob_order_id: order_id,
          total_amount_egp: totalAmount,
          deposit_amount_egp: Number(booking.deposit_amount),
          platform_fee_egp: Number(booking.platform_fee),
        });
      } catch (err) {
        if (err instanceof BookingEngineError) {
          const errorInfo = BOOKING_ERROR_MESSAGES[err.code];
          return reply.code(errorInfo?.status ?? 409).send({
            error: {
              code: err.code,
              message: errorInfo?.en ?? 'Booking failed.',
              message_ar: errorInfo?.ar ?? 'فشل الحجز.',
            },
          });
        }
        throw err;
      }
    }
  );

  // ── POST /bookings/:id/pay ─────────────────────────────────

  fastify.post<{
    Params: { id: string };
    Body: { payment_method: string; paymob_token?: string };
  }>(
    '/bookings/:id/pay',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params;
      const { payment_method } = request.body;
      const user = request.user as JwtAccessPayload;

      const booking = await fastify.db.booking.findUniqueOrThrow({ where: { id } });
      if (booking.consumer_id !== user.sub) {
        return reply.code(403).send({
          error: { code: 'FORBIDDEN', message: 'Not your booking.', message_ar: 'هذا الحجز ليس لك.' },
        });
      }

      const consumer = await fastify.db.user.findUniqueOrThrow({ where: { id: user.sub } });
      const totalAmount = Number(booking.deposit_amount) + Number(booking.platform_fee);

      const { payment_key, iframe_url } = await generatePaymentKey({
        order_id: booking.paymob_order_id!,
        amount_egp: totalAmount,
        payment_method,
        consumer_name: consumer.full_name,
        consumer_phone: consumer.phone,
        consumer_email: consumer.email ?? undefined,
      });

      // Update payment method on booking
      await fastify.db.booking.update({
        where: { id },
        data: { payment_method: payment_method as any },
      });

      return reply.send({
        payment_key,
        iframe_url,
        booking_ref: booking.booking_ref,
      });
    }
  );

  // ── GET /bookings ──────────────────────────────────────────

  fastify.get<{ Querystring: { status?: string; page?: string } }>(
    '/bookings',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const { status, page = '1' } = request.query;
      const pageNum = parseInt(page);
      const limit = 20;

      const [bookings, total] = await Promise.all([
        fastify.db.booking.findMany({
          where: {
            consumer_id: user.sub,
            ...(status ? { status: status as any } : {}),
          },
          include: {
            business: { select: { name_ar: true, name_en: true, district: true } },
            slot: { select: { start_time: true, end_time: true } },
          },
          orderBy: { created_at: 'desc' },
          skip: (pageNum - 1) * limit,
          take: limit,
        }),
        fastify.db.booking.count({
          where: { consumer_id: user.sub, ...(status ? { status: status as any } : {}) },
        }),
      ]);

      return reply.send({ bookings, total });
    }
  );

  // ── GET /bookings/:id ──────────────────────────────────────

  fastify.get<{ Params: { id: string } }>(
    '/bookings/:id',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const booking = await fastify.db.booking.findUnique({
        where: { id: request.params.id },
        include: {
          business: true,
          slot: true,
          payments: true,
          review: true,
        },
      });

      if (!booking || booking.consumer_id !== user.sub) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Booking not found.', message_ar: 'الحجز غير موجود.' },
        });
      }

      return reply.send(booking);
    }
  );

  // ── PATCH /bookings/:id/cancel ─────────────────────────────

  fastify.patch<{
    Params: { id: string };
    Body: { reason?: string };
  }>(
    '/bookings/:id/cancel',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const booking = await fastify.db.booking.findUnique({ where: { id: request.params.id } });

      if (!booking || booking.consumer_id !== user.sub) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Booking not found.', message_ar: 'الحجز غير موجود.' },
        });
      }

      try {
        const result = await cancelBooking(fastify.db, request.params.id, 'consumer', request.body.reason);
        return reply.send({
          refund_amount: result.refund_amount,
          deposit_forfeited: result.deposit_forfeited,
          message: result.deposit_forfeited
            ? 'Booking cancelled. Deposit forfeited per cancellation policy.'
            : 'Booking cancelled. Refund will be processed in 3–5 business days.',
        });
      } catch (err) {
        if (err instanceof BookingEngineError) {
          const errorInfo = BOOKING_ERROR_MESSAGES[err.code];
          return reply.code(errorInfo?.status ?? 409).send({
            error: {
              code: err.code,
              message: errorInfo?.en ?? 'Cancellation failed.',
              message_ar: errorInfo?.ar ?? 'فشل الإلغاء.',
            },
          });
        }
        throw err;
      }
    }
  );

  // ── POST /bookings/:id/reviews ─────────────────────────────

  fastify.post<{
    Params: { id: string };
    Body: { rating: number; body?: string };
  }>(
    '/bookings/:id/reviews',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const { rating, body } = request.body;
      const bookingId = request.params.id;

      if (rating < 1 || rating > 5) {
        return reply.code(400).send({
          error: { code: 'INVALID_RATING', message: 'Rating must be between 1 and 5.', message_ar: 'يجب أن يكون التقييم بين 1 و 5.' },
        });
      }

      const booking = await fastify.db.booking.findUnique({ where: { id: bookingId } });
      if (!booking || booking.consumer_id !== user.sub || booking.status !== 'completed') {
        return reply.code(403).send({
          error: { code: 'REVIEW_NOT_ALLOWED', message: 'Only completed bookings can be reviewed.', message_ar: 'يمكن تقييم الحجوزات المكتملة فقط.' },
        });
      }

      const existingReview = await fastify.db.review.findUnique({ where: { booking_id: bookingId } });
      if (existingReview) {
        return reply.code(409).send({
          error: { code: 'REVIEW_ALREADY_EXISTS', message: 'You have already reviewed this booking.', message_ar: 'لقد قمت بتقييم هذا الحجز بالفعل.' },
        });
      }

      const review = await fastify.db.review.create({
        data: {
          booking_id: bookingId,
          consumer_id: user.sub,
          business_id: booking.business_id,
          rating,
          body: body ?? null,
          status: 'pending',
        },
      });

      return reply.code(201).send({ review_id: review.id, status: 'pending' });
    }
  );

  // ── POST /webhooks/paymob ──────────────────────────────────
  // Handles payment success/failure callbacks from Paymob

  fastify.post<{ Body: { obj: Record<string, unknown>; type: string } }>(
    '/webhooks/paymob',
    async (request, reply) => {
      const { obj, type } = request.body;

      if (type !== 'TRANSACTION') return reply.code(200).send('OK');

      // HMAC verification
      if (!verifyPaymobWebhook(obj)) {
        fastify.log.warn('Paymob webhook HMAC verification failed');
        return reply.code(401).send('Invalid HMAC');
      }

      const transactionId = String(obj['id']);
      const success = obj['success'] === true;
      const merchantOrderId = (obj['order'] as any)?.['merchant_order_id'] as string;

      // Idempotency check
      if (await isTransactionAlreadyProcessed(fastify.db, transactionId)) {
        return reply.code(200).send('Already processed');
      }

      const booking = await fastify.db.booking.findFirst({
        where: { booking_ref: merchantOrderId },
        include: { consumer: true },
      });

      if (!booking) {
        fastify.log.warn({ merchantOrderId }, 'Paymob webhook: booking not found');
        return reply.code(200).send('OK');
      }

      if (success) {
        // Confirm booking
        await confirmBooking(fastify.db, fastify.redis, booking.id, String((obj['order'] as any)?.id), String(obj['source_data.type'] ?? 'card'));

        // Create payment records
        await fastify.db.$transaction([
          fastify.db.payment.create({
            data: {
              booking_id: booking.id,
              type: 'booking_fee',
              direction: 'inbound',
              amount: Number(booking.platform_fee),
              currency: 'EGP',
              paymob_transaction_id: transactionId,
              status: 'completed',
              recipient_type: 'platform',
            },
          }),
          fastify.db.payment.create({
            data: {
              booking_id: booking.id,
              type: 'deposit',
              direction: 'inbound',
              amount: Number(booking.deposit_amount),
              currency: 'EGP',
              status: 'completed',
              recipient_type: 'business',
              recipient_id: booking.business_id,
            },
          }),
        ]);

        // Send confirmations + schedule reminders
        await sendBookingConfirmation(fastify.db, booking.id);
        await scheduleReminders(fastify.db, booking.id);
      } else {
        // Payment failed — expire booking (slot lock will have already expired or be released by job)
        await fastify.db.booking.update({
          where: { id: booking.id },
          data: { status: 'expired' },
        });
      }

      return reply.code(200).send('OK');
    }
  );
};

export default bookingRoutes;
