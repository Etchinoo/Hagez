# Load Tests — Super Reservation (US-096)

## Prerequisites
- k6 v0.47+ installed (`brew install k6` / `choco install k6`)
- Staging environment running with production-equivalent data:
  ```bash
  npm run db:seed:load --workspace=packages/api   # 10k businesses, 50k bookings
  ```
- `PAYMOB_HMAC_SECRET=TEST_SECRET` set in staging `.env` to allow HMAC bypass header

## Run

```bash
k6 run \
  --env BASE_URL=https://staging.api.reservr.eg \
  tests/load/booking-flow.js
```

## Pass Criteria (US-096 AC-3)

| Metric | Threshold |
|--------|-----------|
| Error rate | < 0.1% |
| P95 booking confirmation | < 2 000 ms |
| Redis slot hold contention | < 5% |
| Deadlocks | 0 |

Results are written automatically to `docs/load-test-report.md` via `handleSummary`.

## Before Running
Replace `REPLACE_WITH_SEED_BIZ_ID_XX` in `booking-flow.js` with actual staging business UUIDs from:
```bash
psql $DATABASE_URL -c "SELECT id FROM businesses WHERE status='active' LIMIT 5;"
```
