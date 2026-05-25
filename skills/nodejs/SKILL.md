---
name: nodejs
description: "Node.js 24 production — type stripping, native APIs, framework selection, graceful shutdown, security, observability. Use when: node, nodejs, node 24, --experimental-strip-types, ts-node alternative, AbortController, AbortSignal, AsyncLocalStorage, worker_threads, Piscina, SIGTERM, PM2, AppError, error.cause, argon2, node:sqlite, node:test, ESM, CJS interop, OpenTelemetry, Pino. SKIP: Fastify deep-dive (→fastify), Hono (→hono), BullMQ (→bullmq), TS type system (→typescript), Prisma (→prisma), Next.js (→nextjs)."
stacks:
  - nodejs-backend
  - backend
risk: high-stakes
packages:
  - express
  - fastify
  - hono
  - koa
  - pino
  - winston
  - socket.io
  - piscina
  - argon2
  - helmet
tags:
  - node
  - nodejs
  - typescript
  - backend
  - api
  - middleware
  - handler
source: merged(nodejs-backend-patterns + nodejs-expert)
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- Node.js: `24.x (Active LTS)`
- TypeScript: `6.0.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded automatically when its description matches the active task. Read only the section you need, then follow the link to the relevant reference.

## Use this skill when

- Building or debugging any Node.js backend service, CLI, or script on Node 24
- Running `.ts` directly via built-in type stripping (default in Node 24; flag-free)
- Choosing a web framework: Express 5, Fastify 5, Hono 4, NestJS — with data-driven rationale
- Implementing production patterns: graceful shutdown (SIGTERM/SIGINT), error hierarchies, health checks
- Working with async primitives: `AbortSignal.timeout`, `AbortSignal.any`, native fetch, `AsyncLocalStorage`
- Setting up `worker_threads`, Piscina pool, or PM2 cluster mode for CPU-bound / throughput scaling
- Wiring OpenTelemetry tracing, Pino structured logging, or Prometheus metrics
- Testing with `node:test` (zero-install native runner) or migrating to Vitest for snapshots
- Securing a Node backend: Helmet, CORS, rate limiting, argon2, JWT, env validation with Zod
- Debugging event loop stalls, memory leaks, or high latency with clinic.js / 0x / heap snapshots

## Do not use this skill when

- Task is TypeScript type-system design (conditional types, mapped types) — use `typescript`
- Task is Fastify deep-dive (hooks lifecycle, schema serialization) — use `fastify`
- Task is Hono-specific (middleware, RPC, CF Workers adapter) — use `hono`
- Task is BullMQ job queues — use `bullmq`
- Runtime is Deno or Bun exclusively — different runtime APIs
- Task is browser JavaScript (DOM, bundlers) — use `javascript`
- Task is Prisma ORM schema or migrations — use `prisma`
- Task is Next.js App Router SSR/RSC — use `nextjs`

## Purpose

Node.js 24 is the Active LTS runtime for production backends. It ships native TypeScript type stripping (on by default — no flag, no ts-node), native fetch/WebSocket/crypto globals, and `node:test` as the built-in runner — a production-ready Node service no longer requires a build pipeline or external test framework. This skill closes the gap between "I have a Node.js question" and "I have a working, observable, secure production service."

Coverage spans: project setup with type stripping, framework selection, feature-first architecture, error handling (`AppError` + `error.cause`), graceful shutdown under SIGTERM/SIGINT, async concurrency primitives, security hardening, OpenTelemetry + Pino observability, `worker_threads`, and `node:test`. Hands off to narrower framework skills (`fastify`, `hono`) and domain skills (`bullmq`, `prisma`, `redis`) when depth exceeds the Node-generic layer.

What this skill does NOT do: design TypeScript type systems, manage Prisma schema migrations, configure Next.js RSC, or operate BullMQ queues — those have dedicated skills.

## Capabilities

Each line below points to the canonical reference. The reference owns code, edge cases, and gotchas — not duplicated here.

- **Type stripping** — Node 24 strips TS types by default. `--no-strip-types` disables. `--experimental-transform-types` (RC) enables enums / parameter properties / namespaces. → [type-stripping.md](references/type-stripping.md)
- **Async & concurrency** — native fetch, `AbortSignal.timeout`, `AbortSignal.any`, `AsyncLocalStorage`, Promise patterns. → [async-patterns.md](references/async-patterns.md)
- **Framework selection** — Express 5 / Fastify 5 / Hono 4 / NestJS decision matrix; feature-first project structure. → [architecture.md](references/architecture.md)
- **Error handling** — `AppError` hierarchy, `error.cause` chains, `AggregateError`, `sanitizeError` for structured logs, `unhandledRejection` default behavior. → [error-handling.md](references/error-handling.md)
- **Graceful shutdown** — SIGTERM/SIGINT trap, HTTP drain, deadman timer, PM2 `wait_ready`, k8s `preStop`. → [shutdown.md](references/shutdown.md) | [examples/graceful-shutdown-fastify.md](examples/graceful-shutdown-fastify.md)
- **Worker threads & cluster** — decision matrix (I/O vs CPU vs HTTP scale vs background jobs), Piscina, `SharedArrayBuffer + Atomics`, per-worker `resourceLimits`. → [workers.md](references/workers.md)
- **Security** — env validation with Zod, Helmet, CORS allowlist, argon2id, JWT, parameterized queries, `timingSafeEqual`. → [security.md](references/security.md) | [checklists/security-hardening.md](checklists/security-hardening.md)
- **Observability** — Pino with `redact`, OpenTelemetry preload via `--import`, `AsyncLocalStorage`-carried trace context, clinic.js / 0x / autocannon / heap snapshots via `--heapsnapshot-signal=SIGUSR2`. → [monitoring.md](references/monitoring.md) | [examples/async-context-tracing.md](examples/async-context-tracing.md)
- **Testing** — `node:test` zero-install runner, `mock.fn` / `mock.method`, coverage flag, parallelism. Vitest only when snapshots or UI coupling demands it. → [testing.md](references/testing.md)
- **Streams & modules** — Web Streams global, Node streams `pipeline()`, ESM-first, CJS interop via `createRequire` / dynamic `import()`, `node:sqlite` (stable since v22.13/v23.4). → [streams.md](references/streams.md) | [modules.md](references/modules.md)
- **Recommended defaults** — canonical heap / `UV_THREADPOOL_SIZE` / shutdown grace / argon2 / OTel sampling / Pino redact / PM2 / Piscina values with tuning ranges. → [recommended-defaults.md](references/recommended-defaults.md)
- **Troubleshooting** — symptom-indexed: silent crash, memory leak, event loop stall, SIGTERM timeout, type-strip failures on enums, ESM/CJS interop, ALS lost, argon2 OOM, native module mismatch, worker OOM, Pino lost logs. → [troubleshooting.md](references/troubleshooting.md)
- **Wrong vs right** — 6 high-stakes pairs: uncaughtException swallow, ALS per-request, sync JSON.parse on body, timing-safe compare, subprocess deadman, env validation. → [wrong-vs-right.md](references/wrong-vs-right.md)

## Behavioral Traits

- Chooses framework based on deployment target, team size, throughput — not habit
- TypeScript strict mode always: `strict: true`, no `any` escapes, `unknown` at boundaries
- Validates all external input at the HTTP boundary; internal code trusts types
- Profiles before optimizing — never premature optimization without a measured baseline
- Uses Pino for structured, machine-readable logging; never `console.log` in production code
- Prefers `satisfies` for type assertion without widening
- Reaches for `node:test` first; only adds Vitest when snapshots or UI framework coupling demands it
- Implements `AppError` hierarchy before any domain-specific error logging
- Always uses `process.once` (not `process.on`) for SIGTERM/SIGINT — prevents double-shutdown re-entry
- Keeps worker messages JSON-serializable — no class instances or buffers without `transferList`
- Writes the simplest possible async code — no artificial promise chaining when `await` suffices
- Cites operational values from [recommended-defaults.md](references/recommended-defaults.md) — no inline magic numbers

## Important Constraints

- NEVER hardcode secrets — env vars validated with Zod at startup, never raw `process.env`
- NEVER use `fs.readFileSync` / `crypto.pbkdf2Sync` in request handlers — synchronous I/O blocks the event loop
- NEVER string-concatenate SQL — parameterized queries only
- NEVER `process.on` for SIGTERM/SIGINT — use `process.once` to prevent re-entry
- NEVER log raw Error objects in structured JSON — call `sanitizeError()` to strip stacks
- NEVER polyfill `fetch`, `WebSocket`, `URL`, or `crypto` — they are Node 24 globals
- NEVER swallow `uncaughtException` / `unhandledRejection` — log, flush, exit (see [wrong-vs-right.md](references/wrong-vs-right.md))
- NEVER compare secrets with `===` — use `crypto.timingSafeEqual` or `argon2.verify`
- ALWAYS set a deadman timer in shutdown handlers — prevents infinite hang on stuck connections
- ALWAYS load OpenTelemetry instrumentation before app code (`--import ./instrumentation.js`)
- ALWAYS pass `resourceLimits.maxOldGenerationSizeMb` to `Worker` constructors — pooled workers can collectively OOM the host

## Related Skills

**90%-filter applied** — each entry is the dominant or near-dominant choice in 2026. ✓ marks **active** skills; the rest are **cascade markers**.

### Language
- ✓ `typescript` — TS 6.0 (default pairing with Node 24 type-stripping; TS 6 emits `module: esnext` / `target: es2025` by default — matches Node 24 native ESM)

### Web frameworks
- ✓ `fastify` — Fastify 5 (Node-native production default)
- ✓ `hono` — Hono 4 (edge-first, multi-runtime)
- `express` — Express 5 (legacy + new projects)

### Data persistence
- ✓ `postgresql` — PG 18 (#1 SQL DB pairing)
- ✓ `redis` — Redis 8 (#1 cache/session/pub-sub)
- ✓ `prisma` — Prisma 7 (mainstream Node ORM)

### Background processing
- ✓ `bullmq` — BullMQ 5 (universal Node queue)

### Validation
- ✓ `zod` — Zod 4 (dominant TS-first runtime validation)

### Observability
- `opentelemetry` — OTel JS (universal tracing standard)
- `pino` — mainstream Node structured logger

### Auth
- `auth-patterns` — generic OAuth/OIDC/JWT/sessions
- `better-auth` — Better Auth (rising TS-first 2026 default)

### Lint & format
- ✓ `biome` · ✓ `eslint`

### Testing
- `testing` — Vitest 4 + Jest 30 umbrella · ✓ `playwright` — E2E

### Deploy & ops
- ✓ `linux-sysadmin` — PM2, systemd, Ubuntu 24.04
- `docker` · `github-actions` · `vercel` · `incident-responder`

### Frontend (uses Node as runtime/build)
- ✓ `astro` · ✓ `nextjs` · ✓ `nuxt` · ✓ `react` · ✓ `vue`

### Mobile (Node build toolchain)
- `react-native` — RN 0.85 + Expo 55

### Domain apps
- ✓ `telegram-bot` · `discord-bot`

### Payments (Node SDK consumers)
- ✓ `cloudpayments` · ✓ `yookassa` · `stripe-integration`

### AI coding CLIs (run on Node)
- ✓ `claude-code` · ✓ `opencode` · ✓ `codex`

### Code discipline
- ✓ `karpathy-guidelines`

### AI/LLM (Node side)
- `anthropic-sdk` · `vercel-ai-sdk` · `langchain` · ✓ `agent-evaluation`

## API Reference

### Reference files (Pattern 2)

Load only what's relevant for the current task:

| Topic | File |
|---|---|
| Decision map + quick patterns (AppError, circuit breaker, health check) | [references/REFERENCE.md](references/REFERENCE.md) |
| Type stripping defaults, tsconfig, transform-types RC for enums | [references/type-stripping.md](references/type-stripping.md) |
| Native fetch, `AbortSignal.{timeout,any}`, Promise patterns, AsyncLocalStorage | [references/async-patterns.md](references/async-patterns.md) |
| Web Streams, Node↔Web bridge, backpressure | [references/streams.md](references/streams.md) |
| ESM-first, CJS interop, `node:sqlite`, Permission Model | [references/modules.md](references/modules.md) |
| `node:test` runner, mocking, coverage, hooks | [references/testing.md](references/testing.md) |
| Express 5 / Fastify 5 / Hono 4, feature-first project structure | [references/architecture.md](references/architecture.md) |
| AppError, `error.cause`, AggregateError, unhandledRejection | [references/error-handling.md](references/error-handling.md) |
| SIGTERM/SIGINT, HTTP drain, PM2 `wait_ready`, k8s `preStop` | [references/shutdown.md](references/shutdown.md) |
| `worker_threads`, Piscina, cluster, SharedArrayBuffer, `resourceLimits` | [references/workers.md](references/workers.md) |
| Helmet, CORS, rate limiting, secrets, JWT, argon2id | [references/security.md](references/security.md) |
| Clinic.js, 0x, heap snapshots, OpenTelemetry, Pino | [references/monitoring.md](references/monitoring.md) |
| Event loop, heap monitoring, V8 profiling, performance budget | [references/performance.md](references/performance.md) |
| **Recommended defaults** — canonical heap / threadpool / shutdown / argon2 / Pino / PM2 values | [references/recommended-defaults.md](references/recommended-defaults.md) |
| **Troubleshooting** — symptom-indexed: silent crash, leak, stall, SIGTERM timeout, ESM/CJS, ALS lost | [references/troubleshooting.md](references/troubleshooting.md) |
| **Wrong vs right** — 6 high-stakes pairs (uncaughtException, ALS scope, JSON.parse, timing-safe, deadman, env) | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases (routing tests) | [references/eval-cases.md](references/eval-cases.md) |

### Templates

Production-ready boilerplates with `{{placeholder}}` markers:

| Template | File |
|---|---|
| Fastify 5 server: error handler, Pino, health, graceful shutdown, OTel stub | [templates/fastify-server.ts.template](templates/fastify-server.ts.template) |
| Express 5 equivalent | [templates/express-server.ts.template](templates/express-server.ts.template) |
| Multi-stage Dockerfile for Node 24: distroless final, non-root | [templates/Dockerfile.node24.template](templates/Dockerfile.node24.template) |
| Typed env vars with Zod validation comments | [templates/.env.example.template](templates/.env.example.template) |
| `package.json`: type:module, dev/build/start/test/lint scripts | [templates/package.json.template](templates/package.json.template) |

### Examples

End-to-end walkthroughs:

| Scenario | File |
|---|---|
| Graceful shutdown: trap → drain → close DB/Redis → PM2 + k8s + rollback | [examples/graceful-shutdown-fastify.md](examples/graceful-shutdown-fastify.md) |
| AsyncLocalStorage + Pino + OpenTelemetry: requestId through every layer | [examples/async-context-tracing.md](examples/async-context-tracing.md) |
| Outbound HTTP with circuit breaker + retry using `AbortSignal.timeout` | [examples/circuit-breaker-with-retry.md](examples/circuit-breaker-with-retry.md) |

### Scripts

| Script | File |
|---|---|
| `npm audit` + `npm outdated`, non-zero exit on high severity or stale majors | [scripts/check-deps.sh](scripts/check-deps.sh) |
| Profile event loop with clinic.js doctor; open flame graph | [scripts/profile-event-loop.sh](scripts/profile-event-loop.sh) |

### Checklists

| Checklist | File |
|---|---|
| Pre-deploy: pre-flight, acceptance, self-check | [checklists/pre-deploy.md](checklists/pre-deploy.md) |
| Security hardening: Helmet, CORS, rate limit, JWT, argon2, secrets, Permission Model | [checklists/security-hardening.md](checklists/security-hardening.md) |
| Incident response: OOM, event loop blocked, unhandledRejection storm + RCA | [checklists/incident-response.md](checklists/incident-response.md) |

**How to use**: open the specific file for the topic you need. New service → `architecture.md` + `recommended-defaults.md`. Production hardening → `security.md` + `shutdown.md` + `monitoring.md`. Debugging → `troubleshooting.md` first. Don't read everything — look up only what's relevant.
