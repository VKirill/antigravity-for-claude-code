# yookassa skill — CHANGELOG

## [2.0.0] — 2026-05-15

Full retrofit to skill-evaluation v3 standards (matches the `bullmq` v2.0.x exemplar shape). Substantial restructure; production-readiness uplift for the `risk: high-stakes` cascade.

### Added
- `references/recommended-defaults.md` — canonical operational knobs (Idempotence-Key strategy + 24h dedup, IP allowlist with quarterly refresh cadence + current published ranges, Signing Secret HMAC mode for 2024+ tiers, two-stage capture 7-day hold, saved-method TTL, recurring rebill dunning ladder, 54-ФЗ enums table, HTTP retry policy, sandbox base URL + test cards). Source-tagged + `Last verified` 2026-05-15.
- `references/troubleshooting.md` — symptom-indexed (required for `risk: high-stakes` per v3): IP allowlist drift, webhook re-fetch races (404 after notification), payments stuck in `waiting_for_capture`, `Idempotence-Key` 400 collisions, saved `payment_method_id` rejected on rebill (terminal vs transient reasons), СБП succeeded-but-no-webhook reconciliation, 54-ФЗ ОФД rejections, `ENOTFOUND`/timeout from SDK, refunds stuck in `pending`, signed-webhook signature mismatch. Each entry: Symptoms → Diagnose → Common causes → Fix.
- Wrong-vs-right pairs (❌/✅ with "Why it matters") added to:
  - `references/api-overview.md` — Idempotence-Key persistence pattern
  - `references/webhooks.md` — trust-payload vs re-fetch
  - `references/security-pci.md` — IP allowlist as sole defense vs defense-in-depth
  - `references/recurring-subscriptions.md` — saved-method terminal vs transient declines

### Changed (BREAKING in artifact shape; routing surface unchanged)
- `SKILL.md` compressed 226 → 182 lines. Capabilities section now one-liner-per-domain pointing to references — removed inline code blocks that duplicated reference content (matches bullmq exemplar).
- Frontmatter description tightened: added new trigger tokens (`/v3/payment_methods`, `/v3/receipts`, `СБП`, `SberPay`) and trimmed to 585 chars.
- `references/eval-cases.md` rewritten in v3 format: user-voice phrasing (Russian/typos/incomplete welcome) + "Expected behavior" column instead of a flat list. Says which sub-files / templates should load.
- Behavioral Traits: explicit "no inline magic numbers — values from `recommended-defaults.md`" rule added.
- API Reference table in SKILL.md now lists `recommended-defaults.md` and `troubleshooting.md` explicitly.

