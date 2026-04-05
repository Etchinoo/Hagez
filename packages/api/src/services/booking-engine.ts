// ============================================================
// SUPER RESERVATION PLATFORM — Booking Engine
// Handles: slot availability, Redis locking, state machine,
// booking ref generation, conflict detection.
// ============================================================

import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import { acquireSlotLock, releaseSlotLock } from '../plugins/redis.js';
import { env, PLATFORM_FEES } from '../config/env.js';
import type { BookingCreationResult } from '../types/index.js';

// ── Booking Reference Generator ──────────────────────────────

export function generateBookingRef(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Unambiguous chars only
  const suffix = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `BK-${date}-${suffix}`;
}

// ── Slot Availability Check ──────────────────────────────────

export async function checkSlotAvailability(
  db: PrismaClient,
  slotId: string,
  partySize: number
): Promise<{ available: boolean; reason?: string }> {
  const slot = await db.slot.findUnique({ where: { id: slotId } });

  if (!slot) return { available: false, reason: 'SLOT_NOT_FOUND' };
  if (slot.status === 'blocked') return { available: false, reason: 'SLOT_BLOCKED' };
  if (slot.status === 'past') return { available: false, reason: 'SLOT_PAST' };
  if (slot.start_time < new Date()) return { available: false, reason: 'SLOT_PAST' };
  if (slot.booked_count + partySize > slot.capacity) {
    return { available: false, reason: 'SLOT_CAPACITY_EXCEEDED' };
  }

  return { available: true };
}

// ── Create Booking (Phase 1 of 2: Hold + DB record) ─────────

export async function createBookingWithHold(
  db: PrismaClient,
  redis: Redis,
  params: {
    consumer_id: string;
    business_id: string;
    slot_id: string;
    resource_id?: string;
    party_size: number;
    occasion?: string;
    special_requests?: string;
  }
): Promise<BookingCreationResult> {
  const { consumer_id, business_id, slot_id, resource_id, party_size, occasion, special_requests } = params;

  // 1. Check availability
  const availability = await checkSlotAvailability(db, slot_id, party_size);
  if (!availability.available) {
    throw new BookingEngineError(availability.reason ?? 'SLOT_NOT_AVAILABLE');
  }

  // 2. Fetch business to get category (for platform fee)
  const [slot, business] = await Promise.all([
    db.slot.findUniqueOrThrow({ where: { id: slot_id } }),
    db.business.findUniqueOrThrow({ where: { id: business_id } }),
  ]);

  const platformFee = PLATFORM_FEES[business.category] ?? 25;

  // 3. Generate booking ref (retry up to 3 times on collision)
  let booking_ref = generateBookingRef();
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await db.booking.findUnique({ where: { booking_ref } });
    if (!existing) break;
    booking_ref = generateBookingRef();
  }

  // 4. Create booking in PENDING_PAYMENT state
  const booking = await db.booking.create({
    data: {
      booking_ref,
      consumer_id,
      business_id,
      slot_id,
      resource_id: resource_id ?? null,
      party_size,
      occasion: (occasion as any) ?? null,
      special_requests: special_requests ?? null,
      status: 'pending_payment',
      deposit_amount: slot.deposit_amount,
      platform_fee: platformFee,
    },
  });

  // 5. Acquire Redis slot lock (8 min)
  const lockAcquired = await acquireSlotLock(
    redis,
    slot_id,
    booking.id,
    env.SLOT_HOLD_TTL_SECONDS
  );

  if (!lockAcquired) {
    // Slot was taken between availability check and lock — cancel booking, return error
    await db.booking.update({ where: { id: booking.id }, data: { status: 'expired' } });
    throw new BookingEngineError('SLOT_ALREADY_HELD');
  }

  const holdExpiresAt = new Date(Date.now() + env.SLOT_HOLD_TTL_SECONDS * 1000);

  return {
    booking_id: booking.id,
    booking_ref: booking.booking_ref,
    slot_hold_expires_at: holdExpiresAt,
    payment_intent: {
      order_id: '',      // Filled in by payment service after Paymob order creation
      payment_key: '',
      iframe_url: '',
    },
  };
}

// ── Confirm Booking (Phase 2 of 2: Payment success) ──────────

