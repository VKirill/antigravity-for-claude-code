# YooKassa — Refunds

## Refund vs cancel

| Operation | When | Cost |
|---|---|---|
| `POST /v3/payments/{id}/cancel` | State is `pending` or `waiting_for_capture` | Free |
| `POST /v3/refunds` | State is `succeeded` | Money returned to customer; YooKassa retains commission |

## Full refund

```ts
const refund = await checkout.createRefund({
  payment_id: 'pi_...',
  amount: { value: '1000.00', currency: 'RUB' },
  description: 'Возврат по заказу #42',
  receipt: {
    customer: { email: order.email },
    items: order.items.map(i => ({
      description: i.label,
      quantity: i.quantity.toFixed(3),
      amount: { value: (i.price * i.quantity).toFixed(2), currency: 'RUB' },
      vat_code: i.vatCode,
      payment_subject: 'service',
      payment_mode: 'full_payment',
    })),
    tax_system_code: 2,
  },
}, crypto.randomUUID());
```

Response: a Refund object with `status: pending` (will transition to `succeeded` shortly).

```json
{
  "id": "216749f7-0016-50be-b000-078d43a63ae4",
  "status": "pending",
  "amount": { "value": "1000.00", "currency": "RUB" },
  "created_at": "2026-05-15T10:00:00.000Z",
  "payment_id": "29084b71-000f-5000-9000-1d0b35d96a99",
  "description": "Возврат по заказу #42"
}
```

`refund.succeeded` webhook fires when processed.

## Partial refund

Same endpoint, smaller `amount`. Pass `receipt` matching ONLY the items being refunded:

```ts
// Original payment: 1000 RUB. Customer returns 1 of 2 items, worth 300 RUB.
await checkout.createRefund({
  payment_id: 'pi_...',
  amount: { value: '300.00', currency: 'RUB' },
  description: 'Частичный возврат — товар «Книга»',
  receipt: {
    customer: { email: order.email },
    items: [{
      description: 'Книга «JS the good parts»',
      quantity: '1.000',
      amount: { value: '300.00', currency: 'RUB' },
      vat_code: 3,
      payment_subject: 'commodity',
      payment_mode: 'full_payment',
    }],
    tax_system_code: 1,
  },
}, crypto.randomUUID());
```

Multiple partial refunds allowed up to the original `amount`.

## Track cumulative refunds

YooKassa does not enforce a cumulative-refund cap — your DB does. Before issuing:

```ts
const refunded = await db.refund.aggregate({
  where: { paymentId: payment.id, status: { in: ['pending', 'succeeded'] } },
  _sum: { amount: true },
});
if ((refunded._sum.amount ?? 0) + requestedAmount > payment.amount) {
  throw new Error('Cumulative refund exceeds original payment');
}
```

## refund.succeeded webhook

```json
{
  "type": "notification",
  "event": "refund.succeeded",
  "object": {
    "id": "216749f7-...",
    "status": "succeeded",
    "amount": { "value": "1000.00", "currency": "RUB" },
    "payment_id": "29084b71-...",
    "description": "Возврат по заказу #42",
    "created_at": "2026-05-15T10:00:00.000Z"
  }
}
```

Handler:

```ts
async function onRefundSucceeded(refundId: string) {
  const refund = await checkout.getRefund(refundId);
  await db.$transaction(async (tx) => {
    await tx.refund.update({
      where: { yookassaId: refund.id },
      data: { status: 'succeeded' },
    });
    const totalRefunded = await tx.refund.aggregate({
      where: { paymentId: refund.payment_id, status: 'succeeded' },
      _sum: { amount: true },
    });
    const payment = await tx.payment.findUnique({ where: { yookassaId: refund.payment_id } });
    if (payment && totalRefunded._sum.amount === payment.amount) {
      await tx.order.update({
        where: { id: payment.orderId },
        data: { status: 'refunded' },
      });
      // Revoke access, cancel subscription, etc.
    }
  });
}
```

## Refunds and subscriptions

Refunding the last cycle does NOT cancel the subscription. Two separate actions:

```ts
// 1. Refund last cycle
const lastPayment = await db.payment.findFirst({
  where: { subscriptionId: subId },
  orderBy: { createdAt: 'desc' },
});
await checkout.createRefund({
  payment_id: lastPayment!.yookassaId,
  amount: { value: lastPayment!.amount.toFixed(2), currency: 'RUB' },
  receipt: buildReceipt(...),
}, crypto.randomUUID());

// 2. Stop future charges
await db.subscription.update({
  where: { id: subId },
  data: { status: 'cancelled' },
});
```

## Time limits

- Refund must be issued within 365 days of original `payment.succeeded` (issuer rule)
- After `payment.succeeded` → `succeeded` state, no expiry on YooKassa side until 365d
- Disputed/chargeback transactions: handle via dashboard, not API

## Errors

| Error | Cause | Fix |
|---|---|---|
| `400 invalid_request: amount` | Amount exceeds remaining refundable | Reduce amount; check cumulative |
| `404 not_found` | Wrong `payment_id` | Verify ID with `/v3/payments/{id}` |
| `409` (idempotence collision) | Same Idempotence-Key with different body | Use a fresh UUID for retry |
| `payment_method_restricted` | Issuer rejects refund | Contact YooKassa support |

## Idempotency

`POST /v3/refunds` requires `Idempotence-Key`. Same key + same body returns the cached refund. Same key + different body = `400`. Store the key against your DB refund row.

```ts
async function refundOrder(orderId: string, amount: number) {
  let row = await db.refund.findFirst({
    where: { orderId, amount },
  });
  if (!row) {
    row = await db.refund.create({
      data: { orderId, amount, idempotenceKey: crypto.randomUUID(), status: 'creating' },
    });
  }
  const refund = await checkout.createRefund({...}, row.idempotenceKey);
  await db.refund.update({ where: { id: row.id }, data: { yookassaId: refund.id, status: 'pending' } });
}
```
