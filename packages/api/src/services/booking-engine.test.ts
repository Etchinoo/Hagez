import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  generateBookingRef,
  checkSlotAvailability,
  cancelBooking,
  confirmBooking,
  markNoShow,
  BookingEngineError,
} from './booking-engine.js';

// ── Booking reference generator ──────────────────────────────
describe('generateBookingRef', () => {
  afterEach(() => vi.useRealTimers());

  it('matches BK-YYYYMMDD-XXXXX with the current UTC date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-24T10:00:00Z'));
    // charset is A-Z minus I,O plus 2-9 (L is intentionally included)
    expect(generateBookingRef()).toMatch(/^BK-20260724-[A-HJ-NP-Z2-9]{5}$/);
  });

  it('never emits ambiguous characters 0, 1, O, I across 1000 refs', () => {
    for (let i = 0; i < 1000; i++) {
      const suffix = generateBookingRef().split('-')[2];
      expect(suffix).not.toMatch(/[01OI]/);
    }
  });
});

// ── Slot availability & capacity boundaries ──────────────────
describe('checkSlotAvailability', () => {
  const future = () => new Date(Date.now() + 86_400_000);
  const db = (slot: unknown) => ({ slot: { findUnique: vi.fn().mockResolvedValue(slot) } });

  it('SLOT_NOT_FOUND when the slot does not exist', async () => {
    expect(await checkSlotAvailability(db(null) as never, 's', 2))
      .toEqual({ available: false, reason: 'SLOT_NOT_FOUND' });
  });

  it('SLOT_BLOCKED when status is blocked', async () => {
    expect(await checkSlotAvailability(
      db({ status: 'blocked', start_time: future(), booked_count: 0, capacity: 4 }) as never, 's', 2))
      .toEqual({ available: false, reason: 'SLOT_BLOCKED' });
  });

  it('SLOT_PAST when status is past', async () => {
    expect(await checkSlotAvailability(
      db({ status: 'past', start_time: future(), booked_count: 0, capacity: 4 }) as never, 's', 2))
      .toEqual({ available: false, reason: 'SLOT_PAST' });
  });

  it('SLOT_PAST when start_time is already in the past', async () => {
    expect(await checkSlotAvailability(
      db({ status: 'available', start_time: new Date(Date.now() - 1000), booked_count: 0, capacity: 4 }) as never, 's', 2))
      .toEqual({ available: false, reason: 'SLOT_PAST' });
  });

  it('SLOT_CAPACITY_EXCEEDED when booked_count + party_size exceeds capacity', async () => {
    expect(await checkSlotAvailability(
      db({ status: 'available', start_time: future(), booked_count: 3, capacity: 4 }) as never, 's', 2))
      .toEqual({ available: false, reason: 'SLOT_CAPACITY_EXCEEDED' });
  });

  it('allows a slot that is exactly full (booked_count + party_size === capacity)', async () => {
    expect(await checkSlotAvailability(
      db({ status: 'available', start_time: future(), booked_count: 2, capacity: 4 }) as never, 's', 2))
      .toEqual({ available: true });
  });

  it('allows a future slot with remaining capacity', async () => {
    expect(await checkSlotAvailability(
      db({ status: 'available', start_time: future(), booked_count: 0, capacity: 4 }) as never, 's', 2))
      .toEqual({ available: true });
  });
});

