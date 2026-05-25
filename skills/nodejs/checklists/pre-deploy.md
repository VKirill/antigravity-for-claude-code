# Node.js Pre-Deploy Checklist

Use this before deploying any Node.js service to production. Three sections: Pre-flight (before you push), Acceptance (after deploy, before traffic), Self-check (model verifies its own output).

---

## Pre-flight (run BEFORE deploying)

### Code quality
- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run lint` passes with zero errors (or agreed suppressions are documented)
- [ ] `npm test` passes — all tests green, coverage threshold met
- [ ] `npm run audit:deps` passes (or HIGH/CRITICAL vulns have a documented exception)
- [ ] No `console.log` in production code — Pino logger used throughout
- [ ] No `process.env.FOO` accessed directly — all env vars read through validated EnvSchema

### Graceful shutdown
- [ ] `process.once('SIGTERM', ...)` handler registered (not `process.on`)
- [ ] Deadman timer (`setTimeout(..., 30_000).unref()`) present in shutdown handler
- [ ] `app.close()` (Fastify) or `server.close()` (Express) called before closing DB/Redis
- [ ] PM2 ecosystem config has `wait_ready: true` and `kill_timeout > shutdown deadline`
- [ ] `process.send('ready')` called after server starts (for PM2 `wait_ready`)

### Error handling
- [ ] `AppError` hierarchy defined with `code`, `statusCode`, `cause`
- [ ] Global error handler returns structured JSON (not raw Error object)
- [ ] `unhandledRejection` handler registered as backstop logger
- [ ] No raw `error.stack` in API response bodies

### Security
- [ ] `helmet()` middleware registered
- [ ] CORS origin is an allowlist, not `'*'` in production
- [ ] Rate limiting on public/unauthenticated endpoints
- [ ] Passwords hashed with argon2id, not bcrypt, not MD5
- [ ] JWT tokens validated for signature + expiry + issuer/audience
- [ ] `timingSafeEqual` used for any token comparison
- [ ] No secrets in code, comments, or logs — only in env vars
- [ ] `.env` files are gitignored

### Performance
- [ ] No synchronous file I/O (`readFileSync`, `writeFileSync`) in request handlers
- [ ] No synchronous crypto (`pbkdf2Sync`, `randomBytes` sync variant) in request handlers
- [ ] Large serialization/parsing operations moved off main thread (worker, or batched)
- [ ] Connection pools (DB, Redis) sized appropriately (not `max: 1`, not `max: 500`)

### Observability
- [ ] Pino logger configured with `redact` for auth headers, passwords, tokens
- [ ] OpenTelemetry instrumentation loaded via `--import` before app code
- [ ] Health endpoint `/health` responds without auth and is registered in k8s liveness probe
- [ ] Log level controlled by env var (`LOG_LEVEL`), not hardcoded

### Docker / container
- [ ] Multi-stage Dockerfile (build stage separate from final stage)
- [ ] Final image is distroless or minimal (not `node:24`)
- [ ] Running as non-root user (uid 1000 in distroless/nodejs)
- [ ] `HEALTHCHECK` defined in Dockerfile
- [ ] OCI labels populated (`source`, `title`, `licenses`)

---

## Acceptance (run AFTER deploy, BEFORE full traffic)

- [ ] Health endpoint returns `200 { status: 'ok' }` on prod URL
- [ ] No unexpected errors in PM2 / pod logs in first 5 minutes
- [ ] p50/p95 latency on `/health` and key endpoints within SLA
- [ ] `process.uptime()` value is incrementing (no crash-loop)
- [ ] No `unhandledRejection` or `uncaughtException` in logs
- [ ] Circuit breaker states (if exposed) show CLOSED
- [ ] Auth flow works end-to-end (login → token → protected route)
- [ ] Rate limiting triggers correctly under test load (returns 429)
- [ ] Graceful shutdown test: send `SIGTERM`, confirm in-flight requests complete before process exits

---

## Self-check (model verifies before declaring done)

Before claiming the implementation is production-ready, verify:

- [ ] Every `process.env.X` access is inside the EnvSchema validation at startup
- [ ] Every async function that can throw has error handling at the appropriate boundary
- [ ] No `catch (err) { /* ignored */ }` — all caught errors are either re-thrown or logged
- [ ] Shutdown handler uses `process.once`, not `process.on`
- [ ] Health route is unrestricted (no JWT check, no rate limit or high limit)
- [ ] OpenTelemetry is loaded before app code, not after
- [ ] No hardcoded secrets, tokens, or passwords anywhere in the codebase
- [ ] `npm run typecheck` output is clean (not just the IDE)
- [ ] Tests cover at least: happy path, validation error, 404, unauthorized, graceful shutdown signal
