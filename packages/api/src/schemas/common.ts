// ============================================================
// Reusable JSON-Schema fragments for Fastify route validation.
// (H8 remediation — adds runtime request validation to routes.)
//
// Uses `pattern` rather than `format` so no ajv-formats dependency is
// required. Fastify validates against these before handlers run and, on
// failure, the global error handler returns a 400 VALIDATION_ERROR.
//
// Note on unknown fields: Fastify's ajv defaults to `removeAdditional: true`,
// so `additionalProperties: false` STRIPS unexpected fields rather than
// rejecting the request. That's a deliberate, low-risk default here — it
// still closes mass-assignment (an injected field never reaches Prisma)
// without breaking clients that happen to send extra fields.
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

// Bounded 1-based page number for list endpoints (string querystring form,
// since query params always arrive as strings before any coercion).
export const pageQueryStr = { type: 'string', pattern: '^[0-9]{1,6}$' };
export const pageQueryInt = { type: 'integer', minimum: 1, default: 1 };

// ISO date (YYYY-MM-DD) and month (YYYY-MM) — for query params.
export const isoDate = { type: 'string', pattern: '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' };
export const isoMonth = { type: 'string', pattern: '^[0-9]{4}-(0[1-9]|1[0-2])$' };

// HH:MM 24h time, plus 24:00 (used for "closes at midnight" business hours).
export const hhmm = { type: 'string', pattern: '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$' };

// ── Enums (mirror prisma/schema.prisma — keep in sync) ──────────────────

export const businessCategoryEnum = [
  'restaurant', 'salon', 'court', 'gaming_cafe', 'medical', 'car_wash',
] as const;

export const bookingStatusEnum = [
  'pending_payment', 'confirmed', 'completed',
  'cancelled_by_consumer', 'cancelled_by_business',
  'no_show', 'disputed', 'expired',
] as const;

export const paymentMethodEnum = [
  'card', 'instapay', 'fawry', 'vodafone_cash', 'meeza', 'card_on_file',
] as const;

export const occasionTypeEnum = ['birthday', 'anniversary', 'business', 'other'] as const;

export const resourceTypeEnum = ['staff', 'table', 'court', 'station', 'bay'] as const;

export const userRoleEnum = ['consumer', 'business_owner', 'admin', 'super_admin'] as const;

export const vehicleSizeClassEnum = ['sedan', 'suv', 'pickup', 'van'] as const;

// Business lifecycle status (mirrors BusinessStatus in schema.prisma).
// Added for admin.ts — used in business create/update bodies and the
// businesses list filter (repeated 3+ times).
export const businessStatusEnum = ['pending', 'active', 'suspended', 'deactivated'] as const;

// ── business.ts-specific reusable property fragments (H8) ───────────────
// These are spread into `properties: { ... }`, not full schemas — each
// shape below appears identically 3+ times in business.ts (resource CRUD
// updates + category-config upserts).

// Shared "name/capacity/active" update shape used by the stations/:id,
// courts/:id, and bays/:id PATCH handlers.
export const resourceUpdateProps = {
  name_ar: { type: 'string', maxLength: 200 },
  name_en: { type: 'string', maxLength: 200 },
  capacity: { type: 'integer', minimum: 1, maximum: 1000 },
  is_active: { type: 'boolean' },
};

// Shared slot-duration-options pair used by the gaming-config, court-config,
// and car-wash-config PATCH (upsert) handlers.
export const slotDurationOptionsProps = {
  slot_duration_options: {
    type: 'array',
    items: { type: 'integer', minimum: 5, maximum: 1440 },
    maxItems: 20,
  },
  default_slot_duration_minutes: { type: 'integer', minimum: 5, maximum: 1440 },
};
