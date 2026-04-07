// ============================================================
// SUPER RESERVATION PLATFORM — Notification Worker
// US-045: SMS fallback when WhatsApp undelivered within 60 s
// US-050: SQS consumer — dispatches to 360dialog / Twilio / Firebase
//         Exponential back-off: 1 s → 2 s → 4 s (3 attempts total)
//         On 3rd failure the message lands in the DLQ automatically
//         (SQS maxReceiveCount = 3 configured via AWS console / IaC)
// ============================================================

import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  ChangeMessageVisibilityCommand,
  type MessageSystemAttributeName,
} from '@aws-sdk/client-sqs';
import type { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { env } from '../config/env.js';

// ── Firebase Admin (push notifications) ─────────────────────
// Lazy-initialised so the worker starts without Firebase creds in dev.
let firebaseApp: import('firebase-admin').app.App | null = null;
async function getFirebaseMessaging() {
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    return null;
  }
  if (!firebaseApp) {
    const admin = await import('firebase-admin');
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }
  const admin = await import('firebase-admin');
  return admin.messaging(firebaseApp);
}

// ── SQS Client ───────────────────────────────────────────────
const sqs = new SQSClient({ region: env.AWS_REGION });

// ── SQS Message Shape ────────────────────────────────────────
interface SqsNotificationMessage {
  notification_id: string;
  channel: 'whatsapp' | 'sms' | 'push' | 'email';
  template_key: string;
  payload: Record<string, unknown>;
  recipient_id: string;
  recipient_type: 'consumer' | 'business';
}

// ── Delivery Functions ───────────────────────────────────────

async function deliverWhatsApp(
  db: PrismaClient,
  notificationId: string,
  recipientId: string,
  recipientType: 'consumer' | 'business',
  templateKey: string,
  payload: Record<string, unknown>
): Promise<void> {
  if (!env.DIALOG360_API_KEY || !env.DIALOG360_WABA_NUMBER) {
    console.warn('[notification-worker] DIALOG360 not configured — skipping WhatsApp delivery');
    await db.notification.update({ where: { id: notificationId }, data: { status: 'sent' } });
    return;
  }

  // Resolve recipient phone number
  let phone: string | null = null;
  if (recipientType === 'consumer') {
    const user = await db.user.findUnique({ where: { id: recipientId }, select: { phone: true } });
    phone = user?.phone ?? null;
  } else {
    const biz = await db.business.findUnique({
      where: { id: recipientId },
      select: { owner: { select: { phone: true } } },
    });
    phone = biz?.owner.phone ?? null;
  }

  if (!phone) throw new Error(`No phone for recipient ${recipientId}`);

  // 360dialog HSM template call
  const response = await axios.post(
    `${env.DIALOG360_BASE_URL}/messages`,
    {
      messaging_product: 'whatsapp',
      to: phone.replace(/^\+/, ''),
      type: 'template',
      template: {
        name: templateKey,
        language: { code: 'ar' },
        components: buildTemplateComponents(templateKey, payload),
      },
    },
    {
      headers: {
        'D360-API-KEY': env.DIALOG360_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 10_000,
    }
  );

  const providerMessageId: string = response.data?.messages?.[0]?.id ?? '';
  await db.notification.update({
    where: { id: notificationId },
    data: { status: 'sent', provider_message_id: providerMessageId, sent_at: new Date() },
  });

  // US-045: schedule SMS fallback if WhatsApp undelivered within 60 s
  scheduleSMSFallback(db, notificationId, templateKey, payload, phone);
}

// US-045: SMS fallback — fires 60 s after WhatsApp dispatch
function scheduleSMSFallback(
  db: PrismaClient,
  notificationId: string,
  templateKey: string,
  payload: Record<string, unknown>,
  phone: string
): void {
  setTimeout(async () => {
    try {
      const notification = await db.notification.findUnique({ where: { id: notificationId } });
      // Only fall back if WhatsApp never reached 'delivered'
      if (!notification || notification.status === 'delivered') return;

      await deliverSMS(db, notificationId, phone, templateKey, payload, true);
    } catch (err) {
      console.error('[notification-worker] SMS fallback error', err);
    }
  }, 60_000);
}

async function deliverSMS(
  db: PrismaClient,
  notificationId: string,
  phone: string,
  templateKey: string,
  payload: Record<string, unknown>,
  isFallback = false
): Promise<void> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM_NUMBER) {
    console.warn('[notification-worker] Twilio not configured — skipping SMS delivery');
    if (!isFallback) {
      await db.notification.update({ where: { id: notificationId }, data: { status: 'sent' } });
    }
    return;
  }

  const body = buildSMSBody(templateKey, payload);
  const formData = new URLSearchParams({
    To: phone,
    From: env.TWILIO_FROM_NUMBER,
    Body: body,
  });

  const response = await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
    formData.toString(),
    {
      auth: { username: env.TWILIO_ACCOUNT_SID, password: env.TWILIO_AUTH_TOKEN },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10_000,
    }
  );

  const sid: string = response.data?.sid ?? '';
  if (!isFallback) {
    await db.notification.update({
      where: { id: notificationId },
      data: { status: 'sent', provider_message_id: sid, sent_at: new Date() },
    });
  } else {
    // Fallback — create a sibling notification record for audit
    await db.notification.create({
      data: {
        recipient_id: (await db.notification.findUnique({ where: { id: notificationId }, select: { recipient_id: true } }))!.recipient_id,
        recipient_type: (await db.notification.findUnique({ where: { id: notificationId }, select: { recipient_type: true } }))!.recipient_type,
        booking_id: (await db.notification.findUnique({ where: { id: notificationId }, select: { booking_id: true } }))?.booking_id ?? null,
        channel: 'sms',
        template_key: `${templateKey}_sms_fallback`,
        payload: payload as any,
        status: 'sent',
        provider_message_id: sid,
        sent_at: new Date(),
      },
    });
  }
}

