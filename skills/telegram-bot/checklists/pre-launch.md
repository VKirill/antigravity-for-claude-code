# Pre-Launch Checklist

Run this before going live with a new Telegram bot or a major release.

---

## BotFather configuration

- [ ] `/newbot` completed — bot has a name, username (ends in `bot`), and token
- [ ] `/setdescription` — description set (≤ 512 chars, explains what the bot does)
- [ ] `/setabouttext` — about text set (≤ 120 chars, shown in profile bio)
- [ ] `/setuserpic` — profile photo uploaded (square, minimum 512×512 px)
- [ ] `/setcommands` — command list configured with at least `/start` and `/help`
- [ ] `/setprivacy` — privacy mode is appropriate (`enabled` for most bots; `disabled` only for group management bots that need to read all messages)
- [ ] `/setjoingroups` — set to `enabled` only if the bot supports group mode

---

## Webhook configuration

- [ ] `setWebhook` called with the correct HTTPS URL (port 443, 80, 88, or 8443)
- [ ] `secret_token` set in `setWebhook` and validated server-side on every request
- [ ] `allowed_updates` filtered to only the update types the bot handles
- [ ] `max_connections` set appropriately (default 40; up to 100 for high-traffic bots)
- [ ] `drop_pending_updates: true` on initial deploy (avoid processing stale updates)
- [ ] `getWebhookInfo()` verified — `pending_update_count` = 0, `last_error_message` = empty
- [ ] `validate-webhook.sh` script run — all 3 tests pass (200 OK, 401 wrong, 401 missing)

---

## Long polling (if not using webhooks)

- [ ] `bot.start({ allowed_updates: [...] })` with filtered update types
- [ ] `drop_pending_updates: true` set for fresh deploy
- [ ] `process.once("SIGTERM", ...)` and `process.once("SIGINT", ...)` registered
- [ ] grammY Runner used if expecting > 5 concurrent users (not plain `bot.start()`)
- [ ] `sequentialize` added before session middleware if using sessions

---

## Session storage

- [ ] RAM sessions replaced with Redis (`@grammyjs/storage-redis`) or file adapter
- [ ] Redis connection validated (`redis-cli ping` returns PONG)
- [ ] Session TTL set (`ttl` option in `RedisAdapter`) — no unbounded session growth
- [ ] Session key is unique per user+chat pair (prevents namespace collisions)

---

## Environment and secrets

- [ ] `.env` is in `.gitignore` — never committed to the repository
- [ ] `BOT_TOKEN` is not logged or printed anywhere in the codebase
- [ ] `WEBHOOK_SECRET` is a cryptographically random string (at least 32 chars): `openssl rand -hex 32`
- [ ] All env vars validated at startup with Zod (fail fast, not silently undefined)
- [ ] `ADMIN_USER_IDS` list is set and includes your own Telegram user ID

---

## Error handling

- [ ] `bot.catch()` global error handler registered
- [ ] Error handler does NOT expose stack traces or internal errors to users
- [ ] Every `callback_query` handler calls `ctx.answerCallbackQuery()` — verified in testing
- [ ] `pre_checkout_query` handler responds within 10 seconds for payment flows

---

## Monitoring and observability

- [ ] Structured logging middleware added (logs update_id, type, user_id, duration_ms)
- [ ] Pino or equivalent — no bare `console.log` in production handlers
- [ ] Health check endpoint `/health` returns 200 (for PM2 / Docker / k8s probes)
- [ ] Error alerting configured (Sentry DSN set, or PM2 error notifications active)
- [ ] PM2 `ecosystem.config.js` has `max_restarts: 10` and `restart_delay: 3000`

---

## Acceptance verification (run after deploy)

- [ ] Send `/start` to the bot — expected welcome message received
- [ ] Send `/help` — expected help message received
- [ ] Trigger a callback query — button spinner dismisses (answerCallbackQuery confirmed)
- [ ] `check-bot-permissions.sh` run — bot token valid, admin permissions match requirements
- [ ] Webhook info shows 0 pending updates and no error messages
- [ ] Logs show structured JSON output with no unhandled exceptions
