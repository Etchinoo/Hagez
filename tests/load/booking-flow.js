// ============================================================
// SUPER RESERVATION PLATFORM — k6 Load Test (US-096, EP-24)
// Scenario: 100 virtual users completing full booking flow simultaneously.
// Pass criteria:
//   - Error rate         < 0.1%
//   - P95 confirmation   < 2 000 ms
//   - Redis contention   < 5%   (slot-hold conflicts / total attempts)
//   - Zero deadlocks
//
// Usage:
//   k6 run --env BASE_URL=https://staging.api.reservr.eg \
//           --env PHONE=+201000000001 \
//           tests/load/booking-flow.js
//
// Requirements: k6 v0.47+, staging env with:
//   - 10,000 seed businesses  (npm run db:seed:load in packages/api)
//   - 50,000 seed bookings
//   - Redis + PostgreSQL at production-equivalent specs
// ============================================================

import http   from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ── Custom metrics ───────────────────────────────────────────

const slotHoldContention = new Counter('slot_hold_contention');
const slotHoldAttempts   = new Counter('slot_hold_attempts');
const confirmationTime   = new Trend('booking_confirmation_ms', true);
const errorRate          = new Rate('error_rate');

// ── Options ──────────────────────────────────────────────────

export const options = {
  scenarios: {
    concurrent_booking: {
      executor:    'shared-iterations',
      vus:         100,
      iterations:  100,   // one booking per VU
      maxDuration: '3m',
    },
  },
  thresholds: {
    // US-096 AC-3: Pass criteria
    error_rate:              ['rate<0.001'],   // < 0.1%
    booking_confirmation_ms: ['p(95)<2000'],   // P95 < 2 s
    http_req_failed:         ['rate<0.001'],
  },
};

// ── Config ───────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/v1';

// Pre-seeded test accounts — one per VU to avoid phone collisions.
// Format: +2010000000XX where XX = VU index 01–100.
function phoneForVU(vuId) {
  return `+201000000${String(vuId % 100).padStart(3, '0')}`;
}

// Pre-seeded business IDs from staging seed (restaurants + salons).
// Replace with actual UUIDs after staging seed run.
const SEED_BUSINESS_IDS = [
  'REPLACE_WITH_SEED_BIZ_ID_01',
  'REPLACE_WITH_SEED_BIZ_ID_02',
  'REPLACE_WITH_SEED_BIZ_ID_03',
  'REPLACE_WITH_SEED_BIZ_ID_04',
  'REPLACE_WITH_SEED_BIZ_ID_05',
];

// ── Helpers ───────────────────────────────────────────────────

const HEADERS = { 'Content-Type': 'application/json', 'Accept-Language': 'ar' };

function headersWithAuth(token) {
  return { ...HEADERS, Authorization: `Bearer ${token}` };
}

function post(path, body, headers = HEADERS) {
  return http.post(`${BASE_URL}${path}`, JSON.stringify(body), { headers });
}

function get(path, headers = HEADERS) {
  return http.get(`${BASE_URL}${path}`, { headers });
}

// ── Main scenario ─────────────────────────────────────────────

