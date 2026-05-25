# YooKassa — API Overview

## Base URL & auth

- **Base URL**: `https://api.yookassa.ru/v3`
- **Auth**: HTTP Basic.
  - Username = `shopId` (numeric, visible to merchant)
  - Password = `secretKey` (server-only, `live_*` for prod or `test_*` for sandbox)
- **Content-Type**: `application/json`
- **Idempotency**: required on every state-changing POST via `Idempotence-Key: <uuid>` header

## Required headers

```http
POST /v3/payments HTTP/1.1
Host: api.yookassa.ru
Authorization: Basic <base64(shopId:secretKey)>
Idempotence-Key: 7c5f8a5b-3f4e-4e1f-9b2a-1a2b3c4d5e6f
Content-Type: application/json
```

## Common request shape — create payment

```json
{
  "amount": { "value": "1000.00", "currency": "RUB" },
  "capture": true,
  "confirmation": {
    "type": "redirect",
    "return_url": "https://example.com/orders/42/result"
  },
  "description": "Заказ №42 — подписка Pro",
  "metadata": { "order_id": "42", "user_id": "user-7" },
  "receipt": {
    "customer": { "email": "buyer@example.com" },
    "items": [{
      "description": "Подписка Pro · май 2026",
      "quantity": "1.00",
      "amount": { "value": "1000.00", "currency": "RUB" },
      "vat_code": 1,
      "payment_subject": "service",
      "payment_mode": "full_payment"
    }],
    "tax_system_code": 2
  }
}
```

## Payment object (response)

```json
{
  "id": "29084b71-000f-5000-9000-1d0b35d96a99",
  "status": "pending",
  "amount": { "value": "1000.00", "currency": "RUB" },
  "description": "Заказ №42 — подписка Pro",
  "recipient": { "account_id": "123456", "gateway_id": "789" },
  "created_at": "2026-05-15T10:00:00.000Z",
  "confirmation": {
    "type": "redirect",
    "confirmation_url": "https://yoomoney.ru/checkout/payments/v2/contract?orderId=...",
    "return_url": "https://example.com/orders/42/result"
  },
  "test": false,
  "paid": false,
  "refundable": false,
  "metadata": { "order_id": "42", "user_id": "user-7" }
}
```

Statuses (state machine):

| Status | Meaning |
|---|---|
| `pending` | Created, awaiting customer action (widget / redirect) |
| `waiting_for_capture` | Customer paid; merchant must `/capture` within hold window (typically 7 days) |
| `succeeded` | Captured; money settled (or will settle T+1) |
| `canceled` | Voided, expired, or declined |

## Key endpoints

### Payments

| Endpoint | Purpose |
|---|---|
| `POST /v3/payments` | Create a payment (with `confirmation` for widget URL) |
| `GET /v3/payments/{payment_id}` | Fetch authoritative state — use in webhook handler |
| `POST /v3/payments/{payment_id}/capture` | Capture a held payment (`waiting_for_capture` → `succeeded`) |
| `POST /v3/payments/{payment_id}/cancel` | Cancel a pending payment |
| `GET /v3/payments?limit=N&cursor=...` | List payments (date range, filters) |

### Refunds

| Endpoint | Purpose |
|---|---|
| `POST /v3/refunds` | Refund a `succeeded` payment (full or partial) |
| `GET /v3/refunds/{refund_id}` | Fetch refund state |
| `GET /v3/refunds?payment_id={id}` | List refunds for a payment |

### Receipts (separate fiscal receipts, decoupled from payment)

| Endpoint | Purpose |
|---|---|
| `POST /v3/receipts` | Create a standalone receipt (e.g., for cash on delivery) |
| `GET /v3/receipts/{receipt_id}` | Fetch receipt state |

### Webhooks management

| Endpoint | Purpose |
|---|---|
| `POST /v3/webhooks` | Subscribe a URL to an event (Oauth tokens only) |
| `GET /v3/webhooks` | List subscriptions |
| `DELETE /v3/webhooks/{id}` | Unsubscribe |

For HTTP Basic Auth integrations, configure webhook URLs in the merchant dashboard instead.

## Confirmation types

