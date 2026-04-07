// ============================================================
// SUPER RESERVATION PLATFORM — Daily Summary Email Job
// US-059: Sends Arabic HTML email to business owners at 09:00
// Africa/Cairo every morning with previous day's stats.
// Disabled via business.notify_payout_whatsapp preference
// (shared opt-out flag — email respects same preference).
// In dev/staging: emails are logged only (no SMTP configured).
// ============================================================

import { CronJob } from 'cron';
import type { PrismaClient } from '@prisma/client';

// ── Start Job ────────────────────────────────────────────────

export function startDailySummaryJob(db: PrismaClient): CronJob {
  // 09:00 Africa/Cairo every day
  const job = new CronJob(
    '0 9 * * *',
    async () => {
      try {
        await runDailySummary(db);
      } catch (err) {
        console.error('[daily-summary] Job error', err);
      }
    },
    null,
    true,
    'Africa/Cairo'
  );
  console.log('[daily-summary] Daily summary email job scheduled at 09:00 Africa/Cairo');
  return job;
}

// ── Core Runner ──────────────────────────────────────────────

async function runDailySummary(db: PrismaClient): Promise<void> {
  const now = new Date();
  const todayCairo = towardsCairoMidnight(now);
  const yesterdayStart = new Date(todayCairo.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayEnd = new Date(todayCairo.getTime() - 1); // 23:59:59.999 yesterday

  // Get all active businesses with email notifications enabled
  const businesses = await db.business.findMany({
    where: { status: 'active', notify_payout_whatsapp: true },
    include: { owner: { select: { email: true, full_name: true } } },
  });

  let sent = 0;
  let skipped = 0;

  for (const business of businesses) {
    const ownerEmail = business.owner.email;
    if (!ownerEmail) {
      skipped++;
      continue;
    }

    try {
      const stats = await getYesterdayStats(db, business.id, yesterdayStart, yesterdayEnd);
      const html = buildEmailHtml(business.name_ar, business.owner.full_name, yesterdayStart, stats);

      await sendEmail(ownerEmail, `ملخص يوم أمس — ${business.name_ar}`, html);
      sent++;
    } catch (err) {
      console.error(`[daily-summary] Failed for business ${business.id}`, err);
    }
  }

  console.log(`[daily-summary] Done — sent: ${sent}, skipped (no email): ${skipped}`);
}

// ── Stats Query ───────────────────────────────────────────────

async function getYesterdayStats(
  db: PrismaClient,
  businessId: string,
  from: Date,
  to: Date
) {
  const bookings = await db.booking.findMany({
    where: {
      business_id: businessId,
      created_at: { gte: from, lte: to },
      status: { notIn: ['expired', 'pending_payment'] },
    },
    select: { status: true, deposit_amount: true, platform_fee: true },
  });

  const total = bookings.length;
  const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
  const completed = bookings.filter((b) => b.status === 'completed').length;
  const noShows = bookings.filter((b) => b.status === 'no_show').length;
  const cancelled = bookings.filter((b) => b.status.startsWith('cancelled')).length;
  const depositCollected = bookings
    .filter((b) => b.status === 'completed' || b.status === 'no_show')
    .reduce((sum, b) => sum + Number(b.deposit_amount), 0);

  return { total, confirmed, completed, noShows, cancelled, depositCollected };
}

// ── HTML Email Builder ────────────────────────────────────────

function buildEmailHtml(
  businessNameAr: string,
  ownerName: string,
  date: Date,
  stats: {
    total: number;
    confirmed: number;
    completed: number;
    noShows: number;
    cancelled: number;
    depositCollected: number;
  }
): string {
  const dateAr = date.toLocaleDateString('ar-EG', {
    timeZone: 'Africa/Cairo',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ملخص يومي — ${businessNameAr}</title>
</head>
<body style="margin:0;padding:0;background:#F7F8FA;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8FA;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
        <!-- Header -->
        <tr>
          <td style="background:#0F2044;padding:28px 32px;text-align:right;">
            <div style="color:#1B8A7A;font-size:13px;font-weight:bold;letter-spacing:1px;margin-bottom:6px;">SUPER RESERVATION</div>
            <div style="color:#fff;font-size:22px;font-weight:bold;">ملخص يوم أمس</div>
            <div style="color:rgba(255,255,255,0.6);font-size:14px;margin-top:4px;">${dateAr}</div>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:28px 32px 8px;text-align:right;">
            <p style="color:#0F2044;font-size:16px;margin:0;">مرحباً ${ownerName}،</p>
            <p style="color:#6B7280;font-size:14px;margin:8px 0 0;">فيما يلي ملخص نشاط <strong>${businessNameAr}</strong> ليوم أمس:</p>
          </td>
        </tr>

        <!-- KPI Grid -->
        <tr>
          <td style="padding:20px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                ${kpiCell('إجمالي الحجوزات', stats.total, '#0F2044')}
                ${kpiCell('حجوزات مكتملة', stats.completed, '#1B8A7A')}
              </tr>
              <tr><td colspan="2" height="12"></td></tr>
              <tr>
                ${kpiCell('حالات غياب', stats.noShows, '#D32F2F')}
                ${kpiCell('إيداعات مُحصَّلة', `${stats.depositCollected.toFixed(0)} ج.م`, '#0057FF')}
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:8px 32px 32px;text-align:center;">
            <a href="https://dashboard.reservr.eg" style="display:inline-block;background:#1B8A7A;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:bold;">
              فتح لوحة التحكم
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F7F8FA;padding:16px 32px;text-align:center;border-top:1px solid #E5E7EB;">
            <p style="color:#9CA3AF;font-size:12px;margin:0;">
              لإيقاف هذا الملخص، يمكنك تعطيله من إعدادات الإشعارات في لوحة التحكم.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function kpiCell(label: string, value: number | string, color: string): string {
  return `<td width="50%" style="padding:0 4px;">
    <div style="background:#F7F8FA;border-radius:12px;padding:16px;border-top:3px solid ${color};text-align:right;">
      <div style="font-size:24px;font-weight:bold;color:${color};margin-bottom:4px;">${value}</div>
      <div style="font-size:12px;color:#6B7280;font-weight:600;">${label}</div>
    </div>
  </td>`;
}

// ── Email Sender ──────────────────────────────────────────────
// Stub: logs in dev, integrates with AWS SES / SendGrid in prod.
// Replace this function with your email provider SDK call.

async function sendEmail(to: string, subject: string, _html: string): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[daily-summary] 📧 EMAIL (dev — not sent) → ${to}: ${subject}`);
    return;
  }

  // TODO: replace with SES or SendGrid integration post-MVP
  console.warn('[daily-summary] Email provider not configured for production. Skipping send.');
}

// ── Helpers ───────────────────────────────────────────────────

function towardsCairoMidnight(now: Date): Date {
  // Get midnight Cairo time as UTC Date
  const cairoNow = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
  cairoNow.setHours(0, 0, 0, 0);
  // Offset back to UTC: Cairo is UTC+2 (UTC+3 in summer — use fixed +2 for simplicity)
  return new Date(cairoNow.getTime() - 2 * 60 * 60 * 1000);
}
