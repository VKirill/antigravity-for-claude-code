# YooKassa — Payments Flow

Three integration patterns: hosted page (`redirect`), embedded widget (`embedded`), and direct API for special methods (СБП QR, mobile app deep-link).

## State machine

```
                      ┌──────────────┐
   POST /v3/payments  │   pending    │
   ─────────────────► └──────┬───────┘
                             │  (customer pays)
                             ▼
              ┌──────────────────────────┐
              │  waiting_for_capture     │  ← only if capture: false
              └──────────────┬───────────┘
                             │  (POST /capture)
                             ▼
                      ┌──────────────┐
                      │  succeeded   │  → terminal
                      └──────────────┘

   Any state can transition to:    ┌──────────────┐
                                   │   canceled   │  → terminal
                                   └──────────────┘
```

Webhooks fire on every transition (see [webhooks.md](webhooks.md)).

## Flow 1: Hosted payment page (`redirect`)

Server creates payment with `confirmation: { type: 'redirect', return_url }`, gets `confirmation_url`, redirects browser. Customer pays on YooKassa-hosted page → bounces back to `return_url` → webhook fires server-side.

```ts
const payment = await checkout.createPayment({
  amount: { value: '1000.00', currency: 'RUB' },
  capture: true,
  confirmation: {
    type: 'redirect',
    return_url: `https://example.com/orders/${orderId}/result`,
  },
  description: `Order #${orderId}`,
  metadata: { order_id: orderId },
  receipt: buildReceipt(...),
}, crypto.randomUUID());

return Response.redirect(payment.confirmation.confirmation_url, 303);
```

Lowest PCI scope (SAQ A), no widget code on merchant.

## Flow 2: Embedded widget (`embedded`)

Server creates payment with `confirmation: { type: 'embedded' }`, returns `confirmation_token` to client, client mounts Checkout.js.

### Server

```ts
// app/api/payments/route.ts
export async function POST(req: Request) {
  const { orderId } = await req.json();
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });

  const payment = await checkout.createPayment({
    amount: { value: String(order.amount.toFixed(2)), currency: 'RUB' },
    capture: true,
    confirmation: { type: 'embedded' },
    description: order.description,
    metadata: { order_id: order.id },
    receipt: buildReceipt(order),
  }, crypto.randomUUID());

  await db.payment.create({
    data: { orderId, yookassaId: payment.id, status: 'pending' },
  });

  return NextResponse.json({ confirmation_token: payment.confirmation.confirmation_token });
}
```

### Client

```html
<script src="https://yookassa.ru/checkout-widget/v1/checkout-widget.js"></script>
<div id="payment-form"></div>
<script>
  const checkout = new window.YooMoneyCheckoutWidget({
    confirmation_token: 'ct-...',
    return_url: 'https://example.com/orders/42/result',
    error_callback: (e) => console.error(e),
  });
  checkout.render('payment-form');
</script>
```

## Flow 3: Two-stage payment (`capture: false`)

For physical goods, marketplaces, hotels — hold funds, capture on fulfillment.

```ts
// 1. Create with capture: false
const payment = await checkout.createPayment({
  amount: { value: '5000.00', currency: 'RUB' },
  capture: false,                                  // ← hold
  confirmation: { type: 'redirect', return_url },
  description: 'Бронирование #42',
}, crypto.randomUUID());

// 2. Customer pays → state goes to waiting_for_capture
//    Webhook payment.waiting_for_capture fires

// 3. When ready to fulfill:
const captured = await checkout.capturePayment(payment.id, {
  amount: { value: '5000.00', currency: 'RUB' },
  receipt: buildReceipt(...),
}, crypto.randomUUID());

// 4. Webhook payment.succeeded fires
```

Cancel a held payment with `checkout.cancelPayment(id, idempotenceKey)`. Hold expires automatically after 7 days (typically).

## Flow 4: СБП QR

```ts
const payment = await checkout.createPayment({
  amount: { value: '1000.00', currency: 'RUB' },
  capture: true,
  confirmation: { type: 'qr' },
  payment_method_data: { type: 'sbp' },
  description: 'Оплата по СБП',
  receipt: buildReceipt(...),
}, crypto.randomUUID());

