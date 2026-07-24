// ============================================================
// H8 remediation — schema-layer validation tests for auth.ts.
//
// These tests exercise ONLY the Fastify route schemas (body/params/
// querystring), not the handler business logic. `db`/`redis` are
// decorated as empty objects, so a request that WRONGLY passed
// validation would crash trying to call an undefined Prisma/Redis
// method and 500 — a 400 here proves the schema layer rejected it.
// ============================================================

import { describe, it, expect } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import authRoutes from './auth.js';

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
  await app.register(authRoutes);
  await app.ready();
  return app;
}

describe('auth.ts — H8 schema validation', () => {
  it('rejects /auth/otp/request with a non-Egyptian phone number', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/otp/request',
      payload: { phone: '12345' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects /auth/otp/verify with a malformed (non 6-digit) OTP', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/otp/verify',
      payload: { phone: '+201012345678', otp: 'abc' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects /auth/firebase/verify with a missing idToken', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/firebase/verify',
      payload: { full_name: 'Someone' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects /auth/social with an out-of-enum provider', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/social',
      payload: { provider: 'facebook', token: 'a.b.c' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects /auth/refresh with a missing refresh_token', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects /auth/refresh with a non-coercible (object) refresh_token', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refresh_token: { nested: true } },
    });
    expect(res.statusCode).toBe(400);
  });
});