async function deliverPush(
  db: PrismaClient,
  notificationId: string,
  recipientId: string,
  recipientType: 'consumer' | 'business',
  templateKey: string,
  payload: Record<string, unknown>
): Promise<void> {
  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    console.warn('[notification-worker] Firebase not configured — skipping push delivery');
    await db.notification.update({ where: { id: notificationId }, data: { status: 'sent' } });
    return;
  }

  // Resolve FCM token
  let fcmToken: string | null = null;
  if (recipientType === 'consumer') {
    const user = await db.user.findUnique({ where: { id: recipientId }, select: { fcm_token: true } });
    fcmToken = user?.fcm_token ?? null;
  } else {
    const biz = await db.business.findUnique({
      where: { id: recipientId },
      select: { owner: { select: { fcm_token: true } } },
    });
    fcmToken = biz?.owner.fcm_token ?? null;
  }

  if (!fcmToken) {
    // No token registered — mark sent (not an error)
    await db.notification.update({ where: { id: notificationId }, data: { status: 'sent' } });
    return;
  }

  const { title, body } = buildPushContent(templateKey, payload);
  const messageId = await messaging.send({
    token: fcmToken,
    notification: { title, body },
    data: { template_key: templateKey, notification_id: notificationId },
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default' } } },
  });

  await db.notification.update({
    where: { id: notificationId },
    data: { status: 'sent', provider_message_id: messageId, sent_at: new Date() },
  });
}

// ── Main Worker Loop ─────────────────────────────────────────

let workerRunning = false;

export async function startNotificationWorker(db: PrismaClient): Promise<void> {
  if (!env.SQS_NOTIFICATION_QUEUE_URL) {
    console.warn('[notification-worker] SQS_NOTIFICATION_QUEUE_URL not set — worker disabled');
    return;
  }

  workerRunning = true;
  console.log('[notification-worker] Starting SQS polling loop');

  while (workerRunning) {
    try {
      const result = await sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: env.SQS_NOTIFICATION_QUEUE_URL,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20,          // Long polling — reduces cost
          MessageSystemAttributeNames: ['ApproximateReceiveCount' as MessageSystemAttributeName],
        })
      );

      const messages = result.Messages ?? [];
      await Promise.allSettled(messages.map((msg) => processMessage(db, msg)));
    } catch (err) {
      console.error('[notification-worker] Poll error', err);
      // Back off 5 s on SQS errors to avoid tight loops
      await sleep(5_000);
    }
  }
}

export function stopNotificationWorker(): void {
  workerRunning = false;
}

// ── Process a Single SQS Message ────────────────────────────

