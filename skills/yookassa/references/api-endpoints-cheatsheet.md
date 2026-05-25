# YooKassa API v3 — endpoints cheatsheet

Curated from official docs via Context7 mirror (May 2026). Every block carries the original Source URL — go there for the authoritative version. Use this file as a quick lookup; the integration-flow files (`payments-flow.md`, `recurring-subscriptions.md`, `refunds.md`) cover the patterns.

> Base URL: `https://api.yookassa.ru/v3`
> Auth: HTTP Basic — `<Shop ID>:<Secret Key>`
> Every state-changing POST requires `Idempotence-Key` header (UUID v4 recommended)

## Core payment lifecycle

### POST `/v3/payments` — create payment
Source: https://yookassa.ru/developers/api/index

Request body skeleton:
```json
{
  "amount": { "value": "100.00", "currency": "RUB" },
  "payment_method": { "type": "bank_card" },
  "description": "Payment for order #123"
}
```

Response (201): `{ "id": "<uuid>", "status": "waiting_for_capture" | "pending" | "succeeded", ... }`

### GET `/v3/payments` — list payments (paginated)
Source: https://yookassa.ru/developers/api/index

Query: `limit` (1–100), `cursor`, plus filters (`created_at.gte`, `status`, `payment_method`, ...).

### GET `/v3/payments/{payment_id}` — retrieve
Source: https://yookassa.ru/developers/api/index

**Critical webhook-verification pattern** — when you receive a notification, re-fetch via this endpoint to confirm the payment state. Don't trust the webhook body alone.

### POST `/v3/payments/{payment_id}/capture` — capture authorized
Source: https://yookassa.ru/developers/api/index

Used in two-stage (`capture: false` on create → manual capture). Body can override amount for partial capture.

### POST `/v3/payments/{payment_id}/cancel` — cancel authorized
Source: https://yookassa.ru/developers/api/index

Releases the hold without charging.

## Payment methods (saved methods, recurring)

### POST `/v3/payment_methods` — create payment method (binding flow)
Source: https://yookassa.ru/developers/api/index

Used to bind a card for future recurring use, typically via redirect confirmation. HTTP Basic auth (NOT Bearer), `Idempotence-Key` required.

```bash
curl https://api.yookassa.ru/v3/payment_methods \
  -X POST \
  -u <Shop ID>:<Secret Key> \
  -H 'Idempotence-Key: <uuid>' \
  -H 'Content-Type: application/json' \
  -d '{
        "type": "bank_card",
        "confirmation": {
          "type": "redirect",
          "return_url": "https://www.example.com/return_url"
        }
      }'
```

Response includes `id` (the payment method id), `status` (`pending` → `succeeded` after confirmation), and `confirmation.confirmation_url`. The returned `id` is reusable in `POST /v3/payments` as `"payment_method_id": "<id>"`.

> Most integrations skip this endpoint and save methods via the simpler `save_payment_method: true` flag on a regular `POST /v3/payments` instead — see [recurring-subscriptions.md](recurring-subscriptions.md).

## Recurring (saved method by ID)

### POST `/v3/payments` with `payment_method_id` — charge saved
Source: https://yookassa.ru/developers/payment-acceptance/scenario-extensions/top-up-phones-balance?lang=en

Example — phone top-up scenario with anti-fraud `topped_up_phone` hint:
```bash
curl https://api.yookassa.ru/v3/payments \
  -X POST \
  -u <Shop ID>:<Secret Key> \
  -H 'Idempotence-Key: <uuid>' \
  -H 'Content-Type: application/json' \
  -d '{
    "amount": { "value": "100.00", "currency": "RUB" },
    "capture": true,
    "payment_method_id": "<saved method id>",
    "description": "Adding money to mobile phone balance",
    "fraud_data": { "topped_up_phone": "79000000000" }
  }'
```

### Widget — `save_payment_method: true` on first payment
Source: https://yookassa.ru/developers/payment-acceptance/integration-scenarios/widget/scenarios

```json
{
  "amount": { "value": "2.00", "currency": "RUB" },
  "confirmation": { "type": "embedded", "locale": "ru_RU" },
  "capture": true,
  "save_payment_method": true,
  "description": "Order No. 72"
}
```

Recurring requires a YooMoney manager activation for production stores.

## Payment methods by type

### SberPay (redirect)
Source: https://yookassa.ru/developers/payment-acceptance/integration-scenarios/manual-integration/sberpay?lang=en

```json
{
  "amount": { "value": "2.00", "currency": "RUB" },
  "payment_method_data": { "type": "sberbank" },
  "confirmation": { "type": "redirect", "return_url": "https://www.example.com/return_url" },
  "description": "Order No. 72"
}
```

Response includes `confirmation.confirmation_url` (the `yoomoney.ru/api-pages/...` page).

### Sber Loan (buy-now-pay-later)
Source: https://yookassa.ru/developers/payment-acceptance/integration-scenarios/manual-integration/other/sber-loan?lang=en

```json
{
  "amount": { "value": "5000.00", "currency": "RUB" },
  "payment_method_data": { "type": "sber_loan" },
  "confirmation": { "type": "redirect", "return_url": "https://www.example.com/return_url" },
  "description": "Order No. 37",
  "metadata": { "order_id": "37" }
}
```

## Deals (split payments / marketplace flows)

### GET `/v3/deals` — list deals
Source: https://yookassa.ru/developers/api/index

```python
import requests, base64
url = 'https://api.yookassa.ru/v3/deals'
auth_header = 'Basic ' + base64.b64encode(f'{merchant_id}:{secret_key}'.encode()).decode()
response = requests.get(url, headers={'Authorization': auth_header})
```

Deals are needed for safe-deal escrow scenarios (marketplaces, intermediaries).

## Receipts (54-ФЗ fiscalization)

### GET `/v3/receipts` — list receipts
Source: https://yookassa.ru/developers/api/index_lang=ru

```python
import requests
shop_id, secret_key = '<id>', '<key>'
response = requests.get('https://api.yookassa.ru/v3/receipts', auth=(shop_id, secret_key))
print(response.json())
```

`POST /v3/receipts` creates a standalone receipt. For inline (payment-attached) receipts, embed `receipt: { ... }` in `POST /v3/payments`.

## Authoritative source map

| Topic | Source URL |
|---|---|
| Full API index (RU) | https://yookassa.ru/developers/api/index_lang=ru |
| Full API index (EN) | https://yookassa.ru/developers/api/index |
| Manual integration scenarios | https://yookassa.ru/developers/payment-acceptance/integration-scenarios/manual-integration |
| Widget scenarios | https://yookassa.ru/developers/payment-acceptance/integration-scenarios/widget/scenarios |
| Recurring | https://yookassa.ru/developers/payment-acceptance/integration-scenarios/widget/additional-settings/recurring-payments?lang=en |
| Phone top-up scenario (anti-fraud `topped_up_phone`) | https://yookassa.ru/developers/payment-acceptance/scenario-extensions/top-up-phones-balance?lang=en |
| SberPay | https://yookassa.ru/developers/payment-acceptance/integration-scenarios/manual-integration/sberpay?lang=en |
| Sber Loan (BNPL) | https://yookassa.ru/developers/payment-acceptance/integration-scenarios/manual-integration/other/sber-loan?lang=en |

> Curated 2026-05-15 via Context7 (`/websites/yookassa_ru_developers` + `/websites/yookassa_ru_developers_api`). Re-pull when YooKassa publishes API changes.
