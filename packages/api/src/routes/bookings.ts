// ============================================================
// SUPER RESERVATION PLATFORM — Consumer Booking Routes
// POST   /bookings
// POST   /bookings/:id/pay
// GET    /bookings/:id
// GET    /bookings
// PATCH  /bookings/:id/reschedule     ← US-021
// PATCH  /bookings/:id/cancel
// POST   /bookings/:id/reviews
// POST   /webhooks/paymob
// ============================================================

import type { FastifyPluginAsync } from 'fastify';
import {
  createBookingWithHold,
  confirmBooking,
  cancelBooking,
  rescheduleBooking,
  BookingEngineError,
  BookingEngineErrorWithData,
  BOOKING_ERROR_MESSAGES,
} from '../services/booking-engine.js';
import {
  createPaymobOrder,
  generatePaymentKey,
  verifyPaymobWebhook,
  isTransactionAlreadyProcessed,
  initiateRefund,
} from '../services/payment.js';
import {
  sendBookingConfirmation,
  scheduleReminders,
  sendPaymentReceipt,
  sendCancellationConfirmed,
  sendDisputeReceived,
} from '../services/notification.js';
import { earnPoints, calcRedemption, redeemPoints } from '../services/loyalty.js';
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
      section_preference?: string;
      override_consumer_overlap?: boolean;
      redeem_points?: number; // US-109 (EP-16): loyalty points to burn
    };
  }>(
    '/bookings',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const {
        slot_id, business_id, party_size = 1,
        resource_id, occasion, special_requests,
        section_preference, override_consumer_overlap,
        redeem_points,
      } = request.body;

      try {
        const result = await createBookingWithHold(fastify.db, fastify.redis, {
          consumer_id: user.sub,
          business_id,
          slot_id,
          resource_id,
          party_size,
          occasion,
          special_requests,
          section_preference,
          override_consumer_overlap,
        });

        const consumer = await fastify.db.user.findUniqueOrThrow({
          where: { id: user.sub },
          select: { full_name: true, phone: true, email: true, loyalty_balance: true },
        });
        const booking = await fastify.db.booking.findUniqueOrThrow({
          where: { id: result.booking_id },
          include: { business: true },
        });

        const depositAmount = Number(booking.deposit_amount);

        // US-109: Apply loyalty redemption if requested
        let pointsDiscount = 0;
        let pointsToBurn   = 0;
        if (redeem_points && redeem_points >= 100) {
          const redemption = calcRedemption(consumer.loyalty_balance, redeem_points, depositAmount);
          pointsDiscount = redemption.discountEgp;
          pointsToBurn   = redemption.pointsToBurn;
          // Persist redemption on the booking record
          await fastify.db.booking.update({
            where: { id: result.booking_id },
            data: {
              redeemed_points:     pointsToBurn,
              points_discount_egp: pointsDiscount,
            },
          });
          // Deduct points immediately (before payment) to prevent double-spend
          await redeemPoints(fastify.db, user.sub, result.booking_id, pointsToBurn);
        }

        const totalAmount = Math.max(0, depositAmount - pointsDiscount) + Number(booking.platform_fee);

        const { order_id } = await createPaymobOrder({
          booking_ref: result.booking_ref,
          amount_egp: totalAmount,
          consumer_name: consumer.full_name,
          consumer_phone: consumer.phone,
          consumer_email: consumer.email ?? undefined,
        });

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
          deposit_amount_egp: depositAmount,
          points_discount_egp: pointsDiscount,
          redeemed_points: pointsToBurn,
          platform_fee_egp: Number(booking.platform_fee),
        });
      } catch (err) {
        if (err instanceof BookingEngineErrorWithData) {
          const errorInfo = BOOKING_ERROR_MESSAGES[err.code];
          return reply.code(errorInfo?.status ?? 409).send({
            error: {
              code: err.code,
              message: errorInfo?.en ?? 'Booking failed.',
              message_ar: errorInfo?.ar ?? 'فشل الحجز.',
              ...err.data,
            },
          });
        }
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
    Body: { payment_method: string };
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

      await fastify.db.booking.update({
        where: { id },
        data: { payment_method: payment_method as any },
      });

      return reply.send({ payment_key, iframe_url, booking_ref: booking.booking_ref });
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
            business: {
              select: { id: true, name_ar: true, name_en: true, district: true, category: true },
            },
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

      return reply.send({
        bookings: bookings.map((b) => ({
          id: b.id,
          booking_ref: b.booking_ref,
          status: b.status,
          party_size: b.party_size,
          business_id: b.business_id,
          business: b.business,
          slot: b.slot,
          deposit_amount: Number(b.deposit_amount),
          platform_fee: Number(b.platform_fee),
          created_at: b.created_at,
        })),
        total,
        page: pageNum,
        has_more: (pageNum - 1) * limit + bookings.length < total,
      });
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
          status_logs: { orderBy: { created_at: 'asc' } },
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

  // ── PATCH /bookings/:id/reschedule (US-021) ────────────────

  fastify.patch<{
    Params: { id: string };
    Body: { new_slot_id: string };
  }>(
    '/bookings/:id/reschedule',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;

      try {
        const result = await rescheduleBooking(
          fastify.db,
          fastify.redis,
          request.params.id,
          request.body.new_slot_id,
          user.sub
        );
        return reply.send({
          booking_ref: result.new_booking_ref,
          slot_hold_expires_at: result.slot_hold_expires_at.toISOString(),
          message_ar: 'تم تغيير موعد حجزك بنجاح.',
        });
      } catch (err) {
        if (err instanceof BookingEngineError) {
          const errorInfo = BOOKING_ERROR_MESSAGES[err.code];
          return reply.code(errorInfo?.status ?? 409).send({
            error: {
              code: err.code,
              message: errorInfo?.en ?? 'Reschedule failed.',
              message_ar: errorInfo?.ar ?? 'فشل تغيير الموعد.',
            },
          });
        }
        throw err;
      }
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

        // US-034: Auto-trigger Paymob refund when deposit is refundable
        if (result.refund_amount > 0) {
          const depositPayment = await fastify.db.payment.findFirst({
            where: { booking_id: request.params.id, type: 'deposit', status: 'completed' },
          });

          if (depositPayment?.paymob_transaction_id) {
            try {
              await initiateRefund({
                paymob_transaction_id: depositPayment.paymob_transaction_id,
                amount_egp: result.refund_amount,
              });
              await fastify.db.payment.create({
                data: {
                  booking_id: request.params.id,
                  type: 'refund',
                  direction: 'outbound',
                  amount: result.refund_amount,
                  currency: 'EGP',
                  status: 'pending',
                  recipient_type: 'consumer',
                  recipient_id: booking.consumer_id,
                },
              });
            } catch (refundErr) {
              fastify.log.error({ bookingId: request.params.id, refundErr }, 'Auto-refund via Paymob failed — ops must process manually');
            }
          }
        }

        // US-034: Cancellation WhatsApp notification
        await sendCancellationConfirmed(
          fastify.db,
          request.params.id,
          result.refund_amount,
          result.deposit_forfeited
        ).catch((err) => fastify.log.error(err, 'Failed to send cancellation notification'));

        return reply.send({
          refund_amount: result.refund_amount,
          deposit_forfeited: result.deposit_forfeited,
          message_ar: result.deposit_forfeited
            ? 'تم إلغاء الحجز. العربون لن يُسترد حسب سياسة الإلغاء.'
            : 'تم إلغاء الحجز. سيتم استرداد العربون خلال 3–5 أيام عمل.',
        });
      } catch (err) {
        if (err instanceof BookingEngineError) {
          const errorInfo = BOOKING_ERROR_MESSAGES[err.code];
          return reply.code(errorInfo?.status ?? 409).send({
            error: { code: err.code, message: errorInfo?.en ?? 'Cancellation failed.', message_ar: errorInfo?.ar ?? 'فشل الإلغاء.' },
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

  // ── POST /bookings/:id/dispute (US-040) ───────────────────
  // Consumer challenges a no-show charge within 24 hours.

  fastify.post<{
    Params: { id: string };
    Body: { reason: string; description?: string };
  }>(
    '/bookings/:id/dispute',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const { reason, description } = request.body;

      if (!reason || reason.trim().length < 3) {
        return reply.code(400).send({
          error: { code: 'REASON_REQUIRED', message: 'Dispute reason is required.', message_ar: 'يجب ذكر سبب النزاع.' },
        });
      }

      const booking = await fastify.db.booking.findUnique({ where: { id: request.params.id } });

      if (!booking || booking.consumer_id !== user.sub) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Booking not found.', message_ar: 'الحجز غير موجود.' },
        });
      }

      if (booking.status !== 'no_show') {
        return reply.code(409).send({
          error: { code: 'NOT_NO_SHOW', message: 'Only no-show bookings can be disputed.', message_ar: 'يمكن الاعتراض على حجوزات الغياب فقط.' },
        });
      }

      // US-040: 24-hour dispute window from detection time
      const detectedAt = booking.no_show_detected_at ?? booking.created_at;
      const windowMs = 24 * 60 * 60 * 1000;
      if (Date.now() - detectedAt.getTime() > windowMs) {
        return reply.code(409).send({
          error: { code: 'DISPUTE_WINDOW_CLOSED', message: 'The 24-hour dispute window has closed.', message_ar: 'انتهت مهلة الاعتراض (24 ساعة).' },
        });
      }

      if (booking.dispute_submitted_at) {
        return reply.code(409).send({
          error: { code: 'DISPUTE_ALREADY_SUBMITTED', message: 'A dispute has already been submitted for this booking.', message_ar: 'تم تقديم اعتراض مسبق على هذا الحجز.' },
        });
      }

      const fullReason = description ? `${reason}: ${description}` : reason;

      await fastify.db.booking.update({
        where: { id: request.params.id },
        data: {
          status: 'disputed',
          dispute_reason: fullReason,
          dispute_submitted_at: new Date(),
          escrow_status: 'holding',  // Pause any pending payouts
        },
      });

      // Notify consumer: dispute received, 72h SLA
      await sendDisputeReceived(fastify.db, request.params.id).catch((err) =>
        fastify.log.error(err, 'Failed to send dispute-received notification')
      );

      return reply.code(201).send({
        booking_ref: booking.booking_ref,
        status: 'disputed',
        message_ar: 'تم استقبال اعتراضك. سيتم مراجعته خلال 72 ساعة وإشعارك بالنتيجة.',
      });
    }
  );

  // ── GET /bookings/:id/receipt (US-032) ────────────────────
  // Returns receipt data for PDF download from the consumer app.

  fastify.get<{ Params: { id: string } }>(
    '/bookings/:id/receipt',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const user = request.user as JwtAccessPayload;
      const booking = await fastify.db.booking.findUnique({
        where: { id: request.params.id },
        include: {
          business: { select: { name_ar: true, name_en: true, district: true, category: true } },
          slot: { select: { start_time: true, end_time: true, cancellation_window_hours: true } },
          payments: { where: { status: 'completed' } },
        },
      });

      if (!booking || booking.consumer_id !== user.sub) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Booking not found.', message_ar: 'الحجز غير موجود.' },
        });
      }

      const depositAmount = Number(booking.deposit_amount);
      const platformFee = Number(booking.platform_fee);

      return reply.send({
        booking_ref: booking.booking_ref,
        status: booking.status,
        business_name_ar: booking.business.name_ar,
        business_name_en: booking.business.name_en,
        district: booking.business.district,
        category: booking.business.category,
        slot_start: booking.slot.start_time,
        slot_end: booking.slot.end_time,
        party_size: booking.party_size,
        deposit_amount_egp: depositAmount,
        platform_fee_egp: platformFee,
        total_paid_egp: depositAmount + platformFee,
        payment_method: booking.payment_method,
        cancellation_window_hours: booking.slot.cancellation_window_hours,
        refund_policy_ar: depositAmount > 0
          ? `يمكن الإلغاء مجاناً قبل ${booking.slot.cancellation_window_hours} ساعة من الموعد. بعد ذلك يُحتجز العربون.`
          : 'لا يوجد عربون — الإلغاء مجاني.',
        issued_at: new Date().toISOString(),
      });
    }
  );

  // ── POST /webhooks/paymob ──────────────────────────────────

  fastify.post<{ Body: { obj: Record<string, unknown>; type: string } }>(
    '/webhooks/paymob',
    async (request, reply) => {
      const { obj, type } = request.body;

      if (type !== 'TRANSACTION') return reply.code(200).send('OK');

      if (!verifyPaymobWebhook(obj)) {
        fastify.log.warn('Paymob webhook HMAC verification failed');
        return reply.code(401).send('Invalid HMAC');
      }

      const transactionId = String(obj['id']);
      const success = obj['success'] === true;
      const merchantOrderId = (obj['order'] as any)?.['merchant_order_id'] as string;

      // US-087 (EP-20): Idempotency gate — AFTER HMAC validation, BEFORE any business logic.
      // provider_transaction_id has a UNIQUE DB constraint (migration 003) as a hard stop.
      if (await isTransactionAlreadyProcessed(fastify.db, transactionId)) {
        fastify.log.warn({ paymob_transaction_id: transactionId }, '[webhook-idempotency] Duplicate transaction received — acking without processing');
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
        await confirmBooking(
          fastify.db,
          fastify.redis,
          booking.id,
          String((obj['order'] as any)?.id),
          String(obj['source_data.type'] ?? 'card')
        );

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

        await sendBookingConfirmation(fastify.db, booking.id);
        await scheduleReminders(fastify.db, booking.id);
        // US-032: Send Arabic payment receipt via WhatsApp
        await sendPaymentReceipt(fastify.db, booking.id);
        // US-108 (EP-16): Earn loyalty points on confirmed booking
        const fullBooking = await fastify.db.booking.findUnique({
          where: { id: booking.id },
          include: { business: { select: { name_ar: true } } },
        });
        if (fullBooking) {
          await earnPoints(
            fastify.db,
            booking.consumer_id,
            booking.id,
            Number(fullBooking.deposit_amount),
            fullBooking.business?.name_ar ?? 'الحجز'
          );
        }
      } else {
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
