import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// payment.ts does `import axios from 'axios'` (default export).
vi.mock('axios', () => ({ default: { post: vi.fn() } }));
import axios from 'axios';

import {
  verifyPaymobWebhook,
  executeNoShowSplit,
  isTransactionAlreadyProcessed,
  createPaymobOrder,
  generatePaymentKey,
} from './payment.js';

// ── Webhook HMAC verification ────────────────────────────────
// Replicates the exact field list + concatenation the service uses, so we can
// sign a payload the way Paymob would and assert the trust boundary holds.
const HMAC_FIELDS = [
  'amount_cents', 'created_at', 'currency', 'error_occured',
  'has_parent_transaction', 'id', 'integration_id', 'is_3d_secure',
  'is_auth', 'is_capture', 'is_refunded', 'is_standalone_payment',
  'is_voided', 'order.id', 'owner', 'pending', 'source_data.pan',
  'source_data.sub_type', 'source_data.type', 'success',
];

function computeHmac(obj: Record<string, unknown>, secret = 'test_hmac_secret'): string {
  const s = HMAC_FIELDS.map((field) => {
    const keys = field.split('.');
    let value: unknown = obj;
    for (const key of keys) value = (value as Record<string, unknown>)?.[key];
    return String(value ?? '');
  }).join('');
  return crypto.createHmac('sha512', secret).update(s).digest('hex');
}

function sampleWebhook(): Record<string, unknown> {
  return {
    amount_cents: 12000, created_at: '2026-07-24T10:00:00', currency: 'EGP',
    error_occured: false, has_parent_transaction: false, id: 987654,
    integration_id: 111, is_3d_secure: true, is_auth: false, is_capture: false,
    is_refunded: false, is_standalone_payment: true, is_voided: false,
    order: { id: 555 }, owner: 42, pending: false,
    source_data: { pan: '2345', sub_type: 'MasterCard', type: 'card' },
    success: true,
  };
}

describe('verifyPaymobWebhook (payment trust boundary)', () => {
  it('returns true for a correctly signed payload', () => {
    const obj = sampleWebhook();
    obj.hmac = computeHmac(obj);
    expect(verifyPaymobWebhook(obj)).toBe(true);
  });

  it('returns false for a forged / incorrect hmac', () => {
    const obj = sampleWebhook();
    obj.hmac = 'deadbeefdeadbeef';
    expect(verifyPaymobWebhook(obj)).toBe(false);
  });

  it('returns false when the hmac field is missing', () => {
    expect(verifyPaymobWebhook(sampleWebhook())).toBe(false);
  });

  it('returns false when a signed field is tampered after signing (amount changed)', () => {
    const obj = sampleWebhook();
    obj.hmac = computeHmac(obj);
    obj.amount_cents = 1;
    expect(verifyPaymobWebhook(obj)).toBe(false);
  });

  it('serializes falsy-but-present values (success=false, amount_cents=0) instead of dropping them', () => {
    const obj = sampleWebhook();
    obj.success = false;
    obj.amount_cents = 0;
    obj.hmac = computeHmac(obj);
    expect(verifyPaymobWebhook(obj)).toBe(true);
  });

  // Pins CURRENT behavior + flags a hardening gap: a hostile/malformed payload
  // missing a nested parent throws a TypeError instead of returning false.
  it('THROWS on a malformed payload missing a nested parent (should return false — hardening gap)', () => {
    const obj = sampleWebhook();
    delete obj.order;
    obj.hmac = 'x';
    expect(() => verifyPaymobWebhook(obj)).toThrow();
  });
});

