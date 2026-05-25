# Example — Recurring Subscription (Saved Payment Method)

End-to-end: customer subscribes to 500 RUB/month Pro plan. First payment via widget with `save_payment_method: true`, subsequent cycles auto-charged via BullMQ scheduler.

## Domain model (Prisma)

```prisma
model Subscription {
  id                String   @id @default(uuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id])
  yookassaMethodId  String
  amount            Decimal  @db.Decimal(10, 2)
  status            String   @default("active")  // active | past_due | cancelled
  startedAt         DateTime @default(now())
  nextChargeAt      DateTime
  failedAttempts    Int      @default(0)
  cancelledAt       DateTime?
  payments          Payment[]
}

model Payment {
  id              String   @id @default(uuid())
  subscriptionId  String?
  subscription    Subscription? @relation(fields: [subscriptionId], references: [id])
  yookassaId      String   @unique
  idempotenceKey  String   @unique
  amount          Decimal  @db.Decimal(10, 2)
  status          String   // pending | succeeded | canceled
  cycleKey        String?  // "2026-06"
  createdAt       DateTime @default(now())
}
```

## Step 1: First payment (widget) with `save_payment_method: true`

```ts
// app/api/subscribe/route.ts
export async function POST(req: Request) {
  const userId = await getUserId(req);
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });

  const idempotenceKey = crypto.randomUUID();

  const payment = await checkout.createPayment({
    amount: { value: '500.00', currency: 'RUB' },
    capture: true,
    confirmation: { type: 'embedded' },
    save_payment_method: true,                      // ← capture method
    description: 'Подписка Pro · первый месяц',
    metadata: { user_id: user.id, kind: 'subscription_first' },
    receipt: buildReceipt({
      items: [{
        description: 'Подписка Pro · 1 мес',
        quantity: 1, amount: 500,
        vatCode: 1, paymentSubject: 'service', paymentMode: 'full_payment',
      }],
      customer: { email: user.email },
      taxSystemCode: 2,
    }),
  }, idempotenceKey);

  await db.payment.create({
    data: {
      yookassaId: payment.id,
      idempotenceKey,
      amount: 500,
      status: 'pending',
    },
  });

  return NextResponse.json({
    confirmation_token: (payment.confirmation as any).confirmation_token,
  });
}
```

## Step 2: Webhook handler creates subscription

```ts
async function onPaymentSucceeded(payment: Payment) {
  if (payment.metadata?.kind !== 'subscription_first') {
    // Recurring cycle — handle in a different branch (see Step 4)
    return onCycleSucceeded(payment);
  }
  if (!payment.payment_method?.saved || !payment.payment_method.id) {
    logger.error({ payment }, 'subscription start without saved method');
    return;
  }

  const userId = payment.metadata.user_id;

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { yookassaId: payment.id },
      data: { status: 'succeeded' },
    });

    // Idempotent: skip if subscription already exists for this user
    const existing = await tx.subscription.findFirst({ where: { userId, status: 'active' } });
    if (existing) return;

    await tx.subscription.create({
      data: {
        userId,
        yookassaMethodId: payment.payment_method.id,
        amount: 500,
        status: 'active',
        nextChargeAt: addMonths(new Date(), 1),
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: { yookassaMethodId: payment.payment_method.id },
    });
  });
}
```

## Step 3: Scheduler (BullMQ)

