// ============================================================
// SUPER RESERVATION PLATFORM — Notification Service
// Enqueues notifications to AWS SQS. Workers (WhatsApp, SMS,
// Push) poll SQS and deliver. All channels are decoupled.
// ============================================================

import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import type { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import type { NotificationPayload } from '../types/index.js';

const sqs = new SQSClient({ region: env.AWS_REGION });

// ── Notification Templates → Channels ───────────────────────

type NotificationTemplate =
  | 'booking_confirmation_ar'
  | 'booking_confirmation_court_ar'
  | 'booking_confirmation_gaming_ar'
  | 'booking_confirmation_car_wash_ar'
  | 'reminder_24h_ar'
  | 'reminder_2h_push'
  | 'upcoming_booking_biz'
  | 'new_booking_business'
  | 'review_prompt_ar'
  | 'no_show_consumer_ar'
  | 'no_show_business_ar'
  | 'cancellation_confirmed_ar'
  | 'business_cancelled_ar'
  | 'payment_receipt_ar'
  | 'refund_confirmed_ar'
  | 'payout_failed_ar'
  | 'dispute_received_ar'
  | 'dispute_resolved_consumer_ar'
  | 'dispute_resolved_business_ar';

// ── Enqueue a Notification ───────────────────────────────────

export async function enqueueNotification(
  db: PrismaClient,
  params: {
    recipient_id: string;
    recipient_type: 'consumer' | 'business';
    booking_id?: string;
    channel: 'whatsapp' | 'sms' | 'push' | 'email';
    template_key: NotificationTemplate;
    payload: NotificationPayload;
    scheduled_at?: Date;
  }
): Promise<string> {
  // 1. Persist to DB (source of truth + idempotency)
  const notification = await db.notification.create({
    data: {
      recipient_id: params.recipient_id,
      recipient_type: params.recipient_type,
      booking_id: params.booking_id ?? null,
      channel: params.channel,
      template_key: params.template_key,
      payload: params.payload as any,
      status: 'queued',
      scheduled_at: params.scheduled_at ?? new Date(),
    },
  });

  // 2. Send to SQS for async delivery
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: env.SQS_NOTIFICATION_QUEUE_URL,
      MessageBody: JSON.stringify({
        notification_id: notification.id,
        channel: params.channel,
        template_key: params.template_key,
        payload: params.payload,
        recipient_id: params.recipient_id,
        recipient_type: params.recipient_type,
      }),
      MessageGroupId: params.recipient_id,     // FIFO: group by recipient
      MessageDeduplicationId: notification.id,  // Idempotent — one notification per SQS message
    })
  );

  return notification.id;
}

// ── Booking Confirmation (immediate) ────────────────────────

