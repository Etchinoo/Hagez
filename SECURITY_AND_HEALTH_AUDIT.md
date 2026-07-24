# Security & Code-Health Audit — Hagez API + Dashboard

**Scope:** `packages/api` (Fastify/Prisma) and `packages/dashboard` (Next.js). Gaming-only MVP branch `claude/sleepy-ride`.
**Method:** 8-dimension parallel review; every security finding independently re-verified against the source by a separate reviewer (adversarial, refute-by-default). Findings below are **deduplicated** from the raw run and each was `confirmed` or `partially-confirmed`.
**Status of fixes:** none applied yet — this is a triage backlog. Unit tests added in this branch **pin the current behavior** of several items so a fix visibly flips the test (see `REGRESSION_TESTS.md` → Known-Issues K1–K8).

> ⚠️ Verification caveat: several IDOR/money items were verified by reading the code, not by executing an exploit against a running instance. Treat the High items as "confirmed in code, reproduce in staging before/after fixing."

---

## Severity summary

| Sev | Count | Theme |
|-----|-------|-------|
| **High** | 8 | Token confusion, money double-payout / loss, IDOR on money-moving endpoints, missing input validation |
| **Medium** | 12 | OTP hardening, cross-tenant slot access, mass-assignment, rate-limit correctness, token storage |
| **Low** | 8 | Input-validation 500s, unbounded config, dispute ledger, SMS cost abuse |

The single highest-leverage fix is **H8 (add request validation)** — it is the root cause of ~half the Medium/Low items.

---

## HIGH

### H1 — Access and refresh tokens are interchangeable; `JWT_REFRESH_SECRET` is dead
`packages/api/src/routes/auth.ts:80-99`, `packages/api/src/index.ts:60`
`@fastify/jwt` is registered once with `JWT_ACCESS_SECRET`. Access and refresh tokens are signed with **identical claims** `{sub,phone,role}` and no `type` claim; `JWT_REFRESH_SECRET` is never imported. A 30-day refresh token therefore passes `request.jwtVerify()` on every protected route — it **is** a 30-day access credential — and an access token is accepted at `/auth/refresh`.
**Fix:** sign/verify refresh tokens with a separate key (second `@fastify/jwt` namespace using `JWT_REFRESH_SECRET`); add a mandatory `type:'access'|'refresh'` claim asserted in `authenticate`/`requireRole` and `/auth/refresh`; rotate refresh tokens on use. *(Pinned by `auth.test.ts`.)*

### H2 — No-show 75/25 split has no idempotency guard → double payout
`packages/api/src/services/payment.ts:200`, `packages/api/src/jobs/no-show-detection.ts:54`
Two cron replicas (or a re-run before commit) both read the same `confirmed` booking and both run `executeNoShowSplit`, crediting the business the 75% penalty twice.
**Fix:** atomically claim the booking in `markNoShow` via `updateMany({where:{id,status:'confirmed'},data:{status:'no_show'}})` and proceed only if `count===1`; add a unique constraint (one `no_show_penalty` per `booking_id`) and re-check `escrow_status` inside the `$transaction`; run cron under a single-leader Redis lock.

### H3 — Daily payout job double-disburses under races/crashes
`packages/api/src/jobs/payout.ts:84`
Rows are disbursed before being marked complete; two runners (or a mid-run crash) pay the same rows twice.
**Fix:** atomically claim `pending→processing` by id first, disburse only claimed rows, then mark complete (revert on failure); send a deterministic idempotency key to Paymob; single-leader lock.

