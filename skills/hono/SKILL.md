---
name: hono
description: "Hono 4 — small ultrafast multi-runtime web framework on Web Standards. Use when: hono, honojs, Cloudflare Workers, Bun, Deno, Vercel Edge, AWS Lambda, hono Context (c.req, c.json, c.env, c.var), hc<AppType>() RPC client, zValidator, @hono/zod-validator, hono/jwt, hono/cors, hono/cookie, hono/etag, hono/secure-headers, hono/body-limit, hono/compress, RegExpRouter, TrieRouter, LinearRouter, hono/tiny, @hono/node-server, KVNamespace, D1Database, R2Bucket, DurableObjectNamespace. SKIP: Fastify / Node-native (→fastify), Express (→express), NestJS (→nestjs cascade), itty-router (niche)."
stacks:
  - hono
  - edge-runtime
  - nodejs-backend
  - typescript
packages:
  - hono
  - "@hono/node-server"
  - "@hono/zod-validator"
  - "@hono/zod-openapi"
  - "@hono/swagger-ui"
tags:
  - hono
  - edge
  - cloudflare-workers
  - bun
  - deno
  - vercel-edge
  - typescript
  - rpc
  - web-standards
manifests:
  - package.json
  - wrangler.toml
source: vechkasov-global-skills
risk: high-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- Hono: `4.x`
- Node.js: `24.x (Active LTS)`
- TypeScript: `6.0.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded automatically when its description matches the active task. Read only the section you need.

## Use this skill when

- Building a web app or API targeting **edge runtimes** — Cloudflare Workers, Vercel Edge, Deno Deploy, Bun, Fastly Compute@Edge, AWS Lambda
- Building a Node.js HTTP server with `@hono/node-server` adapter (minimal bundle / startup)
- Using `c.req.valid('json'/'query'/'param'/'header'/'form'/'cookie')` with `@hono/zod-validator`
- Generating a type-safe RPC client (`hc<AppType>()`) consumed from the frontend
- Composing built-in middleware: `cors`, `logger`, `etag`, `csrf`, `secureHeaders`, `jwt`, `basicAuth`, `bearerAuth`, `bodyLimit`, `compress`, `prettyJSON`, `serveStatic`, `cache`, `timeout`, `requestId`
- Generating OpenAPI specs via `@hono/zod-openapi`
- Choosing routers: `RegExpRouter` (default), `TrieRouter`, `LinearRouter` (Lambda cold start), `SmartRouter` (auto), `hono/tiny`
- Writing a route factory (`createFactory().createHandlers(...)`) for shared middleware composition
- Wiring cookies via `setCookie`/`getCookie`/`setSignedCookie` from `hono/cookie`
- Workers bindings: `KVNamespace`, `D1Database`, `R2Bucket`, `DurableObjectNamespace`, `Queue<T>`
- Testing routes via `app.request(url, init)` — no socket, no port

## Do not use this skill when

- Task targets a Node-native, plugin-heavy production server with JSON-Schema serialization → use `fastify`
- Task is Express 4/5 migration to a Node-native equivalent → `express` cascade or `fastify`
- Task is NestJS modules / DI / decorators → `nestjs` cascade
- Task is a Cloudflare Workers question NOT involving HTTP routing (KV/DO/D1 schema) → `cloudflare-workers` cascade
- Task is Prisma ORM, BullMQ, or Redis specifics — use the dedicated skills (Hono is the HTTP shell)
- Task is itty-router / Worktop / Sunder — niche, general assistant

## Purpose

Hono is the dominant choice for Web-Standards HTTP services in 2026. It runs on **any** runtime that implements the Fetch API (Workers, Deno, Bun, Vercel Edge, Lambda, Node via adapter) with the same code. ~3× faster than Express on Node; sub-ms cold start on Workers. Zero external runtime deps; ~14 kB minified+gzip (core) or ~12 kB (`hono/tiny`).

This skill covers the full lifecycle: app construction, routing, the `Context` API (`c.req`/`c.res`/`c.var`/`c.env`/`c.executionCtx`), the middleware pipeline, runtime adapters (Workers / Bun / Vercel / Deno / Node / Lambda), Zod validators, the type-safe RPC client `hc<AppType>()`, Workers bindings types, and testing via `app.request()`.

What this skill does NOT do: Cloudflare Workers internals beyond HTTP (KV/DO data modeling), Bun/Deno runtime APIs, Node event loop (see `nodejs`), TypeScript type-system depth (see `typescript`), Zod schema authoring (see `zod`).

## Capabilities

Each line points to the canonical reference. The reference owns code, edge cases, gotchas — do not duplicate them here.

- **Core API** — `new Hono<{ Bindings, Variables }>()`, Context (`c.req/c.env/c.var`), routers, app lifecycle, `HTTPException`, streaming. → [core-api.md](references/core-api.md)
- **Routing & Context** — patterns (`:id`, `:id{[0-9]+}`, `*`), sub-apps via `app.route`, `basePath`, `createFactory()`. → [routing-and-context.md](references/routing-and-context.md)
- **Middleware** — built-ins (`hono/cors`, `hono/jwt`, `hono/etag`, `hono/secure-headers`, `hono/body-limit`, `hono/compress`, `hono/cache`, `hono/cookie`, `hono/timeout`, `hono/request-id`, `hono/ip-restriction`, `hono/combine`). → [middleware.md](references/middleware.md)
- **Runtimes** — Workers / Vercel Edge / Deno / Bun / Node (`@hono/node-server`) / AWS Lambda; adapter entry shapes. → [runtimes.md](references/runtimes.md)
- **Validators** — `@hono/zod-validator` targets (`json`/`query`/`param`/`header`/`form`/`cookie`); Valibot + ArkType. → [validators-zod.md](references/validators-zod.md)
- **RPC client `hc<AppType>()`** — typed client, `$get`/`$post`, header/query/param args; `AppType = typeof <routes>` chain. → [rpc-client.md](references/rpc-client.md)
- **Testing** — `app.request(url, init)` (no socket), Vitest, Miniflare / `@cloudflare/vitest-pool-workers` for Workers. → [testing.md](references/testing.md)
- **Migration v3 → v4** — generics shape `{Bindings, Variables}`, `hono/cookie` + `hono/jwt` split, `c.req.body` removal, `parseBody` returns `BodyData`. → [migration.md](references/migration.md)
- **Recommended defaults** — runtime choice, router pick, cookie flags, JWT alg pinning, CORS allowlist, body-limit per-route, compression env, RPC type boundary, Workers bindings types. → [recommended-defaults.md](references/recommended-defaults.md)
- **Troubleshooting** — symptom-indexed: ESM vs Service Worker, "Body has already been consumed", Bindings type erasure, CORS preflight, RPC type drift, edge `crypto.subtle` vs Node `crypto`, cookie sameSite, ETag misuse, routing surprise, missing status code, cold start. → [troubleshooting.md](references/troubleshooting.md)

## Behavioral Traits

- Treats `Request` / `Response` Web API as source of truth — never builds Node-specific abstractions
- Picks the runtime adapter at the entry file only — route code stays portable
- **Always** types `Bindings` + `Variables` via constructor generic — no `c.env.X as any` workarounds
- Wires validators inline (`zValidator('json', schema)`) so `c.req.valid()` is typed at the call site
- Exports `AppType = typeof <chained-routes>` for RPC client — never `typeof app` directly
- Uses `c.var` (typed via `Variables` generic) for per-request data, not module-scope state
- Awaits `executionCtx.waitUntil(promise)` for fire-and-forget side-effects on Workers
- Sets `app.basePath('/api')` once per service, not per-route prefix
- Tests with `app.request()` — no server socket needed
- Uses WebCrypto (`crypto.subtle`) for HMAC / hashing — `node:crypto` is unavailable on edges
- Defers values to [recommended-defaults.md](references/recommended-defaults.md) — no inline magic numbers

## Important Constraints

- NEVER import `node:*` modules in Workers / Edge code — they don't exist at the edge (see [troubleshooting.md](references/troubleshooting.md))
- NEVER block on `Response` body in a Worker after `return c.json(...)` — use `executionCtx.waitUntil` instead
- NEVER call `c.req.json()` after a validator has already consumed it — use `c.req.valid('json')`
- NEVER set `cors({ origin: '*', credentials: true })` — browser silently drops the response
- NEVER `export default app` on Node — use `serve({ fetch: app.fetch })` from `@hono/node-server`
- NEVER omit the constructor generic — `new Hono()` without `<{Bindings, Variables}>` erases env/var types
- NEVER export `AppType = typeof app` when routes are split — keep the chain together (`typeof <chain>`)
- NEVER skip `alg` pinning on `jwt({ secret, alg })` — `alg: none` JWT forgery is a real attack
- ALWAYS pin `app.fetch` (not `app`) when exporting to runtimes expecting a `fetch`-function shape
- ALWAYS validate input via `zValidator` (or equivalent) before `c.req.valid()`
- ALWAYS set explicit status: `c.json(body, 4xx)` — `c.json(body)` defaults to 200

## Related Skills

**90%-filter applied** — mainstream 2026 stack pairings with Hono in production.

### Runtime & language
- ✓ `nodejs` — Node 24 host via `@hono/node-server`
- ✓ `typescript` — TS 5.9 (Hono's typing is the killer feature)

### Alternative HTTP framework
- ✓ `fastify` — for Node-native production servers

### Validation
- ✓ `zod` — Zod 4 with `@hono/zod-validator`

### Persistence
- ✓ `prisma` — Prisma 7 with edge driver adapters (Neon, D1, libSQL)
- ✓ `postgresql` — Postgres 18 (via edge-compatible drivers like `postgres.js`, Neon serverless)
- ✓ `redis` — Redis 8 via Upstash REST / `@upstash/redis` from Workers

### Frontend
- ✓ `nextjs` — Next.js 16 calling Hono routes (`/api/[[...path]]/route.ts` mount)
- ✓ `nuxt` — Nuxt 4 Nitro proxy to Hono
- ✓ `react` — React 19 consuming `hc<AppType>()`

### Domain apps
- ✓ `telegram-bot` — grammY webhook adapter for Hono / Workers
- ✓ `cloudpayments` — Hono webhook receiver for low-cost edge deploys

### Deploy & ops
- ✓ `linux-sysadmin` — Ubuntu 24.04 / PM2 host for Node mode
- `cloudflare-workers` — Workers / Wrangler [cascade marker]

### Testing
- ✓ `vitest` — Vitest 4 with `app.request()`

### Code discipline
- ✓ `karpathy-guidelines`

## API Reference

| Topic | File |
|---|---|
| Core API — Hono(), routers, c.req/c.res/c.json/c.var/c.env | [references/core-api.md](references/core-api.md) |
| Routing & Context — patterns, sub-apps, basePath, factory | [references/routing-and-context.md](references/routing-and-context.md) |
| Middleware — built-ins (cors, jwt, etag, secure-headers, body-limit, ...) | [references/middleware.md](references/middleware.md) |
| Runtimes — Workers, Vercel Edge, Deno, Bun, Node, Lambda | [references/runtimes.md](references/runtimes.md) |
| Validators — @hono/zod-validator, multi-target, Valibot, ArkType | [references/validators-zod.md](references/validators-zod.md) |
| RPC client `hc<AppType>()` — typed client, $get/$post, args | [references/rpc-client.md](references/rpc-client.md) |
| Testing — app.request(), Vitest, @cloudflare/vitest-pool-workers | [references/testing.md](references/testing.md) |
| Migration v3 → v4 — generics, cookie/jwt split, c.req.body removal | [references/migration.md](references/migration.md) |
| **Recommended defaults** — runtime/router pick, cookies, JWT alg pinning, CORS, body-limit, RPC boundary, Workers bindings | [references/recommended-defaults.md](references/recommended-defaults.md) |
| **Troubleshooting** — ESM vs SW, body consumed, type erasure, CORS preflight, RPC drift, edge crypto, cookie sameSite, ETag misuse, cold start | [references/troubleshooting.md](references/troubleshooting.md) |
| **Wrong vs Right** — body consumed; Bindings typed; edge crypto.subtle; CORS specific; RPC type generic | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases | [references/eval-cases.md](references/eval-cases.md) |

### Templates

| Template | File |
|---|---|
| Minimal Hono app — runtime-agnostic core | [templates/minimal-app.ts.template](templates/minimal-app.ts.template) |
| Cloudflare Workers entry with typed KV / D1 / env | [templates/cloudflare-workers.ts.template](templates/cloudflare-workers.ts.template) |
| Vercel Edge function entry | [templates/vercel-edge.ts.template](templates/vercel-edge.ts.template) |

### Examples

| Scenario | File |
|---|---|
| End-to-end RPC: server routes + typed `hc<AppType>()` client + tests | [examples/rpc-end-to-end.md](examples/rpc-end-to-end.md) |
| Auth-protected API with JWT middleware + role gates | [examples/jwt-protected-api.md](examples/jwt-protected-api.md) |

**How to use**: open the specific topic file. New project → `core-api.md` + `routing-and-context.md`. Deploy target → `runtimes.md`. Type safety → `validators-zod.md` + `rpc-client.md`. Production hardening → `recommended-defaults.md` + `troubleshooting.md`.
