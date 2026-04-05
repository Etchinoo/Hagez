// ============================================================
// SUPER RESERVATION PLATFORM — Booking Engine
// Handles: slot availability, Redis locking, state machine,
// booking ref generation, conflict detection, reschedule.
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

// ── State Transition Logger ───────────────────────────────────

export async function logStateTransition(
  db: PrismaClient,
  bookingId: string,
  fromStatus: string,
  toStatus: string,
  actor: 'consumer' | 'business' | 'platform' | 'system',
  reason?: string
): Promise<void> {
  await db.bookingStatusLog.create({
    data: {
      booking_id: bookingId,
      from_status: fromStatus,
      to_status: toStatus,
      actor,
      reason: reason ?? null,
    },
  });
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

// ── Conflict Detection (US-023) ───────────────────────────────
// Returns null if no conflict, or a conflict descriptor.

export async function detectConflicts(
  db: PrismaClient,
  params: {
    consumer_id: string;
    slot_id: string;
    resource_id?: string;   // staff member (salon)
  }
): Promise<{
  type: 'staff_double_book' | 'consumer_overlap';
  blocking: boolean;
  message_ar: string;
  alternatives?: Array<{ id: string; start_time: Date }>;
} | null> {
  const slot = await db.slot.findUniqueOrThrow({
    where: { id: params.slot_id },
    select: { start_time: true, end_time: true, business_id: true },
  });

  // 1. Staff double-booking (hard block — salon only)
  if (params.resource_id) {
    const staffConflict = await db.booking.findFirst({
      where: {
        resource_id: params.resource_id,
        status: { in: ['confirmed', 'pending_payment'] },
        slot: {
          start_time: { lt: slot.end_time },
          end_time:   { gt: slot.start_time },
        },
      },
    });

    if (staffConflict) {
      // Find next available slot for this staff member
      const alternatives = await db.slot.findMany({
        where: {
          business_id: slot.business_id,
          resource_id: params.resource_id,
          start_time: { gt: slot.start_time },
          status: 'available',
        },
        orderBy: { start_time: 'asc' },
        take: 3,
        select: { id: true, start_time: true },
      });

      return {
        type: 'staff_double_book',
        blocking: true,
        message_ar: 'المتخصص محجوز في هذا الوقت. اختر وقتًا آخر.',
        alternatives,
      };
    }
  }

  // 2. Consumer booking same time at another business (soft warning)
  const consumerOverlap = await db.booking.findFirst({
    where: {
      consumer_id: params.consumer_id,
      status: { in: ['confirmed', 'pending_payment'] },
      slot: {
        start_time: { lt: slot.end_time },
        end_time:   { gt: slot.start_time },
      },
    },
    include: { business: { select: { name_ar: true } } },
  });

  if (consumerOverlap) {
    return {
      type: 'consumer_overlap',
      blocking: false,
      message_ar: `لديك حجز آخر في نفس الوقت في ${consumerOverlap.business.name_ar}. هل تريد المتابعة؟`,
    };
  }

  return null;
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
    section_preference?: string;
    override_consumer_overlap?: boolean;
  }
): Promise<BookingCreationResult> {
  const {
    consumer_id, business_id, slot_id, resource_id,
    party_size, occasion, special_requests, section_preference,
    override_consumer_overlap = false,
  } = params;

  // 1. Check slot availability
  const availability = await checkSlotAvailability(db, slot_id, party_size);
  if (!availability.available) {
    throw new BookingEngineError(availability.reason ?? 'SLOT_NOT_AVAILABLE');
  }

  // 2. Conflict detection (US-023)
  const conflict = await detectConflicts(db, { consumer_id, slot_id, resource_id });
  if (conflict) {
    if (conflict.blocking) {
      throw new BookingEngineErrorWithData(
        conflict.type === 'staff_double_book' ? 'STAFF_DOUBLE_BOOK' : 'CONFLICT',
        { alternatives: conflict.alternatives, message_ar: conflict.message_ar }
      );
    }
    // Consumer overlap: only block if not explicitly overridden
    if (!override_consumer_overlap) {
      throw new BookingEngineErrorWithData('CONSUMER_OVERLAP', {
        message_ar: conflict.message_ar,
      });
    }
  }

  // 3. Fetch business to get category (for platform fee)
  const [slot, business] = await Promise.all([
    db.slot.findUniqueOrThrow({ where: { id: slot_id } }),
    db.business.findUniqueOrThrow({ where: { id: business_id } }),
  ]);

  const platformFee = PLATFORM_FEES[business.category] ?? 25;

  // 4. Generate booking ref (retry up to 3 times on collision)
  let booking_ref = generateBookingRef();
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await db.booking.findUnique({ where: { booking_ref } });
    if (!existing) break;
    booking_ref = generateBookingRef();
  }

  // 5. Create booking in PENDING_PAYMENT state
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
      section_preference: section_preference ?? null,
      status: 'pending_payment',
      deposit_amount: slot.deposit_amount,
      platform_fee: platformFee,
    },
  });

  // 6. Log initial state
  await logStateTransition(db, booking.id, 'created', 'pending_payment', 'consumer');

  // 7. Acquire Redis slot lock (8 min)
  const lockAcquired = await acquireSlotLock(
    redis,
    slot_id,
    booking.id,
    env.SLOT_HOLD_TTL_SECONDS
  );

  if (!lockAcquired) {
    await db.booking.update({ where: { id: booking.id }, data: { status: 'expired' } });
    throw new BookingEngineError('SLOT_ALREADY_HELD');
  }

  const holdExpiresAt = new Date(Date.now() + env.SLOT_HOLD_TTL_SECONDS * 1000);

  return {
    booking_id: booking.id,
    booking_ref: booking.booking_ref,
    slot_hold_expires_at: holdExpiresAt,
    payment_intent: { order_id: '', payment_key: '', iframe_url: '' },
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
    db.booking.update({
      where: { id: bookingId },
      data: {
        status: 'confirmed',
        paymob_order_id: paymobOrderId,
        payment_method: paymentMethod as any,
      },
    }),
    db.slot.update({
      where: { id: booking.slot_id },
      data: { booked_count: { increment: booking.party_size } },
    }),
  ]);

  await logStateTransition(db, bookingId, 'pending_payment', 'confirmed', 'platform', `paymob:${paymobOrderId}`);
  await releaseSlotLock(redis, booking.slot_id, bookingId);
}

