# Scaling Readiness Checklist

Run this before moving from single-instance to multi-instance deployment, or when traffic
grows beyond a single PM2 process.

---

## Session storage

- [ ] RAM session storage (`initial: () => ({})` with no adapter) replaced with Redis
- [ ] `RedisAdapter` from `@grammyjs/storage-redis` configured and tested
- [ ] Redis connection uses `maxRetriesPerRequest: null` (required for blocking ops)
- [ ] Session TTL set (`ttl` option) — prevents unbounded Redis memory growth
- [ ] Session key is deterministic and unique (typically `chat_id:user_id`)
- [ ] Redis persistence enabled (`appendonly yes` in `redis.conf`) — sessions survive Redis restart

---

## Middleware order (critical)

- [ ] `sequentialize` is FIRST in the middleware stack (before session)
- [ ] `session` is installed AFTER `sequentialize`
- [ ] `conversations()` is installed AFTER `session`
- [ ] `sequentialize` key matches session key — both use `chat_id` or `user_id` or combined
- [ ] Order verified: `sequentialize → session → conversations → your handlers`

---

## grammY Runner (long polling mode)

- [ ] `run(bot)` used instead of `bot.start()` for concurrent update processing
- [ ] `concurrency` limit set in `run()` options (start at 200; profile before increasing)
- [ ] `allowed_updates` filtered in `run()` fetch options — no unnecessary update types
- [ ] Runner graceful shutdown: `runner.isRunning() && await runner.stop()`
- [ ] `process.once` (not `process.on`) for SIGTERM/SIGINT — prevents double-shutdown

---

## Multi-instance (horizontal scaling)

- [ ] Webhook mode chosen for multi-instance (not long polling — only one instance can poll)
- [ ] OR leader election implemented for long polling (Redis SET NX + lease renewal)
- [ ] `secret_token` validated on every incoming webhook request
- [ ] Health check endpoint (`/health`) returns 200 for load balancer probes
- [ ] All instances share the same Redis — no per-instance in-memory state

---

## Rate limiting

- [ ] `apiThrottler()` from `@grammyjs/transformer-throttler` added to `bot.api.config`
- [ ] `autoRetry()` from `@grammyjs/auto-retry` added to `bot.api.config`
- [ ] Per-user rate limiter (`@grammyjs/ratelimiter`) uses Redis as `storageClient`
- [ ] Broadcast function throttles: 25 users per batch, 1-second delay between batches
- [ ] No unbounded `Promise.all` over all users — use batch loop

---

## Infrastructure

- [ ] Docker image uses non-root user and `node:24-alpine` base
- [ ] Redis `maxmemory` set with `allkeys-lru` eviction policy
- [ ] Redis `appendonly yes` for AOF persistence
- [ ] PM2 `kill_timeout: 30000` configured — gives 30 s for graceful shutdown
- [ ] Docker healthcheck targets `/health` endpoint
- [ ] Log aggregation configured (PM2 log rotation or centralized logging)

---

## Conversation isolation

- [ ] Conversations plugin uses Redis storage (not file or RAM)
- [ ] `version` field set in `conversations()` options — increment when conversation logic changes
- [ ] Conversation storage uses same Redis instance as sessions (OK to share, different key space)
- [ ] Tested: conversation survives bot restart (state restored from Redis)

---

## Monitoring and alerting

- [ ] Structured logs include `instance` (PID or pod name) field for multi-instance tracing
- [ ] Sentry or equivalent captures errors from `bot.catch()`
- [ ] Alert configured for: Redis connection loss, high error rate, bot process crash
- [ ] `getWebhookInfo()` checked — no persistent `last_error_message`
- [ ] `pending_update_count` monitored — spike indicates a stuck handler

---

## Acceptance after scaling

- [ ] Deploy 2+ instances and send concurrent messages — no duplicate responses
- [ ] Start a multi-step conversation, kill one instance, restart — conversation resumes correctly
- [ ] Send rapid messages from 2 users simultaneously — correct session isolation
- [ ] Trigger rate limiter — user receives "slow down" message exactly once
- [ ] Stop all instances, then restart — no stuck sessions or orphaned locks in Redis

---

## Self-check (model verifies before declaring done)

- [ ] `sequentialize` is before `session` in middleware chain
- [ ] No `bot.start()` in multi-instance webhook deployments
- [ ] No RAM session storage in any production or multi-instance path
- [ ] Redis `maxRetriesPerRequest: null` set (not missing)
- [ ] `process.once` (not `process.on`) for shutdown signals