// ── No-show 75/25 split (money movement) ─────────────────────
describe('executeNoShowSplit (75/25 no-show payout split)', () => {
  function makeDb(deposit: unknown) {
    return {
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'bk1', deposit_amount: deposit, business_id: 'biz1', business: { id: 'biz1' },
        }),
        update: vi.fn((a: unknown) => a),
      },
      payment: { create: vi.fn((a: unknown) => a) },
      $transaction: vi.fn().mockResolvedValue([]),
    };
  }

  it('splits a 100 EGP deposit into 75 business (outbound/pending) + 25 platform (inbound/completed)', async () => {
    const db = makeDb(100);
    await executeNoShowSplit(db as never, 'bk1');

    const payments = db.payment.create.mock.calls.map((c) => (c[0] as { data: Record<string, unknown> }).data);
    expect(payments[0]).toMatchObject({
      amount: 75, direction: 'outbound', status: 'pending',
      recipient_type: 'business', recipient_id: 'biz1', type: 'no_show_penalty',
    });
    expect(payments[1]).toMatchObject({
      amount: 25, direction: 'inbound', status: 'completed', recipient_type: 'platform',
    });
    expect(db.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { escrow_status: 'split_executed' } })
    );
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.$transaction.mock.calls[0][0]).toHaveLength(3);
  });

  it('handles a zero deposit (still writes two zero payments + escrow update, no early return)', async () => {
    const db = makeDb(0);
    await executeNoShowSplit(db as never, 'bk1');
    const payments = db.payment.create.mock.calls.map((c) => (c[0] as { data: Record<string, unknown> }).data);
    expect(payments[0].amount).toBe(0);
    expect(payments[1].amount).toBe(0);
    expect(db.$transaction.mock.calls[0][0]).toHaveLength(3);
  });

  // Pins CURRENT behavior + flags a hardening gap: money is not rounded to piastres.
  it('does NOT round money — a 33.33 deposit yields sub-piastre floats (hardening gap)', async () => {
    const db = makeDb(33.33);
    await executeNoShowSplit(db as never, 'bk1');
    const payments = db.payment.create.mock.calls.map((c) => (c[0] as { data: Record<string, unknown> }).data);
    expect(payments[0].amount as number).toBeCloseTo(24.9975, 4);
    expect(payments[1].amount as number).toBeCloseTo(8.3325, 4);
  });

  it('is idempotent — does nothing when escrow is already split_executed (H2)', async () => {
    const db = {
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'bk1', deposit_amount: 100, business_id: 'biz1', business: { id: 'biz1' },
          escrow_status: 'split_executed',
        }),
        update: vi.fn(),
      },
      payment: { create: vi.fn() },
      $transaction: vi.fn().mockResolvedValue([]),
    };
    await executeNoShowSplit(db as never, 'bk1');
    expect(db.payment.create).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

// ── Webhook idempotency guard ────────────────────────────────
describe('isTransactionAlreadyProcessed', () => {
  it('returns true when a payment row already exists for the transaction', async () => {
    const db = { payment: { findFirst: vi.fn().mockResolvedValue({ id: 'p1' }) } };
    expect(await isTransactionAlreadyProcessed(db as never, 'tx1')).toBe(true);
    expect(db.payment.findFirst).toHaveBeenCalledWith({ where: { paymob_transaction_id: 'tx1' } });
  });

  it('returns false when no payment row exists', async () => {
    const db = { payment: { findFirst: vi.fn().mockResolvedValue(null) } };
    expect(await isTransactionAlreadyProcessed(db as never, 'tx1')).toBe(false);
  });
});

// ── Paymob order + payment key (amount rounding, integration routing) ─────────
describe('Paymob order/payment-key builders', () => {
  const post = (axios as unknown as { post: ReturnType<typeof vi.fn> }).post;

  beforeEach(() => {
    // Route responses by URL so the module-level auth-token cache can't break
    // call ordering between tests.
    post.mockReset();
    post.mockImplementation((url: string) => {
      if (url.endsWith('/auth/tokens')) return Promise.resolve({ data: { token: 'auth1' } });
      if (url.endsWith('/ecommerce/orders')) return Promise.resolve({ data: { id: 90909 } });
      if (url.endsWith('/payment_keys')) return Promise.resolve({ data: { token: 'paykey1' } });
      return Promise.resolve({ data: {} });
    });
  });

  it('createPaymobOrder converts EGP→cents and returns the order id as a string', async () => {
    const res = await createPaymobOrder({
      booking_ref: 'BK-1', amount_egp: 120.5, consumer_name: 'A B', consumer_phone: '+201000000000',
    });
    expect(res).toEqual({ order_id: '90909' });
    const orderCall = post.mock.calls.find((c) => String(c[0]).endsWith('/ecommerce/orders'))!;
    expect((orderCall[1] as { amount_cents: number }).amount_cents).toBe(12050);
  });

  it('generatePaymentKey routes to the correct integration id and builds the iframe url', async () => {
    const res = await generatePaymentKey({
      order_id: '1', amount_egp: 50, payment_method: 'fawry',
      consumer_name: 'Ahmed Hassan', consumer_phone: '+201000000000',
    });
    const keyCall = post.mock.calls.find((c) => String(c[0]).endsWith('/payment_keys'))!;
    const body = keyCall[1] as { integration_id: string; amount_cents: number; billing_data: { first_name: string; last_name: string } };
    expect(body.integration_id).toBe('222'); // fawry
    expect(body.amount_cents).toBe(5000);
    expect(body.billing_data.first_name).toBe('Ahmed');
    expect(body.billing_data.last_name).toBe('Hassan');
    expect(res.iframe_url).toContain('payment_token=paykey1');
  });

  it('generatePaymentKey falls back to the card integration id for an unknown method', async () => {
    await generatePaymentKey({
      order_id: '1', amount_egp: 10, payment_method: 'bitcoin',
      consumer_name: 'X', consumer_phone: '+20100',
    });
    const keyCall = post.mock.calls.find((c) => String(c[0]).endsWith('/payment_keys'))!;
    expect((keyCall[1] as { integration_id: string }).integration_id).toBe('111'); // card fallback
  });
});
