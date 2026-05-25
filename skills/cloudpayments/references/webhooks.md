# CloudPayments — Webhooks

Six webhook gates. Each is independently configurable (URL set per environment in the merchant dashboard) and independently retried on non-2xx response.

## Quick map

| Webhook | When it fires | Required response |
|---|---|---|
| **Check** | BEFORE money debits — merchant gate | `{code: 0}` to allow, `{code: 10..15}` to reject |
| **Pay** | After successful charge / capture | `{code: 0}` |
| **Confirm** | After two-step capture completed | `{code: 0}` |
| **Fail** | After bank decline OR cancel | `{code: 0}` |
| **Refund** | After refund executed | `{code: 0}` |
| **Recurrent** | Subscription state change | `{code: 0}` |

All return HTTP 200 with `{"code": 0}` body. Any other status or body retries (up to ~5 attempts, exponential backoff up to 24h).

## Request shape

By default, CloudPayments sends `application/x-www-form-urlencoded`. Switch to JSON in dashboard for cleaner parsing (recommended for new integrations).

Common fields across webhooks:

| Field | Type | Description |
|---|---|---|
| `TransactionId` | int | CloudPayments unique txn ID |
| `Amount` | decimal | Charge amount |
| `Currency` | string | `RUB` |
| `DateTime` | string | UTC ISO 8601 |
| `InvoiceId` | string | Merchant order ID |
| `AccountId` | string | Merchant user ID |
| `Email` | string | Buyer email |
| `IpAddress` | string | Buyer IP |
| `CardFirstSix` | string | First 6 digits of PAN |
| `CardLastFour` | string | Last 4 digits |
| `CardType` | string | `Visa`/`MasterCard`/`MIR` |
| `Issuer` | string | Issuing bank name |
| `IssuerBankCountry` | string | ISO country code |
| `Status` | string | `Completed`/`Authorized`/`Cancelled`/`Declined` |
| `TestMode` | int | `1` = test, `0` = production |
| `Token` | string | (Pay/Confirm) Saved card token for future rebill |
| `PaymentMethod` | string | `BankCard`/`Sbp`/`TinkoffPay`/`SberPay` etc. |
| `Data` | string (JSON) | Merchant data passed via widget `data` |

## Check webhook (critical gate)

Fires BEFORE the charge. Return `{code: 0}` to authorize CloudPayments to proceed with the charge, anything else to reject (no money moves).

```http
POST /webhooks/cloudpayments/check HTTP/1.1
Content-HMAC: <base64 HMAC-SHA256 of raw body>
Content-Type: application/json

{"TransactionId":12345678,"Amount":1000.00,"Currency":"RUB","InvoiceId":"order-42","AccountId":"user-7","Email":"buyer@example.com"}
```

Implementation logic:

```ts
async function handleCheck(payload: CheckPayload) {
  const order = await db.order.findUnique({ where: { id: payload.InvoiceId } });
  if (!order) return { code: 10 };                       // order not found
  if (order.status !== 'pending_payment') return { code: 13 }; // already paid / cancelled
  if (Number(order.amount) !== Number(payload.Amount)) return { code: 12 }; // amount mismatch
  if (order.currency !== payload.Currency) return { code: 11 };              // currency mismatch
  return { code: 0 };                                     // allow charge
}
```

Reject codes:

| code | Meaning |
|---|---|
| 10 | Order not found |
| 11 | Wrong amount |
| 12 | Wrong order |
| 13 | Order expired / already paid |
| 20 | Cannot process at this time |

## Pay webhook (money received)

Fires after successful debit. This is your **source of truth** for fulfillment — only trust this, not the client-side `onSuccess` callback.