export async function sendBookingConfirmation(
  db: PrismaClient,
  bookingId: string
): Promise<void> {
  const booking = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { consumer: true, business: true, slot: true },
  });

  const datetimeAr = formatDatetimeAr(booking.slot.start_time);
  const isCourt   = booking.business.category === 'court';
  const isGaming  = booking.business.category === 'gaming_cafe';
  const isCarWash = booking.business.category === 'car_wash';

  // WhatsApp to consumer — court bookings use an enriched template
  if (isCourt) {
    const durationMins = booking.slot.duration_minutes;
    const durationAr =
      durationMins === 60 ? 'ساعة واحدة' :
      durationMins === 90 ? 'ساعة ونصف' :
      durationMins === 120 ? 'ساعتان' :
      `${durationMins} دقيقة`;

    const SPORT_LABELS_AR: Record<string, string> = {
      football: 'كرة القدم', basketball: 'كرة السلة', tennis: 'تنس',
      padel: 'بادل', squash: 'إسكواش', volleyball: 'كرة الطائرة',
    };
    const sportAr = SPORT_LABELS_AR[(booking as any).sport_type ?? ''] ?? (booking as any).sport_type ?? '';

    await enqueueNotification(db, {
      recipient_id: booking.consumer_id,
      recipient_type: 'consumer',
      booking_id: bookingId,
      channel: 'whatsapp',
      template_key: 'booking_confirmation_court_ar',
      payload: {
        booking_ref: booking.booking_ref,
        business_name_ar: booking.business.name_ar,
        datetime_ar: datetimeAr,
        sport_type_ar: sportAr,
        duration_ar: durationAr,
        player_count: booking.party_size,
        cancel_link: `https://app.reservr.eg/bookings/${booking.id}/cancel`,
      },
    });
  } else if (isGaming) {
    const durationMins = booking.slot.duration_minutes;
    const durationAr =
      durationMins === 60 ? 'ساعة واحدة' :
      durationMins === 120 ? 'ساعتان' :
      durationMins === 180 ? 'ثلاث ساعات' :
      `${durationMins} دقيقة`;

    const STATION_LABELS_AR: Record<string, string> = {
      pc: 'كمبيوتر PC', console: 'بلايستيشن', vr: 'واقع افتراضي VR', group_room: 'غرفة جماعية',
    };
    const stationAr = STATION_LABELS_AR[(booking as any).station_type ?? ''] ?? (booking as any).station_type ?? '';

    await enqueueNotification(db, {
      recipient_id: booking.consumer_id,
      recipient_type: 'consumer',
      booking_id: bookingId,
      channel: 'whatsapp',
      template_key: 'booking_confirmation_gaming_ar',
      payload: {
        booking_ref: booking.booking_ref,
        business_name_ar: booking.business.name_ar,
        datetime_ar: datetimeAr,
        station_type_ar: stationAr,
        duration_ar: durationAr,
        cancel_link: `https://app.reservr.eg/bookings/${booking.id}/cancel`,
      },
    });
  } else if (isCarWash) {
    const VEHICLE_LABELS_AR: Record<string, string> = {
      sedan: 'سيدان', suv: 'SUV', truck: 'شاحنة', motorcycle: 'موتوسيكل',
    };
    const vehicleAr = VEHICLE_LABELS_AR[(booking as any).vehicle_type ?? ''] ?? (booking as any).vehicle_type ?? '';
    const serviceAr = (booking as any).service_package ?? '';
    const dropOffAr = (booking as any).drop_off === true ? 'إيداع السيارة' : 'انتظار أثناء الغسيل';

    await enqueueNotification(db, {
      recipient_id: booking.consumer_id,
      recipient_type: 'consumer',
      booking_id: bookingId,
      channel: 'whatsapp',
      template_key: 'booking_confirmation_car_wash_ar',
      payload: {
        booking_ref: booking.booking_ref,
        business_name_ar: booking.business.name_ar,
        datetime_ar: datetimeAr,
        vehicle_type_ar: vehicleAr,
        service_package_ar: serviceAr,
        drop_off_ar: dropOffAr,
        cancel_link: `https://app.reservr.eg/bookings/${booking.id}/cancel`,
      },
    });
  } else {
    // WhatsApp to consumer (primary — restaurant/salon)
    await enqueueNotification(db, {
      recipient_id: booking.consumer_id,
      recipient_type: 'consumer',
      booking_id: bookingId,
      channel: 'whatsapp',
      template_key: 'booking_confirmation_ar',
      payload: {
        booking_ref: booking.booking_ref,
        business_name_ar: booking.business.name_ar,
        datetime_ar: datetimeAr,
        cancel_link: `https://app.reservr.eg/bookings/${booking.id}/cancel`,
      },
    });
  }

  // Push to business dashboard — respect US-049 opt-out
  if (booking.business.notify_new_booking_push) {
    await enqueueNotification(db, {
      recipient_id: booking.business_id,
      recipient_type: 'business',
      booking_id: bookingId,
      channel: 'push',
      template_key: 'new_booking_business',
      payload: {
        consumer_name: booking.consumer.full_name,
        party_size: booking.party_size,
        occasion: booking.occasion ?? undefined,
        booking_ref: booking.booking_ref,
      },
    });
  }
}

// ── Schedule Reminders (called at booking confirmation) ──────

