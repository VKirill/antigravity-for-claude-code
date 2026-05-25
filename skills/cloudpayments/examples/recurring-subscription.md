# Example — Recurring Subscription

End-to-end: customer subscribes to a 500 RUB/month Pro plan, CloudPayments runs the schedule, merchant tracks state via `Recurrent` webhook.

## Scenario

SaaS app, 500 RUB / month, auto-renew until cancelled. First payment via widget, subsequent cycles auto-charged by CloudPayments.

## Step 1: First payment (with token capture)

Widget `charge` with `requireConfirmation: false` plus a CustomerReceipt. CloudPayments returns a `Token` in the `Pay` webhook.

```tsx
widget.pay('charge', {
  publicId: process.env.NEXT_PUBLIC_CP_PUBLIC_ID,
  description: 'Подписка Pro · первый месяц',
  amount: 500,
  currency: 'RUB',
  invoiceId: `sub-${user.id}-${monthKey}`,
  accountId: user.id,
  email: user.email,
  data: {
    CloudPayments: {
      CustomerReceipt: buildCustomerReceipt({
        items: [{ label: 'Подписка Pro · 1 мес', price: 500, quantity: 1, vat: null, object: 4 }],
        taxationSystem: 1,
        email: user.email,
      }),
    },
  },
}, {
  onSuccess: () => { window.location.assign('/subscription/active'); },
});
```

## Step 2: On `Pay` webhook — create CloudPayments subscription

In the webhook handler, after marking the first cycle paid:

```ts
async function onFirstSubscriptionCharge(p: PayPayload) {
  if (!p.Token) {
    req.log.error({ p }, 'subscription started without Token — cannot rebill');
    return;
  }

  await db.user.update({
    where: { id: p.AccountId! },
    data: { cpToken: p.Token },
  });

  // Create the schedule on CloudPayments side
  const subRes = await fetch('https://api.cloudpayments.ru/subscriptions/create', {
    method: 'POST',
    headers: {
      Authorization: basicAuth,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Token: p.Token,
      AccountId: p.AccountId,
      Description: 'Подписка Pro · ежемесячно',
      Email: p.Email,
      Amount: 500,
      Currency: 'RUB',
      RequireConfirmation: false,
      // First auto-charge in ~1 month from now
      StartDate: addMonths(new Date(), 1).toISOString(),
      Interval: 'Month',
      Period: 1,
      // MaxPeriods omitted → indefinite
      CustomerReceipt: buildCustomerReceipt({
        items: [{ label: 'Подписка Pro · 1 мес', price: 500, quantity: 1, vat: null, object: 4 }],
        taxationSystem: 1,
        email: p.Email!,
      }),
    }),
  });

  const subBody = await subRes.json();
  if (!subBody.Success) throw new Error(`Subscription create failed: ${subBody.Message}`);

  await db.subscription.create({
    data: {
      userId: p.AccountId!,
      cpSubscriptionId: subBody.Model.Id,
      status: 'active',
      amount: 500,
      currency: 'RUB',
      nextChargeAt: new Date(subBody.Model.NextTransactionDate),
    },
  });
}
```

## Step 3: Handle `Recurrent` webhook

Each cycle:

```ts
const RecurrentPayload = z.object({
  Id: z.string(),
  AccountId: z.string(),
  Description: z.string(),
  Amount: z.coerce.number(),
  Currency: z.literal('RUB'),
  Status: z.enum(['Active', 'PastDue', 'Cancelled', 'Rejected', 'Expired', 'Completed']),
  SuccessfulTransactionsNumber: z.coerce.number(),
  FailedTransactionsNumber: z.coerce.number(),
  NextTransactionDate: z.string().optional(),
});

app.post('/webhooks/cp/recurrent', async (req, reply) => {
  const rawBody = req.body as Buffer;
  if (!verifyHmac(rawBody, req.headers['content-hmac'] as string)) {
    return reply.status(401).send({ code: 13 });
  }
  const p = RecurrentPayload.parse(parsePayload(rawBody));

  await db.subscription.update({
    where: { cpSubscriptionId: p.Id },
    data: {
      status: mapStatus(p.Status),
      nextChargeAt: p.NextTransactionDate ? new Date(p.NextTransactionDate) : null,
    },
  });

  switch (p.Status) {
    case 'PastDue':
      await queue.add('email.dunning', { userId: p.AccountId });
      break;
    case 'Rejected':
    case 'Expired':
    case 'Cancelled':
      await db.entitlement.deleteMany({ where: { userId: p.AccountId, productId: 'pro' } });
      await queue.add('email.subscription-ended', { userId: p.AccountId, reason: p.Status });
      break;
  }

  return reply.status(200).send({ code: 0 });
});

function mapStatus(s: string): 'active' | 'past_due' | 'cancelled' | 'expired' {
  if (s === 'Active') return 'active';
  if (s === 'PastDue') return 'past_due';
  if (s === 'Cancelled' || s === 'Rejected') return 'cancelled';
  return 'expired';
}
```

## Step 4: Customer cancels (server)

```ts
// app/api/subscriptions/cancel/route.ts
export async function POST(req: Request) {
  const userId = await getUserId(req);
  const sub = await db.subscription.findUnique({ where: { userId } });
  if (!sub) return new Response('No subscription', { status: 404 });

  const res = await fetch('https://api.cloudpayments.ru/subscriptions/cancel', {
    method: 'POST',
    headers: { Authorization: basicAuth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ Id: sub.cpSubscriptionId }),
  });
  const body = await res.json();
  if (!body.Success) throw new Error(body.Message);

  // Recurrent webhook will fire with Status: 'Cancelled' — handler closes loop
  return NextResponse.json({ ok: true });
}
```

## Verification

- First-month payment registers user + Token + CP subscription
- DB row has `cpSubscriptionId` and `nextChargeAt`
- Force-fire from CP dashboard → `Recurrent` webhook arrives → `nextChargeAt` advances
- Test decline (use ExpiredCard test PAN) → `Status: PastDue` → dunning email queued
- Cancel from UI → `Recurrent` with `Status: Cancelled` → entitlement removed

## Pitfalls

- **Don't double-create the CP subscription**: the first `Pay` webhook is the only place to do it. Use idempotency key (DB constraint on userId).
- **Token rotation**: if `Recurrent` reports `Status: Expired` for `ReasonCode: 5054` (card expired), prompt the user to re-add their card. Create a NEW subscription with the new token.
- **54-ФЗ on every cycle**: `/subscriptions/create` accepts a `CustomerReceipt` that applies to all cycles. If pricing changes, call `/subscriptions/update` AND pass new `CustomerReceipt`.
- **Webhook order**: `Pay` and `Recurrent` can arrive in either order. Handlers must be order-independent.
