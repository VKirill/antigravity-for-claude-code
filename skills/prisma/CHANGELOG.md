# prisma skill — CHANGELOG

## [2.0.0] — 2026-05-15

skill-evaluation v3 retrofit. Breaking structural change — older sub-skill consumers should re-load.

### Added
- `risk: high-stakes` in frontmatter (data layer → automatic)
- `references/recommended-defaults.md` — single-source-of-truth table for pool, transactionOptions, page size, logging, prepared statement cache, generator config, migration deployment policy. Format: `| Knob | Default | Range | Tune-up when | Tune-down when | Why |`
- `references/troubleshooting.md` — symptom-indexed guide covering generated client missing, datasource.url move, P2024 pool exhaustion, N+1, migration drift, $transaction timeout, slow include, peer-dep mismatch, ESM/CJS, $queryRawUnsafe injection. Each entry: Symptoms → Diagnose → Causes → Fix
- `references/wrong-vs-right.md` — five paste-runnable contrasts: unbounded findMany, include vs select, network-in-tx, $queryRawUnsafe, Next.js HMR singleton

### Changed
- SKILL.md compressed 275 → 199 lines (Pattern 2 target ≤ 250). Capability descriptions collapsed to one-line + link; long code blocks moved to references/. Wrong-vs-right pairs extracted to dedicated reference.
- Frontmatter description trimmed from 760 → ~560 chars (≤ 600 target). Removed redundant trigger terms; kept canonical class names + SKIP rules.
- `references/eval-cases.md` rewritten in v3 format — user-voice prompts (Russian/typos) + "Expected behavior" column naming which sub-files should load. 10 positive / 10 negative / 5 edge.
- API Reference table now includes recommended-defaults, troubleshooting, wrong-vs-right entries.

### Fixed — hallucinations
- `templates/prisma.config.ts.template:4` — `import { defineConfig, env } from '@prisma/config'` → `from 'prisma/config'`. Verified against Context7 `/prisma/prisma` README + sandbox/basic-postgres. The `@prisma/config` package does NOT exist in Prisma 7; `defineConfig`/`env` are bundled with `prisma` under the `prisma/config` subpath.
- `references/migration.md:35` — same `@prisma/config` → `prisma/config` correction in the migration walkthrough.
- `references/migration.md:108` — removed `"@prisma/config": "^7.6.0"` from devDependencies example (package doesn't exist as standalone in v7).
- Frontmatter `packages` list — removed `"@prisma/config"` (not a real npm package in v7).
- `templates/prisma.config.ts.template` — added `type Env = { ... }` and `env<Env>(...)` typed access per official Context7 snippet pattern.
- `templates/prisma.config.ts.template` — moved `shadowDatabaseUrl` under `datasource` (not under `migrations`); aligned with current Context7 schema.

### Audited — verified-clean
- `PrismaPg` import from `@prisma/adapter-pg` — confirmed
- `PrismaNeon` / `PrismaLibSQL` / `PrismaD1` / `PrismaPlanetScale` / `PrismaMssql` adapter names — confirmed
- `withAccelerate` from `@prisma/extension-accelerate` — confirmed
- `withPulse` from `@prisma/extension-pulse` — confirmed
- `Prisma.PrismaClientKnownRequestError` + error codes `P2024`, `P2034`, `P2025` — confirmed
- `cacheStrategy: { ttl, swr, tags }` shape — confirmed
- Generator block: `provider = "prisma-client"` (not `prisma-client-js`) — confirmed v7
- Generated client import path: `./generated/prisma/client` per user `output` — confirmed
- `transactionOptions` shape (`maxWait`, `timeout`, `isolationLevel`) — confirmed

### Notes
- Two Prisma 7 packages coexist: `prisma` (CLI + config + types) and `@prisma/client` (runtime). Both pinned to the same minor.
- `defineConfig` / `env` live in the `prisma` package under the `prisma/config` subpath — NO separate `@prisma/config` install in v7.
- v6 LTS branch `6.19.x` still maintained for backports if migration is blocked.

## [1.0.0] — 2026-05-15

### Added
- Initial skill generation under skill-evaluation v2 standards (Pattern 2)
- SKILL.md navigator with 9 reference files + eval-cases
- `references/schema-modeling.md` — models, relations, indexes, attributes
- `references/migrations.md` — migrate dev/deploy/diff/reset/resolve, shadow DB, custom SQL
- `references/client-queries.md` — findMany/findUnique/where/pagination/upsert
- `references/relations-and-includes.md` — include vs select, nested filters, N+1
- `references/transactions.md` — interactive + batched + isolation levels + retry
- `references/seed-and-fixtures.md` — package.json hook, prisma.config.ts seed, idempotent upserts
- `references/performance-and-indexes.md` — index strategy, EXPLAIN ANALYZE, N+1 patterns
- `references/prisma-accelerate-and-pulse.md` — Accelerate cache + edge pool, Pulse CDC
- `references/migration.md` — v6 → v7: datasource.url to prisma.config.ts, driver adapters mandatory, ESM-only client
- `references/eval-cases.md` — 10 positive + 10 negative + 5 edge routing tests
- `templates/schema.prisma.template` — Prisma 7 schema (NO datasource.url)
- `templates/seed.ts.template` — idempotent seed via upserts
- `templates/transaction-pattern.ts.template` — interactive transaction with retry on serialization conflict
- `templates/prisma.config.ts.template` — v7 config with env() and migrations.seed
- `examples/fastify-prisma-crud.md` — Fastify + Prisma 7 + PrismaPg adapter
- `examples/prisma-on-edge.md` — Hono on Workers with PrismaD1 / PrismaNeon

### Verified versions (Context7, 2026-05-15)
- Prisma: `7.6.0` (latest stable; Prisma 7 series)
- Sources: `/prisma/prisma`, `/websites/prisma_io`, `/prisma/skills`
- Confirmed v7 breaking changes:
  - `datasource.url` removed from `schema.prisma`
  - `prisma.config.ts` with `defineConfig({ datasource: { url: env('DATABASE_URL') } })`
  - Driver adapters mandatory (PrismaPg / PrismaNeon / PrismaLibSQL / PrismaD1)
  - Generated client lives in user-controlled directory (`output = "../generated/prisma"`)
  - `binaryTargets` removed
  - ESM by default (`moduleFormat = "esm"`)

### Notes
- v7 is a major migration; v6.19.x branch is still maintained for backports
- Driver-adapter-only access changes connection-string management
- Pair `prisma` skill with `postgresql` (DB ops), `redis` (cache-aside), `bullmq` (queued writes)