// ── Cancellation: refund vs forfeit + window boundary ────────
describe('cancelBooking', () => {
  function makeDb(booking: unknown) {
    return {
      booking: { findUniqueOrThrow: vi.fn().mockResolvedValue(booking), update: vi.fn((a: unknown) => a) },
      slot: { update: vi.fn((a: unknown) => a) },
      bookingStatusLog: { create: vi.fn() },
      $transaction: vi.fn().mockResolvedValue([]),
    };
  }
  const base = (over: Record<string, unknown> = {}) => ({
    id: 'bk1', status: 'confirmed', party_size: 2, deposit_amount: 100,
    slot_id: 's1', consumer_id: 'c1',
    slot: { start_time: new Date(Date.now() + 100 * 3600 * 1000), cancellation_window_hours: 24 },
    ...over,
  });

  it('throws when the booking is not confirmed', async () => {
    await expect(cancelBooking(makeDb(base({ status: 'pending_payment' })) as never, 'bk1', 'consumer'))
      .rejects.toBeInstanceOf(BookingEngineError);
  });

  it('consumer cancelling OUTSIDE the window gets a full refund (not forfeited)', async () => {
    const res = await cancelBooking(makeDb(base()) as never, 'bk1', 'consumer');
    expect(res).toEqual({ refund_amount: 100, deposit_forfeited: false });
  });

  it('consumer cancelling INSIDE the window forfeits the deposit (zero refund)', async () => {
    const booking = base({ slot: { start_time: new Date(Date.now() + 1 * 3600 * 1000), cancellation_window_hours: 24 } });
    const res = await cancelBooking(makeDb(booking) as never, 'bk1', 'consumer');
    expect(res).toEqual({ refund_amount: 0, deposit_forfeited: true });
  });

  it('business cancelling inside the window never forfeits — full refund', async () => {
    const booking = base({ slot: { start_time: new Date(Date.now() + 1 * 3600 * 1000), cancellation_window_hours: 24 } });
    const res = await cancelBooking(makeDb(booking) as never, 'bk1', 'business');
    expect(res).toEqual({ refund_amount: 100, deposit_forfeited: false });
  });
});

// ── Confirm booking state machine ────────────────────────────
describe('confirmBooking', () => {
  function makeDeps(booking: unknown) {
    const db = {
      booking: { findUniqueOrThrow: vi.fn().mockResolvedValue(booking), update: vi.fn((a: unknown) => a) },
      slot: { update: vi.fn((a: unknown) => a) },
      bookingStatusLog: { create: vi.fn() },
      $transaction: vi.fn().mockResolvedValue([]),
    };
    const redis = { get: vi.fn().mockResolvedValue('bk1'), del: vi.fn(), set: vi.fn() };
    return { db, redis };
  }

  it('throws INVALID_STATE_TRANSITION when the booking is not pending_payment', async () => {
    const { db, redis } = makeDeps({ id: 'bk1', status: 'confirmed', slot_id: 's1', party_size: 2 });
    await expect(confirmBooking(db as never, redis as never, 'bk1', 'order1', 'card'))
      .rejects.toThrow('INVALID_STATE_TRANSITION');
  });

  it('confirms in one transaction (2 ops) and releases the slot lock', async () => {
    const { db, redis } = makeDeps({ id: 'bk1', status: 'pending_payment', slot_id: 's1', party_size: 2 });
    await confirmBooking(db as never, redis as never, 'bk1', 'order1', 'card');
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.$transaction.mock.calls[0][0]).toHaveLength(2);
    expect(redis.del).toHaveBeenCalledWith('SLOT_HOLD:s1');
  });
});

// ── No-show transition ───────────────────────────────────────
describe('markNoShow', () => {
  it('atomically claims confirmed→no_show, increments no_show_count, logs, and returns true', async () => {
    const db = {
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'bk1', consumer_id: 'c1' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      user: { update: vi.fn() },
      bookingStatusLog: { create: vi.fn() },
    };
    const claimed = await markNoShow(db as never, 'bk1');
    expect(claimed).toBe(true);
    expect(db.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'bk1', status: 'confirmed' },
        data: expect.objectContaining({ status: 'no_show' }),
      })
    );
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'c1' }, data: { no_show_count: { increment: 1 } } })
    );
    expect(db.bookingStatusLog.create).toHaveBeenCalled();
  });

  it('returns false and does NOT increment or log when another runner already claimed it (H2)', async () => {
    const db = {
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'bk1', consumer_id: 'c1' }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      user: { update: vi.fn() },
      bookingStatusLog: { create: vi.fn() },
    };
    const claimed = await markNoShow(db as never, 'bk1');
    expect(claimed).toBe(false);
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.bookingStatusLog.create).not.toHaveBeenCalled();
  });
});
