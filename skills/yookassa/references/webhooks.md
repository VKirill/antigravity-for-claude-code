# YooKassa — Webhooks

Four core event types, fired on payment-object state transitions and refund completions. Configure URLs in the dashboard per environment.

## Events

| Event | When |
|---|---|
| `payment.waiting_for_capture` | Customer paid in a two-stage flow; merchant must `/capture` |
| `payment.succeeded` | Payment captured (one-stage) or captured (two-stage) |
| `payment.canceled` | Voided, expired, or declined |
| `refund.succeeded` | Refund processed |

(Plus optional `payout.*` and `deal.*` for marketplace use cases — out of scope here.)

## Payload shape

```json
{
  "type": "notification",
  "event": "payment.succeeded",
  "object": {
    "id": "29084b71-000f-5000-9000-1d0b35d96a99",
    "status": "succeeded",
    "amount": { "value": "1000.00", "currency": "RUB" },
    "income_amount": { "value": "965.00", "currency": "RUB" },
    "description": "Order #42",
    "recipient": { "account_id": "123456", "gateway_id": "789" },
    "payment_method": {
      "type": "bank_card",
      "id": "29084b71-000f-5000-9000-1d0b35d96a99",
      "saved": true,
      "title": "Bank card *4444",
      "card": {
        "first6": "424242", "last4": "4242",
        "expiry_month": "07", "expiry_year": "2030",
        "card_type": "Visa",
        "issuer_country": "RU", "issuer_name": "Sberbank"
      }
    },
    "captured_at": "2026-05-15T10:00:30.000Z",
    "created_at": "2026-05-15T10:00:00.000Z",
    "test": false,
    "refundable": true,
    "metadata": { "order_id": "42", "user_id": "user-7" }
  }
}
```

`object.id` is the payment ID (`pi_*` in dashboard, UUID over the wire).

## Verification model (default)

YooKassa does NOT include an HMAC signature in webhook headers by default. Authenticity model:

1. **IP allowlist**: only accept webhooks from YooKassa's published IP ranges (dashboard → API → "IP-адреса для получения уведомлений").
2. **Re-fetch the payment**: before mutating state, call `GET /v3/payments/{object.id}` and trust THAT response. The webhook is just a "wake-up call"; the API call is the source of truth.

```ts
// /webhooks/yookassa
app.post('/webhooks/yookassa', async (req, reply) => {
  // 1. IP allowlist (defence-in-depth)
  if (!isYookassaIp(req.ip)) {
    return reply.status(403).send({ error: 'forbidden' });
  }

  const body = req.body as YookassaWebhookBody;
  const parsed = WebhookSchema.safeParse(body);
  if (!parsed.success) return reply.status(400).send({ error: 'bad payload' });

  // 2. Re-fetch authoritative state
  const payment = await checkout.getPayment(parsed.data.object.id);

  // 3. Now safely act on payment.status
  switch (parsed.data.event) {
    case 'payment.succeeded':
      await onPaymentSucceeded(payment);
      break;
    case 'payment.canceled':
      await onPaymentCanceled(payment);
      break;
    case 'payment.waiting_for_capture':
      await onPaymentWaitingForCapture(payment);
      break;
    case 'refund.succeeded':
      await onRefundSucceeded(parsed.data.object.id); // refund object, not payment
      break;
  }

  return reply.status(200).send({ ok: true });
});
```

This pattern is the **canonical YooKassa integration shape**. Re-fetching is the only way to defend against forged or replayed webhooks in environments without signing.

### Trust-the-payload vs re-fetch

**❌ Wrong — trusting the webhook body to mutate order state:**
```ts
app.post('/webhooks/yookassa', async (req, reply) => {
  const body = req.body as YookassaWebhookBody;
  if (body.event === 'payment.succeeded') {
    // body.object.amount is attacker-controlled if request isn't authenticated
    await db.order.update({
      where: { id: body.object.metadata.order_id },
      data: { status: 'paid', amount: body.object.amount.value },
    });
  }
  return reply.status(200).send();
});
```

**✅ Right — re-fetch authoritative state via `GET /v3/payments/{id}`:**
```ts
app.post('/webhooks/yookassa', async (req, reply) => {
  if (!isYookassaIp(req.ip)) return reply.status(403).send();
  const body = WebhookSchema.parse(req.body);
  // Authoritative call — secret-key authenticated, can't be forged
  const payment = await checkout.getPayment(body.object.id);
  if (payment.status === 'succeeded') {
    await db.order.update({
      where: { id: payment.metadata.order_id },
      data: { status: 'paid', amount: payment.amount.value },
    });
  }
  return reply.status(200).send();
});
```

**Why it matters:** YooKassa's default webhook delivery is unsigned. Without re-fetch, a leaked webhook URL becomes a "set order to paid" endpoint for anyone. Even with IP allowlist (which is defense-in-depth), one mis-routed request through your CDN or a misconfigured upstream proxy can spoof source IP. The authoritative call uses your secret key — that cannot be spoofed.

## Opt-in Signing Secret (newer accounts)

