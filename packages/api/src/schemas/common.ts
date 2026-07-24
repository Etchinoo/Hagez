// ============================================================
// Reusable JSON-Schema fragments for Fastify route validation.
// (H8 remediation — adds runtime request validation to routes.)
//
// Uses `pattern` rather than `format` so no ajv-formats dependency is
// required. Fastify validates against these before handlers run and, on
// failure, the global error handler returns a 400 VALIDATION_ERROR.
// ============================================================

// RFC-4122 UUID (Prisma ids are @db.Uuid / gen_random_uuid()).
export const uuid = {
  type: 'string',
  pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
};

// Egyptian mobile in E.164: +20 then 10/11/12/15 then 8 digits.
export const egyptPhone = {
  type: 'string',
  pattern: '^\\+20(10|11|12|15)[0-9]{8}$',
};

// 6-digit numeric OTP (matches OTP_LENGTH default of 6).
export const otpCode = { type: 'string', pattern: '^[0-9]{6}$' };

// `:id` path param, UUID-shaped.
export const idParams = {
  type: 'object',
  required: ['id'],
  additionalProperties: false,
  properties: { id: uuid },
};

// Bounded 1-based page number for list endpoints.
export const pageQuery = { type: 'integer', minimum: 1, default: 1 };

// Booking lifecycle statuses (mirrors the Prisma BookingStatus enum).
export const bookingStatusEnum = [
  'pending_payment',
  'confirmed',
  'completed',
  'cancelled_by_consumer',
  'cancelled_by_business',
  'no_show',
  'disputed',
  'expired',
] as const;
