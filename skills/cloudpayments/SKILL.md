---
name: cloudpayments
description: "[RU: интеграция CloudPayments — карты, СБП, рекуррент, 54-ФЗ] CloudPayments Russian payment gateway — REST API, JS widget, webhook handlers (Check/Pay/Fail/Refund/Recurrent), HMAC-SHA256 Content-HMAC verification, токенизация, рекуррентные подписки, СБП, 54-ФЗ CustomerReceipt. Use when: cloudpayments, cp.charge, /payments/cards/charge, /payments/tokens/charge, widget.pay, Content-HMAC, Pay-уведомление, CustomerReceipt. SKIP: YooKassa/Tinkoff/Stripe/Robokassa (use respective skill); 54-ФЗ without CloudPayments (→fiscalization); generic HMAC webhook (→nodejs)."
stacks:
  - cloudpayments
  - russian-payments
  - nodejs
  - typescript
packages:
  - cloudpayments
  - "@cloudpayments/checkout"
tags:
  - payments
  - russian-payments
  - cloudpayments
  - 54-fz
  - fiscalization
  - subscriptions
  - sbp
  - webhook
  - hmac
manifests:
  - package.json
source: vechkasov-global-skills
risk: high-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- Node.js: `24.x (Active LTS)`
- TypeScript: `6.0.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded automatically when its description matches the active task. Read only the section you need, then follow the link to the relevant reference file for full detail.

## Use this skill when

- Building a CloudPayments checkout — embedding the JS widget (`cp.CloudPayments`) or calling REST API directly
- Implementing server-to-server charge: `/payments/cards/charge`, `/payments/tokens/charge`, two-step auth (`/payments/cards/auth` + `/payments/confirm`)
- Setting up the four merchant webhooks: Check / Pay / Confirm / Fail / Refund / Recurrent
- Verifying `Content-HMAC` (or `X-Content-HMAC`) header on webhook requests — HMAC-SHA256 with API Secret over raw body, base64-encoded
- Building recurrent payments: subscription plans (`/subscriptions/create`, `/subscriptions/update`, `/subscriptions/cancel`) or manual rebill via saved token
- Generating 54-ФЗ fiscal receipts (`CustomerReceipt` object — `Items`, `taxationSystem`, `email`/`phone`, `Vat`, `method`, `object`)
- Handling Russian payment methods: bank card, СБП (Система быстрых платежей), Tinkoff Pay, SberPay, MIR Pay
- Working with refund flow (`/payments/refund`, `/payments/void`) and partial refunds
- Integrating CloudPayments with a Telegram bot (Telegram Stars is separate — this is the merchant Mini App / WebApp flow)
- Resolving 3-D Secure flows — handling `Need3ds` responses and ACS redirect
- Migrating from a sandbox key to production — keys, IP whitelist (notification gates), test cards

## Do not use this skill when

- Task is YooKassa / ЮKassa / Tinkoff / Stripe / Robokassa / Tochka payment integration — use the respective skill
- Task is purely about 54-ФЗ fiscalization with another OFD/provider — use `fiscalization` (cascade marker)
- Task is generic webhook handling without HMAC signature verification — use `nodejs` (webhook patterns) instead
- Task is Telegram Stars / XTR / Telegram Payments 2.0 native — use `telegram-bot` (Stars are NOT CloudPayments)
- Task is wallet-style consumer P2P transfers — CloudPayments is a merchant gateway, not a wallet

## Purpose

CloudPayments is one of the dominant Russian payment gateways (alongside ЮKassa и Tinkoff Касса), used heavily by Russian e-commerce, subscription services, fintech, and donation platforms. Its differentiator: a strong customizable JS widget for in-page checkout (no redirect), full-featured REST API for server-side flows, native СБП / Tinkoff Pay / SberPay support, and built-in 54-ФЗ fiscal receipt generation through the merchant's OFD account.

This skill covers the merchant integration path end-to-end: widget initialization, two- vs one-step payments, tokenization for recurrent billing, the six webhook gates (Check is the most important — it gates the charge), HMAC signature verification, error code semantics (`CardExpired`, `InsufficientFunds`, `Need3ds`, decline reasons), 54-ФЗ receipt payload shape, СБП-specific behavior, and recurrent subscription primitives. The skill owns the **payment-domain knowledge**; the runtime skill (`nodejs`, `fastify`, `hono`) owns the HTTP plumbing.

CloudPayments is a Russian MoR (Merchant of Record); business operates under Russian tax law (НДС, ОСН/УСН), uses ЦБ official exchange rates for FX, and reports to OFD (Operator Fiscal Data) per 54-ФЗ.

## Capabilities

### Widget integration (in-page checkout)

Embed `https://widget.cloudpayments.ru/bundles/cloudpayments.js`, instantiate `cp.CloudPayments({ publicId })`, call `widget.pay(scheme, options, callbacks)`. Two payment schemes: `'charge'` (one-step, money debited immediately) and `'auth'` (two-step, hold then capture). Widget handles card UI, 3-D Secure ACS redirect, СБП QR/deep-link generation, and returns the transaction outcome via callbacks (`onSuccess`, `onFail`, `onComplete`). Pass `data` to embed metadata that flows through to webhook notifications.

