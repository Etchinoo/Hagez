import { describe, it, expect } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import authRoutes from './auth.js';
import bookingRoutes from './bookings.js';

// Builds an app that mirrors index.ts's validation error handler, with a
// permissive `authenticate` so we exercise the SCHEMA layer (which runs before
// the handler) and an empty db (never reached on invalid input).
//
// Note on unknown fields: Fastify's ajv defaults to `removeAdditional: true`,
// so `additionalProperties: false` STRIPS unexpected fields rather than 400ing.
// That still neutralizes mass-assignment (an injected `business_id`/`platform_fee`
// is removed before the handler/Prisma sees it) — it just isn't a 400, so we
// don't assert one here.
async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(jwt, { secret: process.env.JWT_ACCESS_SECRET as string });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.decorate('db', {} as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.decorate('redis', {} as any);
  app.decorate('authenticate', async () => { /* allow through — we test validation */ });
  app.setErrorHandler((error, _request, reply) => {
    if (error.validation) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR' } });
    }
    return reply.code(error.statusCode ?? 500).send({ error: { code: 'INTERNAL_ERROR' } });
  });
  await app.register(authRoutes);
  await app.register(bookingRoutes);
  await app.ready();
  return app;
}

describe('request validation (H8) — auth', () => {
  it('rejects a non-Egyptian phone with 400 VALIDATION_ERROR', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/auth/otp/request', payload: { phone: '+1555000111' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    await app.close();
  });

  it('rejects an OTP that is not 6 digits', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/auth/otp/verify', payload: { phone: '+201000000000', otp: '12' } });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('rejects a request missing the required phone field', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/auth/otp/request', payload: {} });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

describe('request validation (H8) — bookings', () => {
  const validIds = { slot_id: '11111111-1111-1111-1111-111111111111', business_id: '22222222-2222-2222-2222-222222222222' };

  it('rejects party_size below 1 (M10 — capacity corruption)', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/bookings', payload: { ...validIds, party_size: -5 } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    await app.close();
  });

  it('rejects a non-UUID booking id in the path', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/bookings/not-a-uuid' });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('rejects page below 1 in the list query (L2 — negative skip 500)', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/bookings?page=0' });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('rejects a booking create missing the required slot_id/business_id', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/bookings', payload: { party_size: 2 } });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
