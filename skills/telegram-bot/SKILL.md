---
name: telegram-bot
description: "Build, architect, deploy Telegram bots on grammY 1.x + Node 24 + TypeScript 5.9. Use when: telegram bot, tg bot, grammY, Bot API, BotFather, webhook, long polling, Mini App, Telegram WebApp, initData, HMAC validation, secret_token, Telegram Stars, XTR, Payments 2.0, refundStarPayment, business connection, callback query, inline keyboard, conversation, session, sequentialize, runner, paid media, reactions, chat boost. SKIP: Python aiogram (→aiogram-python), Discord (→discord-bot-developer), Matrix/Slack/WhatsApp, Telegram desktop client."
stacks:
  - telegram
  - bot
packages:
  - grammy
  - "@grammyjs/runner"
  - "@grammyjs/conversations"
  - "@grammyjs/storage-redis"
  - "@grammyjs/menu"
  - "@grammyjs/auto-retry"
  - "@grammyjs/ratelimiter"
tags:
  - telegram
  - bot
  - mini-app
  - payments
  - grammy
source: regenerated-zero-baseline
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

Loaded automatically when its description matches the active task. Read only the section you need.

## Use this skill when

- Creating a new Telegram bot or extending an existing one (grammY 1.x — the production-supported choice)
- Setting up webhooks (Fastify/Hono/Express/Cloudflare Workers) or concurrent long polling (`@grammyjs/runner`)
- Implementing Mini Apps: `initData` HMAC-SHA256 validation, `sendData` / `answerWebAppQuery`, deep links
- Integrating Telegram Stars (XTR) or Payments 2.0 (fiat), refunds, subscriptions, paid media
- Handling Bot API 10.0 features: business connections, reactions, chat boosts, guest mode, managed bots
- Designing sessions (RAM/file/Redis), conversations (`@grammyjs/conversations`), sequentialize for scale
- Multi-instance scaling: Redis sessions, sticky routing, distributed locks, broadcast rate limits
- Adding observability (Pino, Sentry, `bot.catch`), graceful shutdown, PM2/Docker/serverless deploys
- Diagnosing webhook delivery, secret_token mismatch, 409 Conflict, idempotency misses, blocked users

## Do not use this skill when

- Task is Python aiogram bot — hand off to `aiogram-python` (cascade marker)
- Task is Discord — hand off to `discord-bot-developer` (cascade marker)
- Task is Matrix, Slack, WhatsApp, or other chat platform integration
- Task is Telegram desktop client or Telegram infrastructure development
- Task is generic Node.js webhook with no Telegram surface — use `nodejs`
- Task is Mini App frontend UI design only — use `ui-ux-pro-max`

## Purpose

Telegram is the dominant chat platform for bot-powered products in CIS markets and increasingly worldwide. Bots handle e-commerce, subscriptions, content delivery, support, AI assistants, and payments without a separate app install. Bot API 10.0 (May 2026) adds guest mode, managed bots, reaction management, and richer business features.

This skill covers the full production lifecycle of a Telegram bot on **grammY 1.x + TypeScript 5.9 + Node.js 24** — the single production framework choice as of 2026 (full Bot API 10.0 coverage, first-class TS via context flavors, active plugin ecosystem). Topics: middleware architecture, session persistence, conversation flows, inline keyboards, webhook security, payment integration (Stars XTR + Payments 2.0), Mini App connectivity, and multi-instance scaling with Redis.

What this skill does NOT do: low-level HTTP framework details (see `fastify` / `hono`), Redis tuning (see `redis`), background job queue design (see `bullmq`), persistence (see `prisma` / `postgresql`), payment gateway integration for RUB fiat (see `cloudpayments` / `yookassa`).

## Capabilities

Each line below points to the canonical reference. The reference owns code, edge cases, and gotchas — do not duplicate them here.