### Fixed (hallucinations caught during Context7 audit pass)
- `references/api-endpoints-cheatsheet.md:47-62` — `POST /v3/payment_methods` example was wrong on TWO axes:
  - **was**: `Authorization: Bearer <access_token>` (Bearer auth)
  - **is**: HTTP Basic `-u <Shop ID>:<Secret Key>` (canonical per [yookassa.ru/developers/api](https://yookassa.ru/developers/api)). The Bearer/OAuth flow is only for partner integrations, not the merchant binding path.
  - **was**: payload contained raw `card.number: '4111111111111111'` (PCI scope explosion + that's not the documented merchant binding shape).
  - **is**: payload uses `type: 'bank_card'` + `confirmation: { type: 'redirect', return_url }` — the canonical binding flow that keeps the merchant out of SAQ D scope.
  - Cross-linked to `recurring-subscriptions.md` which documents the simpler `save_payment_method: true` path most integrations actually use.

### Verified via Context7 (2026-05-15)
- Endpoints confirmed against `/websites/yookassa_ru_developers` + `/websites/yookassa_ru_developers_api`:
  - `POST /v3/payments`, `GET /v3/payments/{id}`, `POST /v3/payments/{id}/capture`, `POST /v3/payments/{id}/cancel`, `GET /v3/payments` ✓
  - `POST /v3/refunds`, `GET /v3/refunds/{id}` ✓
  - `POST /v3/receipts`, `GET /v3/receipts` ✓
  - `POST /v3/payment_methods` (HTTP Basic, with `confirmation.redirect`) ✓
  - `POST /v3/deals`, `GET /v3/deals` (safe deal escrow) ✓
- Webhook events confirmed: `payment.waiting_for_capture`, `payment.succeeded`, `payment.canceled`, `refund.succeeded` ✓
- `@a2seven/yoo-checkout@1.1.4` SDK exports verified from package `.d.ts`:
  - Class: `YooCheckout` ✓
  - Methods: `createPayment`, `getPayment`, `capturePayment`, `cancelPayment`, `getPaymentList`, `createRefund`, `getRefund`, `getRefundList`, `createReceipt`, `getReceipt`, `getReceiptList`, `createWebHook`, `getWebHookList`, `deleteWebHook`, `getShop` ✓
- Widget global: `new window.YooMoneyCheckoutWidget({ confirmation_token, return_url, error_callback, customization? })` ✓ (NOT `YooKassaCheckoutWidget`; brand is YooMoney for the JS widget)
- 54-ФЗ enums (`tax_system_code` 1-6, `vat_code` 1-6, `payment_subject`, `payment_mode`, `measure`) match [yookassa.ru/developers/payment-acceptance/receipts/54fz/other-services/parameters-values](https://yookassa.ru/developers/payment-acceptance/receipts/54fz/other-services/parameters-values) ✓
- IP allowlist current ranges (incl. IPv6 `2a02:5180::/32` and `77.75.156.{11,35}`) tracked against the [changelog](https://yookassa.ru/developers/using-api/changelog) ✓

### Notes
- v3 standards reference: see `~/.claude/skills/skill-evaluation/references/` — esp. `troubleshooting-template.md`, `recommended-defaults-pattern.md`, `wrong-vs-right-patterns.md`, `eval-and-versioning.md`, `internal-consistency.md`.
- No public Node SDK from YooMoney itself; community `@a2seven/yoo-checkout` is the de facto choice. Official YooMoney SDKs exist for PHP, Python, Ruby, Java, .NET, Go.
- Webhook signing (HMAC) remains opt-in (newer accounts via YooMoney manager); default verification model = IP allowlist + payment re-fetch. The skill prescribes both as defense-in-depth even when signing is enabled.

## [1.1.0] — 2026-05-15

### Added
- `references/api-endpoints-cheatsheet.md` — curated endpoint quick-lookup with original source URLs (every snippet attributable to a yookassa.ru/developers page). Covers `/v3/payments` lifecycle, `/v3/payment_methods`, `/v3/deals`, `/v3/receipts`, SberPay, Sber Loan (BNPL), recurring with `topped_up_phone` anti-fraud hint, widget `save_payment_method` scenario.
- Wired the new file into SKILL.md API Reference table.

### Source
- Pulled via Context7 mirrors `/websites/yookassa_ru_developers` + `/websites/yookassa_ru_developers_api` (May 2026).

## [1.0.0] — 2026-05-15

### Added
- Initial skill generation under skill-evaluation v2 standards
- SKILL.md navigator (Pattern 2) with 9 references
- `references/api-overview.md` — REST v3 base URL, auth, Idempotence-Key, endpoints
- `references/payments-flow.md` — widget + API flows, state machine, two-stage, СБП
- `references/webhooks.md` — payment.* / refund.succeeded events, IP allowlist, re-fetch model
- `references/fiscalization-54fz.md` — receipt object, vat_code, payment_subject/mode enums
- `references/recurring-subscriptions.md` — save_payment_method, payment_method_id rebill
- `references/refunds.md` — full/partial refunds, receipt on refund
- `references/security-pci.md` — IP allowlist, re-fetch verification, opt-in Signing Secret
- `references/testing.md` — test shop, test cards, tunneling
- `references/eval-cases.md` — 10 positive + 10 negative + 5 edge routing tests
- `templates/webhook-fastify.ts.template` — Fastify receiver with re-fetch verification
- `templates/create-payment.ts.template` — `@a2seven/yoo-checkout` SDK usage
- `templates/charge-saved-method.ts.template` — recurring rebill
- `templates/receipt.ts.template` — 54-ФЗ receipt builder
- `examples/one-time-payment.md` — Checkout.js end-to-end
- `examples/recurring-subscription.md` — saved-method scheduling
- Description with trigger terms (300+ chars) + SKIP rules for CloudPayments/Tinkoff/Stripe/Robokassa/Tochka/yoomoney/sbp/fiscalization
- Related Skills filtered to 90% mainstream stack with cascade markers for fastify/hono/prisma/redis/bullmq/54-fz-fiscalization/1c-integration/yoomoney/sbp

### Notes
- No official Node SDK from YooMoney; community `@a2seven/yoo-checkout` (TypeScript) is the de facto choice
- Official YooMoney SDKs exist for PHP, Python, Ruby, Java, .NET, Go
- Webhook signing (HMAC) is opt-in (newer accounts only); default model = IP allowlist + re-fetch payment
