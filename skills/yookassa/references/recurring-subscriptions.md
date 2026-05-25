# YooKassa — Recurring & Saved Payment Methods

YooKassa has **no built-in subscription API**. Recurring billing is built on saved payment methods: merchant captures a method ID on first charge, then orchestrates the schedule (cron / BullMQ).

## First charge — capture the method

```ts
const payment = await checkout.createPayment({
  amount: { value: '500.00', currency: 'RUB' },
  capture: true,
  confirmation: { type: 'redirect', return_url },
  save_payment_method: true,                       // ← capture method
  description: 'Подписка Pro · первый месяц',
  metadata: { user_id: userId, subscription_id: subId, cycle: '1' },
  receipt: buildReceipt(...),
}, crypto.randomUUID());
```

`save_payment_method: true` enables one-click rebills. Customer sees a checkbox or is informed via the payment page UI (depending on YooKassa locale settings).

## Retrieve the method ID

After `payment.succeeded` webhook (or by polling `GET /v3/payments/{id}`):

```ts
const p = await checkout.getPayment(paymentId);
if (p.status === 'succeeded' && p.payment_method?.saved) {
  await db.user.update({
    where: { id: userId },
    data: {
      yookassaMethodId: p.payment_method.id,
      yookassaMethodType: p.payment_method.type,   // bank_card / sbp_qr / ...
      cardLast4: p.payment_method.card?.last4 ?? null,
    },
  });
}
```

`p.payment_method.saved: true` confirms the method is reusable.

## Subsequent rebill (no customer interaction)

```ts
const next = await checkout.createPayment({
  amount: { value: '500.00', currency: 'RUB' },
  capture: true,
  payment_method_id: user.yookassaMethodId,       // ← reuse saved
  description: 'Подписка Pro · июнь 2026',
  metadata: { user_id: userId, subscription_id: subId, cycle: '2' },
  receipt: buildReceipt(...),
}, crypto.randomUUID());
```

No `confirmation` block — payment proceeds server-driven. State transitions straight to `succeeded` (or `canceled` on decline) and webhook fires.

## Orchestrate the schedule

YooKassa doesn't track subscriptions, so you do. Recommended pattern:

```ts
// Domain model
interface Subscription {
  id: string;
  userId: string;
  yookassaMethodId: string;
  amount: number;            // RUB
  interval: 'month' | 'week' | 'year';
  nextChargeAt: Date;
  status: 'active' | 'past_due' | 'cancelled';
  failedAttempts: number;
}

// BullMQ recurring job — wake every hour, charge due subs
new Worker('billing-tick', async () => {
  const due = await db.subscription.findMany({
    where: { status: 'active', nextChargeAt: { lte: new Date() } },
  });
  for (const sub of due) {
    await queue.add('billing.charge', { subscriptionId: sub.id });
  }
}, { connection: redis, repeat: { every: 60 * 60 * 1000 } });

// Charge worker — actual API call
new Worker('billing', async (job) => {
  if (job.name !== 'billing.charge') return;
  const { subscriptionId } = job.data;

  const sub = await db.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
  if (sub.status !== 'active') return;

  // Stable idempotence key for this cycle — retries reuse it
  const idempotenceKey = `sub-${sub.id}-cycle-${cycleKey(sub.nextChargeAt)}`;

  try {
    const payment = await checkout.createPayment({
      amount: { value: sub.amount.toFixed(2), currency: 'RUB' },
      capture: true,
      payment_method_id: sub.yookassaMethodId,
      description: `Подписка · ${formatPeriod(sub.nextChargeAt)}`,
      metadata: { subscription_id: sub.id, user_id: sub.userId, cycle: cycleKey(sub.nextChargeAt) },
      receipt: buildReceipt({ amount: sub.amount, ... }),
    }, idempotenceKey);

    // payment.status is initially `pending` — webhook will deliver `succeeded` shortly
    await db.payment.create({
      data: { subscriptionId: sub.id, yookassaId: payment.id, idempotenceKey, status: 'pending' },
    });
  } catch (err) {
    // Handle synchronous errors (network, 400 invalid) separately from async declines
    logger.error({ err, sub }, 'billing charge failed');
    throw err; // BullMQ will retry per worker policy
  }
}, { connection: redis });
```

## Failed cycle handling

Decline → webhook `payment.canceled` with `cancellation_details.reason`. Common patterns:

