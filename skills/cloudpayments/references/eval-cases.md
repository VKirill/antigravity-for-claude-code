# cloudpayments — Eval Cases

v3 format: **user-voice phrasing** (Russian/typos/incomplete welcome) + **Expected behavior** column (which sub-files / templates should load, not just "this skill activates").

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "Сделай интеграцию с CloudPayments для приёма карт" | Activate cloudpayments; load `payments-flow.md` + `api-overview.md`; cite `templates/webhook-fastify.ts.template` |
| "Content-HMAC не сходится, webhook возвращает 403" | Load `troubleshooting.md` (HMAC verification fails section); show raw-body capture pattern + Fastify/Express snippets |
| "прикрутить cp.CloudPayments виджет к Next.js" | Load `payments-flow.md` widget section; cite `examples/one-time-payment.md` |
| "Pay-уведомление пришло дважды — двойной grant" | Load `troubleshooting.md` (Duplicate Pay webhooks section); show DB-transaction idempotency pattern with `TransactionId` |
| "как сделать рекуррент через сохранённый токен" | Load `recurring-subscriptions.md` + `templates/charge-by-token.ts.template`; cite `recommended-defaults.md` for token TTL handling |
| "ОФД отбил чек — Vat некорректный" | Load `troubleshooting.md` (54-ФЗ rejected section) + `fiscalization-54fz.md` for enum reference; cite `templates/customer-receipt.ts.template` |
| "Check-уведомление отклоняет валидные платежи" | Load `troubleshooting.md` (Check gate rejects section); show response-code semantics (0/10/11/12/13/20) |
| "Pay webhook не приходит в продакшене" | Load `troubleshooting.md` (Pay webhook never arrives section); diagnose IP allowlist + TLS + dashboard auto-suspend |
| "3DS висит после возврата от банка" | Load `troubleshooting.md` (3-D Secure stuck section); show CSP + return_url + mobile Safari fixes |
| "Telegram bot принимает CloudPayments — как соединить" | Activate cloudpayments PRIMARY + cross-link `telegram-bot`; load webhook handler patterns from both |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "интеграция с ЮKassa" | `yookassa` | Different gateway, SKIP rule |
| "Tinkoff Касса API" | (no skill — cascade marker) | Different gateway |
| "Stripe Subscriptions" | (no skill — international gateway) | Different ecosystem |
| "Robokassa подключение" | (no skill — cascade marker) | Different RU gateway |
| "Telegram Stars / XTR" | `telegram-bot` | Native Telegram Payments, NOT CloudPayments |
| "общая 54-ФЗ через АТОЛ-онлайн напрямую" | (no skill — cascade marker `fiscalization`) | OFD-direct fiscalization, not via CloudPayments |
| "общий HMAC webhook handler" | `nodejs` | Generic webhook verification, not CP-specific |
| "Tochka банк API для бизнеса" | (no skill) | Bank API, not payment gateway |
| "ЮMoney P2P transfer" | (no skill — `yoomoney` cascade marker) | Consumer wallet, not merchant |
| "Apple Pay в нативном iOS" | (no skill — `apple-pay` cascade marker) | Native iOS payment surface, не CP |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "сравни CloudPayments и YooKassa для подписочной модели" | Architectural — load both `cloudpayments` and `yookassa` SKILL.md (Capabilities section). Surface tradeoffs: CP has built-in `/subscriptions/*` API; YK requires merchant-orchestrated rebill on `save_payment_method`. |
| "хочу СБП без CloudPayments напрямую через банк" | Mostly out of scope. cloudpayments has SBP-via-CP coverage in `payments-flow.md`. Direct-bank SBP integration is a different domain (cascade marker `sbp`). |
| "validate Pay-payload with Zod at handler" | **cloudpayments** PRIMARY (load `webhooks.md`); cross-link `zod`. Show schema for `Pay` payload (RequestId, TransactionId, Amount, Currency, AccountId, etc.) |
| "deploy CP webhook к Cloudflare Workers" | **cloudpayments** PRIMARY (Webhook patterns) + cross-link `hono` (Workers-compatible framework). Note: edge runtime constraints — no Node `crypto.timingSafeEqual` directly; use `crypto.subtle` instead. |
| "перенести с Stripe на CloudPayments — что меняется" | **cloudpayments** PRIMARY; surface architectural differences: Check gate has no Stripe analog; 54-ФЗ embedded vs separate; 3DS flow differs in widget; tokenization semantics differ. |

## How to verify

1. Open a fresh session with this skill loaded from `~/.claude/skills/cloudpayments/`.
2. Paste each Positive prompt → confirm:
   - System reminder lists `cloudpayments` as active
   - Response references files matching "Expected behavior" column
3. Paste each Negative prompt → confirm `cloudpayments` does NOT appear in routed skill response; fallback skill is mentioned
4. Edge cases: confirm explicit cross-link callout ("primary: cloudpayments, see also: zod / hono / telegram-bot")

If routing wrong:
- Negative becoming Positive → tighten `description` SKIP rules
- Positive becoming Negative → add the missing trigger term to `description`
- Edge routing only to one skill → enrich Related Skills cross-links

Run after any change to `SKILL.md` description, SKIP rules, or major reference restructure.