export async function confirmBooking(
  db: PrismaClient,
  redis: Redis,
  bookingId: string,
  paymobOrderId: string,
  paymentMethod: string
): Promise<void> {
  const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });

  if (booking.status !== 'pending_payment') {
    throw new BookingEngineError('INVALID_STATE_TRANSITION');
  }

  await db.$transaction([
    // Transition booking to CONFIRMED
    db.booking.update({
      where: { id: bookingId },
      data: {
        status: 'confirmed',
        paymob_order_id: paymobOrderId,
        payment_method: paymentMethod as any,
      },
    }),
    // Increment slot booked_count
    db.slot.update({
      where: { id: booking.slot_id },
      data: { booked_count: { increment: booking.party_size } },
    }),
  ]);

  // Release Redis lock (slot is now officially booked in DB)
  await releaseSlotLock(redis, booking.slot_id, bookingId);
}

// ── Cancel Booking ───────────────────────────────────────────

export async function cancelBooking(
  db: PrismaClient,
  bookingId: string,
  cancelledBy: 'consumer' | 'business',
  reason?: string
): Promise<{ refund_amount: number; deposit_forfeited: boolean }> {
  const booking = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { slot: true },
  });

  if (!['confirmed'].includes(booking.status)) {
    throw new BookingEngineError('CANNOT_CANCEL_IN_CURRENT_STATE');
  }

  const now = new Date();
  const slotStart = booking.slot.start_time;
  const windowHours = booking.slot.cancellation_window_hours;
  const windowMs = windowHours * 60 * 60 * 1000;
  const isInsideCancellationWindow = (slotStart.getTime() - now.getTime()) < windowMs;

  let refundAmount = 0;
  let depositForfeited = false;

  if (cancelledBy === 'consumer') {
    depositForfeited = isInsideCancellationWindow;
    refundAmount = depositForfeited ? 0 : Number(booking.deposit_amount);
  } else {
    // Business cancels: full refund always
    refundAmount = Number(booking.deposit_amount);
  }

  const newStatus = cancelledBy === 'consumer' ? 'cancelled_by_consumer' : 'cancelled_by_business';

  await db.$transaction([
    db.booking.update({
      where: { id: bookingId },
      data: {
        status: newStatus as any,
        cancelled_at: now,
        cancellation_reason: reason ?? `${cancelledBy}_request`,
      },
    }),
    db.slot.update({
      where: { id: booking.slot_id },
      data: { booked_count: { decrement: booking.party_size } },
    }),
  ]);

  return { refund_amount: refundAmount, deposit_forfeited: depositForfeited };
}

// ── No-Show Transition ───────────────────────────────────────

export async function markNoShow(db: PrismaClient, bookingId: string): Promise<void> {
  await db.booking.update({
    where: { id: bookingId },
    data: { status: 'no_show', no_show_detected_at: new Date() },
  });
  await db.user.update({
    where: {
      id: (await db.booking.findUniqueOrThrow({ where: { id: bookingId } })).consumer_id,
    },
    data: {
      no_show_count: { increment: 1 },
    },
  });
  // deposit_mandatory flag is set by a separate DB trigger or post-update check
}

// ── Custom Error ─────────────────────────────────────────────

export class BookingEngineError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'BookingEngineError';
  }
}

// ── Error Code → HTTP Status Mapping ────────────────────────

export const BOOKING_ERROR_MESSAGES: Record<string, { en: string; ar: string; status: number }> = {
  SLOT_NOT_FOUND: { en: 'Slot not found.', ar: 'الوقت المطلوب غير موجود.', status: 404 },
  SLOT_BLOCKED: { en: 'This slot is not available.', ar: 'هذا الوقت غير متاح.', status: 409 },
  SLOT_PAST: { en: 'This slot has already passed.', ar: 'هذا الوقت قد انتهى.', status: 409 },
  SLOT_CAPACITY_EXCEEDED: { en: 'Not enough capacity for your party size.', ar: 'لا تتوفر أماكن كافية لعدد ضيوفك.', status: 409 },
  SLOT_ALREADY_HELD: { en: 'This slot is currently held by another user. Try again in a few minutes.', ar: 'هذا الوقت محجوز مؤقتاً. حاول مرة أخرى بعد قليل.', status: 409 },
  SLOT_NOT_AVAILABLE: { en: 'This slot is no longer available.', ar: 'هذا الوقت لم يعد متاحاً.', status: 409 },
  INVALID_STATE_TRANSITION: { en: 'This action is not allowed in the current booking state.', ar: 'هذا الإجراء غير مسموح به في الحالة الحالية للحجز.', status: 409 },
  CANNOT_CANCEL_IN_CURRENT_STATE: { en: 'This booking cannot be cancelled.', ar: 'لا يمكن إلغاء هذا الحجز.', status: 409 },
};
