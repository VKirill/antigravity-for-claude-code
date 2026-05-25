# telegram-bot — Eval Cases

v3 format: **user-voice phrasing** (Russian/typos/incomplete welcome) + **Expected behavior** column (which sub-files / templates should load, not just "this skill activates").

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "не приходит webhook от телеги" | Load `troubleshooting.md` (Webhook never arrives section); diagnose TLS chain, port 443/80/88/8443, `getWebhookInfo` |
| "почему initData не валидируется" | Load `troubleshooting.md` (Mini App initData HMAC fails) + `mini-apps.md` validation section; show `HMAC_SHA256("WebAppData", botToken)` derivation |
| "Stars XTR рефанд молчит, баланс не вернулся" | Load `troubleshooting.md` (Stars XTR refund silently no-ops); cite 30-day window from `recommended-defaults.md`; show `refundStarPayment` call shape |
| "Mini App не открывается вне клиента Telegram" | Load `troubleshooting.md` (Telegram.WebApp undefined); show defensive check + script ordering |
| "409 Conflict при getUpdates" | Load `troubleshooting.md` (409 Conflict section); diagnose duplicate processes / webhook+polling collision; show `deleteWebhook` fix |
| "сделать бота на grammY с Redis-сессиями и conversations" | Activate; load `grammy.md` (sessions + conversations) + cite `templates/grammy-bot.ts.template`; reference `recommended-defaults.md` for storage choice |
| "как принять оплату звёздами в боте" | Activate; load `payments.md` (Stars XTR section) + `examples/payment-with-stars.md`; cite idempotency via `telegram_payment_charge_id` |
| "secret_token не совпадает на webhook handler" | Load `troubleshooting.md` (secret_token mismatch); show timing-safe compare; cite `recommended-defaults.md` webhook section |
| "session race — каунтер прыгает при одновременных сообщениях" | Load `troubleshooting.md` (Session race condition); show `sequentialize` ordering rule; cite `recommended-defaults.md` concurrency |
| "бот заблокирован юзером — что делать в коде" | Load `troubleshooting.md` (Forbidden bot blocked section); show `GrammyError` 403 handling, no-retry pattern |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "aiogram бот на питоне" | (cascade — `aiogram-python`) | Python ecosystem, SKIP rule |
| "Discord bot.js слэш-команды" | (cascade — `discord-bot-developer`) | Different platform |
| "Slack bot OAuth + Socket Mode" | (cascade — `slack-bolt`) | Different platform |
| "WhatsApp Business API webhook" | (cascade) | Different platform |
| "развернуть Telegram Desktop с правками" | (no skill — client app) | Telegram client, not bot |
| "ЮKassa подключить к сайту" | `yookassa` | RU payment gateway, NOT Telegram Payments |
| "CloudPayments виджет на Next.js" | `cloudpayments` | RU payment gateway, NOT Telegram Stars |
| "Matrix бот" | (cascade — `matrix-bot`) | Different chat platform |
| "общий HMAC webhook на Node без Telegram" | `nodejs` | Generic webhook, not Telegram-specific |
| "Mini App UI без бота — React-форма" | `ui-ux-pro-max` | Pure frontend, no bot logic |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "Telegram бот принимает CloudPayments — как соединить" | **telegram-bot** PRIMARY + cross-link `cloudpayments`. Stars XTR is native Telegram; for RUB fiat via CP use Payments 2.0 with CP `provider_token` OR external Mini App checkout. |
| "развернуть бота на Cloudflare Workers" | **telegram-bot** PRIMARY (Webhook section) + cross-link `hono`. Note: edge runtime — use `webhookCallback(bot, 'cloudflare-mod')`, `crypto.subtle` for HMAC if Mini App validation. |
| "сравни grammY и Telegraf для нового проекта" | **telegram-bot** PRIMARY. Recommend grammY 1.x without reservations — Telegraf is unsupported since 2024 and behind on Bot API. No comparison table; one production-grade choice. |
| "перенести бота с polling на webhook без даунтайма" | **telegram-bot** PRIMARY. Load `webhooks.md` + `troubleshooting.md` (409 Conflict). Procedure: start webhook handler → `setWebhook` (Telegram switches immediately) → confirm `pending_update_count` drains → stop poller. |
| "бот + BullMQ фоновые задачи" | **telegram-bot** PRIMARY + cross-link `bullmq`. Pattern: webhook → enqueue via `jobId = "msg-${update_id}"` for idempotency → worker does heavy work. See troubleshooting "Webhook handler timeout". |

## How to verify

1. Open a fresh session with this skill loaded from `~/.claude/skills/telegram-bot/`.
2. Paste each Positive prompt → confirm:
   - System reminder lists `telegram-bot` as active
   - Response references files matching "Expected behavior" column
3. Paste each Negative prompt → confirm `telegram-bot` does NOT appear in routed skill response; fallback skill mentioned
4. Edge cases: confirm explicit cross-link callout ("primary: telegram-bot, see also: cloudpayments / hono / bullmq")

If routing wrong:
- Negative becoming Positive → tighten `description` SKIP rules
- Positive becoming Negative → add missing trigger term to `description`
- Edge routing only to one skill → enrich Related Skills cross-links

Run after any change to `SKILL.md` description, SKIP rules, or major reference restructure.