> Full reference: [references/api-overview.md](references/api-overview.md), [references/payments-flow.md](references/payments-flow.md)

### REST API — direct charges

Base URL: `https://api.cloudpayments.ru`. Auth: HTTP Basic with `publicId` (username) + `apiSecret` (password). Key endpoints: `/payments/cards/charge` (charge by raw card cryptogram from widget tokenization), `/payments/tokens/charge` (charge by saved token), `/payments/cards/auth` (hold), `/payments/confirm` (capture), `/payments/void` (release hold), `/payments/refund` (refund), `/payments/get` (fetch state), `/payments/find` (by InvoiceId). All requests are JSON POST. Amounts in major units (rubles, not kopecks), strings allowed, `Currency: "RUB"`.

> Full reference: [references/api-overview.md](references/api-overview.md)

### Webhooks — six gates

CloudPayments calls merchant endpoints for: **Check** (gate before charge — return `{code: 0}` to allow, anything else to reject), **Pay** (success — must idempotently mark order paid), **Confirm** (two-step capture committed), **Fail** (decline reason in `Reason`/`ReasonCode`), **Refund** (refund executed), **Recurrent** (subscription state change). Each request body is x-www-form-urlencoded or JSON depending on dashboard setting. Response shape: `{code: 0}` for success, non-zero rejects (Check) or signals retry. Idempotency by `TransactionId`.

> Full reference: [references/webhooks.md](references/webhooks.md)

### HMAC signature verification

Every webhook request carries a `Content-HMAC` header (legacy: `X-Content-HMAC`) — HMAC-SHA256 of the raw request body using the merchant's API Secret as the key, base64-encoded. Verify with `crypto.timingSafeEqual` to prevent timing attacks. Read the raw body BEFORE any JSON parsing — body-parser middleware that consumes the stream breaks signature math. Whitelist CloudPayments IPs at the firewall/Angie layer as defence-in-depth (published in dashboard).

> Full reference: [references/webhooks.md](references/webhooks.md), [references/security-pci.md](references/security-pci.md)

### Recurrent payments & tokenization

After the first charge (or 1 RUB auth probe), CloudPayments returns a `Token` — a card surrogate stored on their side. Use `/payments/tokens/charge` for server-driven rebill. For automated subscriptions: `/subscriptions/create` defines a plan (Interval=Month/Week/Day, Period, MaxPeriods, Amount, StartDate); CloudPayments fires `Recurrent` webhook on each cycle. `/subscriptions/update` and `/subscriptions/cancel` manage lifecycle. PCI scope stays at CloudPayments — merchant never sees raw PAN.

> Full reference: [references/recurring-subscriptions.md](references/recurring-subscriptions.md)

### 54-ФЗ fiscalization (CustomerReceipt)

To issue a fiscal receipt (чек) per Federal Law 54-ФЗ, attach a `CustomerReceipt` object to the charge request (or include via widget `data`). Shape: `{ Items: [{Label, Price, Quantity, Amount, Vat, Method, Object}], taxationSystem: 0..5, email | phone, isBso, AgentSign, AmountsHelp }`. `Vat` values: `null` (НДС не облагается) | `0` | `10` | `20`. `Method` (sign of method of calculation): `1..7`. `Object` (sign of subject of calculation): `1..13`. CloudPayments transmits to OFD; merchant gets fiscal data in `Pay` webhook.

