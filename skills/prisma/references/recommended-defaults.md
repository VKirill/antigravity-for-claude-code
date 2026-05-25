# Recommended defaults — prisma

The canonical Prisma 7 values. **All other files in this skill cite this table — do not redefine inline.**
Source: synthesized from `/prisma/prisma` Context7 snapshots + Prisma 7.6.x docs, verified 2026-05-15.

> Citation rule: every recommendation has a default + range + "tune up when…" / "tune down when…". Cargo-culting is worse than no defaults.

## Driver adapter — pick once

```ts
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
```

| Adapter | Package | When |
|---|---|---|
| `PrismaPg` | `@prisma/adapter-pg` | Self-hosted Postgres, RDS, Supabase Postgres, Vercel Postgres, any standard pg target. **Default.** |
| `PrismaNeon` | `@prisma/adapter-neon` | Neon serverless Postgres (WebSocket-over-HTTPS pool). Required for Workers/Vercel Edge against Neon. |
| `PrismaLibSQL` | `@prisma/adapter-libsql` | Turso / libSQL. SQLite-compatible. |
| `PrismaD1` | `@prisma/adapter-d1` | Cloudflare D1 (Workers binding). |
| `PrismaPlanetScale` | `@prisma/adapter-planetscale` | PlanetScale MySQL with branching. |
| `PrismaMssql` | `@prisma/adapter-mssql` | MS SQL Server. |

**Adapter version MUST match Prisma version.** `@prisma/adapter-pg@7.6.0` ↔ `prisma@7.6.0` / `@prisma/client@7.6.0`.

## Connection pool (PrismaPg + pg.Pool)

Two shapes:

```ts
// Shape A — connection string only (Prisma manages the pool)
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// Shape B — explicit pg.Pool (you control sizing)
import pg from 'pg';
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
});
const adapter = new PrismaPg(pool, { schema: 'public' });
```

| Knob | Default | Range | Tune-up when | Tune-down when | Why |
|---|---|---|---|---|---|
| `pg.Pool.max` (per process) | **10** | 5–50 | high concurrency Fastify/Hono app on N cores | running behind pgBouncer transaction mode | Postgres backend slot = ~10 MB RAM; pgBouncer fans out |
| `pg.Pool.idleTimeoutMillis` | **30000** | 10000–600000 | bursty traffic, cold connections expensive | steady traffic, want connections persistent | balance reconnect cost vs slot occupancy |
| `connection_limit` (URL `?connection_limit=N`) | **`num_physical_cpus * 2 + 1`** if unset (Prisma docs default) | 10–40 | container has many cores, app is I/O bound | sharing DB with other services | matches `pg` pool default formula |
| `pool_timeout` (URL `?pool_timeout=N`, seconds) | **10** | 5–30 | slow downstream, you'd rather wait | fail-fast preferred | bound P2024 visibility |
| `?idle_in_transaction_session_timeout=N` (ms; URL param) | **60000** | 10000–300000 | long-running interactive transactions are legitimate | tight pool, leaks happen | DB kills zombie transactions holding locks |

## Transactions

`transactionOptions` on `PrismaClient` (global defaults) and per-call options on `$transaction(fn, opts)`.

```ts
// Source: /prisma/prisma Context7 — PrismaClient constructor
const prisma = new PrismaClient({
  adapter,
  transactionOptions: {
    maxWait: 5000,        // ms to wait for a slot
    timeout: 10000,       // ms before interactive tx is rolled back
    isolationLevel: 'ReadCommitted',
  },
});
```

| Knob | Default | Range | Tune-up when | Tune-down when | Why |
|---|---|---|---|---|---|
| `maxWait` (slot acquire) | **5000 ms** | 2000–15000 | pool contention spikes during cold starts | fail-fast on overload | bounds wait when pool is exhausted |
| `timeout` (tx duration) | **5000 ms** (library) / **10000 ms** (our default) | 2000–60000 | reports, ML, multi-row migrations | tight latency SLO | exceeding → automatic rollback |
| `isolationLevel` | **`ReadCommitted`** (Postgres default) | `ReadCommitted` / `RepeatableRead` / `Serializable` | write-skew possible (balance/ledger, inventory) | speed-critical idempotent reads | `Serializable` triggers `P2034` retries — see troubleshooting.md |
| Retry budget for `P2034` | **3 attempts**, exp backoff 50 ms × 2^i | 2–5 | high contention writes | non-idempotent writes (escalate to DLQ) | serialization failures are normal under `Serializable` |