export async function scheduleReminders(
  db: PrismaClient,
  bookingId: string
): Promise<void> {
  const booking = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { consumer: true, business: true, slot: true },
  });

  // US-046: respect consumer notification opt-outs
  const { notify_whatsapp, notify_push } = booking.consumer;

  const slotStart = booking.slot.start_time;

  // 24h WhatsApp reminder — only if consumer opted in
  if (notify_whatsapp) {
    const reminder24h = new Date(slotStart.getTime() - 24 * 60 * 60 * 1000);
    if (reminder24h > new Date()) {
      await enqueueNotification(db, {
        recipient_id: booking.consumer_id,
        recipient_type: 'consumer',
        booking_id: bookingId,
        channel: 'whatsapp',
        template_key: 'reminder_24h_ar',
        payload: {
          business_name_ar: booking.business.name_ar,
          datetime_ar: formatDatetimeAr(slotStart),
          reschedule_link: `https://app.reservr.eg/bookings/${booking.id}/reschedule`,
          cancel_link: `https://app.reservr.eg/bookings/${booking.id}/cancel`,
        },
        scheduled_at: reminder24h,
      });
    }
  }

  // 2h push reminder — only if consumer opted in
  if (notify_push) {
    const reminder2h = new Date(slotStart.getTime() - 2 * 60 * 60 * 1000);
    if (reminder2h > new Date()) {
      await enqueueNotification(db, {
        recipient_id: booking.consumer_id,
        recipient_type: 'consumer',
        booking_id: bookingId,
        channel: 'push',
        template_key: 'reminder_2h_push',
        payload: {
          business_name_ar: booking.business.name_ar,
          time_ar: formatTimeAr(slotStart),
          maps_link: `https://maps.google.com/?q=${booking.business.lat},${booking.business.lng}`,
        },
        scheduled_at: reminder2h,
      });
    }
  }
}

// ── Review Prompt (2h after booking slot end) ─────────────────

export async function scheduleReviewPrompt(
  db: PrismaClient,
  bookingId: string
): Promise<void> {
  const booking = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { business: true, slot: true },
  });

  const reviewAt = new Date(booking.slot.end_time.getTime() + 2 * 60 * 60 * 1000);

  await enqueueNotification(db, {
    recipient_id: booking.consumer_id,
    recipient_type: 'consumer',
    booking_id: bookingId,
    channel: 'whatsapp',
    template_key: 'review_prompt_ar',
    payload: {
      business_name_ar: booking.business.name_ar,
      review_link: `https://app.reservr.eg/bookings/${booking.id}/review`,
    },
    scheduled_at: reviewAt,
  });
}

// ── No-Show Notifications ────────────────────────────────────

export async function sendNoShowNotifications(
  db: PrismaClient,
  bookingId: string
): Promise<void> {
  const booking = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { consumer: true, business: true },
  });

  const disputeWindowEnd = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await Promise.all([
    enqueueNotification(db, {
      recipient_id: booking.consumer_id,
      recipient_type: 'consumer',
      booking_id: bookingId,
      channel: 'whatsapp',
      template_key: 'no_show_consumer_ar',
      payload: {
        business_name_ar: booking.business.name_ar,
        penalty_amount: Number(booking.deposit_amount),
        dispute_link: `https://app.reservr.eg/bookings/${booking.id}/dispute`,
        dispute_window_ends_at: disputeWindowEnd.toISOString(),
      },
    }),
    enqueueNotification(db, {
      recipient_id: booking.business_id,
      recipient_type: 'business',
      booking_id: bookingId,
      channel: 'push',
      template_key: 'no_show_business_ar',
      payload: {
        consumer_name: booking.consumer.full_name,
        booking_ref: booking.booking_ref,
        payout_amount: Number(booking.deposit_amount) * 0.75,
        payout_eta: '48 ساعة',
      },
    }),
  ]);
}

// ── US-032: Payment Receipt (WhatsApp — sent on payment success) ──

export async function sendPaymentReceipt(
  db: PrismaClient,
  bookingId: string
): Promise<void> {
  const booking = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { consumer: true, business: true, slot: true },
  });

  const depositAmount = Number(booking.deposit_amount);
  const platformFee = Number(booking.platform_fee);
  const total = depositAmount + platformFee;
  const datetimeAr = formatDatetimeAr(booking.slot.start_time);

  await enqueueNotification(db, {
    recipient_id: booking.consumer_id,
    recipient_type: 'consumer',
    booking_id: bookingId,
    channel: 'whatsapp',
    template_key: 'payment_receipt_ar',
    payload: {
      booking_ref: booking.booking_ref,
      business_name_ar: booking.business.name_ar,
      datetime_ar: datetimeAr,
      deposit_amount: depositAmount,
      platform_fee: platformFee,
      total_amount: total,
      refund_policy_hours: booking.slot.cancellation_window_hours,
      receipt_link: `https://app.reservr.eg/bookings/${booking.id}/receipt`,
    },
  });
}

