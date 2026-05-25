# telegram-bot — CHANGELOG

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and SemVer.

---

## [2.1.0] — 2026-05-16

### Removed (Telegraf is unsupported since 2024 — no point covering it)
- All Telegraf 4.x references and migration guidance. Sole production framework is now grammY 1.x.
- `SKILL.md` — description trigger `Telegraf` removed; "grammY 1.x or Telegraf 4.x" → "grammY 1.x on Node 24 + TypeScript 5.9"; `packages.telegraf` entry dropped; "Telegraf 4.x for legacy" callout removed from Purpose + Use-when + Behavioral Traits.
- `references/scaling.md` — full "Telegraf 4.x vs grammY 1.x" comparison table + "Telegraf Migration to grammY" snippet deleted.
- `references/recommended-defaults.md` — framework knob row simplified to grammY-only.
- `references/eval-cases.md` — edge case "сравни grammY и Telegraf" rewritten to recommend grammY without reservations.
- `templates/Dockerfile.bot.template` — header "grammY/Telegraf bot" → "grammY bot".
- Previous CHANGELOG bullet about "Primary recommendation: changed from Telegraf to grammY" preserved as historical record.

### Rationale
Telegraf framework stopped active maintenance around 2024; community migrated to grammY. Keeping legacy guidance in a production skill is misleading — readers may pick Telegraf, hit Bot API gaps, and waste time rewriting. Single source of truth is cleaner.

---

## [2.0.0] — 2026-05-15 (skill-evaluation v3 retrofit)

### Changed (BREAKING)

- **Frontmatter** — added `risk: high-stakes` (bots handle webhook secret_token, Mini App `initData` HMAC, Telegram Stars / fiat payments, business connection tokens). Aligns with cloudpayments/yookassa/bullmq for cross-skill consistency.
- **SKILL.md** — compressed from 251 → 207 lines, Capabilities reduced to bullmq-style one-liners with reference links; redundant prose moved into `references/*.md`. Behavioral Traits + Important Constraints stay (process discipline, not knowledge).
- **API Reference table** — added `recommended-defaults`, `troubleshooting`, `wrong-vs-right` rows.

### Added — high-stakes operational artifacts

- `references/recommended-defaults.md` — canonical values for framework choice, update delivery mode, `secret_token` length & validation, Bot API HTTP client, concurrency (sequentialize + runner concurrency), session storage matrix, Mini App `initData` validation (HMAC derivation, 24h TTL), Stars XTR idempotency + 30-day refund window, Payments 2.0 fiat units, business connection scope, file upload limits, inline-query throttling, broadcast rate limits, webhook retry budget, allowed_updates filter, bot token rotation procedure. Cited by all other references. Last verified 2026-05-15 against Bot API 10.0.
- `references/troubleshooting.md` — symptom-indexed (16 entries): Webhook never arrives (TLS chain, port 443/80/88/8443, IP block) · `secret_token` mismatch (env swap, whitespace) · `409 Conflict: terminated by other getUpdates request` · Mini App `initData` HMAC fails (token rotation, derivation order, TTL) · "Forbidden: bot was blocked" (no-retry, mark inactive) · `successful_payment` → no grant (idempotency miss on `telegram_payment_charge_id`) · Stars XTR refund silent (30-day window) · Business connection auth broken · callback_data collision · 413 file upload · 429 Too Many Requests · Webhook handler timeout (offload to BullMQ) · `Telegram.WebApp` undefined · Session race under concurrency · Stars subscription not renewing.
- `references/wrong-vs-right.md` — 5 high-stakes pairs (❌/✅/Why it matters per skill-evaluation v3): (1) webhook handler trust vs `secret_token` validation; (2) Mini App `initDataUnsafe` trust vs server-side HMAC re-validation; (3) grant in `pre_checkout_query` vs `successful_payment` with idempotency; (4) MemorySessionStorage + Runner sans sequentialize vs Redis + sequentialize-before-session; (5) long polling on N instances vs webhook + cluster.
- `references/eval-cases.md` — rewritten to v3 format: user-voice prompts (Russian: "не приходит webhook от телеги", "почему initData не валидируется", "Stars XTR рефанд молчит", "Mini App не открывается вне клиента", "409 Conflict при getUpdates") + "Expected behavior" column citing specific reference files. 10 positive / 10 negative / 5 edge cases. "How to verify" procedure included.

### Fixed — hallucinations caught via Context7 (`/websites/grammy_dev`) + Bot API verification

