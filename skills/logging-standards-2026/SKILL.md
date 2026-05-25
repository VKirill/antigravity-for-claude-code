---
name: logging-standards-2026
description: "Production logging standards — structured JSON logs, correlation IDs, OpenTelemetry, log levels (TRACE/DEBUG/INFO/WARN/ERROR/FATAL) per environment, what-to-log vs what-NEVER-to-log (secrets/PII/req.body), Pino/structlog/loguru recipes, Sentry/Bugsnag error tracking, Grafana Loki aggregation, performance + cost discipline. Use when: настрой логирование, добавь логи, sensible logging, structured logging, correlation ID, request ID, trace ID, pino, structlog, loguru, sentry, observability, logs design, как залогировать, что логировать, что не логировать. SKIP: writing the application code itself (→stack skills); finding secrets that already leaked (→cybersecurity-audit); debugging via reading existing logs (→systematic-debugging)."
tags: [logging, observability, structured-logs, correlation, sentry, opentelemetry, production]
---

## Usage

Loaded automatically when the user asks to add/review/improve logging in an app. Used by main thread when implementing new services or modifying existing logging. Stack-agnostic core principles + per-stack recipes (Node/Python/frontend).

## Purpose

Without standards, every project ends up with `console.log` scattered randomly, no correlation IDs, secrets in logs, no log levels per environment, and a debug session that takes hours because the trail is incomplete. This skill encodes one consistent approach: structured JSON in prod, correlation IDs propagated through async chains, redaction of sensitive fields by default, log levels gated by env, and a clear list of what is and isn't worth logging. Read once, apply forever.

## Use this skill when

- Setting up logging on a new service / project
- Reviewing existing logging quality
- A debug session revealed missing observability — fixing that
- Migrating from `console.log` / `print` to structured logging
- Adding correlation/trace IDs across services
- Choosing a logging library for the stack
- Integrating error tracking (Sentry, Bugsnag, GlitchTip)
- Tuning log volume / cost / retention
- Adding logging to a long-running background job / queue worker
- Logging requirements emerge in a SPEC

## Do not use this skill when

- Writing the actual application code → use stack skill (`nodejs`, `fastapi`, `django`, etc.)
- Investigating a bug by reading existing logs → use `systematic-debugging`
- Auditing logs for already-leaked secrets → use `cybersecurity-audit`
- Choosing what metrics to expose → use observability/metrics skill (out of scope here)
- Designing a log-based alerting strategy → out of scope (this skill = data quality; alerting = data consumption)

## Capabilities

### What to log

The events worth recording. Auditable events (auth, payments, admin actions), boundary events (request entry/exit, external API calls), errors with context, slow operations.

→ Deep dive: [references/what-to-log.md](references/what-to-log.md)

### What NEVER to log

Passwords, tokens, JWT, API keys, full `req.body` raw, Authorization headers, PII (email/phone/address), credit-card numbers, full SQL query parameters that include user data. With regex patterns for automatic redaction.

→ Deep dive: [references/what-NEVER-to-log.md](references/what-NEVER-to-log.md)

### Log levels

TRACE / DEBUG / INFO / WARN / ERROR / FATAL — when to use which. Per-environment defaults (DEBUG in dev, INFO in staging, WARN in prod).

→ Deep dive: [references/log-levels.md](references/log-levels.md)

### Structured logging

JSON format with mandatory fields (`timestamp`, `level`, `msg`, `service`, `request_id`). Field naming conventions. Schema discipline.

→ Deep dive: [references/structured-logging.md](references/structured-logging.md)

### Correlation tracing

Request ID propagation across async chains (Node `AsyncLocalStorage`, Python `contextvars`). Linking logs to OpenTelemetry traces via `trace_id`/`span_id`. Cross-service correlation in microservices.

→ Deep dive: [references/correlation-tracing.md](references/correlation-tracing.md)

### Stack recipes

Concrete setup for each stack — base config, request logger, redaction, examples.

- Node.js → [references/stack-recipes-node.md](references/stack-recipes-node.md) (Pino + base config template)
- Python → [references/stack-recipes-python.md](references/stack-recipes-python.md) (structlog / loguru)
- Frontend (browser) → [references/stack-recipes-frontend.md](references/stack-recipes-frontend.md) (Sentry + PostHog; no console in prod)

### Error tracking

Sentry / Bugsnag / GlitchTip integration. What to capture, what NOT to capture, breadcrumbs, user context (PII-safe), release tracking, source maps.

→ Deep dive: [references/error-tracking.md](references/error-tracking.md)

### Log aggregation

Where logs go in prod (Grafana Loki + Promtail / Vector / Fluent Bit). PM2 + journalctl basics. Retention + cost.

→ Deep dive: [references/log-aggregation.md](references/log-aggregation.md)

### Performance and cost