async function processMessage(
  db: PrismaClient,
  msg: { Body?: string; ReceiptHandle?: string; Attributes?: Record<string, string>; SystemAttributes?: Record<string, string> }
): Promise<void> {
  if (!msg.Body || !msg.ReceiptHandle) return;

  let parsed: SqsNotificationMessage;
  try {
    parsed = JSON.parse(msg.Body);
  } catch {
    console.error('[notification-worker] Invalid JSON in SQS message, deleting', msg.Body);
    await deleteSQSMessage(msg.ReceiptHandle);
    return;
  }

  const receiveCount = parseInt(msg.SystemAttributes?.ApproximateReceiveCount ?? msg.Attributes?.ApproximateReceiveCount ?? '1');
  const delayMs = Math.pow(2, receiveCount - 1) * 1_000; // 1 s → 2 s → 4 s

  // Check notification still pending (idempotency — avoid re-sending delivered messages)
  const notification = await db.notification.findUnique({ where: { id: parsed.notification_id } });
  if (!notification || notification.status === 'delivered' || notification.status === 'sent') {
    await deleteSQSMessage(msg.ReceiptHandle);
    return;
  }

  // Respect scheduling (don't deliver early)
  if (notification.scheduled_at > new Date()) {
    const visibilityDelay = Math.ceil((notification.scheduled_at.getTime() - Date.now()) / 1_000);
    await sqs.send(
      new ChangeMessageVisibilityCommand({
        QueueUrl: env.SQS_NOTIFICATION_QUEUE_URL!,
        ReceiptHandle: msg.ReceiptHandle,
        VisibilityTimeout: Math.min(visibilityDelay, 43_200), // SQS max 12h
      })
    );
    return;
  }

  // Apply exponential back-off for retries (2nd and 3rd attempt)
  if (receiveCount > 1) {
    await sleep(delayMs);
  }

  try {
    switch (parsed.channel) {
      case 'whatsapp':
        await deliverWhatsApp(db, parsed.notification_id, parsed.recipient_id, parsed.recipient_type, parsed.template_key, parsed.payload);
        break;
      case 'sms':
        // Resolve phone first
        const phone = await resolvePhone(db, parsed.recipient_id, parsed.recipient_type);
        if (phone) {
          await deliverSMS(db, parsed.notification_id, phone, parsed.template_key, parsed.payload);
        } else {
          await db.notification.update({ where: { id: parsed.notification_id }, data: { status: 'failed' } });
        }
        break;
      case 'push':
        await deliverPush(db, parsed.notification_id, parsed.recipient_id, parsed.recipient_type, parsed.template_key, parsed.payload);
        break;
      default:
        console.warn('[notification-worker] Unknown channel', parsed.channel);
        await db.notification.update({ where: { id: parsed.notification_id }, data: { status: 'failed' } });
    }

    await deleteSQSMessage(msg.ReceiptHandle);
  } catch (err) {
    console.error(`[notification-worker] Delivery error (attempt ${receiveCount})`, parsed.notification_id, err);
    await db.notification.update({ where: { id: parsed.notification_id }, data: { status: 'failed' } });
    // Do NOT delete — SQS will re-deliver (up to maxReceiveCount=3), then route to DLQ
  }
}

// ── Helpers ──────────────────────────────────────────────────

async function deleteSQSMessage(receiptHandle: string): Promise<void> {
  await sqs.send(
    new DeleteMessageCommand({
      QueueUrl: env.SQS_NOTIFICATION_QUEUE_URL!,
      ReceiptHandle: receiptHandle,
    })
  );
}

