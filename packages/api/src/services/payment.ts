// ============================================================
// SUPER RESERVATION PLATFORM — Paymob Payment Service
// Handles: order creation, payment key generation, webhook
// verification (HMAC-SHA512), escrow release, refunds.
// ============================================================

import crypto from 'crypto';
import axios from 'axios';
import type { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

// ── Module-load Paymob env validation ────────────────────────
// Paymob is optional in local dev, but required in staging/production.
// Validate once at import time so the subsequent non-null assertions
// are justified and the service fails fast on misconfiguration.
const REQUIRED_PAYMOB_VARS = [
  'PAYMOB_API_KEY',
  'PAYMOB_HMAC_SECRET',
  'PAYMOB_INTEGRATION_ID_CARD',
  'PAYMOB_INTEGRATION_ID_FAWRY',
  'PAYMOB_INTEGRATION_ID_VODAFONE',
  'PAYMOB_INTEGRATION_ID_INSTAPAY',
  'PAYMOB_INTEGRATION_ID_MEEZA',
] as const;

if (env.NODE_ENV !== 'development') {
  const missing = REQUIRED_PAYMOB_VARS.filter((k) => !env[k]);
  if (missing.length > 0) {
    throw new Error(
      `[payment] Missing required Paymob env vars in ${env.NODE_ENV}: ${missing.join(', ')}`
    );
  }
}

// ── Paymob Auth Token (cached, valid ~1h) ────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getPaymobAuthToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const res = await axios.post(`${env.PAYMOB_BASE_URL}/auth/tokens`, {
    api_key: env.PAYMOB_API_KEY!,
  });

  cachedToken = {
    token: res.data.token as string,
    expiresAt: Date.now() + 50 * 60 * 1000, // cache for 50 min
  };

  return cachedToken.token;
}

// ── Integration ID by Payment Method ────────────────────────

function getIntegrationId(paymentMethod: string): string {
  const map: Record<string, string> = {
    card: env.PAYMOB_INTEGRATION_ID_CARD!,
    fawry: env.PAYMOB_INTEGRATION_ID_FAWRY!,
    vodafone_cash: env.PAYMOB_INTEGRATION_ID_VODAFONE!,
    instapay: env.PAYMOB_INTEGRATION_ID_INSTAPAY!,
    meeza: env.PAYMOB_INTEGRATION_ID_MEEZA!,
  };
  return map[paymentMethod] ?? env.PAYMOB_INTEGRATION_ID_CARD!;
}

// ── Step 1: Create Paymob Order ──────────────────────────────

export async function createPaymobOrder(params: {
  booking_ref: string;
  amount_egp: number;     // deposit + platform fee combined
  consumer_name: string;
  consumer_phone: string;
  consumer_email?: string;
}): Promise<{ order_id: string }> {
  const token = await getPaymobAuthToken();
  const amountCents = Math.round(params.amount_egp * 100);

  const res = await axios.post(
    `${env.PAYMOB_BASE_URL}/ecommerce/orders`,
    {
      auth_token: token,
      delivery_needed: false,
      amount_cents: amountCents,
      currency: 'EGP',
      merchant_order_id: params.booking_ref,
      items: [
        {
          name: `Reservation ${params.booking_ref}`,
          amount_cents: amountCents,
          description: 'Service reservation deposit and booking fee',
          quantity: 1,
        },
      ],
    }
  );

  return { order_id: String(res.data.id) };
}

// ── Step 2: Generate Payment Key ─────────────────────────────

