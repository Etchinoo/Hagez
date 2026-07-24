import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  slotLockKey,
  acquireSlotLock,
  releaseSlotLock,
  getSlotLockInfo,
} from './redis.js';

// A minimal fake ioredis client — the helpers only use set/get/del/pttl.
function makeRedis() {
  return { set: vi.fn(), get: vi.fn(), del: vi.fn(), pttl: vi.fn() };
}

describe('slot lock helpers (the "8-minute hold")', () => {
  let redis: ReturnType<typeof makeRedis>;
  beforeEach(() => {
    redis = makeRedis();
  });

  it('slotLockKey namespaces the slot id', () => {
    expect(slotLockKey('abc')).toBe('SLOT_HOLD:abc');
  });

  it('acquireSlotLock uses SET NX PX (atomic) and returns true on OK', async () => {
    redis.set.mockResolvedValue('OK');
    const ok = await acquireSlotLock(redis as never, 'slot1', 'book1', 480);
    expect(ok).toBe(true);
    expect(redis.set).toHaveBeenCalledWith('SLOT_HOLD:slot1', 'book1', 'NX', 'PX', 480_000);
  });

  it('acquireSlotLock returns false when the slot is already held (SET returns null)', async () => {
    redis.set.mockResolvedValue(null);
    expect(await acquireSlotLock(redis as never, 'slot1', 'book1', 480)).toBe(false);
  });

  it('acquireSlotLock defaults the TTL to 480s (8 minutes)', async () => {
    redis.set.mockResolvedValue('OK');
    await acquireSlotLock(redis as never, 'slot1', 'book1');
    expect(redis.set).toHaveBeenCalledWith('SLOT_HOLD:slot1', 'book1', 'NX', 'PX', 480_000);
  });

  it('releaseSlotLock deletes the key only when THIS booking owns the lock', async () => {
    redis.get.mockResolvedValue('book1');
    await releaseSlotLock(redis as never, 'slot1', 'book1');
    expect(redis.del).toHaveBeenCalledWith('SLOT_HOLD:slot1');
  });

  it('releaseSlotLock does NOT delete a lock owned by another booking', async () => {
    redis.get.mockResolvedValue('anotherBooking');
    await releaseSlotLock(redis as never, 'slot1', 'book1');
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('releaseSlotLock is idempotent when the key is absent', async () => {
    redis.get.mockResolvedValue(null);
    await releaseSlotLock(redis as never, 'slot1', 'book1');
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('getSlotLockInfo reports holder and remaining TTL', async () => {
    redis.get.mockResolvedValue('book1');
    redis.pttl.mockResolvedValue(123_456);
    expect(await getSlotLockInfo(redis as never, 'slot1')).toEqual({
      held: true,
      bookingId: 'book1',
      ttlMs: 123_456,
    });
  });

  it('getSlotLockInfo reports not-held when the key is absent', async () => {
    redis.get.mockResolvedValue(null);
    redis.pttl.mockResolvedValue(-2);
    expect(await getSlotLockInfo(redis as never, 'slot1')).toEqual({
      held: false,
      bookingId: null,
      ttlMs: -2,
    });
  });
});
