# Recommended defaults — cloudpayments

The canonical operational values for CloudPayments integrations. **All other files in this skill cite this table — do not redefine inline.** Source: synthesized from `developers.cloudpayments.ru`, the published Notification source IP list, and operational experience with Russian Tier-1 merchants.

> Citation rule: when a recommendation depends on workload, give a default + a range + a "tune up when..." / "tune down when..." condition. Cargo-culting defaults is worse than no defaults.

## Webhook response timing (CloudPayments → your server)

CloudPayments retries any non-2xx response or any response that isn't `{"code": 0}` (for the Check/Pay/Fail/Refund/Confirm/Recurrent gates). Backoff is exponential up to ~24 hours of total retry budget.

| Knob | Default | Range | Tune-up when | Tune-down when | Why |
|---|---|---|---|---|---|
| Webhook handler p99 latency | **≤ 5 s** | 1–25 s | downstream work is unavoidable (rare) | aiming for max delivery success | CloudPayments TCP timeout is ~30 s in practice; staying well under removes retries-from-timeout. Queue side effects via BullMQ. |
| Hard timeout returning `{code:0}` | **≤ 25 s** | — | — | — | Above ~30 s CloudPayments treats it as non-delivery and retries. |
| Background side-effect deadline | **≤ 60 s after Pay** | 5–300 s | bulk B2B fulfillment | digital good — sub-second | Use `bullmq` for retries; never block the webhook 200. |

## HMAC verification

| Knob | Default | Why |
|---|---|---|
| Hash algorithm | **HMAC-SHA256** | Required by CloudPayments. |
| Encoding | **UTF-8 → base64** | Per docs (developers.cloudpayments.ru / Notification Verification). |
| Header read order | `Content-HMAC` THEN `X-Content-HMAC` | Both headers ship on every notification. `Content-HMAC` is computed over URL-encoded parameters; `X-Content-HMAC` over URL-decoded. Verify whichever matches your raw body. |
| Comparison | **`crypto.timingSafeEqual` on equal-length Buffers** | Constant-time. `===` leaks per-byte timing. |
| Raw-body read | **BEFORE any JSON / form parsing** | Fastify: `addContentTypeParser(..., { parseAs: 'buffer' })`. Express: `express.raw({ type: '*/*' })`. Any middleware that consumes the stream first will desync the HMAC. |

## Check webhook response codes (your → CloudPayments)

Return `{"code": N}` from your `/check` handler. CloudPayments treats anything other than `0` as a rejection and surfaces the corresponding ReasonCode to the buyer / dashboard.

| Your code | CloudPayments ReasonCode | Meaning | Use when |
|---|---|---|---|
| **0** | — | Allow charge | Order is in `pending_payment`, amount + currency match. |
| **10** | 3001 InvalidInvoiceId | Invoice not found | `InvoiceId` doesn't exist in your DB. |
| **11** | 3002 InvalidAccountId | Account not found | `AccountId` not found. |
| **12** | 3003 InvalidAmount | Amount mismatch | `payload.Amount` ≠ stored order amount. |
| **13** | 3008 NotAccepted | Rejected (generic) | Order in wrong state (already paid, cancelled, expired). |
| **20** | 3004 OutOfDate | Time-window expired | Order TTL window elapsed. |

Source: developers.cloudpayments.ru → Check Notification Response Codes table.

## Idempotency

| Pattern | When to use |
|---|---|
| `TransactionId` (CloudPayments-issued, present on every webhook) | Primary dedup key for Pay/Confirm/Fail/Refund. Store in a `payment_events(transaction_id PRIMARY KEY)` table; insert with `ON CONFLICT DO NOTHING` before processing. |
| `X-Request-ID` header on outbound API calls (`/payments/cards/charge` etc.) | CloudPayments-supported idempotency hint. Generate a UUIDv4 per logical operation; CloudPayments returns the same Model for retries within the dedup window. |
| `InvoiceId` (merchant-issued) | Must be unique per intended charge. CloudPayments does NOT enforce uniqueness server-side — your DB must. |
| Token reuse window | The `Token` returned by Pay is valid until the issuer rotates the card (handle `ReasonCode 5054 ExpiredCard`) or the customer revokes via `my.cloudpayments.ru`. No fixed TTL. |

Recommendation: derive `bullmq` `jobId = "cp-pay-${TransactionId}"` for at-least-once side effects from the Pay webhook.

## Outbound API HTTP retry policy

CloudPayments REST endpoints are stable; failures are usually network / transient. Retry rules:

| Knob | Default | Range | Tune-up when | Tune-down when |
|---|---|---|---|---|
| `attempts` | **3** | 2–5 | flaky uplink | non-idempotent operation (refund without DB guard) |
| Backoff | **exponential, starting 500 ms** | 250 ms – 5 s | bursty failures | provider returns 429 (respect Retry-After) |
| Per-request timeout | **15 s** | 5–30 s | 3DS verification flow | client expects fast response |
| Always-retry status codes | **502, 503, 504, ECONNRESET, ETIMEDOUT** | — | — | — |
| Never-retry status codes | **400, 401, 403, 422** | — | — | — |

