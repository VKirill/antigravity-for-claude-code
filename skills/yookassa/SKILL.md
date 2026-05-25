---
name: yookassa
description: "[RU: интеграция ЮKassa] YooKassa by ЮMoney — API v3, Checkout.js widget, payment lifecycle (pending→waiting_for_capture→succeeded), Idempotence-Key, webhook IP-allowlist + payment re-fetch, saved methods, 54-ФЗ receipt. Use when: yookassa, юкасса, @a2seven/yoo-checkout, /v3/payments, /v3/refunds, /v3/payment_methods, /v3/receipts, Idempotence-Key, save_payment_method, payment_method_id, vat_code, payment_subject, СБП, SberPay. SKIP: CloudPayments/Tinkoff/Stripe/Robokassa (use respective skill); YooMoney P2P (→yoomoney); bank-direct СБП (→sbp)."
stacks:
  - yookassa
  - russian-payments
  - nodejs
  - typescript
packages:
  - "@a2seven/yoo-checkout"
  - "@appigram/yookassa-node"
tags:
  - payments
  - russian-payments
  - yookassa
  - yoomoney
  - 54-fz
  - fiscalization
  - subscriptions
  - sbp
  - webhook
  - idempotence
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

- Building a YooKassa / ЮKassa checkout — embedding Checkout.js widget or calling REST v3 directly
- Creating a payment with `POST /v3/payments` — passing `Idempotence-Key`, `confirmation`, `amount`, `receipt`, `metadata`
- Implementing two-stage payments (`capture: false` → `POST /v3/payments/{id}/capture`) for marketplaces / pre-orders
- Setting up webhooks for `payment.succeeded`, `payment.canceled`, `payment.waiting_for_capture`, `refund.succeeded`
- Verifying webhook authenticity via IP allowlist + re-fetching the payment by ID (`GET /v3/payments/{id}`)
- Saving a payment method for one-click rebill (`save_payment_method: true` → `payment_method.id` → reuse via `payment_method_id`)
- Building recurring subscriptions on top of saved payment methods (no built-in subscription API — merchant orchestrates schedule)
- Building 54-ФЗ fiscal receipts using YooKassa's `receipt` object (`vat_code`, `payment_subject`, `payment_mode`, `tax_system_code`)
- Handling Russian payment methods: `bank_card`, `sbp`, `sberbank`, `tinkoff_bank`, `yoo_money`, `mobile_balance`, `cash`, `sber_loan`
- Issuing refunds via `POST /v3/refunds` with attached `receipt` for 54-ФЗ
- Working with `@a2seven/yoo-checkout` SDK (`YooCheckout` class) or constructing raw HTTPS calls

## Do not use this skill when

- Task is CloudPayments / Tinkoff Касса / Stripe / Robokassa / Tochka — use the respective skill
- Task is YooMoney consumer wallet (P2P transfers, not merchant checkout) — `yoomoney` (cascade marker)
- Task is bank-direct СБП QR generation without YooKassa intermediary — `sbp` (cascade marker)
- Task is 54-ФЗ fiscalization with another OFD/provider unrelated to YooKassa — `fiscalization` (cascade marker)
- Task is Telegram Stars / XTR / native Telegram Payments 2.0 — `telegram-bot`

## Purpose

YooKassa (ЮKassa, formerly Yandex.Checkout, owned by Сбер/ЮMoney) is the largest Russian payment gateway by transaction volume. Differentiators: clean REST v3 API with strong idempotency primitives (every state-changing call carries `Idempotence-Key`), stable payment state machine (`pending` → `waiting_for_capture` → `succeeded`/`canceled`), broad Russian payment method coverage (cards, СБП, SberPay, Tinkoff Pay, YooMoney wallet, mobile balance, cash via terminals, Sber Loan BNPL), Checkout.js embedded widget plus hosted page option.

This skill owns the **payment-domain knowledge**: payment lifecycle, four core webhook events, the `receipt` object for 54-ФЗ, saved methods as the recurring primitive, idempotency semantics, refund flow with `receipt`, СБП handling, and the security model (IP allowlist + re-fetch verification — YooKassa does NOT use HMAC on webhooks by default; opt-in Signing Secret available 2024+ for select tiers). HTTP plumbing belongs to the runtime skill (`nodejs`, `fastify`, `nextjs`).

YooKassa charges through ЮMoney НКО (Merchant of Record under Russian tax law); ОФД transmission is automatic when `receipt` is included.

## Capabilities

