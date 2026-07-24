import { describe, it, expect } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import adminRoutes from './admin.js';

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.decorate('db', {} as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.decorate('redis', {} as any);
  app.decorate('authenticate', async () => { /* bypass auth — testing schema layer only */ });
  app.decorate('authenticateOptional', async () => {});
  app.decorate('requireRole', () => async () => {});
  app.setErrorHandler((error, _request, reply) => {
    if (error.validation) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR' } });
    return reply.code((error as { statusCode?: number }).statusCode ?? 500).send({ error: { code: 'INTERNAL_ERROR' } });
  });
  await app.register(adminRoutes);
  await app.ready();
  return app;
}

describe('admin.ts — H8 schema validation', () => {
  it('POST /admin/refunds rejects a negative amount_egp (money-moving, previously unbounded)', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/admin/refunds',
      payload: { booking_id: '11111111-1111-1111-1111-111111111111', amount_egp: -50, reason: 'goodwill refund' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /admin/refunds rejects a non-UUID booking_id', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/admin/refunds',
      payload: { booking_id: 'not-a-uuid', amount_egp: 100, reason: 'goodwill refund' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /admin/disputes/:id/resolve rejects an out-of-enum resolution value', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/admin/disputes/11111111-1111-1111-1111-111111111111/resolve',
      payload: { resolution: 'drop_it_entirely', reason: 'admin decision' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('PATCH /admin/businesses/:id/suspend rejects a non-UUID :id param', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/admin/businesses/not-a-uuid/suspend',
      payload: { reason: 'repeated no-shows reported' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /admin/businesses/:id/services rejects a zero/negative duration_min (DoS-shaped input)', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/admin/businesses/11111111-1111-1111-1111-111111111111/services',
      payload: { name_ar: 'قص شعر', price_egp: 100, duration_min: 0 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('PATCH /admin/businesses/:id/tier rejects a tier value outside the SubscriptionTier enum', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/admin/businesses/11111111-1111-1111-1111-111111111111/tier',
      payload: { tier: 'ultra_mega_plan' },
    });
    expect(res.statusCode).toBe(400);
  });
});
