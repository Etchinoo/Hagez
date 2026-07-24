// ============================================================
// H8 remediation — schema-layer validation tests for users.ts.
//
// These tests exercise ONLY the Fastify route schemas (body/params/
// querystring), not the handler business logic. `db`/`redis` are
// decorated as empty objects, so a request that WRONGLY passed
// validation would crash trying to call an undefined Prisma/Redis
// method and 500 — a 400 here proves the schema layer rejected it.
// ============================================================

import { describe, it, expect } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import usersRoutes from './users.js';

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
  await app.register(usersRoutes);
  await app.ready();
  return app;
}

describe('users.ts — H8 schema validation', () => {
  it('rejects PATCH /users/me with an out-of-enum language_pref', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/users/me',
      payload: { language_pref: 'fr' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects POST /users/me/payment-token with a missing paymob_card_token', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/users/me/payment-token',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects POST /users/me/payment-token with an object paymob_card_token (type confusion / injection attempt)', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/users/me/payment-token',
      payload: { paymob_card_token: { $ne: null } },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects PATCH /users/me/notification-prefs with a non-boolean notify_push', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/users/me/notification-prefs',
      payload: { notify_push: 'yes' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects DELETE /users/me with a missing confirmation field', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'DELETE',
      url: '/users/me',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects GET /users/me/loyalty/history with a non-numeric page querystring value', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/users/me/loyalty/history?page=DROP TABLE users',
    });
    expect(res.statusCode).toBe(400);
  });
});
