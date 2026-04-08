# App Store & Play Store Submission Checklist (US-098, EP-24)

**Target:** Both submissions minimum **2 weeks before launch date**
**Rejection SLA:** 48-hour turnaround on any rejection feedback

---

## Apple App Store

### Privacy & Legal
- [ ] App Privacy section completed in App Store Connect:
  - [ ] **Name** — collected, linked to user
  - [ ] **Phone number** — collected, linked to user
  - [ ] **Precise location** — collected, linked to user (optional, "قريبة منك" feature)
  - [ ] **Payment info** — collected, linked to user (via Paymob)
  - [ ] **User ID** — collected, linked to user
  - [ ] **Usage data** — collected, not linked to user (analytics)
- [ ] Privacy Policy URL live and publicly reachable: `https://reservr.eg/privacy`
  - URL must match the one in `privacy-policy.tsx` (US-081)
- [ ] Terms of Service URL live: `https://reservr.eg/terms`

### Technical Requirements
- [ ] Apple Sign-In implemented (US-067) — **mandatory for apps offering other login methods**
- [ ] App does not use private APIs
- [ ] All entitlements declared in `app.json` / `eas.json`
- [ ] Push notification entitlement declared (Firebase FCM via APNs)
- [ ] No crash on launch on iOS 16+ and iOS 17+

### Metadata (Arabic RTL)
- [ ] App name: **سوبر ريزرفيشن** (or approved Arabic name)
- [ ] Subtitle: **احجز مطاعمك وصالوناتك بسهولة**
- [ ] Description: Arabic RTL, naturally written, max 4,000 characters
- [ ] Keywords: Arabic keywords entered (max 100 characters)
- [ ] Age rating: **4+** (no objectionable content)
- [ ] Primary language: Arabic

### Screenshots
- [ ] iPhone 6.5" screenshots (1284 × 2778 px) — Arabic UI, at least 3
- [ ] iPhone 5.5" screenshots (1242 × 2208 px) — Arabic UI, at least 3
- [ ] iPad 12.9" screenshots (2048 × 2732 px) — Arabic UI, at least 3
- [ ] Screenshots show key flows: Home, Search, Booking, Confirmation

### Pre-Launch Testing
- [ ] TestFlight build live and tested with pilot businesses (Sprint 8)
- [ ] TestFlight invite sent to ops team and pilot business owners
- [ ] All TestFlight feedback addressed before store submission

---

## Google Play Store

### Privacy & Legal
- [ ] Privacy Policy URL live: `https://reservr.eg/privacy`
- [ ] Data Safety form completed:
  - [ ] Data collected: Name, Phone, Location (optional), Payment info
  - [ ] Data shared: with businesses (name, party size), with Paymob
  - [ ] Data encrypted in transit: Yes (TLS)
  - [ ] Users can request deletion: Yes (DELETE /users/me — US-082)

### Technical Requirements
- [ ] Target API level ≥ 34 (Android 14) — required for Play Store 2024+
- [ ] Arabic locale declared in `app.json`: `"locales": ["ar"]`
- [ ] 64-bit build only (no 32-bit APK)
- [ ] No uses-permission for unused dangerous permissions

### Metadata (Arabic RTL)
- [ ] App name: **سوبر ريزرفيشن**
- [ ] Short description (80 chars): Arabic, RTL
- [ ] Full description (4,000 chars): Arabic, RTL, naturally written
- [ ] App category: **Lifestyle** or **Travel & Local**

### Screenshots & Assets
- [ ] Phone screenshots (min 2, max 8): Arabic UI
- [ ] Feature graphic: 1024 × 500 px
- [ ] App icon: 512 × 512 px (no alpha)

### Pre-Launch Testing
- [ ] Internal Testing track live and tested with pilot businesses (Sprint 8)
- [ ] Closed Testing track promoted before public release

---

## Sign-Off

| Item | Owner | Date Completed |
|------|-------|---------------|
| Apple submission submitted | | |
| Google submission submitted | | |
| Apple — approved | | |
| Google — approved | | |
| Both stores live | | |

**Launch gate passes when both stores show status: Live / Published.**
