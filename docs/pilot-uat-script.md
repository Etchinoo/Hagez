# Pilot Business UAT Script (US-100, EP-24)

**Pilot size:** 20 businesses across 4 districts, 2 categories (min 8 restaurants, min 8 salons)
**Engineering team:** NOT present during sessions (simulates real unassisted usage)
**Success criterion:** ≥ 80% of businesses (16/20) complete full script without support intervention
**Debrief:** Ops lead within 24h of each session

---

## Business Selection Matrix

| District | Restaurants | Salons | Total |
|----------|-------------|--------|-------|
| Maadi | 2–3 | 2–3 | 5 |
| Zamalek | 2–3 | 2–3 | 5 |
| Heliopolis | 2–3 | 2–3 | 5 |
| New Cairo | 2–3 | 2–3 | 5 |
| **Total** | **10** | **10** | **20** |

---

## Pre-UAT Setup (Ops Team — Done Before Each Session)

- [ ] Business account created in staging (phone + OTP verified)
- [ ] Dashboard URL and login credentials sent to business owner WhatsApp
- [ ] Test consumer account created for sending a test booking
- [ ] Business owner briefed: "Complete the checklist on the dashboard. If you get stuck, note it — do not call us."

---

## UAT Script — Business Owner Tasks

The business owner must complete all tasks below **without engineering support**.
Ops team observes (remotely or in-person) and logs any assistance requests.

### Task 1 — Onboarding (US-062)
**Goal:** Complete business profile setup

- [ ] Log in to the dashboard with the provided credentials
- [ ] Fill in business name (Arabic + English), category, district, address
- [ ] Upload at least one business photo
- [ ] Set operating hours (at least 3 days)
- [ ] Save and verify profile shows as "under review"

**Pass:** Profile saved without error. Owner did not ask for help.

---

### Task 2 — Configure Availability (US-027)
**Goal:** Set up bookable time slots

- [ ] Navigate to the Availability / Slots section
- [ ] Set slot duration (e.g., 90 minutes for restaurant, 60 for salon)
- [ ] Set max covers / capacity per slot
- [ ] Publish slots for the next 7 days
- [ ] Verify at least one slot appears as "available"

**Pass:** Slots visible on the consumer app search for this business.

---

### Task 3 — Set Deposit Policy (US-033)
**Goal:** Configure deposit and cancellation window

- [ ] Navigate to Settings → Deposit Policy
- [ ] Set deposit type (fixed or percentage)
- [ ] Set deposit amount / percentage
- [ ] Set cancellation window (hours before slot)
- [ ] Save and verify Arabic policy preview text is correct

**Pass:** Policy saved. Arabic preview text renders correctly without system errors.

---

### Task 4 — Receive Test Booking
**Goal:** A test booking arrives and the owner can see it

*(Ops team triggers a test booking from the pre-created consumer account)*

- [ ] New booking appears in the "Today" or "Upcoming" section
- [ ] Booking shows: consumer name, party size, time slot, deposit status
- [ ] WhatsApp notification received on business owner's phone (if WABA live)

**Pass:** Booking visible in dashboard within 60 seconds of creation.

---

### Task 5 — Mark Booking Attended (US-044)
**Goal:** Close the booking loop after the simulated visit

- [ ] Navigate to the booking
- [ ] Tap "تأكيد الحضور" (Mark as Attended / Completed)
- [ ] Confirm booking status changes to "مكتمل"

**Pass:** Booking status updated. No error shown.

---

## Issue Log

| Business # | District | Category | Task # | Issue Description | Severity | Resolved? |
|------------|----------|----------|--------|-------------------|----------|-----------|
| | | | | | | |
| | | | | | | |

**Severity:** Critical = could not complete task / Major = needed workaround / Minor = confusion only

---

## Results Summary

| Metric | Result |
|--------|--------|
| Businesses completed all 5 tasks without help | __ / 20 |
| Success rate | __%  |
| Critical issues found | __ |
| Major issues found | __ |
| **VERDICT** | ☐ PASS (≥80%) ☐ FAIL (<80%) |

---

## Launch Gate Criteria

- **Pass:** ≥ 16 / 20 businesses complete the full script without support intervention
- **Critical issues:** must be fixed before launch gate
- **Major issues:** fix required within 48 hours of UAT session
- Ops lead sign-off attached to Sprint 9 completion report