Each line below points to the canonical reference. The reference owns code, edge cases, and gotchas — do not duplicate them here.

- **API overview** — base URL `https://api.yookassa.ru/v3`, HTTP Basic auth (`shopId`:`secretKey`), `Idempotence-Key` on every POST. → [api-overview.md](references/api-overview.md)
- **Payment flow** — widget vs hosted page vs direct API; state machine; two-stage capture; СБП, SberPay, Tinkoff Pay. → [payments-flow.md](references/payments-flow.md)
- **Webhooks** — four events (`payment.succeeded`/`canceled`/`waiting_for_capture`, `refund.succeeded`); IP allowlist + re-fetch as canonical auth. → [webhooks.md](references/webhooks.md)
- **Idempotency** — UUID v4 per logical action; same key + different body → 400; cached ~24h. → [api-overview.md](references/api-overview.md)
- **Saved payment methods (recurring)** — `save_payment_method: true` → `payment_method.id` → reuse via `payment_method_id`. Merchant owns schedule. → [recurring-subscriptions.md](references/recurring-subscriptions.md)
- **54-ФЗ fiscalization** — `receipt` object, `vat_code` (1–6), `payment_subject`, `payment_mode`, `tax_system_code` (1–6). → [fiscalization-54fz.md](references/fiscalization-54fz.md)
- **Refunds** — `POST /v3/refunds` with matching `receipt`; full/partial; `refund.succeeded` webhook. → [refunds.md](references/refunds.md)
- **Security & PCI** — SAQ A / A-EP, IP allowlist, re-fetch, opt-in Signing Secret HMAC-SHA256. → [security-pci.md](references/security-pci.md)
- **Testing** — test shop credentials, test cards, tunneling, sandbox base URL. → [testing.md](references/testing.md)
- **API endpoints cheatsheet** — every documented endpoint with source URL. → [api-endpoints-cheatsheet.md](references/api-endpoints-cheatsheet.md)
- **Recommended defaults** — canonical Idempotence-Key strategy, IP allowlist refresh, retry policy, capture window, receipt enums. → [recommended-defaults.md](references/recommended-defaults.md)
- **Troubleshooting** — IP allowlist drift, webhook re-fetch races, idempotence collisions, expired saved methods, СБП delivery, 54-ФЗ errors, signature mismatch. → [troubleshooting.md](references/troubleshooting.md)

## Behavioral Traits

- Always passes a fresh UUID v4 in `Idempotence-Key` for every state-changing POST; stores it keyed to the action so retries reuse it
- Verifies webhooks by re-fetching `GET /v3/payments/{id}` and trusting THAT, not the webhook body
- Checks the source IP against the published YooKassa allowlist on every webhook (defense-in-depth above edge-level firewall)
- Saves `payment_method.id` (not raw card data) for recurring use
- Uses `capture: true` only when fulfillment is immediate (digital goods); two-stage with `capture: false` otherwise
- Sends `customer.email` OR `customer.phone` in every `receipt` (54-ФЗ requirement)
- Attaches a `receipt` to refund requests if the original had one
- Validates webhook body shape with Zod but does NOT trust it for state — that is the re-fetch's job
- Treats `confirmation_token` as one-time and short-lived; does not persist it past the widget lifetime
- Uses values from [recommended-defaults.md](references/recommended-defaults.md) — no inline magic numbers

## Important Constraints

- NEVER omit `Idempotence-Key` on POST — YooKassa may reject or duplicate
- NEVER trust the webhook payload for amount / status — always re-fetch `GET /v3/payments/{id}` before mutating order
- NEVER store raw PAN, CVV, or card data — PCI scope stays at SAQ A / A-EP via widget or hosted page
- NEVER reuse `Idempotence-Key` across different request bodies — collision returns `400 Bad Request`
- NEVER ship `secretKey` in the browser; only `confirmation_token` (server-issued) goes to the client
- NEVER skip the `receipt` object for B2C transactions — 54-ФЗ requires it
- ALWAYS configure webhook URLs per environment in dashboard; do NOT share dev/prod webhook URLs
- ALWAYS respond `200 OK` from webhook handlers within 30s (queue side effects)
- ALWAYS handle idempotent webhook delivery — same event may arrive 2+ times (YooKassa retries non-2xx for ~24h)
- ALWAYS attach `receipt` to refunds when the original charge had one (54-ФЗ)

## Related Skills

**90%-filter applied** — mainstream 2026 choices used in >30% of Russian e-commerce / SaaS projects.

