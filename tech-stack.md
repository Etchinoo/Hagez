# Tech Stack — Super Reservation Platform

## Architecture Overview

Turborepo monorepo with three main packages, all TypeScript.

```
super-reservation/
├── packages/
│   ├── api/              — Fastify backend (Node.js)
│   ├── consumer-app/     — Expo React Native mobile app
│   └── dashboard/        — Next.js 14 business PWA
├── turbo.json
├── docker-compose.yml    — Local dev stack
└── .env / .env.example
```

---

## Backend (`@reservr/api`)

| Concern | Technology |
|---------|-----------|
| Framework | Fastify (Node.js) |
| ORM | Prisma |
| Database | PostgreSQL 15 (local Docker / AWS RDS me-south-1) |
| Cache / Lock | Redis 7 (local Docker / AWS ElastiCache) |
| Auth | JWT (access 15m, refresh 30d) + OTP via Twilio/360dialog |
| Validation | Zod |
| Extensions | pgcrypto (UUIDs), PostGIS (geo search) |

**Key files:**
- `src/routes/auth.ts` — OTP flow, JWT refresh
- `src/routes/bookings.ts` — Full booking lifecycle
- `src/routes/business.ts` — Business management
- `src/routes/search.ts` — Discovery / geo search
- `src/routes/admin.ts` — Admin endpoints
- `src/services/booking-engine.ts` — Slot hold, confirm, cancel logic
- `src/services/payment.ts` — Paymob integration (HMAC-SHA512 webhooks)
- `src/services/notification.ts` — WhatsApp, SMS, push, email dispatch
- `prisma/schema.prisma` — Full data model

---

## Consumer App (`@reservr/consumer-app`)

| Concern | Technology |
|---------|-----------|
| Framework | Expo (React Native ~50.0) |
| Navigation | Expo Router 3.4 |
| State | Zustand |
| API client | Axios + TanStack Query |
| i18n | i18next + react-i18next |
| Notifications | expo-notifications |
| Storage | expo-secure-store (tokens) |

**Runs on:** iOS + Android
**Dev command:** `expo start` or `npm run dev --workspace=packages/consumer-app`

---

## Business Dashboard (`@reservr/dashboard`)

| Concern | Technology |
|---------|-----------|
| Framework | Next.js 14 |
| Rendering | PWA (next-pwa), tablet-first |
| State | Zustand |
| API client | Axios + TanStack Query |
| Date handling | date-fns |
| Port | 3001 |

**RTL-first layout.** Serves restaurant and salon business owners.

---

## Infrastructure & Integrations

| Service | Purpose | Region |
|---------|---------|--------|
| AWS RDS (PostgreSQL 15) | Primary database | me-south-1 (Bahrain) |
| AWS ElastiCache (Redis 7) | Slot locks + sessions | me-south-1 |
| AWS S3 + CloudFront | Media storage + CDN | me-south-1, `cdn.reservr.eg` |
| AWS SQS | Notification queue + DLQ | me-south-1 |
| Paymob | Payment gateway (all Egyptian methods) | Egypt |
| 360dialog | WhatsApp Business API | — |
| Twilio | SMS fallback + OTP | — |
| Firebase | Push notifications | — |
| Google Maps | Geo search, business locations | — |
| Sentry | Error monitoring | — |

---

## Local Dev Setup

```bash
# 1. Start infrastructure (Postgres + Redis + API)
cd super-reservation
docker compose up -d

# 2. DB migration
npm run db:migrate

# 3. Optional: Prisma Studio
npm run db:studio

# 4. Dev servers
turbo run dev                                  # All packages
npm run dev --workspace=packages/api           # API only (port 3000)
npm run dev --workspace=packages/dashboard     # Dashboard only (port 3001)
npm run dev --workspace=packages/consumer-app  # Expo app
```

**Docker services:**
- `reservr_postgres` → port 5432
- `reservr_postgres_shadow` → port 5433 (Prisma migrations)
- `reservr_redis` → port 6379
- `reservr_api` → port 3000

---

## Key Business Rules (Coded)

| Rule | Value | Config key |
|------|-------|------------|
| Slot hold TTL | 480 seconds (8 min) | `SLOT_HOLD_TTL_SECONDS` |
| No-show detection delay | 30 minutes | `NO_SHOW_DETECTION_DELAY_MINUTES` |
| Default cancellation window | 24 hours | `CANCELLATION_WINDOW_DEFAULT_HOURS` |
| No-show split — business | 75% | `NO_SHOW_SPLIT_BUSINESS_PCT` |
| No-show split — platform | 25% | `NO_SHOW_SPLIT_PLATFORM_PCT` |
| OTP expiry | 300 seconds (5 min) | `OTP_EXPIRY_SECONDS` |
| OTP length | 6 digits | `OTP_LENGTH` |
| JWT access token | 15 minutes | `JWT_ACCESS_EXPIRY` |
| JWT refresh token | 30 days | `JWT_REFRESH_EXPIRY` |

---

## Design System (Stitch)

Located in `stitch/stitch/`. Contains:
- `product_requirements_document_prd.html` — Full PRD in HTML
- `design_system_core_components_styles/` — Core component library
- `information_architecture_map/` — IA diagrams
- `majlis_modern/` — Majlis-themed design variant
- `portal_1_home_discovery/` — Consumer home & discovery screens
- `portal_1_restaurant_detail/` — Restaurant detail page
- `portal_2_booking_calendar/` — Booking calendar flow
- `portal_2_restaurant_analytics/` — Restaurant analytics dashboard
- `portal_3_salon_stylist_roster/` — Salon stylist management
- `updated_design_system_original_brand_colors/` — Brand color update

**Brand colors:**
- Primary Navy: `#1A3A52`
- Secondary Teal: `#0B8B8F`
- CTA Blue: `#0066CC`
- Typography: Cairo (Arabic), Inter (Latin)
