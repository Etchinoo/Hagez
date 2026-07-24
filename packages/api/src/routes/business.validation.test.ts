// ============================================================
// H8 remediation — schema-layer validation tests for business.ts.
//
// These tests exercise ONLY the Fastify route schemas (body/params/
// querystring), not the handler business logic. `db`/`redis` are
// decorated as empty objects, so a request that WRONGLY passed
// validation would crash trying to call an undefined Prisma/Redis
// method and 500 — a 400 here proves the schema layer rejected it.
//
// Scoped to the 6 highest-risk endpoints in this file: bulk slot
// generation (unbounded-loop DoS risk), booking status transition
// (money-moving payout trigger), walk-in booking creation, business
// deposit/payout policy, dynamic pricing rules, and business signup.
// ============================================================

import { describe, it, expect } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import businessRoutes from './business.js';

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
  await app.register(businessRoutes);
  await app.ready();
  return app;
}

describe('business.ts — H8 schema validation', () => {
  it('rejects POST /business/slots/bulk with a non-positive slot_duration_min (would spin the slot-generation loop forever)', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/business/slots/bulk',
      payload: {
        rules: [
          { day_of_week: 1, open_time: '09:00', close_time: '22:00', slot_duration_min: 0, capacity: 10 },
        ],
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects PATCH /business/bookings/:id/status with an out-of-enum status or non-UUID id (payout trigger)', async () => {
    const app = await buildApp();
    const badStatus = await app.inject({
      method: 'PATCH',
      url: '/business/bookings/11111111-1111-1111-1111-111111111111/status',
      payload: { status: 'refunded' },
    });
    expect(badStatus.statusCode).toBe(400);

    const badId = await app.inject({
      method: 'PATCH',
      url: '/business/bookings/not-a-uuid/status',
      payload: { status: 'completed' },
    });
    expect(badId.statusCode).toBe(400);
  });

  it('rejects POST /business/bookings (walk-in) with a malformed consumer_phone', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/business/bookings',
      payload: {
        slot_id: '11111111-1111-1111-1111-111111111111',
        consumer_name: 'Test Consumer',
        consumer_phone: '0123456789', // not E.164 Egyptian format
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects PUT /business/policy with an out-of-range cancellation_window_hours', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'PUT',
      url: '/business/policy',
      payload: { cancellation_window_hours: 999 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects POST /business/pricing-rules with an out-of-range days_of_week entry', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/business/pricing-rules',
      payload: { rule_type: 'surge', name_ar: 'عرض نهاية الأسبوع', days_of_week: [7] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects POST /business/signup with an out-of-enum category', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/business/signup',
      payload: {
        full_name: 'Test Owner',
        name_ar: 'اسم النشاط',
        category: 'not_a_real_category',
        district: 'Maadi',
      },
    });
    expect(res.statusCode).toBe(400);
  });
});