// ── Cancellation / Refund Notifications ──────────────────────

export async function sendCancellationConfirmed(
  db: PrismaClient,
  bookingId: string,
  refundAmount: number,
  depositForfeited: boolean
): Promise<void> {
  const booking = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { consumer: true, business: true, slot: true },
  });

  await enqueueNotification(db, {
    recipient_id: booking.consumer_id,
    recipient_type: 'consumer',
    booking_id: bookingId,
    channel: 'whatsapp',
    template_key: 'cancellation_confirmed_ar',
    payload: {
      booking_ref: booking.booking_ref,
      business_name_ar: booking.business.name_ar,
      deposit_forfeited: depositForfeited,
      refund_amount: refundAmount,
      refund_eta: depositForfeited ? null : '3–5 أيام عمل',
    },
  });
}

// ── US-040 / US-041: Dispute Notifications ───────────────────

export async function sendDisputeReceived(
  db: PrismaClient,
  bookingId: string
): Promise<void> {
  const booking = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { consumer: true, business: true },
  });

  await enqueueNotification(db, {
    recipient_id: booking.consumer_id,
    recipient_type: 'consumer',
    booking_id: bookingId,
    channel: 'whatsapp',
    template_key: 'dispute_received_ar',
    payload: {
      booking_ref: booking.booking_ref,
      business_name_ar: booking.business.name_ar,
      sla_hours: 72,
    },
  });
}

export async function sendDisputeResolved(
  db: PrismaClient,
  bookingId: string,
  resolution: 'uphold' | 'reverse' | 'partial',
  refundAmount: number
): Promise<void> {
  const booking = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { consumer: true, business: true },
  });

  const outcomeAr = resolution === 'uphold'
    ? 'تم التحقق من الغياب وتأكيد الرسوم.'
    : resolution === 'reverse'
    ? 'تم إلغاء الرسوم وسيتم استرداد مبلغ العربون كاملاً.'
    : `تم البت في النزاع — مبلغ الاسترداد: ${refundAmount} ج.م.`;

  await Promise.all([
    enqueueNotification(db, {
      recipient_id: booking.consumer_id,
      recipient_type: 'consumer',
      booking_id: bookingId,
      channel: 'whatsapp',
      template_key: 'dispute_resolved_consumer_ar',
      payload: {
        booking_ref: booking.booking_ref,
        business_name_ar: booking.business.name_ar,
        outcome_ar: outcomeAr,
        refund_amount: refundAmount,
      },
    }),
    enqueueNotification(db, {
      recipient_id: booking.business_id,
      recipient_type: 'business',
      booking_id: bookingId,
      channel: 'push',
      template_key: 'dispute_resolved_business_ar',
      payload: {
        booking_ref: booking.booking_ref,
        resolution,
        outcome_ar: outcomeAr,
      },
    }),
  ]);
}

export async function sendPayoutFailedAlert(
  db: PrismaClient,
  businessId: string,
  amountEgp: number
): Promise<void> {
  const business = await db.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { owner_user_id: true, name_ar: true },
  });

  await enqueueNotification(db, {
    recipient_id: businessId,
    recipient_type: 'business',
    channel: 'whatsapp',
    template_key: 'payout_failed_ar',
    payload: {
      business_name_ar: business.name_ar,
      amount_egp: amountEgp,
    },
  });
}

// ── Helpers ──────────────────────────────────────────────────

function formatDatetimeAr(date: Date): string {
  return date.toLocaleString('ar-EG', {
    timeZone: 'Africa/Cairo',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTimeAr(date: Date): string {
  return date.toLocaleString('ar-EG', {
    timeZone: 'Africa/Cairo',
    hour: '2-digit',
    minute: '2-digit',
  });
}
