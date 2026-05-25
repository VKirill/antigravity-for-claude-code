# CloudPayments — Recurring & Subscriptions

Two approaches to recurring billing:

1. **Manual rebill by Token** — full merchant control, charge whenever you like
2. **`/subscriptions/*` API** — CloudPayments runs the schedule, fires `Recurrent` webhook

## Token lifecycle

After any successful charge (or 1 RUB authorization probe), CloudPayments returns `Model.Token` — a permanent card surrogate. Store it keyed to the user (NOT to a single order).

```ts
// after Pay webhook
await db.user.update({
  where: { id: payload.AccountId },
  data: { cpToken: payload.Token },
});
```

Tokens stay valid until:
- Customer's card expires (issuer rotates token at re-issue — handle `ReasonCode 5054`)
- Customer asks merchant to delete payment method
- CloudPayments deactivates the token via dashboard

## Manual rebill

```ts
async function chargeSubscription(userId: string, amount: number) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.cpToken) throw new Error('no token');

  const res = await fetch('https://api.cloudpayments.ru/payments/tokens/charge', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${publicId}:${apiSecret}`).toString('base64'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Amount: amount,
      Currency: 'RUB',
      AccountId: user.id,
      Token: user.cpToken,
      InvoiceId: `sub-${user.id}-${new Date().toISOString().slice(0, 7)}`,
      Description: `Подписка Pro · ${new Date().toISOString().slice(0, 7)}`,
      JsonData: {
        CloudPayments: {
          CustomerReceipt: buildReceipt({ amount, email: user.email }),
        },
      },
    }),
  });

  return res.json();
}
```

Schedule with a cron / BullMQ recurring job. Useful when:
- Variable amounts (metered billing, usage-based)
- Conditional skip (free trial, paused subscription)
- Bundled retry logic with custom backoff

## `/subscriptions/create` API

CloudPayments-managed schedule. Pass plan once, gateway handles cycles.

```ts
const res = await fetch('https://api.cloudpayments.ru/subscriptions/create', {
  method: 'POST',
  headers: {
    Authorization: 'Basic ' + Buffer.from(`${publicId}:${apiSecret}`).toString('base64'),
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    Token: user.cpToken,
    AccountId: user.id,
    Description: 'Подписка Pro',
    Email: user.email,
    Amount: 500,
    Currency: 'RUB',
    RequireConfirmation: false,
    StartDate: '2026-06-15T10:00:00',
    Interval: 'Month',          // 'Day' | 'Week' | 'Month'
    Period: 1,
    MaxPeriods: 12,              // optional — auto-cancel after N
  }),
});
```

Response:

```json
{
  "Success": true,
  "Model": {
    "Id": "sub_xxx",
    "AccountId": "user-7",
    "Status": "Active",
    "NextTransactionDate": "2026-06-15T10:00:00",
    "Description": "Подписка Pro",
    "Amount": 500,
    "Interval": "Month",
    "Period": 1
  }
}
```

Each successful cycle fires the standard `Pay` webhook plus a `Recurrent` webhook. Failed cycles → `Fail` webhook + `Recurrent` with `Status: PastDue`.

## Update subscription

```ts
await fetch('https://api.cloudpayments.ru/subscriptions/update', {
  method: 'POST',
  headers: { ... },
  body: JSON.stringify({
    Id: 'sub_xxx',
    Amount: 600,           // price change
    Interval: 'Month',
    Period: 1,
  }),
});
```

Only mutable fields: `Description`, `Amount`, `Interval`, `Period`, `MaxPeriods`, `RequireConfirmation`. Customer-visible change (e.g., price increase) — notify the customer separately, CloudPayments doesn't send emails.

## Cancel

```ts
await fetch('https://api.cloudpayments.ru/subscriptions/cancel', {
  method: 'POST',
  headers: { ... },
  body: JSON.stringify({ Id: 'sub_xxx' }),
});
```

Cancellation is immediate — no more charges. Existing charges are not refunded.

## Recurrent webhook

See [webhooks.md](webhooks.md). Body has full subscription state. Key fields:

- `Status`: `Active` / `PastDue` / `Cancelled` / `Rejected` / `Expired` / `Completed`
- `SuccessfulTransactionsNumber`
- `FailedTransactionsNumber`
- `NextTransactionDate`

Use `PastDue` to trigger dunning emails / soft-cancel grace period.

## Past-due handling

CloudPayments default behavior on declined cycle: retry next day, then 3 days, then deactivate. Configure in dashboard. Recommended pattern:

```ts
async function handleRecurrent(payload: RecurrentPayload) {
  switch (payload.Status) {
    case 'Active': break; // healthy
    case 'PastDue':
      await sendDunningEmail(payload.AccountId);
      break;
    case 'Rejected':
    case 'Expired':
    case 'Cancelled':
      await db.user.update({
        where: { id: payload.AccountId },
        data: { subscriptionActive: false },
      });
      break;
  }
  return { code: 0 };
}
```

## Manual vs subscriptions API decision

| Need | Choice |
|---|---|
| Fixed price, monthly/yearly | `/subscriptions/create` |
| Metered / usage-based | Manual rebill (variable amounts) |
| Pause / resume support | Manual rebill (more control) |
| Compliance dashboard for CFO | `/subscriptions/create` (visible in CP dashboard) |
| Free trial + upgrade | Manual rebill (avoid the 1 RUB probe noise) |

## 54-ФЗ on every cycle

EACH cycle is a separate sale — needs its own fiscal receipt. Include `CustomerReceipt` in:
- The initial `/subscriptions/create` call (applies to first AND subsequent cycles)
- OR every `/payments/tokens/charge` call for manual rebill

If receipt template needs to change mid-subscription (price change), call `/subscriptions/update`.

## Test recurring locally

CloudPayments test environment supports subscriptions but does NOT actually wait for the schedule. Use sandbox-only `/subscriptions/test-fire` (dashboard button) to trigger an immediate cycle and inspect the `Recurrent` webhook payload.
