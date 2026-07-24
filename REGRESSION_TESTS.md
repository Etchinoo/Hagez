# Regression Test Checklist — Hagez (Super Reservation)

Run this after **every build** before promoting to staging/production. It is ordered
so the cheapest, most decisive gates run first (fail fast). Times are approximate on
the 2-core CI runner.

**Legend:** ⛔ = blocker (do not ship if it fails) · ⚠️ = investigate before shipping · ✅ = pass criteria.

---

## 0. Prerequisites (once per environment)

```bash
# From repo root
docker compose up -d            # Postgres 15 + Redis
npm install --legacy-peer-deps  # peer-dep flag required by the current tree
```

- ✅ `docker compose ps` shows `reservr-postgres` and `reservr-redis` healthy.
- ✅ `.env` present in `packages/api` with valid `DATABASE_URL`, `REDIS_URL`, 32+ char `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`. In staging/prod also `PAYMOB_API_KEY`, `PAYMOB_HMAC_SECRET`, and all `PAYMOB_INTEGRATION_ID_*` (⛔ if `PAYMOB_HMAC_SECRET` is unset in prod — every webhook will crash; see Known-Issues #K1).

---

## 1. Automated gates (⛔ all must pass)

Run from repo root. Each command is copy-pasteable.

### 1.1 Typecheck
```bash
npm run typecheck
```
- ✅ Exit 0, no TS errors in `packages/api` or `packages/dashboard`.

### 1.2 Lint
```bash
npm run lint
```
- ✅ Exit 0 (warnings allowed, errors are ⛔).

### 1.3 Build (this is the one that broke Vercel before — keep it in the gate)
```bash
npm run build
```
- ✅ `@reservr/api` compiles (`tsc`) and `@reservr/dashboard` runs `next build` to completion.
- ✅ Dashboard build reaches `✓ Generating static pages` and prints the route table with **no** `useContext` null error and **no** `No entrypoint found` error.
- ⚠️ Any new `metadata.themeColor`/`viewport` warning → move it to a `viewport` export (see `layout.tsx`).

### 1.4 Unit tests
```bash
npm run test --workspace=packages/api
```
- ✅ **47+ tests pass** across `env`, `redis`, `payment`, `booking-engine`, `auth` suites.
- ⚠️ If a test in the "Known-Issues watchlist" (below) flips from pass→fail, it usually means a hardening fix landed — **update the test's expectation**, don't just re-green it.

> Setup note: the API test harness forces `NODE_ENV=development` and injects dummy
> secrets (`packages/api/vitest.config.ts` + `test/setup.ts`). This is required because
> `src/config/env.ts` calls `process.exit(1)` on invalid env at import and Vitest
> otherwise sets `NODE_ENV=test`, which the schema rejects. Do not remove that setup.

---

## 2. API smoke tests (⛔ core funnel)

Start the API: `npm run dev --workspace=packages/api` (port 3000). Base URL `http://localhost:3000/v1`.

| # | Check | Command / action | ✅ Pass |
|---|-------|------------------|--------|
| 2.1 | Health | `curl -s localhost:3000/health` | `{"status":"ok",...}` |
| 2.2 | OTP request | `POST /v1/auth/otp/request {"phone":"+201000000000"}` | `200 {"message":"OTP sent"}`; OTP printed in API dev logs |
| 2.3 | OTP verify | `POST /v1/auth/otp/verify {"phone":"+201000000000","otp":"<dev otp>"}` | `200` with `access_token`, `refresh_token`, `user` |
| 2.4 | Auth required | `GET /v1/users/me` with **no** token | `401 UNAUTHORIZED` |
| 2.5 | Auth accepted | `GET /v1/users/me` with `Authorization: Bearer <access>` | `200` |
| 2.6 | Search (public) | `GET /v1/search/businesses?category=gaming_cafe` | `200`, gaming businesses only |
| 2.7 | Business detail | `GET /v1/businesses/:id` (a gaming_cafe) | `200` incl. `gaming_config` + `stations` |
| 2.8 | Refresh | `POST /v1/auth/refresh {"refresh_token":"<refresh>"}` | `200` new `access_token` |
| 2.9 | Rate limit | 120× `GET /health` in <1 min from one IP | `429` after ~100 |

---

## 3. Booking funnel (⛔ revenue path)

Requires a seeded gaming_cafe with availability. Run `npm run db:seed` if needed.

- 3.1 **Create + hold** — `POST /v1/bookings` with `{ slot_id, business_id, resource_id, station_type:"PC", genre_preference:"FPS", party_size:2, session_duration_min:120 }`
  - ✅ `200` with `booking_ref` (`BK-YYYYMMDD-XXXXX`), `deposit_amount`, `slot_hold_expires_at` ≈ now + 8 min.
  - ✅ A second create against the **same slot** while held → `409 SLOT_ALREADY_HELD`.
- 3.2 **Capacity guard** — book `party_size` that exceeds slot capacity → `409 SLOT_CAPACITY_EXCEEDED`.
- 3.3 **Confirm** — simulate a valid Paymob webhook → booking moves `pending_payment → confirmed`, slot `booked_count` increments, hold lock released.
- 3.4 **Hold expiry** — create a booking, wait 8+ min without paying → booking auto-`expired`, slot freed (slot-hold-expiry job).
- 3.5 **Cancel (outside window)** — consumer cancels a confirmed booking >window hours out → full refund, `deposit_forfeited:false`.
- 3.6 **Cancel (inside window)** — consumer cancels <window hours out → `deposit_forfeited:true`, refund 0.
- 3.7 **Reschedule** — confirmed booking, outside window, <2 prior reschedules → succeeds; 3rd attempt → `409 RESCHEDULE_LIMIT_REACHED`.

---

## 4. Payments & money (⛔ financial correctness)

- 4.1 **Webhook signature** — POST a webhook with a **valid** HMAC → processed once; POST the **same** transaction id again → **not** double-processed (idempotency). POST with a **wrong/absent** HMAC → rejected.
- 4.2 **No-show split** — trigger no-show detection on a confirmed, past, un-attended booking → business payout row = 75% of deposit (`outbound/pending`), platform row = 25% (`inbound/completed`), `escrow_status = split_executed`.
- 4.3 **No double-pay** — re-run the no-show job over the same booking → **no** second split is written (⚠️ see Known-Issues #K2 — this guard is currently missing).
- 4.4 **Payout job** — daily payout run disburses only `pending` business-owed rows once (⚠️ #K2 race).

---

## 5. Dashboard (⚠️ render + core flows)

Start: `npm run dev --workspace=packages/dashboard` (port 3001). RTL, Arabic.

- 5.1 `/login` — OTP two-step renders; wrong OTP shows inline error; valid OTP routes to `/`.
- 5.2 `/` — Bookings calendar renders day/week; a `confirmed` booking shows "حضر ✅" / "غياب" actions; marking each updates status.
- 5.3 `/analytics` — 6 KPI cards render; month picker refetches; empty month shows `—` placeholders (not a crash).
- 5.4 `/settings` — 4 tabs (Availability, Policy, Payout, 🎮 Gaming). Gaming tab: station-type / genre / duration chips toggle; Group-Room settings appear only when "Group Room" selected; Save shows success confirmation.
- 5.5 Console — no React hydration or `useContext` errors in the browser console.

---

## 6. Security regression checks (⚠️ tie-back to audit)

These guard against re-introducing audited weaknesses. See `SECURITY_AND_HEALTH_AUDIT.md`.

- 6.1 **IDOR — booking status** — as business A, call the "mark completed/no_show" endpoint on a booking belonging to business B → must be `403/404`, must **not** move money. (Audit: `biz-status-no-state-guard`, `booking-create-slot-business-unbound`.)
- 6.2 **Cross-tenant slot** — as business A, create a walk-in / reschedule onto business B's `slot_id` → rejected. (Audit: `walkin-cross-tenant-slot`, `reschedule-cross-business-slot`.)
- 6.3 **Mass assignment** — `PATCH /business/gaming-config` with an extra `business_id` in the body pointing at another tenant → must be ignored/rejected. (Audit: `gaming-config-mass-assignment`.)
- 6.4 **Input validation** — `party_size:-1`, `page:-5`, malformed `date=` → `400`, never a `500` or corrupted `booked_count`. (Audit: `party-size-negative`, `negative-pagination-500`, `invalid-date-query-500`.)
- 6.5 **Bulk slots DoS** — `POST /business/slots/bulk` with `slot_duration_min:0` → rejected, no hang/OOM. (Audit: `bulk-slots-infinite-loop-dos`.)
- 6.6 **OTP brute force** — >N rapid `otp/verify` for one phone → throttled/locked. (Audit: `otp-endpoints-no-dedicated-rate-limit`.)

---

## Known-Issues watchlist (audited; fixes pending)

These are **currently pinned by passing unit tests** that assert present behavior. When a
fix lands, the referenced test will fail — that is expected; update the test's expectation.

| ID | Issue | Pinned by test | Severity |
|----|-------|----------------|----------|
| K1 | `PAYMOB_HMAC_SECRET` optional but required by `createHmac` — unset in prod crashes every webhook | (env gate §0) | High in prod |
| K2 | `executeNoShowSplit` / daily payout have no idempotency/atomic-claim guard → possible double payout | §4.3, §4.4 | High |
| K3 | Refresh token verified with the access secret; `JWT_REFRESH_SECRET` unused → access token accepted at `/auth/refresh` | `auth.test.ts` "CURRENTLY accepts an ACCESS token…" | High |
| K4 | Webhook HMAC compared with `===` (not `crypto.timingSafeEqual`) | `payment.test.ts` webhook cases | Medium |
| K5 | Webhook throws (500) on malformed payload instead of returning false | `payment.test.ts` "THROWS on a malformed payload…" | Medium |
| K6 | No-show split money not rounded to piastres (sub-cent floats stored) | `payment.test.ts` "does NOT round money…" | Medium |
| K7 | Webhook failure branch sets a **confirmed** booking to `expired` | (add §3 case when fixed) | High |
| K8 | No token revocation (logout is a no-op, no blocklist) | — | Medium |

---

## Sign-off

| Gate | Owner | Status |
|------|-------|--------|
| §1 Automated gates | | ☐ |
| §2 API smoke | | ☐ |
| §3 Booking funnel | | ☐ |
| §4 Payments & money | | ☐ |
| §5 Dashboard | | ☐ |
| §6 Security regression | | ☐ |

Do not promote to production with any ⛔ open or any new Known-Issue of High severity introduced.