## Query defaults

```ts
const users = await prisma.user.findMany({
  where: { /* ... */ },
  select: { id: true, email: true },   // prefer select over include on hot paths
  orderBy: { createdAt: 'desc' },
  take: 50,                            // ALWAYS bound page size
});
```

| Knob | Default | Range | Why |
|---|---|---|---|
| Default page size (`take`) | **50** | 20–200 | unbounded `findMany` is the #1 prod incident pattern |
| Max page size (hard cap) | **500** | — | reject requests asking for more; paginate |
| `select` vs `include` in hot paths | **`select`** | — | `include` drags entire related rows; `select` projects |
| `cursor` for keyset pagination | **always** beyond page 10 | — | `skip: N` becomes linear in N |

## Logging policy

```ts
// Source: /prisma/prisma Context7 — PrismaClient constructor
const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'production'
    ? ['warn', 'error']
    : [{ emit: 'event', level: 'query' }, 'warn', 'error'],
  errorFormat: 'minimal',  // production
});
```

| Env | `log` | `errorFormat` | Why |
|---|---|---|---|
| production | `['warn', 'error']` | `'minimal'` | query log is high-volume noise; ship via `pg_stat_statements` instead |
| dev | `['query', 'warn', 'error']` (event emit) | `'pretty'` | inspect SQL during debugging |
| CI | `['warn', 'error']` | `'colorless'` | terminal-safe logs |

## Prepared statement cache (driver-side in v7)

Prisma 7 driver adapters manage prepared statements. Two options:

```ts
// Default: Prisma generates a stable statement name per query
const adapter = new PrismaPg(pool, {
  statementNameGenerator: (q) =>
    `ps_${Buffer.from(q.sql).toString('base64').slice(0, 40)}`,
});

// Disable (required for some pgBouncer transaction-mode setups w/o passthrough)
const adapter = new PrismaPg(pool, { statementNameGenerator: () => '' });
```

| Setup | Setting |
|---|---|
| Direct Postgres (no bouncer) | default (cache on) |
| pgBouncer **session** mode | default |
| pgBouncer **transaction** mode + bouncer 1.21+ with `max_prepared_statements > 0` | default (passthrough works) |
| pgBouncer **transaction** mode without passthrough | disable cache (return `''`) |

## Generated client (Prisma 7 — user-controlled dir)

```prisma
generator client {
  provider     = "prisma-client"     // NOT "prisma-client-js" (that's v6)
  output       = "../generated/prisma"
  runtime      = "nodejs"            // 'nodejs' | 'bun' | 'deno' | 'workerd' | 'edge-light'
  moduleFormat = "esm"               // 'esm' | 'cjs'
}
```

- Add `generated/` to `.gitignore`
- Add `"postinstall": "prisma generate"` to `package.json`
- Import as `import { PrismaClient } from './generated/prisma/client'` (path varies by `output`)

| Knob | Default | When otherwise |
|---|---|---|
| `output` | `../generated/prisma` | match your project's `src/` layout |
| `runtime` | `nodejs` | `workerd` for Cloudflare, `edge-light` for Vercel Edge, `deno` for Deno |
| `moduleFormat` | `esm` | `cjs` if you can't escape CJS consumers |

## Migration deployment policy

| Step | Command | When |
|---|---|---|
| Develop | `prisma migrate dev --name <slug>` | local dev; uses shadow DB to validate |
| CI verify | `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code` | pre-merge; non-zero exit if drift |
| Deploy | `prisma migrate deploy` | production; applies pending only, no shadow DB |
| Reset | `prisma migrate reset` | local only; wipes data |
| Drift check | `prisma migrate diff --from-url $DATABASE_URL --to-migrations prisma/migrations --exit-code` | runtime drift alarm |

**Shadow DB** required for `migrate dev`. On managed providers (Neon, RDS) where you can't `CREATE DATABASE` dynamically, set `shadowDatabaseUrl` in `prisma.config.ts` to a pre-created empty DB.

## Citation rule

Other files in this skill MUST NOT redefine these values inline. Use:

> Defaults: see [recommended-defaults.md](recommended-defaults.md).

## Last verified

2026-05-15 against Prisma 7.6.x — `/prisma/prisma` and `/websites/prisma_io` Context7 snapshots.
