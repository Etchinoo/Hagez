# Glossary

Complete decoder ring for the Super Reservation Platform project.

---

## Acronyms & Abbreviations

| Term | Meaning | Context |
|------|---------|---------|
| PRD | Product Requirements Document | `master_prd.docx` is the main one |
| RTL | Right-to-left | Arabic-first UI layout direction |
| EGP | Egyptian Pound | Platform currency |
| OTP | One-time password | Phone-based authentication |
| PWA | Progressive Web App | Dashboard is a Next.js PWA |
| RDS | AWS Relational Database Service | PostgreSQL 15 hosted in me-south-1 |
| SQS | AWS Simple Queue Service | Notification dispatch queue |
| DLQ | Dead Letter Queue | SQS retry/failure queue |
| CDN | Content Delivery Network | CloudFront serving `cdn.reservr.eg` |
| GTM | Go-to-market | `gtm_strategy.docx` |
| UX | User experience | `ux_flow_diagrams.docx` |
| PM | Product Manager | Hesham's role |
| RTG | Robusta Technology Group | Employer/agency |

---

## Project Terms

| Term | Meaning |
|------|---------|
| Super Reservation | The platform product name |
| Reservr | Internal codename; used in Docker containers, DB names, S3 bucket |
| Stitch | Design system and HTML prototype library |
| Phase 1 | Egypt launch — Restaurants + Salons only |
| Phase 2 | Sports Courts, Gaming Cafes, Car Washes |
| the monorepo | `super-reservation/` — Turbo-managed workspace |
| the API | `@reservr/api` Fastify backend (port 3000) |
| the consumer app | `@reservr/consumer-app` Expo React Native app |
| the dashboard | `@reservr/dashboard` Next.js tablet PWA (port 3001) |
| the design system | `stitch/` folder with shared UI components |

---

## Business / Domain Terms

| Term | Meaning |
|------|---------|
| Slot hold | 8-minute Redis lock on a booking slot during payment (480s TTL) |
| the hold | Same as slot hold |
| Escrow | Paymob holds deposit until booking is completed; then released |
| No-show | Consumer misses booking; detected 30 min post-slot start |
| the split | No-show penalty split: 75% to business, 25% to platform |
| Ammiya | Egyptian Arabic dialect used in WhatsApp/bot communications |
| Section config | Restaurant table section layout and configuration |
| Availability rules | Business-defined time rules for open/closed slots |
| Deposit policy | Business-set upfront payment requirement for a booking |
| Cancellation policy | Business-set rules for refund eligibility on cancellations |
| Stylist roster | Salon staff list with working hours and service assignments |
| Station capacity | Number of simultaneous clients a salon can serve |

---

## Booking Statuses

| Status | Meaning |
|--------|---------|
| pending_payment | Slot held; awaiting Paymob payment confirmation |
| confirmed | Payment received; booking active |
| completed | Service delivered; escrow released to business |
| cancelled_by_consumer | Consumer cancelled (refund per policy) |
| cancelled_by_business | Business cancelled (refund to consumer) |
| no_show | Consumer didn't show; no-show split executed |
| disputed | Consumer raised dispute; under review |
| expired | Payment not completed within hold window |

---

## Payment Methods

| Method | Notes |
|--------|-------|
| card | Visa/Mastercard via Paymob |
| instapay | Egyptian instant transfer |
| fawry | Cash payment at Fawry outlets |
| vodafone_cash | Vodafone mobile wallet |
| meeza | Egyptian national payment card |
| card_on_file | Saved card for repeat bookings |

---

## Subscription Tiers

`free` → `starter` → `growth` → `pro` → `enterprise`

---

## Tech Stack Shorthand

| Term | Meaning |
|------|---------|
| Fastify | Node.js web framework used for the API |
| Prisma | ORM for PostgreSQL |
| Turbo / Turborepo | Monorepo build tool |
| Expo | React Native framework for consumer mobile app |
| the schema | `super-reservation/packages/api/prisma/schema.prisma` |
| seed | `super-reservation/packages/api/prisma/seed.sql` |
| pgcrypto | PostgreSQL extension for UUID generation |
| postgis | PostgreSQL extension for geo/location queries |

---

## Platform Fees (EGP)

| Category | Fee |
|----------|-----|
| Restaurant | 25 EGP |
| Salon | 15 EGP |
| Sports Court | 35 EGP |
| Gaming Cafe | 20 EGP |
| Car Wash | 20 EGP |