### H4 — A failed/out-of-order webhook flips a **confirmed, paid** booking to `expired`
`packages/api/src/routes/bookings.ts:623`
The webhook failure branch expires unconditionally. Paymob delivers at-least-once and out-of-order, so a paid booking can be silently voided — consumer loses a paid booking, slot `booked_count` left inconsistent, no refund.
**Fix:** only expire when still `pending_payment` (mirror `confirmBooking`'s guard); ignore failure webhooks for `confirmed`/`completed`.

### H5 — `PATCH /business/bookings/:id/status` has no current-status guard → repeatable payout
`packages/api/src/routes/business.ts:87`
A business owner can mark their own booking `completed`/`no_show` repeatedly (or over a `cancelled`/already-`no_show` booking), re-triggering deposit payout each time.
**Fix:** only allow `completed`/`no_show` from `confirmed` (else 409); make payout creation idempotent (unique `(booking_id,type,direction)`); require slot `end_time` passed for `completed`.

### H6 — Booking creation never verifies the slot belongs to `business_id` (IDOR + fee manipulation)
`packages/api/src/services/booking-engine.ts:195`
`POST /v1/bookings` trusts the body's `business_id` independently of the slot. A consumer can pair another business's slot with a cheaper business's id → wrong platform fee / cross-tenant booking rows.
**Fix:** require `slot.business_id === business_id` (and resource ownership) or, better, derive `business_id` from the slot and ignore the body.

### H7 — `POST /business/slots/bulk` infinite loop / OOM DoS
`packages/api/src/routes/business.ts:260`
`slot_duration_min:0` (or negative) makes the slot-generation `while` loop spin forever, allocating until the process OOMs.
**Fix:** schema-validate `slot_duration_min` (int 5–1440), `open<close`, bound `weeks_ahead` and `rules.length`; add a max-iteration ceiling.

### H8 — No runtime request validation anywhere (root cause)
`packages/api/src/index.ts:91` (dead `error.validation` branch) + all routes
Route generics are compile-time only; no Fastify JSON schema / Zod guards run. This is the upstream cause of most type-coercion 500s, negative/oversized numbers, mass-assignment, and unbounded strings below. *(SQL injection specifically is NOT present — Prisma is used safely, no raw interpolation.)*
**Fix:** attach a JSON schema (or Zod `preValidation`) to every route; Fastify then 400s malformed input and activates the existing `error.validation` handler.

---

## MEDIUM

| ID | Finding | Location | Fix summary |
|----|---------|----------|-------------|
| M1 | OTP uses `Math.random()` (predictable) + no per-phone lockout + no dedicated rate limit → brute-force / prediction | `routes/auth.ts:17-23` | `crypto.randomInt`; per-phone attempt lockout; Redis per-phone limit |
| M2 | Authz role trusted from JWT, never re-checked vs DB; suspended users keep access until expiry | `plugins/auth.ts:47`, `routes/auth.ts:103` | Persist role/status; re-load per request; re-derive on refresh |
| M3 | Rate-limit `keyGenerator` reads `request.user` before `jwtVerify` populates it → per-user limiting is dead | `index.ts:54` | Verify JWT in keyGenerator or use route-level `config.rateLimit` |
| M4 | `trustProxy` unset → behind CloudFront `request.ip` is the proxy, collapsing rate-limit into one global bucket | `index.ts:28` | Set `trustProxy` to the proxy CIDR |
| M5 | `no_show_penalty` business payouts are never picked up by any payout job → "75% to business" never actually pays | `jobs/payout.ts:34` | Include those rows (idempotently) or document the settlement path |
| M6 | No-show split not retried if it fails after `markNoShow` → money owed lost with only a `console.error` | `jobs/no-show-detection.ts:70` | Single transaction, or idempotent reconciliation query |
| M7 | Walk-in `POST /business/bookings` doesn't verify slot ownership → book/inflate a competitor's slot (fee=0) | `routes/business.ts:158` | `findFirst({where:{id:slot_id,business_id:business.id}})` |
| M8 | Reschedule can repoint a booking to another business's slot | `services/booking-engine.ts:326` | Require new slot `business_id === booking.business_id` |
| M9 | `PATCH /business/gaming-config` spreads `req.body` into Prisma upsert → mass-assignment + cross-tenant `business_id` | `routes/business.ts:468` | Whitelist fields; never accept `business_id` from body |
| M10 | Unvalidated `party_size` (negative/zero) corrupts slot `booked_count` → over-booking | `routes/bookings.ts:63` | Validate int `1..capacity` |
| M11 | Logout is a no-op; no token blocklist → cannot revoke a stolen/rotated token | `routes/auth.ts:122` | Redis `jti` denylist; refresh-token store |
| M12 | Dashboard stores access **and** refresh JWT in `localStorage` → XSS exfiltrates a 30-day (per H1) credential | `dashboard/src/store/auth.ts:31` | HttpOnly+Secure+SameSite cookies; keep refresh out of JS storage |

---

## LOW

| ID | Finding | Location | Fix summary |
|----|---------|----------|-------------|
| L1 | `PAYMOB_HMAC_SECRET` optional but required by `createHmac` → unset in prod crashes every webhook (bookings stuck) | `config/env.ts:24` | Refine schema to require it when `NODE_ENV!=='development'` |
| L2 | `?page=0/-1` → negative Prisma `skip` → 500 (bookings, reviews, admin lists) | `routes/bookings.ts:191` | Coerce+clamp `page`, bound `limit` |
| L3 | Unvalidated `date`/`month` query → `Invalid Date` → Prisma 500 (incl. public search) | `routes/search.ts:109` | Validate ISO; reject `isNaN` |
| L4 | Fixed `deposit_value` not bounded (negative/huge accepted) | `routes/business.ts:371` | Validate finite `0..100000` |
| L5 | Dispute `reverse`/`partial` ignores an already-executed no-show split; refund not capped to deposit | `routes/admin.ts:172` | Void prior penalty rows; clamp `0<=refund<=deposit` |
| L6 | No per-phone throttle on `otp/request` → SMS bombing / Twilio cost DoS / toll fraud | `routes/auth.ts:33` | Per-phone send policy + daily spend circuit-breaker |
| L7 | No schema on OTP bodies → arbitrary `phone` reaches the SMS provider | `routes/auth.ts:17` | Strict EG E.164 regex; `otp` exactly N digits |
| L8 | Role hardcoded `consumer`; no business/admin assignment path exists via the API | `routes/auth.ts:81` | Persisted, admin-gated role assignment |

**Two hardening items surfaced while writing tests** (behavior pinned by `payment.test.ts`): the webhook HMAC is compared with `===` rather than `crypto.timingSafeEqual` (timing side-channel), and `verifyPaymobWebhook` **throws** (500) on a malformed payload missing a nested parent instead of returning `false`.

---

## Code health & redundancy (non-security)

| Sev | Item | Location |
|-----|------|----------|
| High | Business-marked `no_show` path doesn't run the 75/25 split — divergent duplicate of the cron path | `routes/business.ts:117` |
| High | Pervasive `as any` casts defeat Prisma enum type-safety, letting bad values reach the DB | `routes/bookings.ts:198` |
| Med | `findUniqueOrThrow` used where a 404 is expected → 500s instead of clean not-found | `routes/bookings.ts:155` |
| Med | Error-envelope + `BookingEngineError→message` mapping hand-duplicated ~40× | `routes/bookings.ts:116` |
| Med | `getAuthenticatedBusiness` + `if(!business) 404` duplicated in ~13 handlers | `routes/business.ts:33` |
| Med | Currency math with floats + hardcoded `0.75` split in three places | `routes/business.ts:330` |
| Med | Dashboard: hardcoded hex + duplicated save-tab pattern instead of tokens/shared components (596-line `settings/page.tsx`) | `dashboard/.../settings/page.tsx` |
| Low | `getPaymobAuthToken` + token cache duplicated in `payment.ts` and `payout.ts` | `jobs/payout.ts:107` |
| Low | Two divergent booking-ref generators (unambiguous vs base36) | `routes/business.ts:161` |
| Low | `buildPolicyPreviewAr` duplicated between API and dashboard (drift risk on policy copy) | `dashboard/.../settings/page.tsx:562` |
| — | **Dead code from the gaming pivot:** restaurant/salon/court/car-wash still referenced in enums, `PLATFORM_FEES`, and `Booking.occasion`/staff/section branches | schema + `env.ts` + routes |

---

## Suggested remediation order

1. **H8** (add validation) — unblocks/kills L2, L3, L4, L7, M10, H7, part of M9.
2. **H1 + M11 + M12** (token model: separate refresh secret + `type` claim + revocation + move off localStorage) — one coherent auth-hardening PR.
3. **H2, H3, H4, H5 + M5, M6** (money integrity: idempotency, atomic claims, webhook state guards) — one payments-integrity PR; highest financial risk.
4. **H6, M7, M8, M9** (tenant isolation / IDOR on slot & config ownership).
5. **M1, L6, M3, M4** (OTP + rate-limit hardening).
6. Low items and code-health cleanups.