- `references/grammy.md:384–389` — `conversations({ storage, version: 1 })` was structurally wrong. Correct form (per grammy.dev/plugins/conversations): `conversations({ storage: { type: "key", version: 1, adapter: <Adapter> } })`. `version` lives inside the storage config object, not as a sibling. Fixed.
- `references/bot-api.md:222–224` — `getManagedBotToken(user_id)` had a parameter that doesn't exist. Per grammy.dev/ref/core/context, the method takes no `user_id` — only an optional `signal: AbortSignal`. The token is for the managed bot attached to the current bot's user. Fixed + added companion `Keyboard.requestManagedBot()` reference.
- `references/grammy.md:373–379` — overstated `conversation.external()` semantics ("cached after first run" implied a memoization decorator). Replaced with accurate description: "runs once; result is persisted by the plugin and reused on subsequent replays" + serializability constraint (`JSON.parse(JSON.stringify(data))` semantics, no ORM model instances).

### Verified — Context7 + core.telegram.org

- Bot API 10.0 method surface confirmed: `answerGuestQuery`, `getManagedBotToken`, `setChatMemberTag`, `deleteMessageReaction`, `deleteAllMessageReactions`, `getChatAdministrators` `return_bots` param. All exist as documented in current `bot-api.md`.
- grammY imports / types confirmed: `Bot`, `Context`, `session`, `SessionFlavor`, `InlineKeyboard`, `webhookCallback`, `GrammyError`, `HttpError`, `Composer`, `InputFile`, `InlineQueryResultBuilder`, `Keyboard`, `LazySessionFlavor`, `lazySession`.
- grammY plugins confirmed: `@grammyjs/runner` (`run`, `sequentialize`), `@grammyjs/conversations` (`conversations`, `createConversation`, `Conversation`, `ConversationFlavor`, `external`), `@grammyjs/hydrate` (`HydrateFlavor`, `hydrate`), `@grammyjs/storage-file` (`FileAdapter`), `@grammyjs/storage-redis` (`RedisAdapter`), `@grammyjs/menu` (`Menu`), `@grammyjs/auto-retry` (`autoRetry`), `@grammyjs/ratelimiter` (`limit`), `@grammyjs/transformer-throttler` (`apiThrottler`).
- Stars XTR API confirmed: `currency: "XTR"`, `refundStarPayment(user_id, telegram_payment_charge_id)`, `successful_payment.is_recurring`, `successful_payment.subscription_expiration_date`, `sendPaidMedia`, `PayButton` semantics.
- Mini App `initData` validation confirmed: secret key derivation is `HMAC_SHA256(key="WebAppData", message=bot_token)` then `HMAC_SHA256(key=secret_key, message=data_check_string)` — fixed in `troubleshooting.md` with paste-runnable Node `crypto` snippet.

### Preserved

- `references/bot-api.md` (with `getManagedBotToken` fix above)
- `references/grammy.md` (with `conversations`/`external` fixes above)
- `references/mini-apps.md` — current; not rewritten
- `references/payments.md` — current; not rewritten
- `references/webhooks.md` — current; not rewritten
- `references/scaling.md` — current; not rewritten
- `templates/*` — preserved
- `examples/*` — preserved
- `scripts/*` — preserved
- `checklists/*` — preserved
- `<!-- versions:start -->...<!-- versions:end -->` block — preserved exactly (sync-script-owned)

---

## [1.1.0] — 2026-05-15 (earlier session)

### Changed (BREAKING)

- **SKILL.md** — zero-baseline rewrite per skill-evaluation v2 standards. Old content inherited from vibeship-spawner scaffold; new content written fresh against Bot API 10.0 and grammY 1.x
- **Description** — expanded from 5 trigger terms to 25+; added SKIP rules for Python aiogram, Discord, Matrix/Slack, Telegram desktop client
- **Primary recommendation** — changed from Telegraf to grammY 1.x (now leads; Telegraf mentioned as legacy/migration path)
- **Related Skills** — rewritten semantically per cascade-generation.md; removed non-existent skill references; added active ✓ marks

### Added

- `references/eval-cases.md` — 10 positive / 10 negative / 5 edge routing test cases
- `templates/grammy-bot.ts.template` — production grammY bot
- `templates/webhook-server-fastify.ts.template` — Fastify 5 webhook with secret_token validation hook
- `templates/webhook-server-hono.ts.template` — Hono webhook handler (Cloudflare Workers ready)
- `templates/bot.env.example.template` — typed env vars with descriptions
- `templates/Dockerfile.bot.template` — Node 24 multi-stage, non-root user, HEALTHCHECK
- `examples/payment-with-stars.md` — end-to-end Stars flow
- `examples/mini-app-launch.md` — BotFather setup, HMAC-SHA256 validation, sendData vs answerWebAppQuery, deep links
- `examples/scaling-multi-instance.md` — Runner + sequentialize, Redis sessions, leader election, PM2, Docker Compose
- `scripts/validate-webhook.sh` — 3-test webhook validator (200/401/401)
- `scripts/check-bot-permissions.sh` — getMe + getChatAdministrators checker
- `checklists/pre-launch.md`, `checklists/payment-integration.md`, `checklists/scaling-readiness.md`

---

## [1.0.0] — 2026-05-15 (earlier session)

### Added

- Initial SKILL.md from vibeship-spawner scaffold (Apache 2.0)
- 6 reference files split from original monolith
