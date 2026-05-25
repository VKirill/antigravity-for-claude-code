---
name: prisma
description: "Prisma 7 — TypeScript-first ORM. Declarative schema, type-safe client, migrations, driver adapters (PrismaPg/Neon/LibSQL/D1). Use when: prisma 7, prisma.config.ts, prisma migrate, PrismaClient, PrismaPg, driver adapter, schema.prisma, @prisma/adapter-pg, $transaction, $queryRaw, $extends, Accelerate, Pulse, findMany, include, select, upsert. SKIP: Drizzle (→drizzle cascade), TypeORM (legacy), raw SQL only (→postgresql), MongoDB Prisma usage."
stacks:
  - prisma
  - nodejs-backend
  - typescript
  - orm
packages:
  - prisma
  - "@prisma/client"
  - "@prisma/adapter-pg"
  - "@prisma/adapter-neon"
  - "@prisma/adapter-libsql"
  - "@prisma/adapter-d1"
  - "@prisma/extension-accelerate"
  - "@prisma/extension-pulse"
tags:
  - prisma
  - orm
  - nodejs
  - typescript
  - migrations
  - schema
manifests:
  - package.json
  - prisma/schema.prisma
  - prisma.config.ts
source: vechkasov-global-skills
risk: high-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- Prisma: `7.x`
- PostgreSQL: `18.x`
- TypeScript: `6.0.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded when the description matches the task. Open only the reference you need.

## Use this skill when

- Designing or evolving a Prisma 7 `schema.prisma` (models, relations, indexes, enums)
- Writing or auditing Prisma queries — `findMany`/`findUnique`/`include`/`select`/`where`
- Setting up migrations — `migrate dev/deploy/diff/reset`, custom SQL, shadow DB
- Configuring v7's `prisma.config.ts` (datasource URL moved out of `schema.prisma`)
- Choosing and wiring driver adapters — `PrismaPg`/`PrismaNeon`/`PrismaLibSQL`/`PrismaD1`
- Running transactions — interactive `$transaction(async tx => ...)` or batched
- Writing raw SQL via `$queryRaw` (tagged template parameter binding)
- Composing extensions via `$extends({ query, model, client, result })`
- Setting up Accelerate (cache + edge pool) or Pulse (CDC)
- Tuning queries — `EXPLAIN ANALYZE`, indexes, N+1, `select` over `include`
- Migrating from Prisma 6 → 7 (datasource URL, ESM-only, driver-adapter mandatory)

## Do not use this skill when

- Drizzle ORM — use `drizzle` (cascade marker)
- TypeORM / Sequelize / MikroORM — legacy
- Pure raw SQL without ORM coupling — use `postgresql`
- MongoDB-specific Prisma — niche, use general assistant
- Supabase platform (auth/edge/storage) — use `supabase` (cascade)
- PostgreSQL DBA work (pg_dump, RLS policies, pgBouncer) — use `postgresql`

## Purpose

Prisma 7 is the dominant TypeScript-first ORM in 2026. Declarative `schema.prisma` → typed client with IDE autocomplete; migration system with shadow databases; **driver adapters** route queries through native drivers (`pg`, `@neondatabase/serverless`, `@libsql/client`, `D1Database`) instead of a Rust binary — enabling edge runtimes and ~30% lower memory.

This skill covers: schema modeling, migrations, client query patterns, transactions, raw SQL escape hatches, `$extends`, Accelerate (cache + connection pool) and Pulse (CDC), seeding, performance tuning, and v6 → v7 migration. Out of scope: low-level Postgres DBA work (`postgresql`), Redis caching (`redis`), BullMQ wired around Prisma (`bullmq`).

## Capabilities

Each line points to the canonical reference. The reference owns code, edge cases, and gotchas — do not duplicate here.

- **Schema modeling** — models, relations, indexes, attributes; `datasource.url` moved out of schema in v7. → [schema-modeling.md](references/schema-modeling.md)
- **Migrations** — `migrate dev/deploy/diff/reset`, shadow DB, custom SQL migrations. → [migrations.md](references/migrations.md)
- **Client queries** — `findMany`/`findUnique`/`where`/pagination/upsert/`createMany`. → [client-queries.md](references/client-queries.md)
- **Relations & includes** — `include` vs `select`, nested filters, N+1 prevention. → [relations-and-includes.md](references/relations-and-includes.md)
- **Transactions** — interactive / batched / isolation levels / `P2034` retry. → [transactions.md](references/transactions.md)
- **Seeding & fixtures** — `prisma db seed`, `prisma.config.ts` `migrations.seed`, idempotent upserts. → [seed-and-fixtures.md](references/seed-and-fixtures.md)
- **Performance & indexes** — `select` over `include`, `@@index`, N+1 patterns, EXPLAIN. → [performance-and-indexes.md](references/performance-and-indexes.md)
- **Accelerate & Pulse** — Accelerate cache + edge pool, Pulse CDC via logical replication. → [prisma-accelerate-and-pulse.md](references/prisma-accelerate-and-pulse.md)
- **v6 → v7 migration** — `datasource.url` to `prisma.config.ts`, driver adapters mandatory, ESM-only, generated client lives in user dir. → [migration.md](references/migration.md)
- **Recommended defaults** — canonical values for pool size, `transactionOptions`, page size, logging, prepared statements. → [recommended-defaults.md](references/recommended-defaults.md)
- **Troubleshooting** — generated client not found, `datasource.url`, `P2024` pool exhaustion, N+1, migration drift, `P2034`, peer-dep mismatch, ESM/CJS. → [troubleshooting.md](references/troubleshooting.md)

## Behavioral Traits

- Always uses `select` over `include` on hot paths — avoids dragging unused columns
- Always declares `@unique` constraints in the schema, not just in app code
- Always bounds `findMany` with `take` (default 50, max 500) — see [recommended-defaults.md](references/recommended-defaults.md)
- Uses `prisma.$transaction(async tx => ...)` for multi-step writes
- Pairs soft-delete with a `deletedAt`-aware unique partial index (raw SQL migration)
- Adds `@@index` for any column used in `where` that isn't already PK or unique
- Keeps `generated/prisma` out of git; regenerates in `postinstall`
- Never stores money as `Float` — uses `@db.Decimal(p, s)`
- Uses `cuid()` IDs by default; `uuid()` only when consumed by an external system that requires it
- Wraps Prisma errors with `instanceof Prisma.PrismaClientKnownRequestError` before mapping to HTTP status
- Pins the same Prisma version across `prisma`, `@prisma/client`, and the driver adapter

## Important Constraints

- NEVER put `datasource.url` in `schema.prisma` (v7) — it lives in `prisma.config.ts`
- NEVER deploy without `prisma migrate deploy` in CI — drift breaks production
- NEVER call `prisma.$disconnect()` inside short-lived request handlers — open once per process
- NEVER use `$queryRawUnsafe` with user input — use `$queryRaw\`...\`` tagged template
- NEVER hot-reload `PrismaClient` in dev without a singleton — leaks pools (Next.js dev hot-reload)
- NEVER mix Prisma migrations with Drizzle/raw SQL migrations on the same DB
- NEVER do external HTTP calls inside `$transaction(async tx => ...)` — keeps the slot open across network latency → `P2024`
- ALWAYS regenerate the client (`prisma generate`) after schema changes — types lag otherwise
- ALWAYS pin the same Prisma version on CLI, client, and adapter — peer-dep mismatches break runtime
- ALWAYS use driver adapters in v7 — there is no native binary fallback

