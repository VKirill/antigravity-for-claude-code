# Recommended defaults — telegram-bot

Canonical operational values for Telegram bots (grammY 1.x, Bot API 10.0, Node.js 24). **All other files in this skill cite this table — do not redefine inline.** Source: grammy.dev docs, core.telegram.org/bots/api, and operational experience with production bots.

> Citation rule: when a recommendation depends on workload, give a default + a range + "tune-up when…" / "tune-down when…" + Why. Cargo-culting defaults is worse than no defaults.

---

## Framework choice

| Knob | Default | Range | Tune-up when | Tune-down when | Why |
|---|---|---|---|---|---|
| Framework | **grammY 1.x** | grammY only | every TS Telegram bot project as of 2026 | — | Sole production-supported framework. Full Bot API 10.0 coverage, first-class TS via context flavors, active plugin ecosystem. |
| Language | **TypeScript 5.9** | — | — | — | grammY ships types; runtime payloads from Telegram are dynamic — TS at boundary prevents whole class of bugs. |
| Runtime | **Node.js 24 LTS** | Node 22 LTS / Deno / Cloudflare Workers | edge deployment needed | enterprise on 22 LTS only | Node 24 is Active LTS through Apr 2027. |

---

## Update delivery — webhook vs long polling

| Mode | Use when | Avoid when |
|---|---|---|
| **Webhook** (production default) | Public HTTPS server available, expect > 1 msg/sec, scale > 1 instance | Local dev without tunnel, low-volume bot (≤ 1 msg/min) where polling is simpler |
| **Long polling** | Development, single-server low-volume deploys, no public IP, behind corporate NAT | Production with > 100 msg/sec, multi-instance deployments (only one process may poll at a time) |
| **Concurrent long polling** (`@grammyjs/runner`) | Long-polling production with throughput > 5 msg/sec; ≤ 1 instance | Webhook setups (Telegram already parallelises) |

Webhook requirements (Telegram-enforced):
- HTTPS only with valid TLS chain (no self-signed without `certificate` upload)
- Port **443, 80, 88, or 8443** ONLY — other ports are rejected
- Public URL reachable from Telegram edge

---

## Webhook `secret_token` validation

| Knob | Default | Why |
|---|---|---|
| Secret length | **64 chars** (alphanumeric + `_` + `-`) | Telegram allows 1–256 chars matching `[A-Za-z0-9_-]`. 64 gives 384 bits of entropy. |
| Header name | **`X-Telegram-Bot-Api-Secret-Token`** | Set by Telegram on every webhook POST. |
| Validation timing | **Before reading body / any middleware** | Reject early; non-matching = 401. |
| Comparison | **`crypto.timingSafeEqual` on equal-length Buffers** | Constant-time; prevents per-byte timing leaks. |
| Storage | **env var `WEBHOOK_SECRET`** | Never in code. Rotate via `setWebhook` to new secret + deploy in single window. |

NOT an HMAC over the body (unlike CloudPayments / YooKassa). Telegram simply echoes the static secret in the header.

---

## Bot API HTTP client

| Knob | Default | Range | Tune-up when | Tune-down when |
|---|---|---|---|---|
| Base URL | `https://api.telegram.org` | self-hosted Bot API server | high-throughput bot (offload TLS handshake) | n/a |
| HTTP version | **HTTP/1.1 keep-alive** | HTTP/2 if self-hosted Bot API server | — | grammY uses `node-fetch`-equivalent under the hood; HTTP/1.1 sufficient |
| Connection pool | **Reuse default Node keep-alive agent** | custom `Agent` with `keepAliveMsecs: 30000` | > 50 req/s sustained | rare; per-request connection is fine for <10 req/s |
| `apiRoot` retry on 5xx / network | **`@grammyjs/auto-retry` (default backoff)** | — | 429 storms | — |
| Per-request timeout | **30 s** | 10–60 s | uploading large files | — |

---

## Concurrency model

