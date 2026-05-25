---
name: fastify
description: "Fastify 5 — Node-native production HTTP framework. Schema-based validation, plugin encapsulation, hooks pipeline, TS type providers. Use when: fastify, FastifyInstance, fastify.register, fastify-plugin, withTypeProvider, TypeBoxTypeProvider, fastify-type-provider-zod, @fastify/jwt, @fastify/cors, @fastify/helmet, @fastify/rate-limit, @fastify/swagger, @fastify/multipart, addContentTypeParser, setErrorHandler, preHandler, keepAliveTimeout, trustProxy, fastify.inject, graceful shutdown. SKIP: Hono/edge (→hono), Express (→express), NestJS (→nestjs cascade), pure node:http (→nodejs)."
stacks:
  - nodejs-backend
  - fastify
  - backend
packages:
  - fastify
  - "@fastify/jwt"
  - "@fastify/cors"
  - "@fastify/helmet"
  - "@fastify/rate-limit"
  - "@fastify/swagger"
  - "@fastify/type-provider-typebox"
  - "@fastify/type-provider-json-schema-to-ts"
  - "fastify-plugin"
  - "fastify-type-provider-zod"
  - "fastify-raw-body"
tags:
  - fastify
  - nodejs
  - typescript
  - backend
  - api
  - http
  - validation
  - plugins
manifests:
  - package.json