- **Bot API 10.0 surface** — BotFather, update types, methods, reactions, boosts, business connections, guest mode, managed bots. → [bot-api.md](references/bot-api.md)
- **grammY 1.x framework** — typed context flavors, sessions (RAM/file/Redis), menus, conversations, middleware composition. → [grammy.md](references/grammy.md)
- **Webhooks vs long polling** — adapters (Fastify/Hono/Express/Workers/Lambda), `secret_token`, `allowed_updates`, serverless. → [webhooks.md](references/webhooks.md)
- **Mini Apps** — seven launch methods, `Telegram.WebApp` SDK, `initData` HMAC-SHA256 validation, deep links. → [mini-apps.md](references/mini-apps.md)
- **Payments** — Stars (XTR) flow, Payments 2.0 (fiat), `pre_checkout_query` discipline, `refundStarPayment`, paid media, subscriptions. → [payments.md](references/payments.md)
- **Scaling** — `@grammyjs/runner` + `sequentialize`, multi-instance, Redis sessions, rate limits, broadcast pattern. → [scaling.md](references/scaling.md)
- **Recommended defaults** — canonical values for framework choice, concurrency, sessions, timeouts, payment idempotency. → [recommended-defaults.md](references/recommended-defaults.md)
- **Troubleshooting** — symptom-indexed: webhook never arrives, secret_token mismatch, 409 Conflict, initData fails, Stars refund silent, session race. → [troubleshooting.md](references/troubleshooting.md)
- **Wrong vs right patterns** — 5 high-stakes pairs: webhook trust, initData validation, payment grant timing, session+sequentialize, polling vs webhook. → [wrong-vs-right.md](references/wrong-vs-right.md)

## Behavioral Traits

- Uses grammY 1.x as the single production framework choice; does not propose Telegraf (unsupported since 2024)
- Installs `sequentialize` BEFORE session middleware — same key on both — when using `@grammyjs/runner`
- Calls `ctx.answerCallbackQuery()` on every `callback_query` handler, even silently
- Wraps every side-effect in `conversation.external(() => ...)` inside conversations
- Sets `secret_token` in `setWebhook` and validates `X-Telegram-Bot-Api-Secret-Token` header with `timingSafeEqual`
- Uses `telegram_payment_charge_id` as idempotency key in `successful_payment` — dedup row inside the grant transaction
- Validates Mini App `initData` server-side with `HMAC_SHA256("WebAppData", botToken)` derivation — never trusts `initDataUnsafe`
- Answers `pre_checkout_query` within 10 s — validates only, never grants access there
- Sets `allowed_updates` in both `setWebhook` and `bot.start()` to filter unused update types
- Uses `process.once("SIGTERM", ...)` — never `process.on` — to prevent double-shutdown
- Offloads work > 5 s to BullMQ via `jobId = "msg-${update_id}"` for idempotent at-least-once processing
- Treats `GrammyError` `error_code: 403` ("bot was blocked") as terminal — marks user inactive, never retries

## Important Constraints

- NEVER trust `initDataUnsafe` from a Mini App without server-side HMAC validation
- NEVER skip `ctx.answerCallbackQuery()` — users see a spinner forever otherwise
- NEVER do > 5 s of synchronous work in a handler — Telegram webhook hard timeout is 60 s
- NEVER use RAM session storage in production or any multi-instance deployment — use Redis
- NEVER grant access in `pre_checkout_query` — only validate; grant in `successful_payment` with idempotency
- NEVER use `process.on` for SIGTERM/SIGINT — use `process.once` to prevent double-shutdown
- NEVER run long polling on > 1 process for the same bot token — fails with `409 Conflict`
- NEVER skip `secret_token` validation on webhook endpoints — the URL is public, this is the ONLY caller auth
- ALWAYS filter `allowed_updates` to ONLY types your bot handles — reduces traffic, edge cost
- ALWAYS handle `bot.catch()` globally — unhandled errors in long polling silently drop updates

## Related Skills

✓ marks **active** skills; the rest are **cascade markers** — generate when a task actually touches that domain.

### Runtime
- ✓ `nodejs` — Node 24 LTS, graceful shutdown, AsyncLocalStorage, worker_threads, PM2

### Web frameworks (webhook server)
- ✓ `fastify` — production webhook with grammY adapter, `addContentTypeParser` patterns
- ✓ `hono` — edge webhook (Cloudflare Workers, Vercel Edge)

### Data persistence
- ✓ `redis` — Redis 8 IORedis setup, session storage, rate limiter backends
- ✓ `postgresql` — PostgreSQL 18 user/subscription/order persistence
- ✓ `prisma` — Prisma 7 TS-first ORM

### Payments (external provider layer)
- ✓ `cloudpayments` — CloudPayments RU gateway as Payments 2.0 provider
- ✓ `yookassa` — YooKassa (ЮMoney) RU gateway
- `stripe-integration` — Stripe SDK for Payments 2.0 fiat [cascade marker]

### Mini App frontend
- ✓ `ui-ux-pro-max` — Mini App UI design (React/Tailwind/shadcn)
- ✓ `astro` — Mini App as static site with SSR islands

### Background processing
- ✓ `bullmq` — BullMQ 5 background jobs triggered by bot events (idempotency via `jobId`)

### Deploy and ops
- ✓ `linux-sysadmin` — PM2, Angie, Ubuntu 24.04 (primary VPS target)
- `docker` — multi-stage Dockerfile, compose [cascade marker]

