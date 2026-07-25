import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyError } from 'fastify';
import { errorHandler, notFoundHandler } from './error-handler.js';

// Minimal reply/request doubles for direct unit calls.
function makeReply() {
  const reply = {
    statusCode: 0,
    body: undefined as unknown,
    code(c: number) {
      reply.statusCode = c;
      return reply;
    },
    send(b: unknown) {
      reply.body = b;
      return reply;
    },
  };
  return reply;
}

const makeRequest = () => ({
  url: '/v1/test',
  log: { warn: vi.fn(), error: vi.fn() },
});

describe('errorHandler', () => {
  it('maps a validation error to the standard envelope with VALIDATION_ERROR', () => {
    const reply = makeReply();
    const request = makeRequest();
    const err = {
      validation: [{ instancePath: '/date', message: 'must match pattern' }],
    } as unknown as FastifyError;

    errorHandler(err, request as never, reply as never);

    expect(reply.statusCode).toBe(400);
    expect(reply.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data.',
        message_ar: 'بيانات الطلب غير صحيحة.',
      },
    });
    expect(request.log.warn).toHaveBeenCalled();
  });

  it('does NOT echo the internal schema pattern back to the caller', () => {
    const reply = makeReply();
    const request = makeRequest();
    const err = {
      validation: [{ message: 'must match pattern "^[0-9]{4}-..."' }],
    } as unknown as FastifyError;

    errorHandler(err, request as never, reply as never);

    // The pattern is logged for debugging but must not appear in the response.
    expect(JSON.stringify(reply.body)).not.toContain('must match pattern');
    expect(JSON.stringify(reply.body)).not.toContain('^[0-9]');
  });

  it('keeps 5xx opaque — never leaks the internal error message', () => {
    const reply = makeReply();
    const request = makeRequest();
    const err = Object.assign(
      new Error('connect ECONNREFUSED 10.0.0.5:5432 — relation "bookings" does not exist'),
      { statusCode: 500 }
    ) as FastifyError;

    errorHandler(err, request as never, reply as never);

    expect(reply.statusCode).toBe(500);
    expect(reply.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
        message_ar: 'حدث خطأ غير متوقع.',
      },
    });
    const serialized = JSON.stringify(reply.body);
    expect(serialized).not.toContain('ECONNREFUSED');
    expect(serialized).not.toContain('bookings');
    expect(serialized).not.toContain('10.0.0.5');
  });

  it('treats an error with no statusCode as 500 (opaque)', () => {
    const reply = makeReply();
    const request = makeRequest();
    errorHandler(new Error('boom') as FastifyError, request as never, reply as never);

    expect(reply.statusCode).toBe(500);
    expect((reply.body as { error: { code: string } }).error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(reply.body)).not.toContain('boom');
  });

  it('describes 4xx errors, which are caller mistakes and safe to surface', () => {
    const reply = makeReply();
    const request = makeRequest();
    const err = Object.assign(new Error('Rate limit exceeded'), {
      statusCode: 429,
      code: 'FST_ERR_RATE_LIMIT',
    }) as FastifyError;

    errorHandler(err, request as never, reply as never);

    expect(reply.statusCode).toBe(429);
    expect(reply.body).toEqual({
      error: {
        code: 'FST_ERR_RATE_LIMIT',
        message: 'Rate limit exceeded',
        message_ar: 'الطلب غير صحيح.',
      },
    });
  });
});

describe('notFoundHandler', () => {
  it('returns the standard envelope rather than Fastify default body', () => {
    const reply = makeReply();
    notFoundHandler(makeRequest() as never, reply as never);

    expect(reply.statusCode).toBe(404);
    expect(reply.body).toEqual({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'Route not found.',
        message_ar: 'المسار غير موجود.',
      },
    });
  });
});

// ── Regression guard for the actual production bug ──────────────────────
//
// The handlers themselves were always correct; the bug was that index.ts
// registered them AFTER `await fastify.register(routes)`, so the already-built
// route contexts never inherited them and Fastify's defaults were served
// instead. These tests encode that ordering requirement.

describe('handler registration order (the production bug)', () => {
  async function buildApp(order: 'before' | 'after') {
    const app = Fastify();
    const routes = async (instance: typeof app) => {
      instance.get(
        '/thing',
        { schema: { querystring: { type: 'object', properties: { n: { type: 'integer' } } } } },
        async () => ({ ok: true })
      );
    };

    if (order === 'before') {
      app.setErrorHandler(errorHandler);
      app.setNotFoundHandler(notFoundHandler);
      await app.register(routes, { prefix: '/v1' });
    } else {
      await app.register(routes, { prefix: '/v1' });
      app.setErrorHandler(errorHandler);
      app.setNotFoundHandler(notFoundHandler);
    }
    await app.ready();
    return app;
  }

  it('handlers registered BEFORE routes produce the standard envelope', async () => {
    const app = await buildApp('before');
    const res = await app.inject({ method: 'GET', url: '/v1/thing?n=notanumber' });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data.',
        message_ar: 'بيانات الطلب غير صحيحة.',
      },
    });
    await app.close();
  });

  it('handlers registered AFTER routes are bypassed — this was the bug', async () => {
    const app = await buildApp('after');
    const res = await app.inject({ method: 'GET', url: '/v1/thing?n=notanumber' });

    expect(res.statusCode).toBe(400);
    // Fastify's built-in shape leaks through instead of the app envelope.
    expect(res.json()).toHaveProperty('code', 'FST_ERR_VALIDATION');
    expect(res.json()).not.toHaveProperty('error.code', 'VALIDATION_ERROR');
    await app.close();
  });
});