// ── Reschedule Booking (US-021) ───────────────────────────────

export async function rescheduleBooking(
  db: PrismaClient,
  redis: Redis,
  bookingId: string,
  newSlotId: string,
  consumerId: string
): Promise<{ new_booking_ref: string; slot_hold_expires_at: Date }> {
  const booking = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { slot: true },
  });

  if (booking.consumer_id !== consumerId) {
    throw new BookingEngineError('FORBIDDEN');
  }

  if (booking.status !== 'confirmed') {
    throw new BookingEngineError('CANNOT_RESCHEDULE_IN_CURRENT_STATE');
  }

  // Enforce cancellation window — must be outside window to reschedule
  const now = new Date();
  const slotStart = booking.slot.start_time;
  const windowMs = booking.slot.cancellation_window_hours * 60 * 60 * 1000;
  if (slotStart.getTime() - now.getTime() < windowMs) {
    throw new BookingEngineError('RESCHEDULE_OUTSIDE_WINDOW');
  }

  // Enforce reschedule limit (max 2 per booking)
  if ((booking.reschedule_count ?? 0) >= 2) {
    throw new BookingEngineError('RESCHEDULE_LIMIT_REACHED');
  }

  // Check new slot availability
  const availability = await checkSlotAvailability(db, newSlotId, booking.party_size);
  if (!availability.available) {
    throw new BookingEngineError(availability.reason ?? 'SLOT_NOT_AVAILABLE');
  }

  // Acquire lock on new slot
  const lockAcquired = await acquireSlotLock(redis, newSlotId, bookingId, env.SLOT_HOLD_TTL_SECONDS);
  if (!lockAcquired) {
    throw new BookingEngineError('SLOT_ALREADY_HELD');
  }

  // Atomically: release old slot, update booking, increment booked on new slot
  const oldSlotId = booking.slot_id;
  await db.$transaction([
    db.booking.update({
      where: { id: bookingId },
      data: {
        slot_id: newSlotId,
        reschedule_count: { increment: 1 },
        rescheduled_at: now,
      },
    }),
    db.slot.update({
      where: { id: oldSlotId },
      data: { booked_count: { decrement: booking.party_size } },
    }),
    db.slot.update({
      where: { id: newSlotId },
      data: { booked_count: { increment: booking.party_size } },
    }),
  ]);

  await logStateTransition(db, bookingId, 'confirmed', 'confirmed', 'consumer', `rescheduled_to:${newSlotId}`);
  await releaseSlotLock(redis, oldSlotId, bookingId);
  await releaseSlotLock(redis, newSlotId, bookingId);

  const holdExpiresAt = new Date(Date.now() + env.SLOT_HOLD_TTL_SECONDS * 1000);
  return { new_booking_ref: booking.booking_ref, slot_hold_expires_at: holdExpiresAt };
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
  const windowMs = booking.slot.cancellation_window_hours * 60 * 60 * 1000;
  const isInsideCancellationWindow = (slotStart.getTime() - now.getTime()) < windowMs;

  const depositForfeited = cancelledBy === 'consumer' && isInsideCancellationWindow;
  const refundAmount = depositForfeited ? 0 : Number(booking.deposit_amount);
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

  await logStateTransition(db, bookingId, 'confirmed', newStatus, cancelledBy, reason);

  return { refund_amount: refundAmount, deposit_forfeited: depositForfeited };
}

