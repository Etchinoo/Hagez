# Super Reservation Platform

**Internal codename:** Reservr
**Status:** Active — Phase 1 development
**Market:** Egypt (Phase 1) → MENA (Phase 2+)

---

## What It Is

A multi-category lifestyle booking platform targeting Arabic-speaking consumers in Egypt and the broader MENA region. Consumers discover and book services across five categories; businesses manage availability, calendars, and analytics through dedicated dashboards.

**Consumer value:** One app to book restaurants, salons, courts, gaming cafes, and car washes — in Arabic, with Egyptian payment methods.
**Business value:** Replace manual WhatsApp bookings with a structured reservation system with deposits, no-show protection, and analytics.

---

## Phase 1 Scope (Egypt)

**Categories live:** Restaurants, Salons
**Auth:** Phone OTP (Egyptian +20 numbers prioritised)
**Payments:** Paymob (card, Fawry, InstaPay, Vodafone Cash, Meeza)
**Language:** Arabic-first (RTL), Egyptian Arabic (Ammiya) for communications

---

## Three Portals

### Portal 1 — Consumer Mobile App
- Expo (iOS + Android)
- Flows: Auth (OTP) → Home/Discovery → Search/Filter → Business Detail → Checkout (Paymob) → My Bookings → Reviews

### Portal 2 — Restaurant Business Dashboard
- Next.js PWA, tablet-first, RTL
- Features: Analytics, multi-view booking calendar, section/table config, availability rules, deposit & cancellation policies

### Portal 3 — Salon Business Dashboard
- Next.js PWA, tablet-first, RTL
- Features: Stylist roster, service menu, multi-column stylist calendar, station capacity management

---

## Subscription Model

Business owners pay a monthly subscription: `free → starter → growth → pro → enterprise`
Platform also collects a per-booking fee (varies by category, see glossary).

---

## Key Files

| File | Location |
|------|----------|
| Full PRD | `master_prd.docx` (workspace root) |
| PRD (HTML) | `stitch/stitch/product_requirements_document_prd.html` |
| Tech specs | `tech_specs.docx` |
| Backlog | `backlog.xlsx` |
| UX flows | `ux_flow_diagrams.docx` |
| Design guide | `ui_design_guide.docx / .pptx` |
| GTM strategy | `gtm_strategy.docx` |
| Competitive analysis | `competitive_analysis.docx` |
| Operating model | `operating_model.docx` |
| Codebase | `super-reservation/` |
| Design system | `stitch/` |

---

## Related Projects (RTG)

| Project | Type | Notes |
|---------|------|-------|
| Orascom ODH | Prop-tech | Separate RTG project, Hesham is PM |
| Beltone KEE | Prop-tech | Separate RTG project, Hesham is PM |
