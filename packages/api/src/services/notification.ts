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
  | 'reminder_24h_ar'
  | 'reminder_2h_push'
  | 'upcoming_booking_biz'
  | 'new_booking_business'
  | 'review_prompt_ar'
  | 'no_show_consumer_ar'
  | 'no_show_business_ar'
  | 'cancellation_confirmed_ar'
  | 'business_cancelled_ar';

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

  // WhatsApp to consumer (primary)
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

  // Push to business dashboard
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

// ── Schedule Reminders (called at booking confirmation) ──────

export async function scheduleReminders(
  db: PrismaClient,
  bookingId: string
): Promise<void> {
  const booking = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { consumer: true, business: true, slot: true },
  });

  const slotStart = booking.slot.start_time;

  // 24h WhatsApp reminder
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

  // 2h push reminder
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