| Knob | Default | Range | Tune-up when | Tune-down when | Why |
|---|---|---|---|---|---|
| `sequentialize` key | **`ctx.chat?.id.toString()`** (or `[chat, user]`) | — | conversations spanning multiple chats | — | Must match session key. Telegram guarantees same-chat updates arrive in order; sequentialize lets you keep that guarantee during concurrent processing. |
| Runner `process.concurrency` | **200** | 50–500 | bot is mostly I/O-bound (waiting on DB / external APIs) | bot CPU-bound (image processing, LLM inference) | grammY Runner default is 500; lower if processing is heavy. |
| Per-user rate limit (`@grammyjs/ratelimiter`) | **3 updates / 2 s** | 1–10 / 1–10 s | abuse-prone public bot | private bot with trusted users | Protects bot from a single user flooding. |
| Webhook server workers | **1** (long polling) / **`pm2: instances: max`** (webhook) | — | — | — | Long polling: only one process may call `getUpdates` per bot token. Webhook: any number of instances can serve. |

`sequentialize` MUST be installed **before** `session` middleware. Order: `sequentialize → session → conversations → handlers`.

---

## Session storage

| Storage | Use when | Avoid when |
|---|---|---|
| **MemorySessionStorage** (default) | Dev only, throwaway bot, single-process | Production, multi-instance, any state you care about |
| **FileAdapter** (`@grammyjs/storage-file`) | Single-server prod with < 10k users, low write volume | Multi-instance, > 10k users, high write throughput |
| **RedisAdapter** (`@grammyjs/storage-redis`) | **Multi-instance prod (default)**, > 10k users, high concurrency | Edge runtime without Redis access |
| Postgres-backed (custom adapter) | Persistence-critical (audit trail), already running Postgres | Latency-sensitive (Redis is faster) |

Session TTL: wrap with `enhanceStorage({ millisecondsToLive: 30 * 24 * 3600 * 1000 })` for 30-day expiry (good default for user sessions).

---

## Mini App `initData` validation

| Knob | Default | Why |
|---|---|---|
| Hash algorithm | **HMAC-SHA256** | Telegram-specified. |
| Secret key derivation | **`HMAC_SHA256("WebAppData", bot_token)`** (key = literal string `WebAppData`, message = bot token) | Per `core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app`. |
| Data check string | **sorted `key=value\n…`** (excluding `hash`) | URL-decoded values, newline-joined, alphabetical by key. |
| Comparison | **`crypto.timingSafeEqual` on equal-length Buffers** | Constant-time. |
| `auth_date` TTL | **24 h** (Telegram-enforced; ≤ 24h required for trust window) | Reject if `now - auth_date > 86400`. Configurable 1–24h depending on threat model. |
| Third-party launch | **Ed25519 signature** (different format — `<bot_id>:WebAppData\n` + sorted fields) | Bot API 8.0+: when Mini App opened outside the bot's chat. |

**ALWAYS** re-validate `initData` server-side on every request. `tg.initDataUnsafe` is client-controlled and MUST NOT be trusted.

---

## Payments — Stars (XTR)

| Knob | Default | Range | Why |
|---|---|---|---|
| Currency code | **`"XTR"`** | — | Stars-only. No `provider_token` needed. |
| Amount unit | **Whole Stars (integer)** | 1 – 10000 per item | NOT minor units like cents. `[{ label: "Premium", amount: 250 }]` = 250 Stars. |
| `pre_checkout_query` response window | **≤ 10 s** | hard Telegram limit | Miss the window → transaction silently cancelled. Always `answerPreCheckoutQuery(true)` unless you must reject. |
| Idempotency key (grant on `successful_payment`) | **`telegram_payment_charge_id`** | — | Unique per Telegram transaction. Store in `processed_payments(charge_id PK)`. INSERT on conflict NOTHING before granting. |
| Refund window | **30 days** from `successful_payment` | hard Telegram limit | `refundStarPayment(user_id, telegram_payment_charge_id)` silently no-ops after window. |
| Stars subscription period | **2592000 s (30 days)** | only Telegram-supported period | `subscription_period: 2592000` in `sendInvoice`. Telegram bills user automatically. |

---

## Payments 2.0 — fiat (provider tokens)

