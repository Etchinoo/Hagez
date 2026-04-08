import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('30d'),

  // Database shadow (optional — only needed for prisma migrate dev)
  DATABASE_SHADOW_URL: z.string().url().optional(),

  // Paymob — required in staging/prod, optional in local dev
  PAYMOB_API_KEY: z.string().optional(),
  PAYMOB_HMAC_SECRET: z.string().optional(),
  PAYMOB_INTEGRATION_ID_CARD: z.string().optional(),
  PAYMOB_INTEGRATION_ID_FAWRY: z.string().optional(),
  PAYMOB_INTEGRATION_ID_VODAFONE: z.string().optional(),
  PAYMOB_INTEGRATION_ID_INSTAPAY: z.string().optional(),
  PAYMOB_INTEGRATION_ID_MEEZA: z.string().optional(),
  PAYMOB_BASE_URL: z.string().url().default('https://accept.paymob.com/api'),

  // 360dialog (WhatsApp) — optional in dev
  DIALOG360_API_KEY: z.string().optional(),
  DIALOG360_BASE_URL: z.string().url().default('https://waba.360dialog.io/v1'),
  DIALOG360_WABA_NUMBER: z.string().optional(),

  // AWS SQS — optional in dev
  AWS_REGION: z.string().default('me-south-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  SQS_NOTIFICATION_QUEUE_URL: z.string().url().optional(),
  SQS_NOTIFICATION_DLQ_URL: z.string().url().optional(),

  // S3 — optional in dev
  S3_BUCKET_NAME: z.string().optional(),
  S3_BUCKET_REGION: z.string().default('me-south-1'),
  CLOUDFRONT_DOMAIN: z.string().url().optional(),

  // Google Maps — optional in dev
  GOOGLE_MAPS_API_KEY: z.string().optional(),

  // Twilio (SMS fallback) — optional in dev
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),

  // Sentry — optional in dev
  SENTRY_DSN: z.string().optional(),

  // OTP
  OTP_EXPIRY_SECONDS: z.coerce.number().default(300),
  OTP_LENGTH: z.coerce.number().default(6),

  // Platform fees (EGP)
  PLATFORM_FEE_RESTAURANT: z.coerce.number().default(25),
  PLATFORM_FEE_SALON: z.coerce.number().default(15),
  PLATFORM_FEE_COURT: z.coerce.number().default(35),
  PLATFORM_FEE_GAMING: z.coerce.number().default(20),
  PLATFORM_FEE_CAR_WASH: z.coerce.number().default(20),

  // Booking engine
  SLOT_HOLD_TTL_SECONDS: z.coerce.number().default(480),
  NO_SHOW_DETECTION_DELAY_MINUTES: z.coerce.number().default(30),
  CANCELLATION_WINDOW_DEFAULT_HOURS: z.coerce.number().default(24),
  NO_SHOW_SPLIT_BUSINESS_PCT: z.coerce.number().default(75),
  NO_SHOW_SPLIT_PLATFORM_PCT: z.coerce.number().default(25),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

// Platform fee lookup by category
export const PLATFORM_FEES: Record<string, number> = {
  restaurant: env.PLATFORM_FEE_RESTAURANT,
  salon: env.PLATFORM_FEE_SALON,
  court: env.PLATFORM_FEE_COURT,
  gaming_cafe: env.PLATFORM_FEE_GAMING,
  car_wash: env.PLATFORM_FEE_CAR_WASH,
};