Since 2024, YooKassa supports webhook signing for select account tiers. When enabled, dashboard provides a "Signing Secret"; webhooks include `X-Yookassa-Signature` header with `t=<timestamp>,v1=<hex-hmac>` format (Stripe-like).

If you have signing enabled:

```ts
import crypto from 'node:crypto';

function verifyYookassaSignature(rawBody: string, header: string, secret: string): boolean {
  const parts = Object.fromEntries(
    header.split(',').map(s => s.split('=').map(x => x.trim()))
  ) as { t?: string; v1?: string };
  if (!parts.t || !parts.v1) return false;

  const payload = `${parts.t}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  if (expected.length !== parts.v1.length) return false;
  const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));

  // Replay window: 5 minutes
  const ageMs = Date.now() - Number(parts.t) * 1000;
  if (Math.abs(ageMs) > 5 * 60 * 1000) return false;

  return ok;
}
```

Even with signing, **still re-fetch the payment** — it's a marginal extra round-trip for major safety in business-critical webhooks.

## Retries

YooKassa retries non-2xx responses with exponential backoff for ~24h. Endpoints must:

- Be idempotent: same event ID processed twice must not double-fulfill
- Respond within 30s (queue async work)
- Return 2xx ONLY when fully processed (or accepted into reliable queue)

## Idempotency on the receiver

Use `object.id` (payment UUID) + event type as a dedup key:

```ts
const dedupKey = `${parsed.data.event}:${parsed.data.object.id}`;
const inserted = await db.webhookEvent.create({
  data: { dedupKey, event: parsed.data.event, paymentId: parsed.data.object.id },
}).catch((err) => {
  if (err.code === 'P2002') return null; // duplicate (Prisma unique violation)
  throw err;
});
if (!inserted) return reply.status(200).send({ ok: true }); // already processed
```

## Webhook body validation with Zod

```ts
import { z } from 'zod';

const Amount = z.object({
  value: z.string().regex(/^\d+\.\d{2}$/),
  currency: z.string(),
});

const PaymentObject = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending', 'waiting_for_capture', 'succeeded', 'canceled']),
  amount: Amount,
  description: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  test: z.boolean(),
  refundable: z.boolean(),
  payment_method: z.object({
    id: z.string().optional(),
    type: z.string(),
    saved: z.boolean().optional(),
  }).optional(),
});

export const WebhookSchema = z.object({
  type: z.literal('notification'),
  event: z.enum([
    'payment.waiting_for_capture',
    'payment.succeeded',
    'payment.canceled',
    'refund.succeeded',
  ]),
  object: PaymentObject,
});
export type YookassaWebhook = z.infer<typeof WebhookSchema>;
```

## payment.succeeded handler

```ts
async function onPaymentSucceeded(payment: Payment) {
  await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: payment.metadata?.order_id },
    });
    if (!order) return;
    if (order.status === 'paid') return; // idempotent

    if (order.amount.toFixed(2) !== payment.amount.value) {
      logger.error({ order, payment }, 'amount mismatch');
      return;
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'paid',
        paidAt: new Date(),
        yookassaPaymentId: payment.id,
        cardLast4: payment.payment_method?.card?.last4 ?? null,
        savedMethodId: payment.payment_method?.saved ? payment.payment_method.id : null,
      },
    });

    await tx.paymentEvent.create({
      data: { type: 'payment.succeeded', payload: payment },
    });
  });

  await queue.add('order.fulfill', { orderId: payment.metadata?.order_id });
}
```

## payment.canceled handler

```ts
async function onPaymentCanceled(payment: Payment) {
  const orderId = payment.metadata?.order_id;
  if (!orderId) return;

  await db.order.update({
    where: { id: orderId },
    data: {
      status: 'payment_failed',
      cancellationReason: payment.cancellation_details?.reason ?? 'unknown',
    },
  });
}
```

`cancellation_details.reason` values: `insufficient_funds`, `card_expired`, `payment_method_restricted`, `fraud_suspected`, `3d_secure_failed`, `general_decline`, `permission_revoked`, `unsupported_mobile_operator`, `internal_timeout`, `expired_on_capture`, `canceled_by_merchant`.

## payment.waiting_for_capture handler

For two-stage flows. The default action is "capture immediately" (since you already validated the order); for marketplaces with manual fulfillment, delay until shipment.

```ts
async function onPaymentWaitingForCapture(payment: Payment) {
  // Validate it's still safe to capture
  const order = await db.order.findUnique({ where: { id: payment.metadata?.order_id } });
  if (!order || order.status === 'cancelled') {
    await checkout.cancelPayment(payment.id, crypto.randomUUID());
    return;
  }

  await checkout.capturePayment(
    payment.id,
    { amount: payment.amount, receipt: buildReceipt(order) },
    `capture-${payment.id}`, // stable idempotence key
  );
}
```

## refund.succeeded handler

`object` is a refund object (different shape):

```ts
async function onRefundSucceeded(refundId: string) {
  const refund = await checkout.getRefund(refundId);
  await db.refund.update({
    where: { yookassaId: refund.id },
    data: { status: 'succeeded', completedAt: new Date(refund.created_at) },
  });
  await queue.add('refund.completed', { refundId });
}
```
