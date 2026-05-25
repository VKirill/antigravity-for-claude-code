# CloudPayments — Payments Flow

Three integration shapes: widget (most common), REST cryptogram (custom UI on merchant), recurrent token charge.

## Widget flow (in-page checkout)

```html
<script src="https://widget.cloudpayments.ru/bundles/cloudpayments.js"></script>
<script>
  const widget = new cp.CloudPayments({
    publicId: 'pk_xxxxxxxxxxxxxxxxxxxxxxxxx',
  });

  widget.pay(
    'charge',                                  // 'charge' | 'auth'
    {
      publicId: 'pk_xxx',
      description: 'Подписка Pro · май 2026',
      amount: 1000,
      currency: 'RUB',
      invoiceId: 'order-42',
      accountId: 'user-7',
      email: 'buyer@example.com',
      skin: 'mini',                            // 'classic' | 'modern' | 'mini'
      autoClose: 3,
      data: { internal_ref: 'abc' },
      requireEmail: true,
    },
    {
      onSuccess: (options) => {
        // payment succeeded — Pay webhook will arrive
      },
      onFail: (reason, options) => {
        // declined or canceled — log reason
      },
      onComplete: (paymentResult, options) => {
        // always fires after success or fail
      },
    },
  );
</script>
```

The widget collects card data inside an iframe served from `widget.cloudpayments.ru`, performs tokenization, handles 3DS redirect inline, and emits callbacks. Merchant DOM never sees PAN/CVV.

**Important**: client-side `onSuccess` is informational only. Order fulfillment must be triggered by the **server-side `Pay` webhook**, not by the JS callback (the user may close the browser before the callback fires).

## One-step charge

`charge` scheme — money debits immediately. Use for goods/services delivered instantly (digital downloads, SaaS subscriptions, donations).

Server has no work to do until the `Pay` webhook arrives.

## Two-step auth + capture

`auth` scheme — funds held on customer's card, then captured (`/payments/confirm`) within the bank's hold window (usually 7 days). Use for physical goods (capture on shipment), marketplaces, hotel reservations.

```
1. Widget.pay('auth', ...)                  → card authorized
2. Order picked / ready to ship
3. POST /payments/confirm { TransactionId, Amount }
4. Server receives Confirm webhook
```

Release a hold without capture: `POST /payments/void { TransactionId }`.

## REST cryptogram (custom UI)

If you must render your own card form (rare — only do this with PCI SAQ A-EP scope), use the CloudPayments **checkout JS library** (`@cloudpayments/checkout`) to tokenize raw card fields client-side into a `cryptogram` string, then send to your server, then `POST /payments/cards/charge { CardCryptogramPacket }`.

The cryptogram is one-time and short-lived. Do not log or persist it.

## Charge by saved token (recurrent)

After the first successful payment, CloudPayments returns `Model.Token` — a permanent surrogate keyed to the card-on-file. Server can rebill at any time without customer involvement:

```ts
const result = await fetch('https://api.cloudpayments.ru/payments/tokens/charge', {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${Buffer.from(`${publicId}:${apiSecret}`).toString('base64')}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    Amount: 500,
    Currency: 'RUB',
    AccountId: 'user-7',
    Token: savedToken,
    InvoiceId: 'order-43',
    Description: 'Подписка Pro · июнь 2026',
  }),
});
```

Tokens are NOT eternal — issuers may rotate them. Handle `ReasonCode: 5054` (ExpiredCard) by prompting the user to re-add their card.

## СБП (Система быстрых платежей)

CloudPayments offers СБП payment method through the same widget. Pass `paymentMethods: { sbp: true }` in widget options, or use server-side `POST /payments/qr/sbp/qrcode/get` to generate a QR/deep-link. Customer scans QR / taps deep-link → confirms in their bank app → CloudPayments fires `Pay` webhook with `PaymentMethod: "Sbp"`.

СБП settlement is faster than card (T+1 → T+0) and merchant commission is lower (~0.4-0.7%), but available only to Russian consumers with СБП-enabled banks (which is essentially all of them post-2022).

## Tinkoff Pay / SberPay / MIR Pay

Wallet-style methods. Activate in CloudPayments dashboard, widget shows them as additional buttons. Webhook payload `PaymentMethod` field identifies the source.

## Invoice (payment link, no widget)

`POST /orders/create` returns a payment URL. Send by email/SMS/Telegram. Customer opens link → CloudPayments-hosted page → pays → standard webhooks fire. Useful for B2B invoices, donations, off-session payments.

## Idempotency

CloudPayments does not enforce `InvoiceId` uniqueness server-side. Enforce client-side: SELECT by `InvoiceId` before retry, reject duplicates. Pass `X-Request-ID` header as best-effort idempotency hint.

## Flow decision matrix

| Use case | Flow |
|---|---|
| One-page checkout, digital good | Widget `charge` |
| Marketplace, physical good | Widget `auth` + server `confirm` on ship |
| Subscription with recurring billing | Widget `charge` → save Token → server `tokens/charge` on cycle, OR use `/subscriptions/create` |
| B2B invoice | `/orders/create` + send link |
| In-app mobile payment | Native CloudPayments SDK (iOS/Android) or WebView with widget |
| Telegram bot payment | Widget mounted in Mini App, or `/orders/create` link sent to chat |