```ts
async function handlePay(payload: PayPayload) {
  // 1. Verify HMAC (done by middleware, see security-pci.md)
  // 2. Look up order — re-check amount/currency
  const order = await db.order.findUnique({ where: { id: payload.InvoiceId } });
  if (!order) return reply.status(200).send({ code: 0 }); // ignore unknown
  if (order.status === 'paid') return reply.status(200).send({ code: 0 }); // idempotent

  if (Number(order.amount) !== Number(payload.Amount)) {
    // SUSPICIOUS — log and alert ops
    logger.error({ payload, order }, 'amount mismatch on Pay webhook');
    return reply.status(200).send({ code: 0 });
  }

  // 3. Mark paid in DB
  await db.$transaction([
    db.order.update({
      where: { id: order.id },
      data: {
        status: 'paid',
        paidAt: new Date(),
        cpTransactionId: payload.TransactionId,
        cardLast4: payload.CardLastFour,
        token: payload.Token ?? null,
      },
    }),
    db.paymentEvent.create({
      data: {
        type: 'pay',
        transactionId: payload.TransactionId,
        amount: payload.Amount,
        rawPayload: payload,
      },
    }),
  ]);

  // 4. Side effects (queue them — don't block the webhook response)
  await queue.add('order.fulfill', { orderId: order.id });

  return reply.status(200).send({ code: 0 });
}
```

## Fail webhook

Fires when bank declines. Body includes `Reason` (string) and `ReasonCode` (numeric). Mark order as failed; surface human-readable reason to user.

```json
{
  "TransactionId": 12345678,
  "Amount": 1000.00,
  "InvoiceId": "order-42",
  "Reason": "InsufficientFunds",
  "ReasonCode": 5051,
  "Status": "Declined"
}
```

## Confirm webhook (two-step only)

Fires after `/payments/confirm` captures a previously-authorized payment. Same shape as Pay. Implement only if using two-step (`auth`) flow.

## Refund webhook

Fires after `/payments/refund` is executed (manually or via subscription cancellation). Body includes `PaymentTransactionId` (original txn) plus the refund's own `TransactionId`.

```json
{
  "TransactionId": 12345699,
  "PaymentTransactionId": 12345678,
  "Amount": 1000.00,
  "DateTime": "2026-05-15T10:00:00",
  "InvoiceId": "order-42"
}
```

Mark order as refunded; trigger downstream actions (cancel subscription, revoke access).

## Recurrent webhook

Fires on subscription lifecycle events: cycle billed, billing failed, plan ended.

```json
{
  "Id": "sub_xxx",
  "AccountId": "user-7",
  "Description": "Monthly Pro",
  "Amount": 500,
  "Currency": "RUB",
  "Status": "Active",
  "SuccessfulTransactionsNumber": 3,
  "FailedTransactionsNumber": 0,
  "MaxPeriods": null,
  "Interval": "Month",
  "Period": 1,
  "StartDate": "2026-02-15T10:00:00",
  "NextTransactionDate": "2026-06-15T10:00:00"
}
```

Statuses: `Active` / `PastDue` / `Cancelled` / `Rejected` / `Expired` / `Completed`.

## Retry semantics

CloudPayments retries non-2xx and non-`{code:0}` responses. Backoff is exponential, up to ~24 hours total. After exhausting retries, the merchant sees a notification in the dashboard.

Implement webhooks to be:
- **Idempotent**: same `TransactionId` processed twice must not double-fulfill
- **Fast**: respond within 30s. Queue side effects via BullMQ/Redis rather than blocking
- **Defensive**: validate every field; never trust amount/currency from payload alone

## Payload validation with Zod

```ts
import { z } from 'zod';

export const PayPayload = z.object({
  TransactionId: z.coerce.number().int().positive(),
  Amount: z.coerce.number().positive(),
  Currency: z.literal('RUB'),
  InvoiceId: z.string().min(1),
  AccountId: z.string().optional(),
  Email: z.email().optional(),
  Status: z.enum(['Completed', 'Authorized']),
  Token: z.string().optional(),
  CardLastFour: z.string().length(4).optional(),
  TestMode: z.coerce.number().pipe(z.union([z.literal(0), z.literal(1)])),
});
export type PayPayload = z.infer<typeof PayPayload>;
```

Parse with `.safeParse(req.body)` — log and reject on schema fail.
