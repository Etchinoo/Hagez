import fp from 'fastify-plugin';
import Redis from 'ioredis';
import type { FastifyPluginAsync } from 'fastify';
import { env } from '../config/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

const redisPlugin: FastifyPluginAsync = async (fastify) => {
  const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
    enableReadyCheck: true,
  });

  redis.on('connect', () => fastify.log.info('✅ Redis connected'));
  redis.on('error', (err) => fastify.log.error({ err }, 'Redis connection error'));

  fastify.decorate('redis', redis);

  fastify.addHook('onClose', async () => {
    await redis.quit();
    fastify.log.info('Redis disconnected');
  });
};

export default fp(redisPlugin, { name: 'redis' });

// ── Slot Lock Helpers ────────────────────────────────────────

export function slotLockKey(slotId: string): string {
  return `SLOT_HOLD:${slotId}`;
}

/**
 * Acquire an 8-minute Redis lock on a slot.
 * Uses SET ... NX PX for atomic acquisition (no race condition).
 * Returns true if lock was acquired, false if slot is already held.
 */
export async function acquireSlotLock(
  redis: Redis,
  slotId: string,
  bookingId: string,
  ttlSeconds: number = 480
): Promise<boolean> {
  const key = slotLockKey(slotId);
  const result = await redis.set(key, bookingId, 'PX', ttlSeconds * 1000, 'NX');
  return result === 'OK';
}

/**
 * Release a slot lock. Only releases if the lock belongs to this booking (idempotent).
 */
export async function releaseSlotLock(
  redis: Redis,
  slotId: string,
  bookingId: string
): Promise<void> {
  const key = slotLockKey(slotId);
  const held = await redis.get(key);
  if (held === bookingId) {
    await redis.del(key);
  }
}

/**
 * Check who holds a slot lock and how much TTL remains.
 */
export async function getSlotLockInfo(
  redis: Redis,
  slotId: string
): Promise<{ held: boolean; bookingId: string | null; ttlMs: number }> {
  const key = slotLockKey(slotId);
  const [bookingId, ttlMs] = await Promise.all([redis.get(key), redis.pttl(key)]);
  return { held: bookingId !== null, bookingId, ttlMs };
}
