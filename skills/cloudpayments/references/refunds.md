# CloudPayments — Refunds & Voids

Two operations, one outcome (money goes back), different semantics.

## Void vs refund

| Operation | When | Cost | Reversible |
|---|---|---|---|
| **Void** | Two-step auth, BEFORE capture | Free | No |
| **Refund** | After capture / one-step charge | Returns issuer commission | No |

If the original payment was `auth` and you haven't called `/payments/confirm`, **always prefer void** — it releases the hold without involving the issuer's refund pipeline.

## Void

```ts
await fetch('https://api.cloudpayments.ru/payments/void', {
  method: 'POST',
  headers: { ... },
  body: JSON.stringify({ TransactionId: 12345678 }),
});
```

Response:
```json
{ "Success": true, "Message": null }
```

No `Refund` webhook fires for voids (no money moved). Mark order cancelled in DB.

## Refund (full)

```ts
await fetch('https://api.cloudpayments.ru/payments/refund', {
  method: 'POST',
  headers: { ... },
  body: JSON.stringify({
    TransactionId: 12345678,
    Amount: 1000.00,           // full original amount
    JsonData: {
      CloudPayments: {
        CustomerReceipt: buildRefundReceipt({ amount: 1000, items: order.items, email: order.email }),
      },
    },
  }),
});
```

CloudPayments processes the refund (typically 1–5 business days back to customer's card), fires the `Refund` webhook on completion.

## Refund (partial)

Same endpoint, smaller `Amount`. Multiple partial refunds allowed up to the original charge total.

```ts
// charge: 1000 RUB. customer returns one item at 300 RUB.
await fetch('https://api.cloudpayments.ru/payments/refund', {
  method: 'POST',
  headers: { ... },
  body: JSON.stringify({
    TransactionId: 12345678,
    Amount: 300.00,
    JsonData: {
      CloudPayments: {
        CustomerReceipt: {
          Items: [
            { label: 'Книга', price: 300, quantity: 1, amount: 300, vat: 10, method: 4, object: 1 },
          ],
          taxationSystem: 0,
          email: order.email,
          AmountsHelp: { electronic: 300 },
        },
      },
    },
  }),
});
```

Track cumulative refund total in DB; reject merchant-initiated refunds that would exceed the original charge.

## 54-ФЗ refund receipt

Per 54-ФЗ, every refund of a B2C transaction MUST produce a "возврат прихода" receipt and be transmitted to ОФД. Attach `CustomerReceipt` to the refund request:

```ts
function buildRefundReceipt(args: {
  amount: number;
  items: OrderItem[];
  email: string;
  taxationSystem: 0 | 1 | 2 | 3 | 4 | 5;
}): CustomerReceipt {
  return {
    Items: args.items.map(i => ({
      label: i.label,
      price: i.price,
      quantity: i.quantity,
      amount: i.price * i.quantity,
      vat: i.vat ?? null,
      method: 4,
      object: i.object ?? 4,
    })),
    taxationSystem: args.taxationSystem,
    email: args.email,
    AmountsHelp: { electronic: args.amount },
  };
}
```

For partial refunds, include only the items being returned.

## Refund webhook

Fires after the refund is registered with the bank.

```json
{
  "TransactionId": 12345699,
  "PaymentTransactionId": 12345678,
  "Amount": 1000.00,
  "DateTime": "2026-05-15T10:00:00",
  "InvoiceId": "order-42",
  "AccountId": "user-7"
}
```

Idempotently update order status (some orchestrations send multiple refund events for partial refunds). Trigger downstream: revoke access, cancel related subscription, send email.

## Refunds and subscriptions

Cancelling a subscription (`/subscriptions/cancel`) does NOT refund past charges. To refund the last cycle:

1. Find the last `Pay` transaction's `TransactionId` for this `AccountId`
2. Call `/payments/refund` with that ID
3. Cancel the subscription separately

## Refund time limits

- Refund must happen within **365 days** of original charge (issuer rule)
- Voids must happen within the auth hold window (typically 7 days)
- Disputed/chargeback transactions can't be refunded normally — handle via dispute flow in dashboard

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `Refund amount exceeds remaining` | Multiple partial refunds total > charge | Track cumulative in DB |
| `Cannot refund test transaction` | Test mode txn | Use sandbox refund flow |
| `Transaction not found` | Wrong `TransactionId` | Look up via `/payments/find` by `InvoiceId` |
| `Already refunded` | Duplicate refund call | Check DB before issuing |

## Idempotency

Refunds are NOT idempotent on the CloudPayments side. Two `/payments/refund` calls with same `TransactionId` and same `Amount` will execute TWO refunds (if total ≤ original). Always check DB before retrying.