async function resolvePhone(
  db: PrismaClient,
  recipientId: string,
  recipientType: 'consumer' | 'business'
): Promise<string | null> {
  if (recipientType === 'consumer') {
    const user = await db.user.findUnique({ where: { id: recipientId }, select: { phone: true } });
    return user?.phone ?? null;
  } else {
    const biz = await db.business.findUnique({
      where: { id: recipientId },
      select: { owner: { select: { phone: true } } },
    });
    return biz?.owner.phone ?? null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Template Helpers ─────────────────────────────────────────
// Maps template_key → 360dialog HSM component parameters.
// All template content must be pre-approved by Meta via 360dialog.
// See /docs/waba-templates.md for the full catalogue.

function buildTemplateComponents(
  templateKey: string,
  payload: Record<string, unknown>
): object[] {
  // Most templates use body-only parameters.
  // Header / footer components are defined in WABA template settings.
  const bodyParams = getBodyParams(templateKey, payload);
  return [
    {
      type: 'body',
      parameters: bodyParams.map((text) => ({ type: 'text', text })),
    },
  ];
}

function getBodyParams(templateKey: string, payload: Record<string, unknown>): string[] {
  switch (templateKey) {
    case 'booking_confirmation_ar':
      return [
        String(payload.booking_ref ?? ''),
        String(payload.business_name_ar ?? ''),
        String(payload.datetime_ar ?? ''),
        String(payload.cancel_link ?? ''),
      ];
    case 'reminder_24h_ar':
      return [
        String(payload.business_name_ar ?? ''),
        String(payload.datetime_ar ?? ''),
        String(payload.reschedule_link ?? ''),
        String(payload.cancel_link ?? ''),
      ];
    case 'payment_receipt_ar':
      return [
        String(payload.booking_ref ?? ''),
        String(payload.business_name_ar ?? ''),
        String(payload.datetime_ar ?? ''),
        String(payload.deposit_amount ?? ''),
        String(payload.platform_fee ?? ''),
        String(payload.total_amount ?? ''),
        String(payload.receipt_link ?? ''),
      ];
    case 'cancellation_confirmed_ar':
      return [
        String(payload.booking_ref ?? ''),
        String(payload.business_name_ar ?? ''),
        payload.deposit_forfeited ? 'تم خصم العربون' : `سيتم استرداد ${payload.refund_amount} ج.م. خلال ${payload.refund_eta}`,
      ];
    case 'no_show_consumer_ar':
      return [
        String(payload.business_name_ar ?? ''),
        String(payload.penalty_amount ?? ''),
        String(payload.dispute_link ?? ''),
      ];
    case 'dispute_received_ar':
      return [
        String(payload.booking_ref ?? ''),
        String(payload.business_name_ar ?? ''),
        String(payload.sla_hours ?? '72'),
      ];
    case 'dispute_resolved_consumer_ar':
      return [
        String(payload.booking_ref ?? ''),
        String(payload.business_name_ar ?? ''),
        String(payload.outcome_ar ?? ''),
      ];
    case 'refund_confirmed_ar':
      return [
        String(payload.booking_ref ?? ''),
        String(payload.refund_amount ?? ''),
      ];
    case 'payout_failed_ar':
      return [
        String(payload.business_name_ar ?? ''),
        String(payload.amount_egp ?? ''),
      ];
    default:
      return [];
  }
}

function buildSMSBody(templateKey: string, payload: Record<string, unknown>): string {
  // Plain-text Arabic SMS — condensed versions of WhatsApp templates
  switch (templateKey) {
    case 'booking_confirmation_ar':
      return `تم تأكيد حجزك في ${payload.business_name_ar} — ${payload.datetime_ar}\nرقم الحجز: ${payload.booking_ref}`;
    case 'reminder_24h_ar':
      return `تذكير: حجزك في ${payload.business_name_ar} غداً ${payload.datetime_ar}`;
    case 'cancellation_confirmed_ar':
      return `تم إلغاء حجزك ${payload.booking_ref} في ${payload.business_name_ar}.`;
    case 'no_show_consumer_ar':
      return `تم تسجيل غيابك عن حجز في ${payload.business_name_ar}. رسوم ${payload.penalty_amount} ج.م.`;
    default:
      return `إشعار من Reservr — ${templateKey}`;
  }
}

function buildPushContent(
  templateKey: string,
  payload: Record<string, unknown>
): { title: string; body: string } {
  switch (templateKey) {
    case 'new_booking_business':
      return {
        title: 'حجز جديد',
        body: `${payload.consumer_name} — ${payload.party_size} أشخاص | ${payload.booking_ref}`,
      };
    case 'upcoming_booking_biz':
      return {
        title: 'حجز قادم',
        body: `${payload.consumer_name} خلال ساعتين`,
      };
    case 'reminder_2h_push':
      return {
        title: `حجزك في ${payload.business_name_ar}`,
        body: `موعدك الساعة ${payload.time_ar} — الوصول بخير!`,
      };
    case 'no_show_business_ar':
      return {
        title: 'غياب مسجل',
        body: `${payload.consumer_name} (${payload.booking_ref}) لم يحضر. سيتم صرف ${payload.payout_amount} ج.م.`,
      };
    case 'dispute_resolved_business_ar':
      return {
        title: 'نتيجة النزاع',
        body: String(payload.outcome_ar ?? ''),
      };
    default:
      return { title: 'Reservr', body: templateKey };
  }
}