> Full reference: [references/fiscalization-54fz.md](references/fiscalization-54fz.md)

### Refunds and voids

Two-step auth not yet captured → `/payments/void` (releases hold, no money moved). Captured/single-step charge → `/payments/refund` with `Amount` (full or partial). Refunds also require a `CustomerReceipt` if the original payment had one — chequed return per 54-ФЗ. Refund triggers `Refund` webhook. Multiple partial refunds allowed up to original `Amount`.

> Full reference: [references/refunds.md](references/refunds.md)

### Security & PCI scope

Merchant integration is PCI DSS SAQ A-EP (widget) or SAQ A (full hosted) — no raw PAN ever touches merchant servers. Cryptograms from widget are one-time. API Secret is server-only — never ship to browser. Use HTTPS-only callbacks, restrict webhook source IPs, verify HMAC, log replays without persisting secrets. Test mode uses a separate test API key + magic test card numbers (e.g., `4242 4242 4242 4242`, `5555 5555 5555 4444`).

> Full reference: [references/security-pci.md](references/security-pci.md)

### Testing

Test environment uses identical API at `https://api.cloudpayments.ru` with test-mode keys. Test cards in the docs trigger specific outcomes (success, decline, 3-D Secure required, expired). Webhook testing: use a tunneling tool (ngrok / cloudflared) to expose local handlers, or test against staging server with public hostname. Always test the Check webhook returning non-zero — easy to forget the rejection path.

> Full reference: [references/testing.md](references/testing.md)

## Behavioral Traits

- Reads the raw request body BEFORE JSON parsing on webhook routes — uses Fastify's `addContentTypeParser` or Express raw body middleware
- Verifies `Content-HMAC` with `crypto.timingSafeEqual` against the computed base64 digest, treats `X-Content-HMAC` as legacy fallback
- Stores `TransactionId` (CloudPayments unique txn ID) AND merchant `InvoiceId` — uses TransactionId as the idempotency key
- Treats Check webhook as a gate: validates internal order state, returns `{code: 0}` only when order is in `pending_payment` AND amount/currency match
- Never trusts client-supplied amount on the `Pay` webhook — recomputes from the order in the DB and verifies the match
- Stores `Token` securely keyed to a user, NEVER to a single order — same token re-used for future rebills
- Sends `CustomerReceipt.email` or `CustomerReceipt.phone` (one is required) per 54-ФЗ
- Logs `Reason` AND `ReasonCode` on Fail webhook for support escalation
- Uses one publicId per environment (test vs prod) and rotates API Secret if exposed
- Validates webhook payload shape with Zod schema before downstream business logic

## Important Constraints

- NEVER skip HMAC verification on webhook handlers — public endpoint without auth lets anyone forge `Pay` calls
- NEVER parse JSON body before computing HMAC — middleware that buffers/transforms the stream invalidates the signature
- NEVER store raw PAN, CVV, or card cryptogram — keep PCI scope at SAQ A-EP via widget
- NEVER trust amount/currency from the webhook payload alone — cross-check against the order record by `InvoiceId`
- NEVER hardcode API Secret in source; load from env, rotate on leak
- NEVER use the same `InvoiceId` twice — CloudPayments doesn't enforce uniqueness server-side but you must enforce it client-side for reconciliation
- ALWAYS implement Check webhook idempotently — CloudPayments may retry on timeout (>30s)
- ALWAYS return HTTP 200 with `{code: 0}` from successful Pay webhook — non-200 triggers retries
- ALWAYS attach `CustomerReceipt` on refunds if the original payment had one (54-ФЗ requirement)
- ALWAYS test the decline path AND the 3-D Secure interrupted path before production

## Related Skills

**90%-filter applied** — mainstream 2026 choices used in >30% of Russian e-commerce / SaaS projects.

### Runtime
- ✓ `nodejs` — Node 24 (primary runtime for webhook receiver and API caller)
- ✓ `typescript` — TS 5.9 (default for new projects; types for SDK + payload schemas)

