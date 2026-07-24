import { defineConfig } from 'vitest/config';

// NOTE: env is provided here (applied before any module loads) AND redundantly in
// test/setup.ts. This is required because:
//   1. src/config/env.ts runs envSchema.safeParse(process.env) at import time and
//      calls process.exit(1) on failure — every module under test transitively
//      imports it, so valid env MUST exist before the first import.
//   2. Vitest sets NODE_ENV='test' by default, which env.ts's zod enum rejects
//      (only development|staging|production) → process.exit(1) before any test runs.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    clearMocks: true,
    env: {
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://u:p@localhost:5432/test',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'test_access_secret_at_least_32_chars_long_xx',
      JWT_REFRESH_SECRET: 'test_refresh_secret_at_least_32_chars_long_x',
      PAYMOB_HMAC_SECRET: 'test_hmac_secret',
      PAYMOB_API_KEY: 'test_api_key',
      PAYMOB_INTEGRATION_ID_CARD: '111',
      PAYMOB_INTEGRATION_ID_FAWRY: '222',
      PAYMOB_INTEGRATION_ID_VODAFONE: '333',
      PAYMOB_INTEGRATION_ID_INSTAPAY: '444',
      PAYMOB_INTEGRATION_ID_MEEZA: '555',
    },
  },
});