export default function bookingFlow() {
  const vuId  = __VU;
  const phone = phoneForVU(vuId);

  // ── Step 1: OTP Request ───────────────────────────────────
  const otpRes = post('/auth/otp/request', { phone });
  check(otpRes, { 'OTP request 200': (r) => r.status === 200 });
  if (otpRes.status !== 200) { errorRate.add(1); return; }
  errorRate.add(0);

  sleep(0.2);

  // ── Step 2: OTP Verify (staging uses fixed OTP 1111) ─────
  const authRes = post('/auth/otp/verify', { phone, otp: '1111' });
  const authOk  = check(authRes, { 'Auth 200': (r) => r.status === 200 });
  if (!authOk) { errorRate.add(1); return; }
  errorRate.add(0);

  const { access_token: token } = authRes.json();

  // ── Step 3: Search businesses ─────────────────────────────
  const searchRes = get('/search/businesses?category=restaurant&limit=5', headersWithAuth(token));
  check(searchRes, { 'Search 200': (r) => r.status === 200 });
  errorRate.add(searchRes.status !== 200 ? 1 : 0);

  const businesses = searchRes.json('businesses') || [];
  const biz = businesses[0] ?? { id: SEED_BUSINESS_IDS[vuId % SEED_BUSINESS_IDS.length] };

  sleep(0.3);

  // ── Step 4: Get available slots ───────────────────────────
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const slotsRes = get(`/businesses/${biz.id}/slots?date=${tomorrow}&party_size=2`, headersWithAuth(token));
  const slotsOk  = check(slotsRes, { 'Slots 200': (r) => r.status === 200 });
  if (!slotsOk || !slotsRes.json('slots')?.length) { errorRate.add(1); return; }
  errorRate.add(0);

  const slot = slotsRes.json('slots')[0];

  sleep(0.1);

  // ── Step 5: Create booking (Redis slot hold) ──────────────
  const bookStart = Date.now();
  slotHoldAttempts.add(1);

  const bookRes = post('/bookings', {
    slot_id:     slot.id,
    business_id: biz.id,
    party_size:  2,
  }, headersWithAuth(token));

  const bookOk = check(bookRes, {
    'Booking created (200/201)': (r) => r.status === 200 || r.status === 201,
  });

  if (!bookOk) {
    // 409 = slot hold contention (another VU grabbed the slot)
    if (bookRes.status === 409) slotHoldContention.add(1);
    errorRate.add(1);
    return;
  }
  errorRate.add(0);

  const booking = bookRes.json('booking');

  // ── Step 6: Mock payment (staging — skip Paymob) ─────────
  // In staging, the webhook is triggered directly to simulate payment success.
  const webhookRes = post('/webhooks/paymob', {
    type: 'TRANSACTION',
    obj: {
      id:      `LOAD_TEST_TXN_${vuId}_${Date.now()}`,
      success: true,
      order:   { merchant_order_id: booking.booking_ref, id: `ORD_${vuId}` },
      'source_data.type': 'card',
      // Staging HMAC bypass: set PAYMOB_HMAC_SECRET=TEST_SECRET in staging env
      // and send X-Test-Skip-Hmac: true header
    },
  }, { ...HEADERS, 'X-Test-Skip-Hmac': 'true' });

  const confirmOk = check(webhookRes, { 'Payment webhook 200': (r) => r.status === 200 });
  if (!confirmOk) { errorRate.add(1); return; }
  errorRate.add(0);

  // ── Step 7: Verify booking confirmed ─────────────────────
  const confirmRes = get(`/bookings/${booking.id}`, headersWithAuth(token));
  const confirmed  = check(confirmRes, {
    'Booking confirmed': (r) => r.json('booking.status') === 'confirmed',
  });

  confirmationTime.add(Date.now() - bookStart);
  errorRate.add(confirmed ? 0 : 1);

  sleep(0.5);
}

// ── Summary handler ───────────────────────────────────────────

export function handleSummary(data) {
  const contention = data.metrics.slot_hold_contention?.values?.count ?? 0;
  const attempts   = data.metrics.slot_hold_attempts?.values?.count   ?? 1;
  const contRate   = ((contention / attempts) * 100).toFixed(2);
  const p95        = data.metrics.booking_confirmation_ms?.values?.['p(95)'] ?? 0;
  const errRate    = (data.metrics.error_rate?.values?.rate * 100 ?? 0).toFixed(3);

  const verdict = (
    parseFloat(errRate) < 0.1 &&
    p95 < 2000 &&
    parseFloat(contRate) < 5
  ) ? '✅ PASS' : '❌ FAIL';

  const report = `# Load Test Summary — Super Reservation
**Date:** ${new Date().toISOString()}
**Verdict:** ${verdict}

## Results vs Thresholds

| Metric                  | Result          | Threshold | Status |
|-------------------------|-----------------|-----------|--------|
| Error rate              | ${errRate}%     | < 0.1%    | ${parseFloat(errRate) < 0.1 ? '✅' : '❌'} |
| P95 confirmation time   | ${p95.toFixed(0)}ms | < 2000ms  | ${p95 < 2000 ? '✅' : '❌'} |
| Slot hold contention    | ${contRate}%    | < 5%      | ${parseFloat(contRate) < 5 ? '✅' : '❌'} |

## Raw k6 Output
\`\`\`
${JSON.stringify(data.metrics, null, 2)}
\`\`\`
`;

  return {
    'docs/load-test-report.md': report,
    stdout: `\n[load-test] Verdict: ${verdict} | Error: ${errRate}% | P95: ${p95.toFixed(0)}ms | Contention: ${contRate}%\n`,
  };
}