```ts
async function onPaymentCanceled(payment: Payment) {
  const subId = payment.metadata?.subscription_id;
  if (!subId) return;

  const reason = payment.cancellation_details?.reason ?? 'unknown';

  await db.subscription.update({
    where: { id: subId },
    data: {
      failedAttempts: { increment: 1 },
      status: reasonIsTerminal(reason) ? 'cancelled' : 'past_due',
      lastFailureReason: reason,
    },
  });

  if (reason === 'card_expired') {
    await queue.add('email.card-expired', { subscriptionId: subId });
  }

  // Retry policy: day 1, day 3, day 7 — then give up
  const sub = await db.subscription.findUniqueOrThrow({ where: { id: subId } });
  if (sub.failedAttempts < 3 && !reasonIsTerminal(reason)) {
    await db.subscription.update({
      where: { id: subId },
      data: { nextChargeAt: addDays(new Date(), retryDelay(sub.failedAttempts)) },
    });
  }
}

function reasonIsTerminal(r: string) {
  return ['permission_revoked', 'fraud_suspected', 'card_expired'].includes(r);
}
```

## Cancel by customer

Customer requests cancellation through merchant UI:

```ts
// POST /api/subscriptions/cancel
await db.subscription.update({
  where: { id: subId, userId },
  data: { status: 'cancelled', cancelledAt: new Date() },
});
// No YooKassa-side call needed — saved method remains, but you stop charging
```

If the customer wants the method itself revoked from YooKassa, currently no public API — they can revoke from YooKassa's account UI directly.

## Saved method types

Most reusable methods: `bank_card`. Some flows save `sbp_qr` for one-tap СБП rebill (newer feature, check current docs). YooMoney wallet (`yoo_money`) supports saving but UX differs.

## TTL on saved methods

Saved methods are valid until:
- Customer's card expires (issuer rotates method id)
- 3 years inactivity (YooKassa-side cleanup)
- YooKassa fraud-flag deactivation

Handle by treating `card_expired` and `payment_method_restricted` as triggers to prompt re-add.

## Why no `/subscriptions/*` API?

YooMoney's stance is that merchants need full control over schedule, retries, dunning, proration, plan changes — and a generic API can't fit every business. You build your own subscription state machine on top of saved methods. This is **more code** than CloudPayments' `/subscriptions/create`, but **more flexible**.

## Idempotence-Key pattern for cycles

```ts
function cycleKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
// idempotenceKey = `sub-${subId}-cycle-2026-06`
// Retries within the same cycle reuse the same key → safe
```

If you ever change `amount` mid-cycle and retry, YooKassa returns `400 Bad Request` (key conflict). Use a fresh key when intentionally changing the body.

## 54-ФЗ on every cycle

Each cycle is a separate sale — needs its own fiscal receipt. Include `receipt` in every `createPayment` call, even for rebills.

## Wrong vs right — saved-method expiry handling

**❌ Wrong — retry forever on every `canceled`:**
```ts
async function onPaymentCanceled(payment: Payment) {
  await db.subscription.update({
    where: { id: payment.metadata!.subscription_id },
    data: {
      nextChargeAt: addDays(new Date(), 1),  // try again tomorrow
      // ...no check of cancellation_details.reason
    },
  });
}
```

**✅ Right — distinguish terminal vs transient reasons; stop wasting attempts on dead cards:**
```ts
const TERMINAL_REASONS = new Set([
  'card_expired',
  'permission_revoked',
  'payment_method_restricted',
  'fraud_suspected',
]);

async function onPaymentCanceled(payment: Payment) {
  const subId = payment.metadata!.subscription_id;
  const reason = payment.cancellation_details?.reason ?? 'unknown';

  if (TERMINAL_REASONS.has(reason)) {
    await db.subscription.update({
      where: { id: subId },
      data: { status: 'cancelled', lastFailureReason: reason },
    });
    if (reason === 'card_expired') {
      await queue.add('email.re-add-card', { subscriptionId: subId });
    }
    return;
  }

  // Transient — dunning ladder: day 1, day 3, day 7, then give up
  const sub = await db.subscription.findUniqueOrThrow({ where: { id: subId } });
  if (sub.failedAttempts >= 3) {
    await db.subscription.update({
      where: { id: subId }, data: { status: 'cancelled', lastFailureReason: reason },
    });
    return;
  }
  await db.subscription.update({
    where: { id: subId },
    data: {
      failedAttempts: { increment: 1 },
      nextChargeAt: addDays(new Date(), [1, 3, 7][sub.failedAttempts]),
    },
  });
}
```

**Why it matters:** Retrying a `card_expired` saved method 30+ times produces nothing except issuer-side annoyance signals that can flip your account into fraud review. `permission_revoked` means the customer explicitly opted out — retrying is hostile. `fraud_suspected` means the issuer / YooKassa fraud engine declined — retries amplify the signal. Detect terminal reasons up front and gate retries on transient declines (`insufficient_funds`, `general_decline`, `3d_secure_failed`, `internal_timeout`) only.