### AI/LLM integration
- `vercel-ai-sdk` — AI SDK streaming in bot handlers [cascade marker]
- ✓ `agent-evaluation` — testing bot/LLM behavior
- ✓ `claude-api` — Anthropic SDK for bots calling Claude

### Validation
- ✓ `zod` — env validation, update payload schemas

### Code discipline
- ✓ `karpathy-guidelines`

### Meta
- ✓ `skill-evaluation` — skill authoring standards (this skill is v2.0.0)

## API Reference

| Topic | File |
|---|---|
| Bot API 10.0 — BotFather, update types, methods, reactions, boosts, business, guest mode | [references/bot-api.md](references/bot-api.md) |
| grammY 1.x — sessions, menus, conversations, middleware, context flavors, plugins | [references/grammy.md](references/grammy.md) |
| Mini Apps — 7 launch methods, SDK, initData HMAC validation, deep links | [references/mini-apps.md](references/mini-apps.md) |
| Payments — Stars XTR + Payments 2.0, refundStarPayment, subscriptions, paid media | [references/payments.md](references/payments.md) |
| Webhooks vs long polling — all adapters, secret_token, allowed_updates, serverless | [references/webhooks.md](references/webhooks.md) |
| Scaling — Runner + sequentialize, Redis sessions, PM2/Docker/serverless, rate limits | [references/scaling.md](references/scaling.md) |
| **Recommended defaults** — framework/concurrency/sessions/payment idempotency canonical values | [references/recommended-defaults.md](references/recommended-defaults.md) |
| **Troubleshooting** — symptom-indexed: webhook delivery, secret_token, 409, initData, Stars refund, session race | [references/troubleshooting.md](references/troubleshooting.md) |
| **Wrong vs right** — 5 high-stakes pairs with "why it matters" | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases — 10 positive / 10 negative / 5 edge user-voice routing tests | [references/eval-cases.md](references/eval-cases.md) |

### Templates

| Template | File |
|---|---|
| grammY bot — typed Context, Redis sessions, conversations, error handler, graceful shutdown | [templates/grammy-bot.ts.template](templates/grammy-bot.ts.template) |
| Fastify 5 webhook server with secret_token validation | [templates/webhook-server-fastify.ts.template](templates/webhook-server-fastify.ts.template) |
| Hono webhook handler (Cloudflare Workers ready) | [templates/webhook-server-hono.ts.template](templates/webhook-server-hono.ts.template) |
| Typed env vars (BOT_TOKEN, WEBHOOK_URL, WEBHOOK_SECRET, REDIS_URL, ADMIN_USER_IDS) | [templates/bot.env.example.template](templates/bot.env.example.template) |
| Node 24 multi-stage Dockerfile — non-root user, healthcheck | [templates/Dockerfile.bot.template](templates/Dockerfile.bot.template) |

### Examples

| Scenario | File |
|---|---|
| Stars (XTR) payment — invoice → pre_checkout → successful_payment → grant + refund | [examples/payment-with-stars.md](examples/payment-with-stars.md) |
| Mini App launch — BotFather setup, HMAC validation, sendData vs answerWebAppQuery, deep link | [examples/mini-app-launch.md](examples/mini-app-launch.md) |
| Multi-instance scaling — Runner + sequentialize, Redis sessions, leader election | [examples/scaling-multi-instance.md](examples/scaling-multi-instance.md) |

### Scripts

| Script | File |
|---|---|
| POST synthetic update to localhost webhook, verify HTTP 200 + secret_token enforcement | [scripts/validate-webhook.sh](scripts/validate-webhook.sh) |
| Query `getMe` + `getChatAdministrators`, verify bot permissions for target chat | [scripts/check-bot-permissions.sh](scripts/check-bot-permissions.sh) |

### Checklists

| Checklist | File |
|---|---|
| Pre-launch — BotFather, webhook, secret_token, allowed_updates, monitoring | [checklists/pre-launch.md](checklists/pre-launch.md) |
| Payment integration — Stars vs fiat, pre_checkout_query, idempotency, refund | [checklists/payment-integration.md](checklists/payment-integration.md) |
| Scaling readiness — Redis sessions, sequentialize, rate limits, alerts | [checklists/scaling-readiness.md](checklists/scaling-readiness.md) |

**How to use**: open only the topic file relevant to the current task. New bot → `grammy.md` + `webhooks.md`. Webhook security → `troubleshooting.md` (secret_token) + `recommended-defaults.md`. Payments → `payments.md` + `wrong-vs-right.md` (pair #3). Scaling production → `scaling.md` + `recommended-defaults.md` concurrency section.