// payment.confirmation.confirmation_data contains the SBP URL/payload
// Render as QR code (e.g., via qrcode npm package) and display to customer
```

Customer scans QR with their banking app, confirms → `payment.succeeded`. СБП settlement is faster (T+0/T+1) and commission is lower (~0.4-0.7% vs ~2-3% for cards).

## Flow 5: Tinkoff Pay / SberPay (mobile_application)

```ts
const payment = await checkout.createPayment({
  amount: { value: '1000.00', currency: 'RUB' },
  capture: true,
  confirmation: { type: 'mobile_application', return_url },
  payment_method_data: { type: 'tinkoff_bank' },
  description: 'Оплата через Tinkoff Pay',
  receipt: buildReceipt(...),
}, crypto.randomUUID());

// payment.confirmation.confirmation_url = tinkoffbank://... deep-link
// On mobile, redirect to this URL — opens the Tinkoff app
// On desktop, fall back to QR code or hosted page
```

## Recurring (saved payment method)

First charge:

```ts
const payment = await checkout.createPayment({
  amount: { value: '500.00', currency: 'RUB' },
  capture: true,
  confirmation: { type: 'redirect', return_url },
  save_payment_method: true,                       // ← capture method for future
  description: 'Подписка Pro · первый месяц',
  metadata: { user_id: userId, subscription: 'pro' },
  receipt: buildReceipt(...),
}, crypto.randomUUID());
```

After `payment.succeeded`, fetch the payment and extract `payment_method.id`:

```ts
const p = await checkout.getPayment(payment.id);
if (p.status === 'succeeded' && p.payment_method?.id && p.payment_method.saved) {
  await db.user.update({ where: { id: userId }, data: { yookassaMethodId: p.payment_method.id } });
}
```

Subsequent rebill (no customer interaction needed):

```ts
const next = await checkout.createPayment({
  amount: { value: '500.00', currency: 'RUB' },
  capture: true,
  payment_method_id: user.yookassaMethodId,         // ← reuse saved method
  description: 'Подписка Pro · июнь 2026',
  metadata: { user_id: userId },
  receipt: buildReceipt(...),
}, crypto.randomUUID());
```

No `confirmation` needed — server-driven charge proceeds directly. Webhook `payment.succeeded` fires.

## Idempotency in flows

Every state-changing POST requires `Idempotence-Key`. Patterns:

- **Create payment**: UUID v4 per merchant order action. If retrying the same logical order, reuse the SAME key.
- **Capture**: UUID v4 per capture action. Don't reuse across captures of different payments.
- **Refund**: UUID v4 per refund. If splitting one refund into two calls (partial), use a different key for each.

Store the UUID in your DB before the call so retries reuse it:

```ts
await db.$transaction(async (tx) => {
  let row = await tx.payment.findUnique({ where: { orderId } });
  if (!row) {
    row = await tx.payment.create({
      data: { orderId, idempotenceKey: crypto.randomUUID(), status: 'creating' },
    });
  }
  const payment = await checkout.createPayment(body, row.idempotenceKey);
  await tx.payment.update({ where: { id: row.id }, data: { yookassaId: payment.id, status: 'pending' } });
});
```

## Decision matrix

| Use case | Flow |
|---|---|
| Simple checkout, want lowest PCI scope | `confirmation: redirect` |
| In-page checkout, custom UX wrapper | `confirmation: embedded` + Checkout.js |
| Marketplace, physical goods | `capture: false` + capture on ship |
| СБП-only checkout | `confirmation: qr` + `payment_method_data.type: sbp` |
| Mobile app deep-link | `confirmation: mobile_application` |
| Subscription (recurring) | `save_payment_method: true` → rebill with `payment_method_id` |
| Off-session B2B invoice | `confirmation: redirect`, email customer the URL |
| Telegram bot | `redirect` to YooKassa page (link in chat) or Mini App with `embedded` widget |