```ts
// Wake every hour; enqueue charges for subs whose nextChargeAt has elapsed
new Worker('billing-tick', async () => {
  const due = await db.subscription.findMany({
    where: { status: 'active', nextChargeAt: { lte: new Date() } },
    take: 100,
  });
  for (const sub of due) {
    await queue.add('billing.charge', { subscriptionId: sub.id }, { jobId: `charge-${sub.id}-${cycleKey(sub.nextChargeAt)}` });
  }
}, { connection: redis, repeat: { every: 60 * 60 * 1000 } });

// Charge worker
new Worker('billing', async (job) => {
  if (job.name !== 'billing.charge') return;
  const sub = await db.subscription.findUniqueOrThrow({
    where: { id: job.data.subscriptionId },
    include: { user: true },
  });
  if (sub.status !== 'active') return;

  const ck = cycleKey(sub.nextChargeAt);
  const idempotenceKey = `sub-${sub.id}-cycle-${ck}`;

  // Skip if already attempted this cycle
  const existing = await db.payment.findUnique({ where: { idempotenceKey } });
  if (existing && existing.status !== 'canceled') return;

  const payment = await checkout.createPayment({
    amount: { value: Number(sub.amount).toFixed(2), currency: 'RUB' },
    capture: true,
    payment_method_id: sub.yookassaMethodId,
    description: `Подписка Pro · ${ck}`,
    metadata: {
      user_id: sub.user.id,
      subscription_id: sub.id,
      cycle: ck,
      kind: 'subscription_cycle',
    },
    receipt: buildReceipt({
      items: [{
        description: `Подписка Pro · 1 мес`,
        quantity: 1, amount: Number(sub.amount),
        vatCode: 1, paymentSubject: 'service', paymentMode: 'full_payment',
      }],
      customer: { email: sub.user.email },
      taxSystemCode: 2,
    }),
  }, idempotenceKey);

  await db.payment.create({
    data: {
      subscriptionId: sub.id,
      yookassaId: payment.id,
      idempotenceKey,
      amount: sub.amount,
      cycleKey: ck,
      status: 'pending',
    },
  });
}, { connection: redis });

function cycleKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
```

## Step 4: Cycle webhook handlers

```ts
async function onCycleSucceeded(payment: Payment) {
  const subId = payment.metadata?.subscription_id;
  if (!subId) return;

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { yookassaId: payment.id },
      data: { status: 'succeeded' },
    });
    await tx.subscription.update({
      where: { id: subId },
      data: {
        status: 'active',
        failedAttempts: 0,
        nextChargeAt: addMonths(new Date(), 1),
      },
    });
  });
}

async function onPaymentCanceled(payment: Payment) {
  const subId = payment.metadata?.subscription_id;
  if (!subId) return;

  const reason = payment.cancellation_details?.reason ?? 'unknown';

  await db.payment.update({
    where: { yookassaId: payment.id },
    data: { status: 'canceled' },
  });

  const terminal = ['permission_revoked', 'fraud_suspected'].includes(reason);
  const sub = await db.subscription.update({
    where: { id: subId },
    data: {
      failedAttempts: { increment: 1 },
      status: terminal ? 'cancelled' : 'past_due',
      lastFailureReason: reason,
    },
  });

  if (reason === 'card_expired') {
    await queue.add('email.card-expired', { subscriptionId: subId });
  }

  // Retry policy: day +1, day +3, day +7 → then terminal
  if (sub.failedAttempts < 3 && !terminal) {
    const delay = [1, 3, 7][sub.failedAttempts - 1] ?? 0;
    await db.subscription.update({
      where: { id: subId },
      data: { nextChargeAt: addDays(new Date(), delay) },
    });
  }
}
```

## Step 5: Customer cancel

```ts
// app/api/subscriptions/cancel/route.ts
export async function POST(req: Request) {
  const userId = await getUserId(req);
  await db.subscription.update({
    where: { userId, status: 'active' },
    data: { status: 'cancelled', cancelledAt: new Date() },
  });
  // No YooKassa call needed — saved method remains but no more charges
  return NextResponse.json({ ok: true });
}
```

## Verification

- First payment registers subscription + saves method
- DB has `yookassaMethodId` on subscription
- Force `nextChargeAt` to past, run worker manually → new cycle payment created
- Webhook `payment.succeeded` arrives → next cycle advances by +1 month
- Test decline with `5555 5555 5555 4444` → `past_due`, retry scheduled at +1 day
- Cancel from UI → `status: cancelled`, no further charges

## Pitfalls

- **Don't reuse Idempotence-Key across cycles**: cycle key in idempotency key prevents the same UUID being reused
- **Webhook ordering**: payment.succeeded for the cycle may arrive before the worker job completes; both must be idempotent
- **Receipt on every cycle**: 54-ФЗ mandates a receipt per sale — include it on every `createPayment`
- **Token rotation**: if `cancellation_details.reason === 'card_expired'`, prompt user to re-add card; that creates a new `yookassaMethodId`