// ── No-Show Transition ───────────────────────────────────────

export async function markNoShow(db: PrismaClient, bookingId: string): Promise<void> {
  const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
  await db.booking.update({
    where: { id: bookingId },
    data: { status: 'no_show', no_show_detected_at: new Date() },
  });
  await db.user.update({
    where: { id: booking.consumer_id },
    data: { no_show_count: { increment: 1 } },
  });
  await logStateTransition(db, bookingId, 'confirmed', 'no_show', 'system', 'auto_detected');
}

// ── Custom Errors ────────────────────────────────────────────

export class BookingEngineError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'BookingEngineError';
  }
}

export class BookingEngineErrorWithData extends Error {
  constructor(
    public readonly code: string,
    public readonly data: Record<string, unknown>
  ) {
    super(code);
    this.name = 'BookingEngineErrorWithData';
  }
}

// ── Error Code → HTTP Status Mapping ────────────────────────

export const BOOKING_ERROR_MESSAGES: Record<string, { en: string; ar: string; status: number }> = {
  SLOT_NOT_FOUND:                    { en: 'Slot not found.',                                             ar: 'الوقت المطلوب غير موجود.',                          status: 404 },
  SLOT_BLOCKED:                      { en: 'This slot is not available.',                                 ar: 'هذا الوقت غير متاح.',                               status: 409 },
  SLOT_PAST:                         { en: 'This slot has already passed.',                               ar: 'هذا الوقت قد انتهى.',                               status: 409 },
  SLOT_CAPACITY_EXCEEDED:            { en: 'Not enough capacity for your party size.',                    ar: 'لا تتوفر أماكن كافية لعدد ضيوفك.',                  status: 409 },
  SLOT_ALREADY_HELD:                 { en: 'This slot is currently held. Try again in a few minutes.',   ar: 'هذا الوقت محجوز مؤقتاً. حاول مرة أخرى بعد قليل.', status: 409 },
  SLOT_NOT_AVAILABLE:                { en: 'This slot is no longer available.',                           ar: 'هذا الوقت لم يعد متاحاً.',                          status: 409 },
  STAFF_DOUBLE_BOOK:                 { en: 'This staff member is already booked at that time.',           ar: 'المتخصص محجوز في هذا الوقت.',                       status: 409 },
  CONSUMER_OVERLAP:                  { en: 'You have another booking at this time.',                      ar: 'لديك حجز آخر في نفس الوقت.',                        status: 409 },
  INVALID_STATE_TRANSITION:          { en: 'This action is not allowed in the current booking state.',   ar: 'هذا الإجراء غير مسموح به في الحالة الحالية.',       status: 409 },
  CANNOT_CANCEL_IN_CURRENT_STATE:    { en: 'This booking cannot be cancelled.',                          ar: 'لا يمكن إلغاء هذا الحجز.',                          status: 409 },
  CANNOT_RESCHEDULE_IN_CURRENT_STATE:{ en: 'This booking cannot be rescheduled.',                        ar: 'لا يمكن إعادة جدولة هذا الحجز.',                    status: 409 },
  RESCHEDULE_OUTSIDE_WINDOW:         { en: 'Reschedule is not allowed within the cancellation window.',  ar: 'لا يمكن إعادة الجدولة قرب موعد الحجز.',             status: 409 },
  RESCHEDULE_LIMIT_REACHED:          { en: 'You have reached the reschedule limit for this booking.',    ar: 'لقد وصلت للحد الأقصى لتغيير الحجز.',                status: 409 },
  FORBIDDEN:                         { en: 'Not your booking.',                                          ar: 'هذا الحجز ليس لك.',                                  status: 403 },
};