## Wrong vs Right (high-stakes — full pairs)

Five paste-runnable contrasts live in [references/wrong-vs-right.md](references/wrong-vs-right.md):

1. Unbounded `findMany` vs bounded `take`
2. `include` (over-fetch) vs `select` (projection) on hot paths
3. External HTTP inside `$transaction` (P2024 risk) vs network-outside
4. `$queryRawUnsafe` (injection) vs `$queryRaw` tagged template
5. Per-import `new PrismaClient()` (HMR pool leak) vs `globalThis` singleton

## Related Skills

### Runtime & language
- ✓ `nodejs` — Node 24 LTS host
- ✓ `typescript` — TS 5.9 (Prisma's main value prop is types)

### Database
- ✓ `postgresql` — Postgres 18 (most common Prisma target)
- `mysql` — MySQL 8.x (less common but supported) [cascade marker]

### Web frameworks
- ✓ `fastify` — Prisma decorator pattern (`fastify-plugin`)
- ✓ `hono` — Prisma + edge driver adapters (Neon, libSQL, D1)
- ✓ `nextjs` — Prisma singleton + Server Components
- ✓ `nuxt` — Nitro `server/utils/db.ts` singleton

### Validation
- ✓ `zod` — input validation feeding Prisma queries

### Cache & queue
- ✓ `redis` — query result cache (cache-aside) around Prisma
- ✓ `bullmq` — Prisma writes from worker jobs

### Deploy
- ✓ `linux-sysadmin` — Ubuntu 24.04 host
- `docker` — Postgres container [cascade marker]

### Testing
- ✓ `vitest` — Prisma + libSQL adapter for in-memory unit tests

### Code discipline
- ✓ `karpathy-guidelines`

## API Reference

| Topic | File |
|---|---|
| Schema modeling — models, relations, indexes, attributes | [references/schema-modeling.md](references/schema-modeling.md) |
| Migrations — `migrate dev/deploy/diff/reset`, shadow DB, custom SQL | [references/migrations.md](references/migrations.md) |
| Client queries — `findMany`/`findUnique`/`where`/pagination | [references/client-queries.md](references/client-queries.md) |
| Relations & includes — `include` vs `select`, nested filters, N+1 | [references/relations-and-includes.md](references/relations-and-includes.md) |
| Transactions — interactive / batched / isolation / `P2034` retry | [references/transactions.md](references/transactions.md) |
| Seeding & fixtures — `prisma db seed`, idempotent upserts | [references/seed-and-fixtures.md](references/seed-and-fixtures.md) |
| Performance & indexes — `select` over `include`, EXPLAIN, N+1 | [references/performance-and-indexes.md](references/performance-and-indexes.md) |
| Accelerate & Pulse — cache + edge pool, CDC streaming | [references/prisma-accelerate-and-pulse.md](references/prisma-accelerate-and-pulse.md) |
| Migration v6 → v7 — `datasource.url`, driver adapters, ESM | [references/migration.md](references/migration.md) |
| **Recommended defaults** — pool, transactionOptions, page size, logging | [references/recommended-defaults.md](references/recommended-defaults.md) |
| **Troubleshooting** — `P2024`, drift, N+1, ESM/CJS, peer-dep, missing client | [references/troubleshooting.md](references/troubleshooting.md) |
| **Wrong vs Right** — 5 paste-runnable production-grade pairs | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases | [references/eval-cases.md](references/eval-cases.md) |

### Templates

| Template | File |
|---|---|
| `schema.prisma` starter (Postgres) for v7 — no `datasource.url` | [templates/schema.prisma.template](templates/schema.prisma.template) |
| Seed script (idempotent upserts) for v7 | [templates/seed.ts.template](templates/seed.ts.template) |
| Interactive transaction pattern with `P2034` retry | [templates/transaction-pattern.ts.template](templates/transaction-pattern.ts.template) |
| `prisma.config.ts` — v7 datasource + migrations config | [templates/prisma.config.ts.template](templates/prisma.config.ts.template) |

### Examples

| Scenario | File |
|---|---|
| Fastify + Prisma 7 CRUD with PrismaPg adapter and transactional create | [examples/fastify-prisma-crud.md](examples/fastify-prisma-crud.md) |
| Prisma 7 on Cloudflare Workers via D1 / Neon adapter | [examples/prisma-on-edge.md](examples/prisma-on-edge.md) |

**How to use**: new project → `schema-modeling.md` + `migrations.md`. Upgrading from v6 → `migration.md`. Production hardening → `recommended-defaults.md` + `troubleshooting.md`. Edge → `prisma-accelerate-and-pulse.md`.
