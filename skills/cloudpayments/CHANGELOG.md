# cloudpayments skill — CHANGELOG

## [2.0.0] — 2026-05-15

Full retrofit to skill-evaluation v3 standards. bullmq v2.0.1 used as gold-standard exemplar.

### Added
- `references/recommended-defaults.md` — canonical operational defaults: HMAC timing-safe comparison, idempotency window (24h on TransactionId), HTTP retry policy for outbound /payments/* calls, 3-D Secure timeout, recurring rebill schedule, token TTL handling, 54-ФЗ enum reference (Vat / Method / Object), sandbox vs prod URL convention.
- `references/troubleshooting.md` — required for `risk: high-stakes`. Symptom-indexed: HMAC verification fails, Check gate rejects valid payments, Pay webhook never arrives, duplicate Pay webhooks, 3-D Secure stuck, recurring rebill silently fails, 54-ФЗ receipt rejected by OFD, sandbox/prod confusion, IP allowlist drift. Each entry: Symptoms → Diagnose (commands) → Common causes → Fix (paste-runnable).

### Changed
- Frontmatter `risk: high-stakes` added — triggers v3 mandatory artifacts.
- `references/eval-cases.md` rewritten in v3 format: user-voice phrasing (Russian/typos/incomplete) + "Expected behavior" column. Routes to specific sub-files/templates, not just "this skill activates". Added explicit "How to verify" section.
- SKILL.md API Reference table extended with troubleshooting + recommended-defaults entries.

### Source of guidance
- bullmq v2.0.1 (CHANGELOG + structure)
- skill-evaluation v3 references: troubleshooting-template, recommended-defaults-pattern, internal-consistency, eval-and-versioning v3 format, cascade-generation Anti-hallucination rules

## [1.0.0] — 2026-05-15

### Added
- Initial skill generation under skill-evaluation v2 standards
- SKILL.md navigator (Pattern 2) with 9 references
- `references/api-overview.md` — REST base URL, auth, endpoints, error codes
- `references/payments-flow.md` — widget + REST flows, one-step vs two-step, 3DS, СБП
- `references/webhooks.md` — Check / Pay / Confirm / Fail / Refund / Recurrent gates
- `references/fiscalization-54fz.md` — CustomerReceipt shape, taxationSystem, Vat/Method/Object enums
- `references/recurring-subscriptions.md` — tokenization, `/subscriptions/*`, manual rebill
- `references/refunds.md` — void vs refund, partial, 54-ФЗ on refund
- `references/security-pci.md` — HMAC-SHA256 verification, IP allowlist, PCI scope
- `references/testing.md` — sandbox keys, test cards, tunneling
- `references/eval-cases.md` — 10 positive + 10 negative + 5 edge routing tests
- `templates/webhook-fastify.ts.template` — Fastify raw-body HMAC verifier
- `templates/webhook-express.ts.template` — Express raw-body HMAC verifier
- `templates/charge-by-token.ts.template` — server-driven rebill
- `templates/customer-receipt.ts.template` — 54-ФЗ receipt builder
- `examples/one-time-payment.md` — widget + server confirm end-to-end
- `examples/recurring-subscription.md` — subscription create + Recurrent webhook
- Description with trigger terms (300+ chars) + SKIP rules for YooKassa/Tinkoff/Stripe/Robokassa/Tochka/fiscalization/nodejs
- Related Skills filtered to 90% mainstream stack with cascade markers for fastify/hono/prisma/redis/bullmq/54-fz-fiscalization/1c-integration

### Notes
- No official CloudPayments Node SDK; community `cloudpayments` npm package (TypeScript) is the de facto choice
- Widget JS is loaded from CDN — no versioned npm package for the widget itself
