// ============================================================
// H8 remediation — schema-layer validation tests for search.ts.
//
// These tests exercise ONLY the Fastify route schemas (params/
// querystring), not the handler business logic. `db`/`redis` are
// decorated as empty objects, so a request that WRONGLY passed
// validation would crash trying to call an undefined Prisma/Redis
// method and 500 — a 400 here proves the schema layer rejected it.
// ============================================================

import { describe, it, expect } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import searchRoutes from './search.js';

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
  await app.register(searchRoutes);
  await app.ready();
  return app;
}

describe('search.ts — H8 schema validation', () => {
  it('rejects GET /search/businesses with a negative party_size (would drive an unbounded capacity filter)', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/search/businesses?party_size=-5',
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects GET /search/businesses with an out-of-range lat (e.g. 999)', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/search/businesses?lat=999&lng=31.2',
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects GET /search/businesses with an out-of-enum category', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/search/businesses?category=nightclub',
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects GET /businesses/:id with a non-UUID id param', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/businesses/not-a-uuid',
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects GET /businesses/:id/slots with a malformed date (would drive an Invalid Date into the Prisma range filter)', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/businesses/11111111-1111-1111-1111-111111111111/slots?date=not-a-date',
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects GET /businesses/:id/slots with a non-UUID resource_id', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/businesses/11111111-1111-1111-1111-111111111111/slots?resource_id=not-a-uuid',
    });
    expect(res.statusCode).toBe(400);
  });
});