source: vechkasov-global-skills
risk: high-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- Fastify: `5.x`
- Node.js: `24.x (Active LTS)`
- TypeScript: `6.0.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded automatically when its description matches the active task. Read only the section you need.

## Use this skill when

- Building or migrating a production HTTP API on Node.js using Fastify 5
- Designing route schemas (querystring / params / body / response) with JSON Schema, TypeBox, or Zod via adapter
- Configuring type providers (`withTypeProvider<TypeBoxTypeProvider>()`) for end-to-end type safety
- Writing plugins — `fastify-plugin` for global registration, encapsulation by default
- Using lifecycle hooks: `onRequest` → `preParsing` → `preValidation` → `preHandler` → handler → `preSerialization` → `onSend` → `onResponse` (+ `onError`)
- Integrating `@fastify/jwt`, `@fastify/cookie`, `@fastify/cors`, `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/swagger`, `@fastify/multipart`, `@fastify/websocket`
- Wiring schema-based response serialization (`fast-json-stringify`)
- Setting up Pino structured logging (built-in)
- Capturing raw body for webhook HMAC verification (`addContentTypeParser` with `parseAs: 'buffer'`, or `fastify-raw-body`)
- Migrating from Fastify 4 to 5 (Node 20+, full JSON Schema, type provider split, removed `request.routerPath`)
- Testing routes with `fastify.inject()` against Vitest / `node:test`

## Do not use this skill when

- Task targets Hono / edge runtimes / Cloudflare Workers — use `hono`
- Task is Express 4/5 middleware migration — use `express` (cascade) or refactor toward Fastify
- Task is NestJS DI / decorators / modules — use `nestjs` (cascade)
- Task is pure Node `http`/`node:http` without a framework — use `nodejs`
- Task is a Prisma query / migration — use `prisma` (Fastify is just the HTTP layer)
- Task is BullMQ queue / worker — use `bullmq` (Fastify hosts the admin UI / enqueue routes only)

## Purpose

Fastify 5 is the highest-throughput, lowest-overhead production HTTP framework for Node.js — built around JSON-Schema validation, plugin encapsulation, hooks, async-by-default. It's the Node-native choice for teams that need Express-class ergonomics with 4–6× the throughput and first-class TypeScript via type providers (no decorators, no runtime metadata).

This skill covers the full server lifecycle: instance creation, route schemas with TypeBox/Zod, plugin design with `fastify-plugin` and encapsulation rules, the 11-stage hook pipeline, error handling via `setErrorHandler`/`setNotFoundHandler`, schema-driven serialization, JWT/cookie/CORS/helmet/rate-limit/swagger plugins, raw-body webhook patterns, graceful shutdown, and `fastify.inject()` testing.

What this skill does NOT do: Node runtime internals (see `nodejs`), TypeScript type-system design (see `typescript`), Zod schema authoring (see `zod`), ORM queries (see `prisma`), queue jobs (see `bullmq`).

## Capabilities

Each line points to the canonical reference. The reference owns code, edge cases, gotchas — do not duplicate them here.

- **Core API & lifecycle** — `Fastify(opts)`, `ready()`, `listen()`, `close()`, hooks, decorators, Pino logger. → [core-api.md](references/core-api.md)
- **Routing & schemas** — shorthand, `app.route(...)`, full JSON Schema, `addSchema` + `$ref`, content-type parsers. → [routing.md](references/routing.md)
- **Validation & type providers** — TypeBox / json-schema-to-ts / Zod adapter; Fastify 5 split into `validator` + `serializer`. → [validation-schemas.md](references/validation-schemas.md)
- **Plugins & encapsulation** — `fastify-plugin` (`fp`) for hoisting; dependency declaration; ecosystem map. → [plugins-ecosystem.md](references/plugins-ecosystem.md)
- **Authentication** — `@fastify/jwt`, `@fastify/cookie`, `@fastify/auth`, `preHandler` patterns. → [authentication.md](references/authentication.md)
- **Error handling** — `setErrorHandler` single source of truth, `AppError`, validation-error mapping, 404 handler. → [error-handling.md](references/error-handling.md)
- **Performance** — schema serialization (2–4× speedup), `keepAliveTimeout` < LB, no `register` in handlers. → [performance.md](references/performance.md)
- **Testing** — `app.inject()`, `buildApp()` factory, Vitest / `node:test`. → [testing.md](references/testing.md)
- **Migration v4 → v5** — Node 20+, full JSON Schema, type provider split, `request.routerPath` removed, `bodyLimit` change. → [migration.md](references/migration.md)
- **Recommended defaults** — canonical `bodyLimit`/`keepAliveTimeout`/`requestTimeout`/CORS/rate-limit/Pino values with tuning ranges. → [recommended-defaults.md](references/recommended-defaults.md)
- **Troubleshooting** — symptom-indexed: schema errors, raw-body lost, plugin encapsulation surprise, `FST_ERR_*` matrix, 502 from upstream, shutdown drops, response stripping. → [troubleshooting.md](references/troubleshooting.md)

## Behavioral Traits

- Always defines a `response` schema for every route — drives validation AND `fast-json-stringify` serialization
- Wraps decorator-installing plugins with `fastify-plugin` (`fp`) so they hoist to the parent scope
- Uses `withTypeProvider<TypeBoxTypeProvider>()` (or Zod adapter) — zero schema/type duplication
- Throws structured errors with `statusCode` + `code`; centralizes in `setErrorHandler`
- Uses `preHandler` for auth (not `onRequest`) — auth often needs the parsed body
- Treats `request.log` (Pino child with reqId) as the only logger; never `console.log`
- Sets `keepAliveTimeout` **less than** upstream LB idle timeout — prevents 502 races
- Builds the app via a `buildApp()` factory so tests can spin up fresh instances cheaply
- Captures raw body via `addContentTypeParser` with `parseAs: 'buffer'` for HMAC webhooks
- Defers values to [recommended-defaults.md](references/recommended-defaults.md) — no inline magic numbers

## Important Constraints

- NEVER call `app.register()` inside a route handler — plugin tree compiles once at `ready()`
- NEVER mix sync `done()` callbacks with `async` in the same hook — pick one style
- NEVER skip schema validation on public endpoints — `body` schema is your input-sanitization layer
- NEVER use Fastify 4 shorthand schemas (`{ name: { type: 'string' } }`) — Fastify 5 requires full JSON Schema
- NEVER set `keepAliveTimeout` ≥ upstream LB keepalive — guarantees 502 races (see [troubleshooting.md](references/troubleshooting.md))
- NEVER use `JSON.stringify(req.body)` for HMAC — key order is non-deterministic; capture raw body instead
- NEVER set `origin: '*'` with `credentials: true` — browser silently drops the request
- ALWAYS wrap decorator plugins with `fastify-plugin` if visible to siblings is required
- ALWAYS register `@fastify/helmet` and `@fastify/cors` **before** route plugins
- ALWAYS configure `setErrorHandler` — the default leaks stack traces in dev
- ALWAYS `await app.close()` in test teardown — leaks Pino transports and sockets otherwise

## Related Skills

**90%-filter applied** — mainstream 2026 stack pairings with Fastify in production Node services.

### Runtime & language
- ✓ `nodejs` — Node 24 LTS
- ✓ `typescript` — TS 5.9 with type providers

### Edge / alternative HTTP
- ✓ `hono` — for edge/serverless (Workers / Vercel Edge / Bun)

### Validation
- ✓ `zod` — Zod 4 via `fastify-type-provider-zod`

### Persistence
- ✓ `prisma` — Prisma 7 ORM (registered as `app.db` decorator)
- ✓ `postgresql` — Postgres 18 (raw SQL via `pg` / `postgres.js`)
- ✓ `redis` — Redis 8 (session store, rate-limit backend, cache)

### Background jobs
- ✓ `bullmq` — Fastify enqueues; worker process runs separately

### Frontend consumers
- ✓ `nextjs`, ✓ `nuxt`, ✓ `react`

### Domain
- ✓ `telegram-bot` — Fastify is the canonical webhook receiver for grammY/Telegraf
- ✓ `cloudpayments` — HMAC-SHA256 raw-body verification
- ✓ `yookassa` — IP allowlist + payment re-fetch

### Deploy & ops
- ✓ `linux-sysadmin` — Ubuntu 24.04 / Angie / PM2
- `docker` — Docker 29 [cascade marker]

### Testing
- ✓ `vitest` — Vitest 4 with `fastify.inject()`
- ✓ `playwright` — E2E against live server

### Code discipline
- ✓ `karpathy-guidelines`

## API Reference

| Topic | File |
|---|---|
| Core API — Fastify(), lifecycle, hooks, decorators, logger | [references/core-api.md](references/core-api.md) |
| Routing — shorthand, route options, schemas, content-type parsers | [references/routing.md](references/routing.md) |
| Validation — JSON Schema, TypeBox, json-schema-to-ts, Zod adapter | [references/validation-schemas.md](references/validation-schemas.md) |
| Plugins — `fastify-plugin`, encapsulation, dependencies, ecosystem | [references/plugins-ecosystem.md](references/plugins-ecosystem.md) |
| Authentication — @fastify/jwt, @fastify/cookie, preHandler patterns | [references/authentication.md](references/authentication.md) |
| Error handling — setErrorHandler, AppError, validation errors, 404 | [references/error-handling.md](references/error-handling.md) |
| Performance — response schemas, keepAliveTimeout, hot-path tips | [references/performance.md](references/performance.md) |
| Testing — fastify.inject(), buildApp() factory, Vitest | [references/testing.md](references/testing.md) |
| Migration v4 → v5 — Node 20+, JSON Schema, type provider split | [references/migration.md](references/migration.md) |
| **Recommended defaults** — bodyLimit/keepAliveTimeout/CORS/rate-limit/Pino + tuning ranges | [references/recommended-defaults.md](references/recommended-defaults.md) |
| **Troubleshooting** — schema errors, raw-body lost, FST_ERR matrix, 502, shutdown | [references/troubleshooting.md](references/troubleshooting.md) |
| **Wrong vs Right** — schema/no-schema, raw-body, plugin encapsulate, trustProxy, logger redact | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases | [references/eval-cases.md](references/eval-cases.md) |

### Templates

| Template | File |
|---|---|
| Minimal Fastify 5 server with Pino + health + graceful shutdown | [templates/minimal-server.ts.template](templates/minimal-server.ts.template) |
| Fastify + Zod via `fastify-type-provider-zod` — typed req/res | [templates/fastify-with-zod.ts.template](templates/fastify-with-zod.ts.template) |
| `@fastify/jwt` auth plugin — preHandler authentication | [templates/jwt-auth-plugin.ts.template](templates/jwt-auth-plugin.ts.template) |

### Examples

| Scenario | File |
|---|---|
| TypeBox CRUD with type provider + Prisma + tests | [examples/typebox-crud-with-tests.md](examples/typebox-crud-with-tests.md) |
| Webhook receiver with raw-body + HMAC (CloudPayments-style) | [examples/webhook-with-hmac.md](examples/webhook-with-hmac.md) |

**How to use**: open the specific topic file. New project → `core-api.md` + `routing.md`. Type safety → `validation-schemas.md`. Auth → `authentication.md`. Upgrading → `migration.md`. Production hardening → `recommended-defaults.md` + `troubleshooting.md`.