### Runtime
- ✓ `nodejs` — Node 24 (primary runtime; webhook receiver, API caller)
- ✓ `typescript` — TS 5.9 (default for new projects; SDK types + payload schemas)

### Web frameworks
- ✓ `nextjs` — Next.js 16 (App Router Route Handler for widget + webhook receiver)
- ✓ `react` — React 19 (Checkout.js widget mounted in a React form)
- ✓ `fastify` — Fastify 5 (raw-body parser pattern, webhook handler)
- ✓ `hono` — Hono 4 (lightweight webhook receiver, edge deploys)

### Validation
- ✓ `zod` — Zod 4 (validate webhook payloads, payment-object types, receipt shape)

### Deploy & ops
- ✓ `linux-sysadmin` — Ubuntu 24.04 + Angie/Nginx (TLS termination, IP allowlist for webhook source)

### Domain
- ✓ `telegram-bot` — Telegram bots accepting Russian-card payments via YooKassa (Mini App / hosted page link)

### Persistence & queues
- ✓ `prisma` — Prisma 7 (payment + idempotency-key persistence)
- ✓ `redis` — Redis 8 (idempotency cache, dedupe webhook retries)
- ✓ `bullmq` — BullMQ 5 (recurring rebill scheduler, retry queue)

### Code discipline
- ✓ `karpathy-guidelines`

## API Reference

| Topic | File |
|---|---|
| API overview — base URL, auth, Idempotence-Key, endpoints, error codes | [references/api-overview.md](references/api-overview.md) |
| Payment flow — widget vs API, state machine, two-stage capture, СБП, SberPay, Tinkoff Pay | [references/payments-flow.md](references/payments-flow.md) |
| Webhooks — payment.* / refund.succeeded, payload shape, retries, re-fetch verification | [references/webhooks.md](references/webhooks.md) |
| 54-ФЗ fiscalization — `receipt`, `tax_system_code`, `vat_code`, `payment_subject`/`payment_mode`, ОФД flow | [references/fiscalization-54fz.md](references/fiscalization-54fz.md) |
| Recurring & saved payment methods — `save_payment_method`, `payment_method_id`, scheduling | [references/recurring-subscriptions.md](references/recurring-subscriptions.md) |
| Refunds — full/partial, receipt on refund, refund.succeeded webhook | [references/refunds.md](references/refunds.md) |
| Security & PCI scope — IP allowlist, re-fetch verification, opt-in Signing Secret, key rotation | [references/security-pci.md](references/security-pci.md) |
| Testing — test shop, test cards, tunneling, fixture payloads | [references/testing.md](references/testing.md) |
| API endpoints cheatsheet — every documented endpoint with source URL | [references/api-endpoints-cheatsheet.md](references/api-endpoints-cheatsheet.md) |
| **Recommended defaults** — canonical Idempotence-Key / IP-list / capture-window / retry / receipt enums | [references/recommended-defaults.md](references/recommended-defaults.md) |
| **Troubleshooting** — symptom-indexed: IP drift, re-fetch races, 400 idempotence, expired methods, 54-ФЗ errors | [references/troubleshooting.md](references/troubleshooting.md) |
| Eval cases | [references/eval-cases.md](references/eval-cases.md) |

### Templates

| Template | File |
|---|---|
| Fastify webhook receiver with IP allowlist + payment re-fetch verification | [templates/webhook-fastify.ts.template](templates/webhook-fastify.ts.template) |
| Create payment via `@a2seven/yoo-checkout` SDK | [templates/create-payment.ts.template](templates/create-payment.ts.template) |
| Saved payment-method rebill (recurring) | [templates/charge-saved-method.ts.template](templates/charge-saved-method.ts.template) |
| 54-ФЗ receipt builder helper | [templates/receipt.ts.template](templates/receipt.ts.template) |

### Examples

| Scenario | File |
|---|---|
| Successful one-time payment via Checkout.js widget (front + server confirm) | [examples/one-time-payment.md](examples/one-time-payment.md) |
| Recurring subscription via saved payment method (BullMQ scheduler + re-fetch) | [examples/recurring-subscription.md](examples/recurring-subscription.md) |

**How to use**: open only the topic file relevant to the current task. Webhook work → `webhooks.md` + `security-pci.md` + `troubleshooting.md`. New integration → `api-overview.md` + `payments-flow.md`. Recurring → `recurring-subscriptions.md`. Tuning knobs → `recommended-defaults.md`.