### Web frameworks (own the request lifecycle)
- ✓ `nextjs` — Next.js 16 (App Router route handler for widget + webhook receiver; React widget mount)
- ✓ `react` — React 19 (widget embedded into a React form)
- ✓ `fastify` — Fastify 5 (raw-body parser pattern is canonical) 
- ✓ `hono` — Hono 4 (raw body via `c.req.raw.text()` for HMAC) 

### Validation
- ✓ `zod` — Zod 4 (validate webhook payloads, widget options, CustomerReceipt shape)

### Deploy & ops
- ✓ `linux-sysadmin` — Ubuntu 24.04 + Angie/Nginx (TLS termination, IP allowlist for webhook source)

### Domain app
- ✓ `telegram-bot` — Telegram bots accepting Russian-card payments via CloudPayments Widget (Mini App)

### Persistence & queues
- ✓ `prisma` — Prisma 7 (order/transaction persistence; idempotency tracking) 
- ✓ `redis` — Redis 8 (idempotency cache for `TransactionId`, dedupe webhook retries) 
- ✓ `bullmq` — BullMQ 5 (retry queue for failed downstream actions after `Pay`) 

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| API overview — base URL, auth, endpoints, response shape, error codes | [references/api-overview.md](references/api-overview.md) |
| Payment flow — widget vs REST, one-step vs two-step, 3-D Secure, СБП, Tinkoff Pay | [references/payments-flow.md](references/payments-flow.md) |
| Webhooks — Check / Pay / Confirm / Fail / Refund / Recurrent, payload shape, response codes | [references/webhooks.md](references/webhooks.md) |
| 54-ФЗ fiscalization — CustomerReceipt, taxationSystem, Vat/Method/Object enums, OFD flow | [references/fiscalization-54fz.md](references/fiscalization-54fz.md) |
| Recurring & subscriptions — tokenization, `/subscriptions/*`, manual rebill, Recurrent webhook | [references/recurring-subscriptions.md](references/recurring-subscriptions.md) |
| Refunds — void vs refund, partial refund, 54-ФЗ on refund | [references/refunds.md](references/refunds.md) |
| Security & PCI scope — HMAC verification, IP allowlist, key rotation, test cards | [references/security-pci.md](references/security-pci.md) |
| Testing — sandbox keys, test cards, tunneling, fixture payloads | [references/testing.md](references/testing.md) |
| **Recommended defaults** — HMAC timing-safe, idempotency window, HTTP retry, 3DS timeout, 54-ФЗ enums | [references/recommended-defaults.md](references/recommended-defaults.md) |
| **Troubleshooting** — symptom-indexed: HMAC fails, Check rejected, Pay missing, duplicates, 3DS stuck, recurring fails, 54-ФЗ rejected, sandbox/prod confusion, IP drift | [references/troubleshooting.md](references/troubleshooting.md) |
| Eval cases — routing tests (positive + negative + edge) | [references/eval-cases.md](references/eval-cases.md) |

### Templates

| Template | File |
|---|---|
| Minimal Node + Fastify webhook receiver with HMAC verification | [templates/webhook-fastify.ts.template](templates/webhook-fastify.ts.template) |
| Minimal Node + Express raw-body HMAC verifier | [templates/webhook-express.ts.template](templates/webhook-express.ts.template) |
| REST API charge by token (server-side rebill) | [templates/charge-by-token.ts.template](templates/charge-by-token.ts.template) |
| 54-ФЗ CustomerReceipt builder helper | [templates/customer-receipt.ts.template](templates/customer-receipt.ts.template) |

### Examples

| Scenario | File |
|---|---|
| Successful one-time payment via widget (front + server confirm) | [examples/one-time-payment.md](examples/one-time-payment.md) |
| Recurring subscription with `/subscriptions/create` and Recurrent webhook | [examples/recurring-subscription.md](examples/recurring-subscription.md) |

**How to use**: open only the topic file relevant to the current task. Webhook work → `webhooks.md` + `security-pci.md`. Subscription work → `recurring-subscriptions.md`. New integration → `api-overview.md` + `payments-flow.md`.
