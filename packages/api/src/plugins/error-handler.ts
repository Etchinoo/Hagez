import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

// ============================================================
// Global error + not-found handlers.
//
// Extracted from index.ts so they can be unit tested directly — the previous
// inline versions were unreachable in production (see index.ts for why) and
// nothing caught it, because there was no way to assert on them.
//
// Contract: every error response uses the app's standard envelope
//   { error: { code, message, message_ar } }
// which is what the dashboard and mobile clients parse. Fastify's built-in
// shape ({ statusCode, code, error, message }) must never reach a client.
// ============================================================

/**
 * 5xx bodies must not echo `error.message` — it can contain Prisma query
 * fragments, constraint names, connection strings and other internals.
 * 4xx are caller mistakes and safe to describe.
 */
export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (error.validation) {
    // A client mistake, not a server fault — log at warn so real errors stay
    // visible. The validation detail is logged but deliberately NOT returned:
    // it echoes internal schema patterns back to the caller.
    request.log.warn(
      { path: request.url, validation: error.validation },
      'request validation failed'
    );
    return reply.code(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data.',
        message_ar: 'بيانات الطلب غير صحيحة.',
      },
    });
  }

  const statusCode = error.statusCode ?? 500;

  if (statusCode >= 400 && statusCode < 500) {
    request.log.warn({ err: error, path: request.url }, 'client error');
    return reply.code(statusCode).send({
      error: {
        code: error.code ?? 'BAD_REQUEST',
        message: error.message,
        message_ar: 'الطلب غير صحيح.',
      },
    });
  }

  request.log.error({ err: error, path: request.url }, 'unhandled server error');
  return reply.code(statusCode).send({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      message_ar: 'حدث خطأ غير متوقع.',
    },
  });
}

/** Unknown routes get the standard envelope too, not Fastify's default body. */
export function notFoundHandler(_request: FastifyRequest, reply: FastifyReply) {
  return reply.code(404).send({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: 'Route not found.',
      message_ar: 'المسار غير موجود.',
    },
  });
}