Async appenders, hot-path discipline, sampling, log volume control, rotation, cost calculation.

→ Deep dive: [references/performance-and-cost.md](references/performance-and-cost.md)

## Behavioral Traits

- **Defaults to structured JSON in prod, pretty console in dev.** Never both.
- **Adds `request_id` to every log via context propagation** — never relies on developers passing it manually.
- **Logs at boundaries**, not in the middle of pure functions.
- **Treats secrets / PII as already redacted** at the logger layer — no leak via developer error.
- **Picks one logging library per language**, doesn't mix.
- **Logs the error stack with context**, not just the error message.
- **Levels are environment-driven** — same code, different verbosity per env, controlled by env var.
- **Logs slow operations** with duration, not "operation done".
- **Never logs in hot paths** without sampling.
- **Documents one auditable event per action** that matters (login, payment, admin action) — for future incident review.

## Important Constraints

- NEVER use `console.log` in production code paths (Node) — always pass through Pino / structured logger
- NEVER use `print()` in production Python — always through `logging` / structlog / loguru
- NEVER log raw `req.body`, `req.headers`, password, JWT, API key, credit card, full SSN
- NEVER log Authorization header — even after "I'll redact it later"
- NEVER mix logging libraries within one service (pino + winston → mess)
- NEVER block the event loop for logging — use async / buffered appenders
- NEVER ship console logs to user-visible build (frontend prod) — strip via build config
- ALWAYS propagate `request_id` through AsyncLocalStorage (Node) / contextvars (Python)
- ALWAYS include service name + environment in every log entry
- ALWAYS structure log fields consistently (one schema across all services in the org)
- ALWAYS set log level via env var with sensible default (INFO in prod, DEBUG in dev)
- ALWAYS verify log retention + cost before shipping (10x log volume = 10x cost surprise)

## Related Skills

### Stacks (where the actual logging code lives)
- ✓ `nodejs` — process.env, AbortController, AsyncLocalStorage
- ✓ `fastapi` — middleware, contextvars
- ✓ `django` — LOGGING dict, request middleware
- ✓ `python` — logging module foundations
- ✓ `nextjs` / `nuxt` / `astro` — framework-specific middleware
- ✓ `fastify` / `hono` — Pino built-in; first-class structured logging
- ✓ `bullmq` — per-job logger context

### Discipline
- ✓ `karpathy-guidelines` — minimal-change discipline applies to logging too (don't log what nobody reads)
- ✓ `cybersecurity-audit` — for hunting secrets that already leaked; this skill prevents future leaks
- ✓ `systematic-debugging` — for using logs to debug; this skill ensures logs are good enough

### Verification
- `worker-security-verifier` agent — runs greps for secrets in logged content; complements this skill's discipline

## API Reference

| Topic | File |
|---|---|
| Index, decision map | [references/REFERENCE.md](references/REFERENCE.md) |
| What to log (auditable events, boundaries, errors, slow ops) | [references/what-to-log.md](references/what-to-log.md) |
| What NEVER to log (secrets/PII + redaction patterns) | [references/what-NEVER-to-log.md](references/what-NEVER-to-log.md) |
| Log levels — TRACE/DEBUG/INFO/WARN/ERROR/FATAL per env | [references/log-levels.md](references/log-levels.md) |
| Structured logging — JSON schema, mandatory fields | [references/structured-logging.md](references/structured-logging.md) |
| Correlation tracing — request_id, AsyncLocalStorage, OpenTelemetry | [references/correlation-tracing.md](references/correlation-tracing.md) |
| Node.js recipes — Pino + middleware + AsyncLocalStorage | [references/stack-recipes-node.md](references/stack-recipes-node.md) |
| Python recipes — structlog / loguru + contextvars | [references/stack-recipes-python.md](references/stack-recipes-python.md) |
| Frontend recipes — no console in prod, Sentry + PostHog | [references/stack-recipes-frontend.md](references/stack-recipes-frontend.md) |
| Error tracking — Sentry / Bugsnag setup, breadcrumbs, source maps | [references/error-tracking.md](references/error-tracking.md) |
| Log aggregation — Loki + Promtail, PM2 + journalctl, retention | [references/log-aggregation.md](references/log-aggregation.md) |
| Performance + cost — async appenders, sampling, volume control | [references/performance-and-cost.md](references/performance-and-cost.md) |

## Templates

| Template | File |
|---|---|
| Pino base config (TypeScript) — JSON in prod, pretty in dev, redaction, AsyncLocalStorage | [templates/pino-base-config.ts.template](templates/pino-base-config.ts.template) |
| structlog base config (Python) — JSON renderer, contextvars, request middleware | [templates/structlog-base-config.py.template](templates/structlog-base-config.py.template) |
| Sentry init — Node + frontend, PII-safe, release tracking | [templates/sentry-init.template](templates/sentry-init.template) |
