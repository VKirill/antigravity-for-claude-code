# yookassa — Eval Cases

v3 format: **user-voice phrasing** (Russian / typos / incomplete welcome) + **Expected behavior** column (which sub-files / templates should load, not just "this skill activates").

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "юкасса не присылает webhook на succeeded, что проверить" | Load `troubleshooting.md` (СБП/IP/handler sections) + `webhooks.md`; suggest reconciliation by `GET /v3/payments` |
| "почему IP allowlist отбивает уведомления от ЮKassa" | Load `troubleshooting.md` (IP allowlist drift section) + `recommended-defaults.md` IP table; cite quarterly refresh + changelog |
| "Idempotence-Key reuse 400 при retry, что не так" | Load `troubleshooting.md` (Idempotence-Key reuse) + `api-overview.md` Idempotency; cite `recommended-defaults.md` key scoping rule |
| "save_payment_method не работает — payment_method.saved false" | Load `recurring-subscriptions.md` first-charge section + `troubleshooting.md` (saved method rejected); check `save_payment_method: true` was set |
| "застрял waiting_for_capture, как его раз-capture" | Load `troubleshooting.md` (Payment stuck in waiting_for_capture) + `payments-flow.md` two-stage; cite `capture-${paymentId}` idempotence pattern |
| "сделай чек 54-ФЗ для подписки Pro, vat_code какой?" | Load `fiscalization-54fz.md` SaaS example + `recommended-defaults.md` 54-ФЗ enums; default `vat_code: 1`, `payment_subject: 'service'`, `tax_system_code: 2` |
| "Fastify webhook с re-fetch и IP allowlist" | Cite `templates/webhook-fastify.ts.template` + `webhooks.md` re-fetch model + `security-pci.md` IP layers |
| "рекуррент через ЮKassa — как orchestrate cycle?" | Load `recurring-subscriptions.md` BullMQ pattern + `recommended-defaults.md` retry ladder (day 1/3/7) |
| "Checkout.js виджет, как получить confirmation_token" | Load `payments-flow.md` widget section + `api-overview.md` confirmation types; show `confirmation: { type: 'embedded' }` and `new window.YooMoneyCheckoutWidget` |
| "refund с receipt — обязательно ли всё дублировать?" | Load `refunds.md` + `fiscalization-54fz.md` refund receipt; YES — 54-ФЗ requires matching receipt items |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "CloudPayments виджет cp.CloudPayments.pay" | **cloudpayments** | Different gateway entirely |
| "Stripe payment intent + webhook signature" | **stripe** (not yet active) | Different gateway |
| "Tinkoff Касса token-эквайринг" | **tinkoff** (not yet active) | Different gateway |
| "Robokassa xml-callback подпись MD5" | **robokassa** (not yet active) | Different gateway |
| "Generic HTTP webhook with HMAC-SHA256 in Express" | **nodejs** / **express** | Provider-neutral HMAC |
| "СБП QR напрямую от Сбера B2B Эквайринг" | **sbp** (cascade) | Bank-direct, no YooKassa |
| "ЮMoney кошелёк P2P-переводы" | **yoomoney** (cascade) | Consumer wallet, not merchant API |
| "Telegram Stars XTR в боте" | **telegram-bot** | Native Telegram Payments 2.0 |
| "Фискальный чек напрямую через АТОЛ ОФД" | **fiscalization** (cascade) | OFD-direct, no YooKassa intermediary |
| "Apple Pay session validation iOS native" | **apple-pay** (not yet active) | Different rail |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "подключи ЮKassa в Telegram-боте через Mini App" | **yookassa** PRIMARY (payment domain) + cross-link **telegram-bot** for Mini App `initData` validation and widget framing |
| "сравни ЮKassa и CloudPayments — что выбрать" | Ambiguous business decision. If migrating TO YooKassa → this skill; otherwise route to general planning. Surface key differences (CP HMAC vs YK re-fetch; CP has `/subscriptions/*`, YK doesn't) |
| "принять YooMoney кошелёк на сайте магазина" | **yookassa** PRIMARY if via merchant `yoo_money` payment method; **yoomoney** if direct P2P/wallet. Default to merchant context (YooKassa) |
| "Самозанятый — чек через ЮKassa возможен?" | **yookassa** primary (load `fiscalization-54fz.md`); default `tax_system_code: 6`, watch out for ОСН-only merchants |
| "Сравни СБП через ЮKassa vs через Сбер напрямую" | Cross-skill: **yookassa** for intermediary route (`confirmation.type: 'qr'`) and **sbp** for bank-direct. Surface tradeoffs (commission vs latency vs onboarding) |

## How to verify (manual)

1. Open a fresh session with this skill loaded.
2. Paste each Positive prompt → confirm:
   - The system reminder lists `yookassa` as an active skill
   - The response references files matching the "Expected behavior" column
   - Specific YooKassa terms appear: `Idempotence-Key`, `payment.succeeded`, `/v3/payments`, `receipt`, `payment_method_id`
3. Paste each Negative prompt → confirm `yookassa` does NOT appear in the routed skill response, and the suggested fallback skill is mentioned
4. Edge cases: confirm the response calls out the cross-link explicitly ("primary: yookassa, see also: telegram-bot/sbp")

If a prompt routes wrong:
- Negative becoming Positive → tighten the `description` SKIP rules
- Positive becoming Negative → add the missing trigger term to `description` (already includes `СБП`, `SberPay`, `/v3/payment_methods`)
- Edge routing only to one skill → enrich Related Skills cross-links

Run after any change to `SKILL.md` description or major reference restructure — that's the regression check.