Pair `X-Request-ID` with retry: same UUID on every attempt so CloudPayments dedups.

## 3-D Secure timeout

| Knob | Default | Why |
|---|---|---|
| ACS round-trip total budget | **≤ 7 min** | Issuers typically expire 3DS sessions in 5–10 min. |
| Server-side wait for `/payments/cards/post3ds` after ACS callback | **≤ 60 s** | Customer is actively waiting at this point — show progress UI. |
| Frontend iframe size | width `≥ 400 px`, height `≥ 600 px` | Mobile-bank ACS pages need room; popup blockers reject very small windows. |

## Recurring / subscription defaults

| Knob | Default | Notes |
|---|---|---|
| Past-due retry policy (CloudPayments-managed) | **2 consecutive failures → `PastDue`, 3 consecutive → `Rejected`** | Per docs (Subscription Statuses table). Configure schedule in dashboard. |
| Manual rebill schedule (your cron) | **First retry: +24 h, second: +72 h, abandon: +168 h** | Use `bullmq` `attempts: 3` with `backoff: { type: 'exponential', delay: 24*3600*1000 }`. |
| `Interval` / `Period` | **`Month` / `1`** for fixed-price SaaS | `Day` / `Week` valid for short cycles. |
| `MaxPeriods` | **omit** unless a fixed-term contract (e.g., 12 cycles) | Mandatory finite term breaks open-ended subscriptions. |
| Trial handling | **Manual rebill** | `/subscriptions/create` cannot delay first charge past `StartDate` skipping; do the trial via your scheduler + first `/payments/tokens/charge` after trial. |

## 54-ФЗ receipt limits

| Knob | Limit / default | Why |
|---|---|---|
| `Items[].label` | **≤ 128 chars** | ОФД rejects longer. Per docs. |
| `Items[].quantity` precision | **0.001** | Three decimals max. |
| Sum of `Items[].amount` | **MUST equal request `Amount` exactly** | ОФД rejects mismatch; CloudPayments dashboard alerts. |
| `Items.length` (single receipt) | **≤ 100 items** | Practical OFD ceiling; split large carts into multiple receipts via dashboard config. |
| Customer contact | **at least one of `email` or `phone`** | 54-ФЗ requires delivery channel. Both is fine — email takes precedence. |
| Transmission deadline | **30 days** from sale to OFD | CloudPayments handles transmission. Storage on your side: keep `FiscalReceiptUrl` from Pay payload for audits. |

## Test mode

| Knob | Value |
|---|---|
| Test API key prefix | **`pk_test_*`** (Public ID) — verify in dashboard |
| Endpoint | **Identical** — `https://api.cloudpayments.ru` |
| Webhook flag | `TestMode: 1` in payload — drop or route separately in prod |
| Public test PANs (verify current list in dashboard) | `4242 4242 4242 4242` (Visa success), `5555 5555 5555 4444` (MC success), `4012 0010 3714 1112` (decline 5051), `4012 0010 3766 1118` (3DS required), `2200 0000 0000 0004` (МИР success) |
| CVV / expiry on test cards | any 3 digits / any future MM/YY |

## Notification source IPs (allowlist at Angie/Nginx/UFW)

Per docs (verified 2026-05-15):

```
185.98.81.0/28
87.251.91.160/27
46.46.175.96/27
46.46.168.160/27
162.55.174.97/32
91.216.178.243/32
```

Treat this list as supplementary, not primary auth — **HMAC verification is the source of truth**. IPs drift; check dashboard at every rotation.

## TLS

| Knob | Minimum |
|---|---|
| Webhook endpoint protocol | **HTTPS (TLS 1.2+)** |
| Cipher suites | per OS bundle; disable TLS 1.0 / 1.1 / SSL3 |

## Citation rule

Other files in this skill MUST NOT redefine these values inline. Use:

> Defaults: see [recommended-defaults.md](recommended-defaults.md).

## Last verified

2026-05-15 against `developers.cloudpayments.ru` (Russian docs) and `developers.cloudpayments.ru/en` (English docs). Notification Verification, Check Notification Response Codes, Subscription Statuses, /payments/{cards,tokens}/{charge,auth,post3ds}, /payments/refund, /payments/void, /subscriptions/{create,update,cancel} all cross-checked.

Source URLs:
- <https://developers.cloudpayments.ru/#uvedomleniya> — webhooks index
- <https://developers.cloudpayments.ru/#proverka-podlinnosti-uvedomleniy> — HMAC
- <https://developers.cloudpayments.ru/#kody-otveta-na-uvedomlenie-o-check> — Check codes
- <https://developers.cloudpayments.ru/#api> — REST endpoint index
- <https://my.cloudpayments.ru/> — merchant dashboard (notification source IPs there)
