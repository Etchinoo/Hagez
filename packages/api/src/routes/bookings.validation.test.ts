// ============================================================
// H8 remediation — schema-layer validation tests for bookings.ts.
//
// These tests exercise ONLY the Fastify route schemas (body/params/
// querystring), not the handler business logic. `db`/`redis` are
// decorated as empty objects, so a request that WRONGLY passed
// validation would crash trying to call an undefined Prisma/Redis
// method and 500 — a 400 here proves the schema layer rejected it.
// ============================================================

import { describe, it, expect } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import bookingRoutes from './bookings.js';

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
  await app.register(bookingRoutes);
  await app.ready();
  return app;
}

describe('bookings.ts — H8 schema validation', () => {
  it('rejects POST /bookings with a negative party_size (would drive downstream logic on bad data)', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/bookings',
      payload: { slot_id: '11111111-1111-1111-1111-111111111111', business_id: '22222222-2222-2222-2222-222222222222', party_size: -5 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects POST /bookings with a non-UUID slot_id', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/bookings',
      payload: { slot_id: 'not-a-uuid', business_id: '22222222-2222-2222-2222-222222222222' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects POST /bookings with a negative redeem_points (loyalty balance abuse)', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/bookings',
      payload: { slot_id: '11111111-1111-1111-1111-111111111111', business_id: '22222222-2222-2222-2222-222222222222', redeem_points: -100 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects POST /bookings/:id/pay with an out-of-enum payment_method', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/bookings/11111111-1111-1111-1111-111111111111/pay',
      payload: { payment_method: 'bitcoin' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects PATCH /bookings/:id/reschedule with a non-UUID new_slot_id', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/bookings/11111111-1111-1111-1111-111111111111/reschedule',
      payload: { new_slot_id: 'tomorrow' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects POST /bookings/:id/reviews with an out-of-range rating', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/bookings/11111111-1111-1111-1111-111111111111/reviews',
      payload: { rating: 99 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects GET /bookings/:id with a non-UUID id param', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/bookings/not-a-uuid',
    });
    expect(res.statusCode).toBe(400);
  });
});