| `confirmation.type` | Flow |
|---|---|
| `redirect` | Server returns `confirmation_url`; merchant redirects the customer to YooKassa-hosted page |
| `embedded` | Server returns `confirmation_token`; merchant mounts Checkout.js widget with this token |
| `qr` | СБП QR code returned; customer scans with banking app |
| `mobile_application` | Deep-link to Tinkoff Pay / SberPay app |
| `external` | Customer pays out-of-band (cash via terminal); merchant polls status |

## Payment methods

Pass `payment_method_data.type` to force a specific method, or omit to let YooKassa show all configured methods:

| `payment_method.type` | Method |
|---|---|
| `bank_card` | Visa / MC / МИР card |
| `sbp` | Система быстрых платежей (СБП) |
| `sberbank` | SberPay |
| `tinkoff_bank` | Tinkoff Pay |
| `yoo_money` | YooMoney wallet |
| `mobile_balance` | МТС / МегаФон / Билайн / Tele2 |
| `cash` | Cash via partner terminals |
| `b2b_sberbank` | B2B SberBusiness |
| `installments` | Сбер «Плати по частям» |

## Errors

```json
{
  "type": "error",
  "id": "ab5a11cd-13fa-4ad1-9c50-d75c1fdc6c83",
  "code": "invalid_request",
  "description": "amount.value is required",
  "parameter": "amount.value"
}
```

Common codes:

| `code` | Cause |
|---|---|
| `invalid_request` | Body validation failed |
| `invalid_credentials` | shopId/secretKey wrong |
| `forbidden` | Account suspended / endpoint disabled |
| `not_found` | Payment/refund ID doesn't exist |
| `too_many_requests` | Rate-limited; back off |
| `internal_server_error` | YooKassa-side; retry with same Idempotence-Key |

## Community Node SDK — `@a2seven/yoo-checkout`

```ts
import { YooCheckout } from '@a2seven/yoo-checkout';

const checkout = new YooCheckout({
  shopId: process.env.YOOKASSA_SHOP_ID!,
  secretKey: process.env.YOOKASSA_SECRET_KEY!,
});

const idempotenceKey = crypto.randomUUID();

const payment = await checkout.createPayment({
  amount: { value: '1000.00', currency: 'RUB' },
  capture: true,
  confirmation: { type: 'redirect', return_url: 'https://example.com/return' },
  description: 'Order #42',
  metadata: { order_id: '42' },
}, idempotenceKey);

console.log(payment.confirmation.confirmation_url);
```

Other methods: `getPayment(id)`, `capturePayment(id, body, idempotenceKey)`, `cancelPayment(id, idempotenceKey)`, `createRefund(body, idempotenceKey)`.

## Amount format

- Strings, not numbers (avoid float precision issues).
- Major units. `"1000.00"` = 1000 RUB.
- Two decimal places, dot separator.
- `currency`: `RUB` (most common), `USD`, `EUR`, `KZT`, `BYN`, `UAH` (availability varies by merchant config).

## Wrong vs right — Idempotence-Key handling

**❌ Wrong — random key per attempt (defeats idempotency):**
```ts
async function chargeOrder(orderId: string, amount: number) {
  // Network retry layer wraps this with 3 attempts...
  return checkout.createPayment(
    { amount: { value: amount.toFixed(2), currency: 'RUB' }, ... },
    crypto.randomUUID(),  // ← new UUID every retry → 3 actual payments
  );
}
```

**✅ Right — stable key per logical operation, persisted before the call:**
```ts
async function chargeOrder(orderId: string, amount: number) {
  let row = await db.charge.findUnique({ where: { orderId } });
  if (!row) {
    row = await db.charge.create({
      data: { orderId, idempotenceKey: crypto.randomUUID(), status: 'pending' },
    });
  }
  // Same key on every retry of the same charge → cached response, no duplicate
  return checkout.createPayment(
    { amount: { value: amount.toFixed(2), currency: 'RUB' }, ... },
    row.idempotenceKey,
  );
}
```

**Why it matters:** YooKassa caches `(Idempotence-Key → response)` for ~24h. Same key + same body → cached response (safe retry). Same key + **different** body → `400 Bad Request` (caller bug). Different key for the same logical charge → **double charge**. The key must be persisted before the first attempt and reused across retries until the operation either succeeds or is intentionally re-versioned.
