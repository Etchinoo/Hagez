// Forces a valid environment BEFORE any source module (which all transitively
// import src/config/env.ts) is loaded. NODE_ENV is forced with '=' (not '??=')
// because Vitest sets it to 'test', which env.ts rejects and would process.exit(1).
process.env.NODE_ENV = 'development';
process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_at_least_32_chars_long_xx';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_at_least_32_chars_long_x';
process.env.PAYMOB_HMAC_SECRET = 'test_hmac_secret';
process.env.PAYMOB_API_KEY = 'test_api_key';
process.env.PAYMOB_INTEGRATION_ID_CARD = '111';
process.env.PAYMOB_INTEGRATION_ID_FAWRY = '222';
process.env.PAYMOB_INTEGRATION_ID_VODAFONE = '333';
process.env.PAYMOB_INTEGRATION_ID_INSTAPAY = '444';
process.env.PAYMOB_INTEGRATION_ID_MEEZA = '555';