export async function generatePaymentKey(params: {
  order_id: string;
  amount_egp: number;
  payment_method: string;
  consumer_name: string;
  consumer_phone: string;
  consumer_email?: string;
}): Promise<{ payment_key: string; iframe_url: string }> {
  const token = await getPaymobAuthToken();
  const amountCents = Math.round(params.amount_egp * 100);
  const integrationId = getIntegrationId(params.payment_method);

  const nameParts = params.consumer_name.split(' ');

  const res = await axios.post(
    `${env.PAYMOB_BASE_URL}/acceptance/payment_keys`,
    {
      auth_token: token,
      amount_cents: amountCents,
      expiration: 3600,
      order_id: params.order_id,
      integration_id: integrationId,
      billing_data: {
        first_name: nameParts[0] ?? 'Consumer',
        last_name: nameParts[1] ?? 'User',
        email: params.consumer_email ?? 'NA',
        phone_number: params.consumer_phone,
        country: 'EG',
        city: 'Cairo',
        street: 'NA',
        building: 'NA',
        floor: 'NA',
        apartment: 'NA',
      },
    }
  );

  const paymentKey: string = res.data.token;
  const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${integrationId}?payment_token=${paymentKey}`;

  return { payment_key: paymentKey, iframe_url: iframeUrl };
}

// ── Step 3: Verify Paymob Webhook (HMAC-SHA512) ──────────────

const HMAC_FIELDS = [
  'amount_cents', 'created_at', 'currency', 'error_occured',
  'has_parent_transaction', 'id', 'integration_id', 'is_3d_secure',
  'is_auth', 'is_capture', 'is_refunded', 'is_standalone_payment',
  'is_voided', 'order.id', 'owner', 'pending', 'source_data.pan',
  'source_data.sub_type', 'source_data.type', 'success',
];

export function verifyPaymobWebhook(obj: Record<string, unknown>): boolean {
  const receivedHmac = (obj['hmac'] as string) ?? '';

  const hmacString = HMAC_FIELDS.map((field) => {
    const keys = field.split('.');
    let value: unknown = obj;
    for (const key of keys) {
      value = (value as Record<string, unknown>)[key];
    }
    return String(value ?? '');
  }).join('');

  const computed = crypto
    .createHmac('sha512', env.PAYMOB_HMAC_SECRET!)
    .update(hmacString)
    .digest('hex');

  return computed === receivedHmac;
}

// ── Idempotency Check ────────────────────────────────────────

export async function isTransactionAlreadyProcessed(
  db: PrismaClient,
  paymobTransactionId: string
): Promise<boolean> {
  const existing = await db.payment.findFirst({
    where: { paymob_transaction_id: paymobTransactionId },
  });
  return existing !== null;
}

// ── Refund via Paymob ────────────────────────────────────────

export async function initiateRefund(params: {
  paymob_transaction_id: string;
  amount_egp: number;
}): Promise<void> {
  const token = await getPaymobAuthToken();

  await axios.post(
    `${env.PAYMOB_BASE_URL}/acceptance/void_refund`,
    {
      auth_token: token,
      transaction_id: params.paymob_transaction_id,
      amount_cents: Math.round(params.amount_egp * 100),
    }
  );
}

// ── No-Show Split Execution ───────────────────────────────────

export async function executeNoShowSplit(
  db: PrismaClient,
  bookingId: string
): Promise<void> {
  const booking = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { business: true },
  });

  const depositAmount = Number(booking.deposit_amount);
  const businessPct = env.NO_SHOW_SPLIT_BUSINESS_PCT / 100;
  const platformPct = env.NO_SHOW_SPLIT_PLATFORM_PCT / 100;

  await db.$transaction([
    // Business payout (75%)
    db.payment.create({
      data: {
        booking_id: bookingId,
        type: 'no_show_penalty',
        direction: 'outbound',
        amount: depositAmount * businessPct,
        currency: 'EGP',
        status: 'pending',
        recipient_type: 'business',
        recipient_id: booking.business_id,
      },
    }),
    // Platform retention (25%)
    db.payment.create({
      data: {
        booking_id: bookingId,
        type: 'no_show_penalty',
        direction: 'inbound',
        amount: depositAmount * platformPct,
        currency: 'EGP',
        status: 'completed',
        recipient_type: 'platform',
      },
    }),
    // Update escrow status
    db.booking.update({
      where: { id: bookingId },
      data: { escrow_status: 'split_executed' },
    }),
  ]);
}