| Knob | Default | Why |
|---|---|---|
| Currency code | **ISO 4217** (`"USD"`, `"EUR"`, `"RUB"`) | NOT `"XTR"`. |
| Amount unit | **smallest currency unit (kopecks/cents)** | `{ label: "Widget", amount: 999 }` = $9.99 USD. |
| `provider_token` | from BotFather → `/mybots → Payments → Set provider` | One token per provider. Stripe test token usable for test bots. |
| `pre_checkout_query` validation | **Validate inventory, idempotency, price match** | NEVER grant access in `pre_checkout_query` — only validate. Grant in `successful_payment`. |
| Idempotency | **`provider_payment_charge_id`** (provider's txn ID) OR **`telegram_payment_charge_id`** | Use Telegram's ID for cross-provider consistency. |

---

## Business connections (Bot API 7.0+)

| Knob | Default | Why |
|---|---|---|
| Update type subscription | **`business_connection` + `business_message`** in `allowed_updates` | Filtered out by default. |
| Per-message scope | **`message.business_connection_id`** | Carries the connection that owns the message. |
| Token scope | **business connection token** (different from Bot token) | Use `getBusinessConnection(id)` to retrieve. |
| Permission check | **`BusinessConnection.can_reply` AND `is_enabled`** | Both must be true before replying. |

---

## File upload size limits (Telegram-enforced)

| Operation | Limit |
|---|---|
| Bot upload (any file via `sendDocument`/`sendVideo`/etc.) | **50 MB** |
| Bot upload via business connection | **2 GB** |
| Bot download via `getFile` | **20 MB** |
| Photo via URL | **5 MB** |
| `file_id` validity for re-use | **forever** (until user/chat deletes original) |
| `getFile` `file_path` validity | **≥ 1 h** |

Workaround for > 50 MB: link to external storage (S3/R2) instead of uploading.

---

## Inline query throttling

| Knob | Default | Why |
|---|---|---|
| Telegram-side rate | **1 inline_query per second per user** | Hard limit. Cache results aggressively. |
| `answerInlineQuery` `cache_time` | **300 s** (5 min) | Reduces repeat queries. Lower (e.g. 0) only when results are user-specific. |
| `is_personal` | **`true`** when results depend on user | Required for per-user caching. |

---

## Outgoing message rate limits (Telegram-enforced)

| Limit | Value |
|---|---|
| Same chat | **1 msg/sec** |
| Different chats (broadcast) | **30 msgs/sec** globally per bot |
| Bulk to same group | **20 msgs/min** |

Use `@grammyjs/transformer-throttler` to auto-throttle outgoing API calls.

---

## Webhook retry budget (Telegram → your server)

| Knob | Behavior | Notes |
|---|---|---|
| Retry count | **Telegram retries on 5xx for ~24 h** with exponential backoff | Don't rely on it — drains `pending_update_count`. |
| Webhook handler timeout | **≤ 60 s** (Telegram-side) | Drops if exceeded. Best practice: ≤ 5 s, offload to BullMQ. |
| Webhook auto-disable | **after sustained 5xx** | Re-enable in BotFather or via `setWebhook` again. |
| Hard fail on 4xx | **Telegram does NOT retry 4xx** (except 429) | Return 401 from secret_token mismatch — Telegram won't flood retries. |

---

## Allowed updates filter

ALWAYS filter `allowed_updates` to ONLY types your bot handles. Defaults exclude `chat_member`, `chat_join_request`, `message_reaction*`, `chat_boost*`, `business_*` — explicitly include if needed.

```ts
allowed_updates: [
  "message",
  "edited_message",
  "callback_query",
  "pre_checkout_query",
  "successful_payment",
  // include only what you handle
]
```

---

## Bot token rotation procedure

1. BotFather → `/mybots` → select bot → API Token → `Revoke current token`
2. Receive new token
3. Update `BOT_TOKEN` env var across all instances + secret store
4. Reload (NOT restart) bot processes — PM2 `pm2 reload`
5. If on webhook: call `setWebhook(url, { secret_token: NEW_SECRET })` with NEW token client
6. Verify with `getMe()` from new token; revoke not reversible

Old token instantly invalidated server-side. Plan a maintenance window — there is a brief gap.

---

## Citation rule

Other files in this skill MUST NOT redefine these values inline. Use:

> Defaults: see [recommended-defaults.md](recommended-defaults.md).

---

## Last verified

**2026-05-15** against `grammy.dev` (grammY 1.x — current stable), `core.telegram.org/bots/api` (Bot API 10.0, May 8 2026).

Source URLs:
- <https://core.telegram.org/bots/api> — Bot API reference
- <https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app> — initData HMAC spec
- <https://core.telegram.org/bots/payments> — Payments 2.0
- <https://core.telegram.org/bots/payments/stars> — Stars XTR
- <https://grammy.dev/advanced/scaling> — sequentialize, runner
- <https://grammy.dev/plugins/conversations> — versioning, external
- <https://grammy.dev/ref/core/webhookcallback> — secretToken
