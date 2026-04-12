# Memory

## Me
Hesham Abdelaal, Senior PM at Robusta Technology Group. Working on the Super Reservation Platform (MENA lifestyle booking) alongside Orascom ODH and Beltone KEE (prop-tech projects at RTG).

---

## Project

| Term | Meaning |
|------|---------|
| **Super Reservation** | Multi-category lifestyle booking platform for Egypt/MENA (Phase 1) |
| **Reservr** | Internal codename / Docker container prefix |
| **Stitch** | Design system and UI component library for this project |
| **Phase 1** | Egypt launch — Restaurants + Salons. Courts, Gaming, Car Wash follow. |

---

## Portals

| Portal | What | Package |
|--------|------|---------|
| **Consumer App** | Mobile app (iOS + Android), OTP auth, discovery, booking, checkout | `@reservr/consumer-app` (Expo) |
| **Biz Dashboard** | Tablet-first Next.js PWA for business owners (Restaurant + Salon) | `@reservr/dashboard` (Next.js 14) |
| **API** | Fastify backend, Prisma ORM, REST endpoints | `@reservr/api` (Node/Fastify) |

→ Full tech stack: memory/context/tech-stack.md

---

## Terms

| Term | Meaning |
|------|---------|
| **OTP** | One-time password — phone-based auth (+20 Egyptian numbers) |
| **Slot hold** | 8-minute reservation lock while user completes payment |
| **Escrow** | Paymob holds deposit; released after booking completion |
| **No-show** | Auto-detected 30 min post-slot; triggers 75/25 split payout |
| **RTL** | Right-to-left — all UI Arabic-first |
| **EGP** | Egyptian Pound — platform currency |
| **Ammiya** | Egyptian Arabic dialect used in WhatsApp/bot messages |
| **PRD** | Product Requirements Document |
| **backlog** | backlog.xlsx — feature/task backlog |
| **the split** | No-show payout: 75% business, 25% platform |
| **the hold** | Slot hold TTL (8 min / 480s), stored in Redis |

→ Full glossary: memory/glossary.md

---

## Business Categories

| Category | Accent Color | Phase | Platform Fee |
|----------|-------------|-------|-------------|
| Restaurant | Burnt Orange | 1 ✅ | 25 EGP |
| Salon | Magenta | 1 ✅ | 15 EGP |
| Sports Court | Green | 2 | 35 EGP |
| Gaming Cafe | Purple | 2 | 20 EGP |
| Car Wash | Cyan | 2 | 20 EGP |

---

## Booking Status Flow

`pending_payment` → `confirmed` → `completed`
                              ↘ `cancelled_by_consumer` / `cancelled_by_business` / `no_show` / `disputed` / `expired`

---

## Payments & Integrations

| Service | Purpose |
|---------|---------|
| **Paymob** | Primary payment gateway (card, Fawry, InstaPay, Vodafone Cash, Meeza) |
| **Fawry** | Cash payment method via Paymob integration |
| **InstaPay** | Egyptian mobile payment method |
| **360dialog** | WhatsApp Business API (booking confirmations, reminders) |
| **Firebase Phone Auth** | OTP verification (10k free/month) |
| **Firebase** | Push notifications (consumer app) |
| **AWS SQS** | Notification queue + DLQ |
| **AWS S3 + CloudFront** | Media storage + CDN (`cdn.reservr.eg`) |
| **AWS RDS** | PostgreSQL 15 in `me-south-1` (Bahrain) region |

---

## Subscription Tiers

`free` → `starter` → `growth` → `pro` → `enterprise`

---

## Workspace Files

| File | What |
|------|------|
| `master_prd.docx` | Full product requirements document |
| `backlog.xlsx` | Feature and task backlog |
| `tech_specs.docx` | Technical specifications |
| `ui_design_guide.docx / .pptx` | Design system guide |
| `ux_flow_diagrams.docx` | UX flows for all portals |
| `competitive_analysis.docx` | Competitor research |
| `gtm_strategy.docx` | Go-to-market strategy |
| `operating_model.docx` | Business operating model |
| `super-reservation/` | Monorepo codebase (Turbo) |
| `stitch/` | Design system HTML prototypes + component library |

---

## Dev Commands

```bash
# Start local stack
cd super-reservation && docker compose up -d

# API dev server (port 3000)
npm run dev --workspace=packages/api

# Dashboard dev (port 3001)
npm run dev --workspace=packages/dashboard

# Consumer app
npm run dev --workspace=packages/consumer-app

# DB migrations
npm run db:migrate
npm run db:studio   # Prisma Studio

# Full monorepo
turbo run dev
```

---

## Preferences
- Senior PM lens: always frame tech decisions in terms of user impact and business outcomes
- RTG context: work spans Super Reservation, Orascom ODH, and Beltone KEE
- Egypt/MENA market awareness: EGP currency, Arabic UX, local payment methods

→ Full details in memory/
