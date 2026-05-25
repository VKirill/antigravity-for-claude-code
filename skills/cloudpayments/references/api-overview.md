# CloudPayments — API Overview

## Base URL & auth

- **Base URL**: `https://api.cloudpayments.ru`
- **Auth**: HTTP Basic.
  - Username = `Public ID` (visible to merchant, used in widget too)
  - Password = `API Secret` (server-only, never expose in browser)
- **Content-Type**: `application/json` for all POST requests
- **Idempotency**: client-side responsibility — pass merchant-unique `InvoiceId` or `AccountId` to allow safe retries

## Common request shape

```http
POST /payments/cards/charge HTTP/1.1
Host: api.cloudpayments.ru
Authorization: Basic <base64(publicId:apiSecret)>
Content-Type: application/json
X-Request-ID: <uuid>          # optional idempotency hint

{
  "Amount": 1000.00,
  "Currency": "RUB",
  "InvoiceId": "order-42",
  "Description": "Подписка Pro · май 2026",
  "AccountId": "user-7",
  "Email": "buyer@example.com",
  "IpAddress": "203.0.113.42",
  "CardCryptogramPacket": "<from widget>",
  "Payer": { "FirstName": "Иван", "LastName": "Иванов" },
  "JsonData": { "internal_ref": "abc" }
}
```

## Common response shape

```json
{
  "Success": true,
  "Message": null,
  "Model": {
    "TransactionId": 12345678,
    "Amount": 1000.00,
    "Currency": "RUB",
    "InvoiceId": "order-42",
    "Status": "Completed",
    "StatusCode": 3,
    "ReasonCode": 0,
    "Token": "tk_abcdef...",
    "GatewayName": "CloudPayments",
    "AuthCode": "A12345",
    "Rrn": "603668680243"
  }
}
```

`Success=true` means the API call accepted the request. **It does NOT always mean money moved** — for `Need3ds` responses, `Success=false` and `Model.PaReq + Model.AcsUrl` instruct the client to redirect.

## Key endpoints

### Payments

| Endpoint | Purpose |
|---|---|
| `POST /payments/cards/charge` | One-step charge (widget cryptogram) |
| `POST /payments/cards/auth` | Two-step authorize (hold) |
| `POST /payments/confirm` | Capture a held auth |
| `POST /payments/void` | Release a held auth |
| `POST /payments/refund` | Refund a captured payment (full or partial) |
| `POST /payments/tokens/charge` | Server-driven rebill by saved Token |
| `POST /payments/tokens/auth` | Hold via saved Token |
| `POST /payments/get` | Fetch transaction by `TransactionId` |
| `POST /payments/find` | Fetch by merchant `InvoiceId` |
| `POST /payments/list` | List by date range |

### Subscriptions (recurrent)

| Endpoint | Purpose |
|---|---|
| `POST /subscriptions/create` | Create a recurring plan + first charge |
| `POST /subscriptions/get` | Fetch subscription state |
| `POST /subscriptions/find` | Fetch by `AccountId` |
| `POST /subscriptions/update` | Change Amount/Interval/Period/MaxPeriods |
| `POST /subscriptions/cancel` | Cancel |

### Invoices / orders

| Endpoint | Purpose |
|---|---|
| `POST /orders/create` | Create a payment link sent to customer (no widget) |
| `POST /orders/cancel` | Cancel an order |

### Notifications (webhooks management)

| Endpoint | Purpose |
|---|---|
| `POST /site/notifications/check/update` | Configure Check webhook URL |
| `POST /site/notifications/pay/update` | Configure Pay webhook URL |
| `POST /site/notifications/fail/update` | Configure Fail webhook URL |
| `POST /site/notifications/refund/update` | Configure Refund webhook URL |
| `POST /site/notifications/recurrent/update` | Configure Recurrent webhook URL |
| `POST /site/notifications/confirm/update` | Configure Confirm webhook URL |

## Response status codes

| `StatusCode` | `Status` | Meaning |
|---|---|---|
| 1 | AwaitingAuthentication | 3DS in progress |
| 2 | Authorized | Held (two-step) |
| 3 | Completed | Captured / one-step success |
| 4 | Cancelled | Voided (two-step before capture) |
| 5 | Declined | Bank declined |

## Reason codes (selection)

Issuer decline reasons returned in `ReasonCode` (numeric, ISO-8583-aligned). Common ones:

| `ReasonCode` | Meaning |
|---|---|
| 5001 | RefusedByIssuer (generic) |
| 5005 | TransactionError |
| 5006 | Fraud |
| 5013 | InvalidAmount |
| 5034 | LostCard |
| 5041 | StolenCard |
| 5051 | InsufficientFunds |
| 5054 | ExpiredCard |
| 5057 | TransactionNotPermitted |
| 5091 | IssuerUnavailable |
| 5096 | SystemMalfunction |

Surface `Reason` (human-readable) AND `ReasonCode` (machine) to your support tooling.

## 3-D Secure flow

If issuer requires 3DS:
1. `/payments/cards/charge` returns `Success: false, Model: { PaReq, AcsUrl, TransactionId }`
2. Client POSTs to `AcsUrl` with `PaReq` and `TermUrl=<your-callback>`
3. ACS returns `PaRes` to your `TermUrl`
4. Server calls `POST /payments/cards/post3ds { TransactionId, PaRes }`
5. Final result returned

The widget handles this automatically. Server-only flows must implement the redirect manually.

## Amount format

- Major units (rubles, not kopecks). `1000.00` = 1000 RUB.
- Up to 2 decimal places.
- Currency: `RUB` is the only currency for domestic Russian transactions. `USD`/`EUR` available for some configurations but rare.

## Errors at API level

`Success: false` with `Message: "Invalid CardCryptogramPacket"` (and similar) — these are merchant/integration errors, not bank declines. Always log full response for support.

## Community Node SDK

`cloudpayments` (npm, TypeScript) wraps the REST surface above. Verify version pinned in version block — community-maintained, occasionally lags new endpoints.

```ts
import { CloudPayments } from 'cloudpayments';

const cp = new CloudPayments({
  publicId: process.env.CP_PUBLIC_ID!,
  privateKey: process.env.CP_API_SECRET!,
});

const result = await cp.payments.charge({
  Amount: 1000,
  Currency: 'RUB',
  InvoiceId: 'order-42',
  CardCryptogramPacket: cryptogram,
});
```

Direct `fetch` is equally fine — the API is small.
