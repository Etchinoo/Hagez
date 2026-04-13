# CLAUDE.md — Hagez Platform Context & Instructions

**Last Updated:** April 13, 2026  
**Owner:** Hesham Abdelaal, Senior PM at Robusta Technology Group  
**Status:** Active Development — Phase 1 Launch  
**Domain:** hagez.app (primary), hagez.com (future)

---

## ⚠️ CRITICAL INSTRUCTION: NO ASSUMPTIONS

### Rule: ALWAYS ASK BEFORE PROCEEDING

**IF** any requirement is vague or ambiguous, **STOP immediately and ask clarifying questions** before generating user stories, code, or strategic recommendations.

**Vague includes:**
- ❓ Missing acceptance criteria or success metrics
- ❓ Unclear user journey or flow
- ❓ Ambiguous business impact or goal
- ❓ Missing technical constraints or dependencies
- ❓ Unclear scope (which portals affected?)
- ❓ Conflicting with prior decisions
- ❓ "Nice to have" vs "must have" unclear

**What I will do:**
1. ✋ **STOP** — Don't generate user stories or code
2. ❓ **ASK** — Provide 5-8 targeted clarifying questions
3. 🎯 **WAIT** — For your answers before proceeding
4. ✅ **DELIVER** — User stories ONLY (no code prompt unless you ask)

**What I will NOT do:**
- ❌ Make assumptions about requirements
- ❌ Guess at technical implementation
- ❌ Assume which portals are affected
- ❌ Proceed with vague scope
- ❌ Skip critical clarifications for speed

---

## 🎯 PROJECT OVERVIEW

### Name & Branding
- **English:** Hagez
- **Arabic:** حاجز (hajez = "reserve/book")
- **Legacy:** "Super Reservation Platform" (old internal name, do NOT use)
- **Domain:** hagez.app (primary), hagez.com (future acquisition)
- **Market Phase 1:** Egypt (Cairo focus)
- **Market Phase 2+:** MENA expansion

### What Hagez Does
Multi-category lifestyle booking marketplace:
- **Consumers:** Book restaurants, salons, sports courts, gaming cafes, car washes via single app
- **Businesses:** Manage bookings, availability, deposits via unified dashboard
- **Platform:** Hold deposits (escrow), process payments, detect no-shows, split revenue

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

## Business Model
```
Revenue: Platform fees (per category: 15-35 EGP) + payment processing
Deposits: Held as escrow via Paymob (released on completion)
No-Show: Auto-detected 30min post-slot → 75/25 split (business/platform)
Cancellation: 24hr window default (configurable per business)
Currency: EGP only (Phase 1)
```

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

## 📱 PORTALS & APPLICATIONS

### Three Main User Paths (Same Domain: hagez.app)

```
hagez.app
├── Consumer App (iOS/Android) — Portal 1
├── Business Dashboard (/dashboard) — Portal 2, 3, 4, 5, 6
│   ├── Restaurant (/dashboard/restaurant)
│   ├── Salon (/dashboard/salon)
│   ├── Sports Court (/dashboard/court) — Phase 2
│   ├── Gaming Cafe (/dashboard/gaming) — Phase 2
│   └── Car Wash (/dashboard/carwash) — Phase 2
└── Admin Console (/admin) — Portal 7
    └── Super Admin Console (elevated permissions) — Portal 8
```

### Portal 1: Consumer Mobile App (iOS + Android)
**Tech:** React Native (Expo), TypeScript  
**Users:** Egyptian consumers  
**Auth:** Phone OTP + Social login (Google/Apple)

**Phase 1 Features:**
- Registration (OTP, social)
- Home discovery (search, filters, category cards)
- Restaurant booking flow
- Salon booking flow
- Payment checkout (Paymob)
- My Bookings (upcoming, past, reschedule, cancel)
- Reviews & ratings
- Profile management
- Language toggle (Arabic/English)
- Push notifications
- Terms & Conditions acceptance (signup + profile)

**Phase 2 Features:**
- Sports court booking
- Gaming cafe booking (with real-time station availability)
- Car wash booking
- Loyalty wallet
- Social features
- Referral program

