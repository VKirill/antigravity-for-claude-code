# Recommended defaults — yookassa

Operational knobs for production YooKassa integrations. **All other files in this skill cite this table — do not redefine inline.** Source: synthesized from [yookassa.ru/developers](https://yookassa.ru/developers), `@a2seven/yoo-checkout` SDK, and field experience.

> Citation rule: when a recommendation depends on workload/account-tier, give a default + a range + a "tune up when..." / "tune down when..." condition. Cargo-culted defaults rot.

## Idempotency

| Knob | Default | Range | Tune-up when | Tune-down when | Why |
|---|---|---|---|---|---|
| `Idempotence-Key` format | UUID v4 | UUID v4 / business key | retries cross process boundaries (persist key in DB) | one-shot ephemeral retries are enough | YooKassa caches keys ~24h; collisions with different bodies return `400` |
| Key TTL on YooKassa side | 24h (server) | fixed by provider | — | — | Documented by YooKassa support |
| Key dedup window (your DB) | 24h | 1h–7d | high-volume retry surface (BullMQ + manual) | low-volume integration | Match or exceed YooKassa's TTL so your retries land on cache |
| Key scope | per (action, resource) — e.g. `pay-${orderId}`, `cap-${paymentId}`, `refund-${refundId}` | — | — | — | Different bodies under same key = `400`; same body + same key = cached response (safe to retry) |

## Re-fetch verification

| Knob | Default | Range | Tune-up when | Tune-down when | Why |
|---|---|---|---|---|---|
| Re-fetch timeout (HTTP GET `/v3/payments/{id}` after webhook) | 5s | 3s–15s | upstream YooKassa latency spikes (rare) | webhook handler SLO is tight | Webhook handler must answer 200 within 30s — leave budget for DB writes |
| Re-fetch retry on 404 | 3 attempts, 500ms/1s/2s backoff | 0–5 | webhook arrives before payment object is queryable (rare race) | strict latency SLO | YooKassa's webhook → API consistency is usually sub-second; brief race possible |
| Re-fetch on every webhook | YES — always | — | — | — | The webhook payload is not signed by default; the API call is authoritative |

## Webhook IP allowlist (verify quarterly)

Source: `https://yookassa.ru/developers/using-api/webhooks` ("IP-адреса для получения уведомлений" in dashboard → Integration → HTTP notifications).

Published ranges as of 2026-05-15 (re-verify each quarter — YooKassa publishes additions in `using-api/changelog`):

```
185.71.76.0/27
185.71.77.0/27
77.75.153.0/25
77.75.154.128/25
77.75.156.11/32
77.75.156.35/32
2a02:5180::/32
```

| Knob | Default | Why |
|---|---|---|
| Refresh cadence | Quarterly | YooKassa added `2a02:5180::/32` (IPv6) and `77.75.156.{11,35}` (Nov 2021) without API broadcast — only the [changelog page](https://yookassa.ru/developers/using-api/changelog) signals it |
| Enforce layer | Edge (Angie/Nginx/UFW) + application | Defense in depth — edge blocks bulk, app rejects with logged 403 for forensics |
| HTTPS required | YES — TCP port 443 or 8443 only, TLS 1.2+ | YooKassa rejects HTTP |

## Signing Secret HMAC (opt-in, 2024+ tiers)

| Knob | Default | When applicable |
|---|---|---|
| Header | `X-Yookassa-Signature: t=<unix_ts>,v1=<hex_hmac_sha256>` (Stripe-like) | Only on accounts where YooMoney manager enabled signing |
| Replay window | 5 minutes | Reject `Math.abs(now - t*1000) > 300_000` |
| Comparison | `crypto.timingSafeEqual` over equal-length Buffers | Avoid string equality timing leak |
| Fallback | IP allowlist + re-fetch still mandatory | Signing is additive defense; never the sole check |
| Format stability | Unstable — verify against current docs before going live | Header schema may evolve; YooMoney publishes in [release notes](https://yookassa.ru/developers/using-api/changelog) |

## Two-stage capture (hold window)

| Knob | Default | Range | Tune-up when | Tune-down when | Why |
|---|---|---|---|---|---|
| Hold window (auto-cancel after) | **7 days** for bank_card (issuer rule, YooKassa-enforced) | issuer-dependent; SBP/wallets vary | — | — | After expiry, payment auto-transitions to `canceled` with `expired_on_capture` reason |
| Capture deadline target | 24h after `payment.waiting_for_capture` | 1h–6d | manual fulfillment (marketplaces, made-to-order) | digital goods (use `capture: true` instead) | Long holds risk customer card churn / disputes |
| Capture idempotence key | `cap-${paymentId}` | — | — | — | Stable across retries within same payment lifecycle |

## Saved payment method TTL

| Knob | Default | Range | Notes |
|---|---|---|---|
| YooKassa-side validity | 3 years inactivity | provider-set | Customer or issuer can invalidate earlier |
| Application-side health check | Re-validate on each rebill via webhook outcome | — | Treat `card_expired`, `permission_revoked`, `payment_method_restricted` as triggers to prompt re-add |
| Method-type reuse | `bank_card` always reusable; `sbp_qr` reuse is newer/limited; `yoo_money` (wallet) reusable | — | Verify per-method support before relying |

## Recurring rebill schedule

| Knob | Default | Range | Tune-up when | Tune-down when | Why |
|---|---|---|---|---|---|
| Tick frequency (BullMQ scheduler) | every 1h | 10m–24h | high-resolution billing (per-hour SaaS) | monthly cycles only | Avoid tighter than 10m — issuer-side declines can ramp into rate-limit territory |
| Retry on `canceled` (non-terminal reason) | day 1, day 3, day 7 — then give up | — | — | — | Standard dunning ladder; aligns with card-network expectations |
| Terminal reasons (stop retrying) | `permission_revoked`, `fraud_suspected`, `payment_method_restricted` | — | — | — | Customer-initiated or issuer-blocked — further retries are wasted |
| Idempotence key per cycle | `sub-${subId}-cycle-${YYYY-MM}` | — | — | — | Same cycle retries reuse the same key — safe |

## 54-ФЗ receipt enums (FFD 1.2)

| Enum | Allowed values |
|---|---|
| `tax_system_code` | `1` ОСН · `2` УСН (доходы) · `3` УСН (доходы минус расходы) · `4` ЕНВД (deprecated post-2021) · `5` ЕСХН · `6` Патент |
| `vat_code` | `1` НДС не облагается · `2` НДС 0% · `3` НДС 10% · `4` НДС 20% · `5` НДС 10/110 (расч.) · `6` НДС 20/120 (расч.) |
| `payment_subject` | `commodity` · `excise` · `job` · `service` · `gambling_bet` · `gambling_prize` · `lottery` · `lottery_prize` · `intellectual_activity` · `payment` · `agent_commission` · `composite` · `property_right` · `non_operating_gain` · `sales_tax` · `resort_fee` · `another` (plus FFD 1.2 marked-goods variants) |
| `payment_mode` | `full_prepayment` · `partial_prepayment` · `advance` · `full_payment` · `partial_payment` · `credit` · `credit_payment` |
| `measure` (FFD 1.2 required) | `piece` · `gram` · `kilogram` · `ton` · `liter` · `meter` · `day` · `hour` · `kilowatt_hour` · `gigacalorie` · `kilobyte`/`megabyte`/`gigabyte`/`terabyte` · `another` · etc. |
| Required customer field | one of `customer.email` OR `customer.phone` (E.164 `79000000000`) | 

Common defaults:
- SaaS subscription (УСН доходы, instant delivery): `tax_system_code: 2`, `vat_code: 1`, `payment_subject: 'service'`, `payment_mode: 'full_payment'`, `measure: 'piece'` or `'another'`
- Physical goods (ОСН): `tax_system_code: 1`, `vat_code: 4` (20%) or `3` (10%), `payment_subject: 'commodity'`, `payment_mode: 'full_payment'`

## HTTP retry policy (outbound /v3 calls)

| Knob | Default | Range | Tune-up when | Tune-down when | Why |
|---|---|---|---|---|---|
| Attempts (state-changing POST) | 3 | 1–5 | flaky network, BullMQ-managed | strict latency budget | YooKassa's 5xx are usually transient; same `Idempotence-Key` ensures no duplicate side effects |
| Attempts (GET, read-only) | 5 | 3–10 | webhook re-fetch path under load | — | Reads are cheap; safe to retry harder |
| Backoff | exponential, base 1000ms, cap 10s, full jitter | — | — | — | Avoids retry storms across concurrent workers |
| Retryable HTTP codes | `408 429 500 502 503 504` + network errors | — | — | — | `4xx` other than `408/429` are deterministic — do not retry |
| Connection timeout | 5s | 3s–10s | high-latency networks | — | YooKassa edge is usually < 200ms RTT from RU/EU |
| Response timeout | 30s | 10s–60s | bulk operations (list calls with `limit=100`) | — | Single-payment ops complete well under 5s |

## Test shop credentials & sandbox

| Knob | Value | Notes |
|---|---|---|
| Sandbox base URL | `https://api.yookassa.ru/v3` (same as prod) | YooKassa uses key prefix to distinguish modes |
| Test secret key prefix | `test_xxxxxxxxxx` | Vs. `live_xxxxxxxxxx` for prod |
| Test mode flag in payloads | `object.test: true` | Filter on prod webhook receivers |
| Test cards | Documented in [dashboard](https://yookassa.ru/developers/payment-acceptance/testing-and-going-live/testing) — common: `5555 5555 5555 4477` success, `5555 5555 5555 4444` insufficient_funds, `4111 1111 1111 1968` 3-D Secure | — |
| 3-D Secure code | `123` | Or any 3 digits on test cards |

## Citation rule

Other files in this skill MUST NOT redefine these values inline. Use:

> Defaults: see [recommended-defaults.md](recommended-defaults.md).

## Last verified

2026-05-15 against:
- [yookassa.ru/developers/api](https://yookassa.ru/developers/api) (full API index)
- [yookassa.ru/developers/using-api/webhooks](https://yookassa.ru/developers/using-api/webhooks) (IP ranges + HTTP notifications config)
- [yookassa.ru/developers/using-api/changelog](https://yookassa.ru/developers/using-api/changelog) (IP additions history)
- [yookassa.ru/developers/payment-acceptance/receipts/54fz/other-services/parameters-values](https://yookassa.ru/developers/payment-acceptance/receipts/54fz/other-services/parameters-values) (receipt enums)
- `@a2seven/yoo-checkout@1.1.4` (`YooCheckout` class signature)

Re-pull quarterly. Special trigger to re-verify: any line in YooKassa changelog mentioning "IP", "notification", "signing", or "webhook".