**RTL:** Arabic-first, full RTL support  
**Typography:** Cairo (Arabic), Inter (Latin)  
**Colors:** Navy (#00243b), Teal (#00696c), category accents

---

### Portals 2–6: Business Dashboard (Next.js PWA)
**Tech:** Next.js 14, TypeScript, Tailwind CSS  
**Domain:** hagez.app/dashboard  
**Auth:** Email + password (business credentials)  
**Device:** Tablet-first (1024px primary), responsive to desktop  
**RTL:** Full Arabic-first RTL (sidebar RIGHT side)

#### Portal 2: Restaurant Dashboard
**URL:** `/dashboard/restaurant`  
**Users:** Restaurant owners, ops managers, reception staff

**Features:**
- Table/section booking calendar
- Operating hours + slot duration setup
- Section configuration (capacity, indoor/outdoor, private)
- Deposit policy configuration
- Manual booking entry (walk-ins, phone)
- Guest management (occasion, special requests, party size)
- Mark attended/no-show
- Analytics (bookings, deposits, no-shows prevented, revenue)

**Phase:** 1 ✅

---

#### Portal 3: Salon Dashboard
**URL:** `/dashboard/salon`  
**Users:** Salon owners, stylists, reception staff

**Features:**
- Staff profile management (stylist name, photo, specializations)
- Service menu with per-stylist assignment
- Multi-column day view (one column per stylist)
- Chair/station capacity
- Deposit + cancellation config
- Manual booking entry
- Stylist utilization analytics
- Service add-on configuration

**Phase:** 1 ✅

---

#### Portal 4: Sports Court Dashboard
**URL:** `/dashboard/court`  
**Users:** Padel club operators, football 5 managers  
**Phase:** 2 (designed, not yet built)

**Features:**
- Court inventory (sport type, surface, capacity)
- Hourly slot configuration (duration-based, not fixed-time)
- Dynamic pricing (peak vs off-peak)
- Equipment rental inventory
- Court grid calendar (rows = courts, columns = time blocks)
- Occupancy analytics

---

#### Portal 5: Gaming Cafe Dashboard
**URL:** `/dashboard/gaming`  
**Users:** Gaming cafe owners, managers  
**Phase:** 2 (designed, not yet built)

**Features:**
- Station inventory (PC, PS, VR, Group Room types)
- Station specs (e.g., "Intel i7, RTX 3080" for PCs)
- Group room configuration
- Late-night operating rules
- Time block configuration
- Station grid calendar
- Revenue-per-station analytics
- Real-time occupancy tracking

---

#### Portal 6: Car Wash Dashboard
**URL:** `/dashboard/carwash`  
**Users:** Car wash + auto detailing center owners  
**Phase:** 2 (designed, not yet built)

**Features:**
- Bay inventory (count, type: basic wash, deluxe, premium)
- Service package setup (price per vehicle type)
- Drop-off vs wait configuration
- Mandatory buffer time between services
- Bay grid calendar
- "Mark Ready" action (triggers consumer WhatsApp notification)
- Service completion tracking

---

### Portal 7: Admin Console (Internal, IP-Restricted)
**Tech:** Next.js, internal web app  
**Domain:** hagez.app/admin  
**Users:** Robusta operations team, support agents, finance  
**Auth:** Passphrase/token-based  
**Status:** Phase 1 ✅

**Features:**
- Business verification queue (24h SLA)
- Dispute resolution center (payment trail, full payout execution)
- Business suspension/deactivation
- Featured listing slot management
- Platform health dashboard (MAU, bookings/hour, error rate, payment success %)
- Manual refund execution (< EGP 500 only)
- Review moderation queue
- No-show flag management
- Booking inspection (full details, state transitions)

**Access:** IP-restricted, no public App Store  
**Requirements:** Must restrict IP before sharing credentials with ops team

---

### Portal 8: Super Admin Console (Elevated Permissions)
**Tech:** Same as Portal 7 (elevated permission layer)  
**Domain:** hagez.app/admin (same as Portal 7, role-based)  
**Users:** Robusta product/engineering leadership, CTO, CEO  
**Auth:** Special role-based access (SUPER_ADMIN vs ADMIN)  
**Status:** Phase 1 ✅

**Additional Features (vs Admin):**
- Reactivate suspended businesses
- Approve refunds > EGP 500
- Manage admin user accounts + roles
- Platform-wide settings:
  - Booking fee by category
  - No-show split ratio
  - Cancellation window defaults
  - Slot hold TTL (Redis)
  - Featured listing pricing
- Reason field required for all actions
- Audit log for all super admin actions

---

### Portal 9: WhatsApp Bot (Onboarding Channel)
**Tech:** 360dialog WABA + conversational AI  
**Domain:** WhatsApp Business  
**Users:** Tech-resistant SMB owners (gradual migration to dashboard)  
**Status:** Phase 2 (designed, not yet built)

**Features:**
- Guided business signup flow (entirely within WhatsApp)
- Availability setup via conversational prompts
- Slot configuration
- Deposit rules configuration
- Booking notifications (all without opening browser)
- Gradual migration to full dashboard (30-60 days)

**Language:** Arabic-first (Egyptian Ammiya dialect)

---

## 🚀 DEPLOYMENT & ENVIRONMENTS

### Deployment Environments
- **Staging:** Pre-production testing environment (mirrors production setup)
  - Used for: Testing new features, payment integration testing, QA verification
  - Data: Test data only, no real user data
  - Deployments: On-demand (every feature branch)
- **Production:** Live environment serving real users
  - Data: Real user data, real payments
  - Deployments: Scheduled releases (weekly or as needed)
  - Monitoring: 24/7 uptime monitoring

### Deployment Platforms & Stack

| Component | Platform | Purpose |
|-----------|----------|---------|
| **Frontend (Portal 1)** | Vercel | React Native Expo builds (iOS + Android) |
| **Web Dashboards** | Vercel | Next.js PWA for business + admin consoles |
| **API** | Railway | Node.js/Fastify backend |
| **Database** | Supabase | PostgreSQL 15 (managed) |
| **Cache** | Upstash | Redis (serverless) |
| **File Storage** | AWS S3 | Media uploads (avatars, business photos) |
| **CDN** | AWS CloudFront | Static asset delivery (cdn.reservr.eg) |
| **Notifications Queue** | AWS SQS | Async notification processing |

### CI/CD Pipeline (GitHub Actions)

**Workflow:**
1. Developer pushes code to feature branch
2. GitHub Actions automatically:
   - Runs unit tests (must pass)
   - Runs integration tests (must pass)
   - Lints code (TypeScript strict mode)
   - Builds Docker images
3. Successful builds deployed to staging
4. Code review + approval required
5. Merge to main triggers production deployment
6. Production deployment: Staging → Production (blue-green)

**Rollback:** Instant revert to previous version if critical issues detected

---

## 🔐 SECURITY & AUTHENTICATION

### Session Management
- **Session Timeout:** Never auto-logout (persist until browser close)
- **Refresh Token TTL:** 30 days (long-lived)
- **JWT Token TTL:** 1 hour (short-lived, refresh before expiry)
- **Session Storage:** Secure storage (Keychain on iOS, Keystore on Android)

### Authentication Methods
- **Consumers:** Phone OTP (primary), Google/Apple social login
- **Business Owners:** Email + password
- **Admins:** Email + password (with IP whitelist)
- **Super Admins:** Email + password (with IP whitelist + MFA ready for Phase 2)

### Password Requirements
- **Business/Admin Passwords:**
  - Minimum 12 characters
  - Must include: uppercase, lowercase, number, special character
  - No common passwords (check against dictionary)
  - Password history (can't reuse last 5 passwords)

### Two-Factor Authentication
- **Current Phase:** Not implemented (Phase 1)
- **Future Phase:** Optional for admins (Phase 2+)

### Admin Console Access Control
- **IP Whitelist:** Required before sharing credentials with ops team
  - Whitelist format: CIDR notation (e.g., 203.0.113.0/24)
  - All admin access must originate from whitelisted IPs
  - Non-whitelisted access: Immediately blocked + logged
- **Audit Logging:** All admin actions logged with user ID, timestamp, IP, action details, reason field

### Token Security
- **JWT Signing:** HS256 (HMAC-SHA256)
- **Token Storage:** Secure storage only (never localStorage/AsyncStorage for production tokens)
- **CORS:** Only allow requests from hagez.app domain
- **HTTPS:** All endpoints HTTPS only, no HTTP fallback

---

## 💾 DATA MANAGEMENT & COMPLIANCE

### Data Retention Policy
- **Soft-Deleted User Data:** Retained for 1 year after deletion
  - After 1 year: Purged from database (hard delete)
  - During retention: User cannot re-register with same phone number
  - After purge: User can re-register
- **Booking History:** Retained indefinitely (for audit trail)
- **Payment Records:** Retained for 7 years (legal/tax compliance)
- **Dispute Data:** Retained until dispute resolved + 90 days after

### GDPR Compliance (Partial — Phase 1 Preparation)

**Implemented in Phase 1:**
- ✅ Data export: User can request export of personal data (JSON format)
- ✅ Privacy policy: Clear, accessible from signup + profile
- ✅ Consent tracking: Terms + Privacy acceptance logged with timestamp + version
- ✅ Right to deletion: Soft delete with anonymization (name, phone, email, avatar)

**Deferred to Phase 2:**
- ⏸️ Right to be forgotten: Full data purge (currently: 1-year retention)
- ⏸️ Data portability API: Machine-readable format for data transfer
- ⏸️ DPA (Data Processing Agreement): For businesses storing customer data

**Not Required (Egypt-Only Phase 1):**
- GDPR consent banners (Egypt PDPL not yet enforced like GDPR)
- But architecture designed for future GDPR compliance

### Database Backups
- **Frequency:** Daily (once per day, off-peak hours 2 AM UTC)
- **Retention:** Last 30 backups retained (30 days rollback window)
- **Backup Location:** AWS S3 (separate region for disaster recovery)
- **Encryption:** AES-256 at rest
- **Testing:** Monthly restore tests (verify backup integrity)

### Disaster Recovery
- **RTO (Recovery Time Objective):** 24 hours (acceptable downtime)
- **RPO (Recovery Point Objective):** 1 hour (acceptable data loss)
  - Means: If disaster occurs, can recover data from 1 hour ago max
  - Achieved via: Daily full backups + hourly transaction logs
- **DR Plan:**
  1. Detect failure (automated monitoring)
  2. Notify team (PagerDuty alert)
  3. Restore database from backup (< 4 hours)
  4. Validate data integrity (< 1 hour)
  5. Failover to DR infrastructure (< 24 hours)
- **Testing:** Quarterly DR drills (restore to alternate region, verify)

---

## 🛡️ API & RATE LIMITING

### Rate Limiting Policy
- **Global Rate Limit:** 100 requests per minute per user (authenticated) OR per IP (unauthenticated)
- **Burst Allowance:** 10 requests per second (smoothing algorithm: token bucket)
- **Enforcement:** Return HTTP 429 (Too Many Requests) when exceeded

### Per-Endpoint Rate Limits

| Endpoint | Limit | Reason |
|----------|-------|--------|
| Phone number validation | 5 req/min | Prevent brute force attacks |
| Search endpoint | 100 req/min | High-frequency, low-cost operation |
| Booking creation | 10 req/min | Prevent double-booking abuse |
| Payment endpoint | 5 req/min | Prevent fraud attempts |
| Login/OTP | 5 req/min | Prevent credential stuffing |
| User registration | 3 req/min | Prevent account spam |
| Review submission | 20 req/min | Allow normal usage |
| Analytics events | 1000 req/min | High volume, low risk |

### Rate Limit Response Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 47
X-RateLimit-Reset: 1713021600 (Unix timestamp)
```

### Bypass Rules
- Admin console: Unlimited (trusted internal use)
- Dashboard: 10× higher limits (business users need flexibility)

---

## 📱 NOTIFICATIONS & COMMUNICATION

### Notification Channels
- **Push Notifications (Primary):** Firebase Cloud Messaging (FCM)
  - Delivery: When user has app open OR has app installed + Firebase token valid
  - Fallback: If push fails, notification queued for retry
- **Other Channels (Future):**
  - SMS: Phase 2 (if internet connectivity low)
  - WhatsApp: Phase 2 (360dialog integration)
  - Email: Phase 2 (low-priority updates)

### Notification Types & Timing

| Event | Channel | Timing | Content |
|-------|---------|--------|---------|
| **Booking Confirmed** | Push | Immediate (< 1 min) | "Your booking confirmed: [Business] [Time]" + booking reference |
| **Reminder** | Push | 1 hour before booking | "Reminder: Your booking at [Business] in 1 hour" |
| **Booking Cancelled** | Push | Immediate | "Your booking cancelled" + refund status |
| **No-Show Alert** | Push | 30 min after start time | "Marked as no-show. Your deposit: [amount]" |
| **Refund Processed** | Push | Within 24h of approval | "Refund of [amount] processed to your Paymob account" |
| **Review Request** | Push | 1 hour after booking completed | "How was your experience? Leave a review" |

### Reminder Notification Details
- **Timing:** 1 hour before scheduled booking
- **Frequency:** Single reminder per booking (no repeat)
- **Opt-Out:** User can disable reminders in notification preferences
- **Silent Mode:** Respects device DND (Do Not Disturb) settings

### Booking Confirmation Details
- **Timing:** Immediate (< 1 minute after payment success)
- **Content:**
  ```
  ✓ Booking Confirmed
  Business: [Name]
  Date: [DD MMM YYYY]
  Time: [HH:MM] - [HH:MM]
  Party Size: [Size] (restaurants)
  
  Booking Reference: BK-20260413-ABC12
  Deposit: EGP [amount]
  
  [View Booking] [Cancel Booking]
  ```
- **Delivery:** Retry mechanism (retry up to 3 times, 5min intervals if fail)

### Notification Preferences
- **Push Notifications:** Toggle ON/OFF (default: ON)
- **Reminder Notifications:** Toggle ON/OFF (default: ON)
- **Promotional Offers:** Toggle ON/OFF (default: OFF)
- **Settings Location:** User profile → Notifications

---

## 💰 REFUNDS & DISPUTES

### Refund Policy

**Cancellation Refund (Eligible Cancellations):**
- **Cancellation Window:** 24 hours before booking (default, configurable per business)
- **If Cancelled Within Window:** 100% refund (including platform fee)
  - Example: Booked EGP 300 deposit + EGP 25 platform fee = refund EGP 325
- **If Cancelled After Window:** No refund (100% penalty)
- **If Business Cancels:** Full refund to consumer (automatic)

**Processing Timeline:**
- Refund initiated: Immediately after cancellation
- Refund processed: Via Paymob (payment method dependent)
  - Card: 3-5 business days
  - Fawry/Vodafone/InstaPay: 1-2 business days
- Refund notification: Push notification + SMS (if enabled)

### No-Show Policy
- **Penalty:** 25% of deposit retained by platform, 75% to business
- **Detection:** Automated job runs every 15 minutes, checks if user marked attended 30min post-slot
- **Appeal Eligibility:** User can appeal within 7 days of no-show
  - Grounds: Technical issue, emergency, etc.
  - Resolution: Admin reviews, approves/rejects appeal
  - If Approved: Full refund processed

### Dispute Resolution Process

**Dispute Types:**
1. **Refund Request:** Consumer disputes booking, requests refund outside window
2. **Quality Complaint:** Consumer unsatisfied with service
3. **No-Show Appeal:** Consumer disputes no-show penalty
4. **Fraud:** Consumer claims unauthorized payment

**Escalation Workflow:**
```
Consumer Files Dispute
        ↓
Admin Review (24h SLA)
        ↓
Evidence Collection (consumer + business provide proof)
        ↓
Resolution Attempt (admin proposes solution)
        ↓
↙                           ↘
Consumer Accepts         Consumer Rejects
        ↓                           ↓
Case Closed             Super Admin Review (48h SLA)
                        ↓
                    Final Decision
```

**Admin Actions:**
- Approve refund (< EGP 500): Auto-approve
- Request refund (≥ EGP 500): Escalate to super admin
- Suspend business (if repeated abuse): Requires super admin approval

**Super Admin Actions:**
- Approve refund (any amount)
- Reverse/override decision
- Suspend business (permanent or temporary)

### Chargeback Handling
- **Process:** Platform mediates (holds funds, releases after resolution)
- **When Chargeback Filed:** Platform notifies business + freezes funds
- **Investigation:** Admin reviews payment trail, booking details, communication
- **Resolution Options:**
  - Refund consumer (if business at fault)
  - Reject chargeback (if consumer at fault) + educate consumer
- **Fees:** Chargeback fee (EGP 50 if business at fault, covered by platform if consumer at fault)

---

## 📊 BOOKING ENGINE & AVAILABILITY

### Slot Availability Logic

**Availability Release Timing:**
- Slot removed from available inventory: Immediately when booking confirmed
- Slot can be re-available: Only after no-show window passes (30min post-slot) OR explicit cancellation

**Multi-Hour Booking Overlap:**
- **Rule:** No overlapping bookings allowed for same business
- **Example:** If table booked 2-4pm, cannot accept booking 3-5pm (overlap at 3-4pm)
- **Conflict Resolution:** FCFS (first-come-first-served at millisecond precision)
  - When simultaneous requests detected: Database transaction uses SERIALIZABLE isolation level
  - First INSERT succeeds, second INSERT fails (slot no longer available)
  - Consumer sees error: "Slot just booked, please try another time"

**Capacity vs Overlap:**
- Restaurants: Support multiple tables (no overlap needed)
  - Slot availability depends on table capacity
  - Example: Restaurant has Table 1 (2 seats) + Table 2 (4 seats)
  - Can accept 2 simultaneous bookings (different tables) at same time
- Sports Courts: Support multiple courts
  - Can accept multiple bookings same time (different courts)
  - Availability logic: Check specific court, not all courts
- Gaming Cafes: Support multiple stations (PC, PS, VR, Group Room)
  - Can accept simultaneous bookings different stations
  - Availability logic: Check specific station type + count

### Simultaneous Booking Conflict Resolution
- **Rule:** First-come-first-served (FCFS, earliest request wins)
- **Precision:** Millisecond-level (database transaction timestamp)
- **Tied Requests:** Use database auto-increment ID as tiebreaker (lower ID wins)
- **Consumer Notification:** Losing consumer gets error + suggested alternative times

### Availability Caching & Refresh
- **Cache Strategy:** Polling every 30 seconds
- **Cache Validity:** 30 seconds (stale data acceptable for UX)
- **Refresh Triggers:**
  - Manual refresh (user taps "Refresh" button)
  - Automatic on booking success (show real-time updates)
  - Automatic on returning to screen (if > 30s elapsed)
- **Backend Source of Truth:** Database (Redis is only temporary hold, not canonical availability)

---

## 🧪 TESTING & QUALITY ASSURANCE

### Test Coverage Targets
- **Minimum Overall Coverage:** 80% (across all test types)
- **Unit Tests:** >= 70% of utility functions, helpers, calculation functions
- **Integration Tests:** >= 60% of API endpoints, database operations
- **E2E Tests:** >= 50% of critical user journeys (booking flow, payment, cancellation)
- **Target:** No critical features shipped with < 80% coverage

### Load Testing Targets
- **Expected Peak Concurrent Users:** 1,000 users (Phase 1 Egypt launch)
- **Stress Testing:** Verified stable up to 5,000 concurrent (3× expected peak)
- **Load Test Metrics:**
  - API response time: < 500ms at p95
  - Database query time: < 100ms at p95
  - Success rate: 99.9% (1 in 1000 requests fails)
- **Frequency:** Monthly load test against staging environment

### Test Data Requirements
- **Staging:** 50+ test businesses (restaurants, salons, different capacities)
- **Test Users:** 500+ test consumer accounts for booking simulations
- **Payment Testing:** Paymob test mode (test card: 4916 5213 4116 9928, all expirations valid)

---

## 📈 PERFORMANCE & UPTIME SLAs

### Uptime Target
- **Availability SLA:** 99.95% monthly uptime
- **Acceptable Downtime:** 21 minutes per month (average)
- **Measurement:** Automated monitoring from 3 geographic regions
- **Monitoring Tools:** TBD (Datadog, Sentry, or equivalent)
- **Alert Threshold:** Downtime > 5 minutes triggers PagerDuty alert

### API Response Time SLA
- **Target:** < 500ms response time for 95% of API requests
- **Measurement:** Per endpoint (p95 percentile)
- **Endpoints Excluded from SLA:** Search (complex queries), Analytics aggregations
- **Retry Logic:** If response > 1s, client-side retry (max 3 attempts)

### Database Performance
- **Query Response Time:** < 100ms for 95% of queries (p95)
- **Connection Pool:** 20 connections (default), adjustable per environment
- **Indexes:** Optimized for common queries (user_id, booking_id, date range)
- **Monitoring:** Slow query log (queries > 1s logged + investigated)

### Monitoring & Alerting
- **24/7 Uptime Monitoring:** 3-region health checks (EU, US, Asia)
- **Critical Alerts:** PagerDuty escalation (on-call rotation)
- **Incident Response:** Max response time 30 minutes
- **Post-Incident:** Root cause analysis + prevention plan within 48 hours

---

## 🏷️ CATEGORY-SPECIFIC BUSINESS RULES

### Restaurant
- **Min Party Size:** 1 person
- **Max Party Size:** Configurable per restaurant (typically 12)
- **Min Advance Booking:** 30 minutes
- **Cancellation Fee:** None (24-hour cancellation window, configurable)
- **Table Reset Time:** 15 minutes between seatings (buffer configurable)
- **Operating Hours:** Configurable per day (open 7am-midnight typical)

### Salon
- **Min Stylist Schedule:** 30 minutes (stylist availability blocks)
- **Service Duration:** 15 min to 3 hours (per service type)
- **Cancellation:** 24-hour window standard
- **No-Show Penalty:** 25% platform split
- **Staff Deactivation:** Existing bookings NOT auto-cancelled (keep bookings, mark staff unavailable after current bookings end)

### Sports Court
- **Min Duration:** 1 hour
- **Max Duration:** 8 hours
- **Peak Hours:** Configurable (e.g., 6-10pm EGP 100/hr, off-peak EGP 50/hr)
- **Equipment Rental:** Add-on at checkout (rackets, balls, etc.)
- **Player Capacity:** Sport-dependent (padel = 4, football 5 = 10)

### Gaming Cafe
- **Station Types:** PC, PlayStation, VR, Group Room
- **Min Duration:** 1 hour
- **Max Duration:** 12 hours
- **Group Room Pricing:** Flat rate per hour (not per person)
- **Station Specs:** Store in dashboard (CPU, GPU, RAM, monitor size)
- **Late-Night Surcharge:** Configurable (e.g., +20% for 12am-6am bookings)

### Car Wash
- **Service Types:** Basic Wash, Deluxe (interior), Premium (detail)
- **Vehicle Types:** Sedan, SUV, Truck (different pricing)
- **Duration:** 30 min (basic) to 2 hours (premium detail)
- **Buffer Time:** Mandatory 15-30 min between services (cleanups)
- **Drop-Off vs Wait:** Business configures which services allow drop-off
- **Mark Ready Action:** Owner marks service complete → Consumer WhatsApp notification sent (unique feature)

---

## 📝 ERROR CODES & ERROR HANDLING

### Standard HTTP Status Codes
```
200 OK — Request successful
201 Created — Resource created successfully
204 No Content — Successful, no body to return
400 Bad Request — Invalid input (validation error)
401 Unauthorized — Missing/invalid authentication
403 Forbidden — Authenticated but not authorized
404 Not Found — Resource doesn't exist
409 Conflict — Resource conflict (e.g., phone duplicate)
429 Too Many Requests — Rate limit exceeded
500 Internal Server Error — Server error
503 Service Unavailable — Temporary unavailability
```

### Application-Specific Error Codes
```
PHONE_DUPLICATE — Phone number already registered
SLOT_UNAVAILABLE — Requested slot booked/unavailable
INSUFFICIENT_BALANCE — User has insufficient funds
PAYMENT_FAILED — Payment gateway rejection
INVALID_OTP — Incorrect OTP code
USER_NOT_FOUND — User account doesn't exist
BUSINESS_NOT_FOUND — Business account doesn't exist
BOOKING_EXPIRED — Booking slot hold TTL expired
SESSION_EXPIRED — JWT token expired
RATE_LIMIT_EXCEEDED — Too many requests
```

### Error Response Format
```json
{
  "error": true,
  "code": "SLOT_UNAVAILABLE",
  "message": "Requested time slot no longer available",
  "statusCode": 409,
  "timestamp": "2026-04-13T14:30:00Z",
  "requestId": "req_abc123def456"
}
```

### Retry Logic
- **Retryable Errors:** 500, 503, 429 (after backoff)
- **Max Retries:** 3 attempts
- **Backoff Strategy:** Exponential (1s, 2s, 4s)
- **Non-Retryable:** 400, 401, 403, 404, 409 (fail immediately)

---

## 🔄 COMPLETED WORK (Phase 1)

### Epics 1-11: Core Platform
- ✅ User authentication (OTP + social login)
- ✅ Home discovery (search, filters, cards)
- ✅ Restaurant booking flow
- ✅ Salon booking flow
- ✅ Payment integration (Paymob)
- ✅ Booking management (My Bookings, reschedule, cancel)
- ✅ Review system
- ✅ Admin console
- ✅ Business dashboard (restaurant + salon)
- ✅ Notifications (FCM push)
- ✅ Analytics (GA4)

### Recent Enhancements (Portal 1 — Consumer App)

#### US-040, 041, 042: Home Page Enhancements ✅
- Real-time search (business name + service name, 300ms debounce)
- Advanced filters (rating ≥3.5★, distance 0-25km, price EGP 50-500, multi-category)
- Enhanced business cards (16:9 hero image, circular category badges, rating ≥3reviews, "Open Now" state)

#### US-060–069: Profile Page Enhancements ✅
- Profile image upload (circular 160px crop, S3 storage)
- Profile edit modal (name, phone, image in one modal)
- Phone validation (format + duplicate check, E.164 format)
- Logout button (confirmation dialog, session clear)
- Account deletion (soft delete, anonymization, GDPR compliant)
- WhatsApp coming soon indicator (static text, no toggle)
- Push notification toggle (FCM subscription)
- Language preference toggle (Arabic/English, immediate RTL flip)
- Footer branding (Hagez • v1.0.0)
- Terms & Conditions / Privacy Policy (signup + profile access)

#### US-070–074: Gaming Cafe Reservation Flow ✅
- Station type selection (PC, PS, VR, Group Room grid display)
- Multi-station selection (same/different types, same time slot)
- Real-time station availability (Available/Booked/Maintenance, 30s polling)
- Date/time selection (7-day calendar, hourly slots, duration 1/2/3 hours, real-time check)
- Checkout & payment (deposit 100%, Paymob integration)

---

## 💻 TECH STACK (Current Level)

### Frontend
- **Consumer App:** React Native (Expo), TypeScript
- **Web Dashboards:** Next.js 14, TypeScript, Tailwind CSS
- **Package Manager:** npm/yarn (Turbo monorepo)

### Backend
- **API:** Node.js + Fastify
- **Database:** PostgreSQL 15
- **ORM:** Prisma
- **Authentication:** JWT (phone OTP, social login)

### Integrations
- **Payments:** Paymob (card, Fawry, InstaPay, Vodafone Cash, Meeza)
- **WhatsApp:** 360dialog WABA (booking confirmations, reminders)
- **SMS:** Twilio (OTP fallback)
- **Push Notifications:** Firebase Cloud Messaging (FCM)
- **File Storage:** AWS S3 + CloudFront CDN
- **Notifications Queue:** AWS SQS + DLQ
- **Database:** AWS RDS PostgreSQL (me-south-1 Bahrain)

### Design System
- **Name:** Material Design 3 (with RTL adaptations)
- **Typography:**
  - Arabic: Cairo font (SemiBold for headlines)
  - Latin: Inter font
  - Monospace: IBM Plex Mono (booking references)
- **Color Palette:**
  - Primary Navy: #00243b
  - Secondary Teal: #00696c
  - CTA Blue: (from design tokens)
  - Category Accents:
    - Restaurant: Burnt Orange (#D2691E)
    - Salon: Magenta (#E91E63)
    - Court: Green
    - Gaming: Purple
    - Car Wash: Cyan
  - Semantic: Red (#d32f2f) destructive, Green (#4CAF50) success
- **Spacing:** 16px horizontal margins, 12px vertical between sections
- **No Dividers:** Use whitespace, not 1px lines (design requirement)

---

## 📚 GLOSSARY & CONVENTIONS

### Booking States
```
pending_payment
  ↓ (payment successful)
confirmed
  ↓ (booking completed, no-show not triggered)
completed
  ↓ OR
  ↳ cancelled_by_consumer (refund applied)
  ↳ cancelled_by_business (refund applied)
  ↳ no_show (detected 30min post-slot, 75/25 split)
  ↳ disputed (customer/business dispute flagged)
  ↳ expired (slot passed, no action taken)
```

### Roles & Permissions
```
consumer — End user, books services, leaves reviews
business_owner — Restaurant/salon owner, manages bookings + availability
admin — Robusta operations, handles disputes, verifies businesses
super_admin — Robusta leadership, approves high-value refunds, configures platform
```

### Payment & Escrow
```
Deposit — Amount held as escrow (Paymob), released on booking completion
Paymob — Payment gateway (primary), supports multiple methods
Escrow — Deposit held until booking completed (no-show triggers split)
No-Show Split — Business 75%, Platform 25% (configurable)
Refund Thresholds — Admin: < EGP 500 auto-approve, Super Admin: ≥ EGP 500 required
```

### Booking References & IDs
```
Booking Reference Format: BK-YYYYMMDD-XXXXX
  Example: BK-20260413-ABC12
  Used in: Confirmations, receipts, customer service

Station ID Format: {category}-{number}
  Example: PC-001, PS-002, VR-001, GROUP-001

User ID Format: user_{uuid}
```

### Real-Time Concepts
```
Slot Hold — Reservation lock while user completes payment, TTL 8 minutes (480s Redis)
No-Show Detection — Automated job runs every 15 minutes, checks if user attended
Real-Time Availability — WebSocket (preferred) or HTTP polling (30s fallback)
Occupancy — Live count of occupied stations/tables/courts
```

### Arabic & Localization
```
RTL — Right-to-left, affects text alignment + layout direction
Ammiya — Egyptian Arabic dialect (used in WhatsApp bot, casual messaging)
Language Preference — Stored per user (ar or en), immediate UI switch
Typeface Styling — Headline fonts: SemiBold for Arabic readability
```

### Database & API Conventions
```
Timestamps — ISO 8601 format (2026-04-13T14:30:00Z)
Currency — EGP only (Phase 1), stored as integers (e.g., 50000 = EGP 500.00)
Phone Numbers — E.164 format (+201234567890)
Dates — YYYY-MM-DD format
API Response — RESTful, JSON, error codes with message + code field
```

---

## 📋 PROJECT FILES & WORKSPACE

### In `/mnt/project/` (Read-Only Project Folder)
```
master_prd.docx            — Full PRD with all requirements
backlog.xlsx               — Feature & task backlog
tech_specs.docx            — Technical specifications
ui_design_guide.docx       — Design system (colors, typography, components)
ui_design_guide.pptx       — Design presentation (18 slides)
ux_flow_diagrams.docx      — UX flows for all portals
competitive_analysis.docx  — Competitor research (Eat App, Fresha, Booksy, etc.)
gtm_strategy.docx          — Go-to-market strategy
operating_model.docx       — Business operating model
GA4_Implementation_Strategy_v1.md — Analytics implementation
DESIGN.md                  — Design system markdown reference
[PNG images]               — UI mockups (home, dashboard, booking, etc.)
```

### In `/mnt/user-data/outputs/` (Deliverables Folder)
```
HAGEZ_*_STORIES.md         — User stories for features
CLAUDE_CODE_PROMPT_*.md    — Implementation specs for Claude Code
[Other supporting docs]    — Visual overviews, roadmaps, references
```

---

## 🎭 USER PERSONAS (Archetypes)

### Consumer Side
- **Ahmed (Busy Professional)** — Books last-minute dining, premium salons
- **Fatima (Social Organizer)** — Plans group events, salons, sports
- **Mohamed (Gaming Enthusiast)** — Books late-night gaming sessions, PC/VR
- **Noor (Budget-Conscious)** — Seeks deals, off-peak bookings, car wash

### Business Side
- **Hassan (Restaurant Owner)** — Manages walk-ins + online bookings, needs inventory
- **Mariam (Salon Owner)** — Manages staff scheduling, wants stylist utilization insights
- **Karim (Gaming Cafe Operator)** — Manages stations, late-night hours, group room rentals
- **Layla (Ops Manager)** — Uses mobile, handles reception, manual bookings

**Phase Alignment:** All personas apply to Phase 1 launch (restaurants + salons). Phase 2 adds court/gaming/car wash personas.

---

## ✅ QUALITY STANDARDS

### RTL Compliance
- ✅ All text right-aligned in Arabic
- ✅ Layout mirrors (sidebars, buttons)
- ✅ Icons stay in consistent position (don't flip)
- ✅ Tested with `I18nManager.isRTL` helper
- ✅ Padding/margins symmetric (left/right equal)

### Accessibility (WCAG AA)
- ✅ Touch targets: 44×44px minimum
- ✅ Color contrast: 4.5:1 for normal text
- ✅ Screen reader labels on all interactive elements
- ✅ Keyboard navigation logical
- ✅ No keyboard traps

### Performance
- ✅ Page load: < 1 second
- ✅ API response: < 500ms
- ✅ Real-time updates: 30s polling max
- ✅ FlatList optimization (no janky scrolls)
- ✅ Image compression (< 50KB per avatar)

### Design System Compliance
- ✅ No 1px dividers (use whitespace)
- ✅ Card shadows: `0px 4px 12px rgba(67, 97, 123, 0.06)`
- ✅ Button shadows: Same card shadow
- ✅ Font hierarchy: Headline-md, Body-md, Body-sm
- ✅ Spacing: 16px horizontal, 12px vertical

---

## 🚀 HOW TO USE THIS FILE

### For Feature Requests
1. **Read** this file first
2. **Check** if feature already exists (Completed Work section)
3. **Verify** which portals are affected
4. **Reference** relevant sections (Glossary, Tech Stack, etc.)
5. **Follow** the NO ASSUMPTIONS rule → **Ask before proceeding**

### For Implementation
1. **User Stories** — Production-ready format, all acceptance criteria
2. **Claude Code Prompt** — Only if you explicitly ask for it (no longer default)
3. **References** — Design system, tech stack, API conventions, examples
4. **Validation** — Cross-check against this file for consistency

### For Decisions
1. **Read** this file for context
2. **Ask clarifying questions** (NO ASSUMPTIONS rule)
3. **Document** decisions in this file (see Update Instructions below)
4. **Share** updated file with team

---

## 📝 UPDATE INSTRUCTIONS

### ⚠️ CRITICAL: Keep This File Current

**WHEN to update:**
- ✅ New epic or feature completed
- ✅ New portal or major feature added
- ✅ Tech stack change
- ✅ Business model change (pricing, fees, split %)
- ✅ Portal impact analysis (which portals affected by decision)
- ✅ Completed work (new stories, flows)

**HOW to update:**
1. **Tell me:** "Update CLAUDE.md with: [what changed]"
2. **I will ask:** Clarifying questions if vague
3. **I will update:** Relevant sections of this file
4. **You will review:** Approve changes before using

**SECTIONS to keep updated:**
- ✏️ Completed Work (add new stories/flows as done)
- ✏️ Portals (add new portals or phase changes)
- ✏️ Tech Stack (if services added/changed)
- ✏️ Glossary (new terms, conventions)
- ✏️ Quality Standards (if criteria change)

**Example update request:**
```
"Update CLAUDE.md: 

Add to Completed Work:
- US-075–080: Booking reschedule flow (new stories)

Update Portal 5:
- Gaming Cafe real-time availability now implemented (was Phase 2)

Add to Glossary:
- 'Station occupancy' definition + examples
```

---

## 📞 QUICK REFERENCE

### Key Contacts
- **Product Owner:** Hesham Abdelaal (Senior PM, Robusta)
- **Design System:** Reference `/mnt/project/DESIGN.md`
- **Backlog:** Reference `/mnt/project/backlog.xlsx`

### Before Starting Any Feature
1. ✅ Read this file
2. ✅ Check Completed Work section
3. ✅ Identify affected portals
4. ✅ Ask clarifying questions (NO ASSUMPTIONS)
5. ✅ Proceed with user stories only

### Key Constraints
- 🚫 No assumptions on vague requirements
- 🚫 No hardcoded URLs (use environment config)
- 🚫 No 1px dividers in UI
- 🚫 No skipping RTL testing
- 🚫 No phone numbers without E.164 format
- 🚫 No Firebase/Paymob tokens in code

---

**STATUS: AUTHORITATIVE PROJECT REFERENCE**  
**Last Updated:** April 13, 2026  
**Next Review:** After major feature completion  
**Owner:** Hesham Abdelaal

---

## 🎯 FINAL REMINDER

**⚠️ BEFORE YOU PROCEED WITH ANY REQUEST:**

**IF anything is unclear:**
- ✋ **STOP**
- ❓ **ASK** (5-8 clarifying questions)
- 🎯 **WAIT** (for your answers)
- ✅ **DELIVER** (user stories only, no assumptions)

**This file is your contract with me.** Use it. Update it. Trust it.
