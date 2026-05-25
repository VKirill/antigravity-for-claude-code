---
name: postgresql
description: "PostgreSQL 18 — production-grade open-source RDBMS. Raw SQL, async I/O, virtual generated columns, OAuth, temporal constraints, UUIDv7, skip-scan B-tree, RLS, extensions. Use when: postgresql, postgres, psql, pg_dump, pg_basebackup, pgBouncer, pg_stat_statements, EXPLAIN ANALYZE, CREATE INDEX CONCURRENTLY, partial index, GIN, GiST, BRIN, pgvector, pg_partman, postgis, logical replication, WAL, vacuum, autovacuum, RLS, CHECK constraint, generated column, JSONB, MERGE, UPSERT, ON CONFLICT. SKIP: ORM-specific (→prisma), MySQL (→mysql cascade), Supabase platform (→supabase cascade), SQLite."
stacks:
  - postgresql
  - database
  - sql
  - linux
packages: []
tags:
  - postgresql
  - postgres
  - sql
  - database
  - rls
  - indexes
  - replication
  - extensions
manifests:
  - postgresql.conf
  - pg_hba.conf
source: vechkasov-global-skills
risk: high-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- PostgreSQL: `18.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded when the description matches the task. Open only the reference you need.

## Use this skill when

- Designing a PostgreSQL 18 schema, picking native types, modeling relationships
- Writing / reviewing raw SQL — DML, DDL, window functions, CTEs, lateral joins, `MERGE`, `RETURNING`
- Tuning queries with `EXPLAIN (ANALYZE, BUFFERS)`; identifying seq scans / sort spills
- Designing indexes — B-tree, partial, expression, GIN, GiST, BRIN, multicolumn order, covering
- Configuring transactions, isolation levels, advisory locks, `FOR UPDATE / NOWAIT / SKIP LOCKED`
- Implementing Row-Level Security (RLS) for multi-tenant separation
- Managing extensions — `pgvector`, `pg_partman`, `postgis`, `pg_trgm`, `citext`, `pg_stat_statements`
- Setting up streaming / logical replication, failover, `pg_basebackup`, PITR
- Backup & restore — `pg_dump`/`pg_restore`, WAL archiving, `pgBackRest`
- Performance tuning — `shared_buffers`, `work_mem`, autovacuum thresholds, pgBouncer pool mode
- Schema migration tooling — Alembic, dbmate, sqitch, Atlas (ORM-agnostic)
- Adopting PG 18 features — async I/O, virtual generated columns, OAuth, `uuidv7()`, skip-scan B-tree, temporal constraints (`WITHOUT OVERLAPS`)

## Do not use this skill when

- Prisma-ORM-specific (`schema.prisma`, Prisma migrations) — use `prisma`
- Drizzle ORM — use `drizzle` (cascade marker)
- MySQL / MariaDB syntax — use `mysql` (cascade marker)
- Supabase platform features (auth, edge functions, realtime) — use `supabase` (cascade)
- SQLite-specific SQL — different dialect
- Postgres ops on Ubuntu (restart, logs via journalctl) — use `linux-sysadmin`

## Purpose

PostgreSQL is the dominant open-source SQL database in 2026. Version 18 (released late 2025) adds: asynchronous I/O subsystem (3–5× faster sequential scans on NVMe), virtual generated columns by default, OAuth authentication, `uuidv7()` for time-ordered keys, skip-scan B-tree lookups on multicolumn indexes, and temporal constraints (`WITHOUT OVERLAPS`) for primary/unique/foreign keys.

This skill covers raw SQL design, indexing strategy, query plans, transactions and locking, RLS, extension ecosystem, replication and backup, performance tuning, and PG 18 specifics. **ORM-agnostic** — pair with `prisma` (Prisma users), `drizzle` (cascade), or use directly via `pg` / `postgres.js` in a Node app.

Out of scope: ORM schema-as-code (`prisma`), MySQL dialect (cascade), Supabase platform (cascade), Postgres-on-Windows specifics.

## Capabilities

Each line points to the canonical reference. The reference owns code, edge cases, and gotchas — do not duplicate here.

- **Data types & modeling** — `timestamptz`, `jsonb`, `numeric`, `uuid` + `uuidv7()`, arrays, enums, ranges. → [data-types-and-modeling.md](references/data-types-and-modeling.md)
- **Indexes & EXPLAIN** — B-tree (incl. skip-scan PG18), partial, expression, multicolumn, covering, GIN, GiST, BRIN; reading plan output. → [indexes-and-explain.md](references/indexes-and-explain.md)
- **Transactions & isolation** — levels, `FOR UPDATE/SHARE/NOWAIT/SKIP LOCKED`, advisory locks, deadlock retry. → [transactions-and-isolation.md](references/transactions-and-isolation.md)
- **Roles & Row-Level Security** — `GRANT/REVOKE`, `CREATE POLICY`, multi-tenant via `current_setting('app.tenant_id')`, OAuth (PG18). → [roles-and-rls.md](references/roles-and-rls.md)
- **Extensions** — `pgvector`, `pg_partman`, `postgis`, `pg_trgm`, `pg_stat_statements`, `citext`, `pgcrypto`. → [extensions.md](references/extensions.md)
- **Replication & backup** — streaming, logical, `pg_basebackup`, WAL archive, PITR, `pg_dump`, replication slots. → [replication-and-backup.md](references/replication-and-backup.md)
- **Performance tuning** — memory, WAL, autovacuum, pgBouncer pool mode, stats / planner. → [performance-tuning.md](references/performance-tuning.md)
- **Migration tooling** (ORM-agnostic) — dbmate, sqitch, Atlas, Alembic. → [migrations-tools.md](references/migrations-tools.md)
- **PG 18 what's new** — async I/O, virtual generated cols, OAuth, `uuidv7()`, skip-scan, temporal constraints. → [pg-18-whats-new.md](references/pg-18-whats-new.md)
- **Recommended defaults** — pool sizing formula, memory + WAL + autovacuum + statement timeouts, pgBouncer pool mode, backup retention. → [recommended-defaults.md](references/recommended-defaults.md)
- **Troubleshooting** — too many clients, slow query, deadlock, vacuum bloat, replication lag, disk full, WAL archive fail, lock contention, statement timeout, OOM. → [troubleshooting.md](references/troubleshooting.md)
- **Wrong vs Right** — 5 paste-runnable production-grade pairs (`SELECT *`, isolation, `CONCURRENTLY`, `json` vs `jsonb`, `timestamptz`). → [wrong-vs-right.md](references/wrong-vs-right.md)

## Behavioral Traits

- Always uses `timestamptz`, never `timestamp without time zone`
- Always uses `jsonb`, never `json`
- Always uses `numeric` for money, never `float`
- Always indexes foreign keys (Postgres does not auto-index FKs, unlike MySQL InnoDB)
- Uses `CREATE INDEX CONCURRENTLY` on live tables — non-concurrent blocks reads
- Pairs every `SELECT ... FOR UPDATE` with a transaction; never standalone
- Uses `SKIP LOCKED` for queue-style row consumption
- Picks `SERIALIZABLE` only when write-skew is provable; otherwise `READ COMMITTED` + advisory locks
- Reads `EXPLAIN ANALYZE` plans before claiming a query is slow — never guesses
- Sets `statement_timeout` + `idle_in_transaction_session_timeout` + `lock_timeout` per role — see [recommended-defaults.md](references/recommended-defaults.md)
- Vacuums big tables manually when `autovacuum` falls behind (visible via `pg_stat_user_tables`)
- Uses `uuidv7()` (PG18+) for new IDs — sortable, indexable, no extension needed

## Important Constraints

- NEVER use `timestamp` (no tz) for stored timestamps — pick `timestamptz`
- NEVER use `varchar(n)` "to save space" — `text` is identical underneath
- NEVER skip `CREATE INDEX CONCURRENTLY` in production — non-concurrent locks the table
- NEVER `ALTER TABLE ... ADD COLUMN ... NOT NULL DEFAULT volatile_expr()` on a large table — forces a full rewrite. Stable defaults (PG11+) skip the rewrite
- NEVER edit `postgresql.conf` while expecting changes to apply — most require `pg_reload_conf()` (SIGHUP) or restart
- NEVER use `pg_dump -F p` (plain) for multi-GB DBs — use `-F c` (custom) for parallel restore
- NEVER deploy WITHOUT replication slot monitoring — orphaned slots grow WAL indefinitely → disk full
- NEVER skip backup restore drills — a backup you've never restored is a backup that doesn't exist
- ALWAYS `pg_basebackup` BEFORE risky migrations
- ALWAYS test `EXPLAIN ANALYZE` on production-shaped data — small dev DBs hide bad plans
- ALWAYS load `pg_stat_statements` via `shared_preload_libraries` — needed to find slow queries (restart required)

## Related Skills

### Runtime & language
- ✓ `nodejs` — Node 24 + `pg` / `postgres.js` drivers
- ✓ `typescript` — typed query results via Kysely / Drizzle / Prisma

### ORMs & query builders
- ✓ `prisma` — Prisma 7 (most common Postgres consumer)
- `drizzle` — Drizzle ORM (TS-native) [cascade marker]

### Cache & queue
- ✓ `redis` — pairs for cache-aside + session store
- ✓ `bullmq` — Redis-backed; alternative to Postgres `SKIP LOCKED` queues

### Web frameworks
- ✓ `fastify` — Fastify 5 + `pg` pool decorator
- ✓ `hono` — Hono + Neon adapter or Postgres.js
- ✓ `nextjs` — Next.js 16 server actions calling Postgres
- ✓ `nuxt` — Nitro + Postgres

### Deploy & ops
- ✓ `linux-sysadmin` — Ubuntu 24.04, systemd, `pg_ctl`, pgBouncer
- `docker` — Postgres container [cascade marker]

### Domain
- ✓ `cloudpayments` / ✓ `yookassa` — store payments in Postgres
- ✓ `telegram-bot` — bot state persistence

### Code discipline
- ✓ `karpathy-guidelines`

## API Reference

| Topic | File |
|---|---|
| Data types & modeling — types, constraints, generated columns | [references/data-types-and-modeling.md](references/data-types-and-modeling.md) |
| Indexes & EXPLAIN — B-tree, partial, GIN/GiST/BRIN, plan reading | [references/indexes-and-explain.md](references/indexes-and-explain.md) |
| Transactions & isolation — levels, locks, `FOR UPDATE`, `SKIP LOCKED`, advisory | [references/transactions-and-isolation.md](references/transactions-and-isolation.md) |
| Roles & Row-Level Security — `GRANT/REVOKE`, `CREATE POLICY`, multi-tenant | [references/roles-and-rls.md](references/roles-and-rls.md) |
| Extensions — `pgvector`, `pg_partman`, `postgis`, `pg_trgm`, `pg_stat_statements` | [references/extensions.md](references/extensions.md) |
| Replication & backup — streaming, logical, `pg_basebackup`, PITR, `pg_dump` | [references/replication-and-backup.md](references/replication-and-backup.md) |
| Performance tuning — `shared_buffers`, `work_mem`, autovacuum, pgBouncer | [references/performance-tuning.md](references/performance-tuning.md) |
| Migration tooling — dbmate / sqitch / Atlas / Alembic (ORM-agnostic) | [references/migrations-tools.md](references/migrations-tools.md) |
| PG 18 what's new — async I/O, virtual cols, OAuth, `uuidv7`, skip-scan, temporal | [references/pg-18-whats-new.md](references/pg-18-whats-new.md) |
| **Recommended defaults** — pool, memory, WAL, autovacuum, timeouts, backup retention | [references/recommended-defaults.md](references/recommended-defaults.md) |
| **Troubleshooting** — too many clients, slow query, deadlock, vacuum bloat, replication lag, disk full, WAL archive fail, lock contention, OOM | [references/troubleshooting.md](references/troubleshooting.md) |
| **Wrong vs Right** — 5 paste-runnable pairs (SELECT \*, isolation, CONCURRENTLY, json/jsonb, timestamptz) | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases | [references/eval-cases.md](references/eval-cases.md) |

### Templates

| Template | File |
|---|---|
| Schema + initial migration SQL (UUIDv7, RLS, FK indexes) | [templates/schema-migration.sql.template](templates/schema-migration.sql.template) |
| Role setup — app role, read-only role, RLS-ready | [templates/role-setup.sql.template](templates/role-setup.sql.template) |
| EXPLAIN ANALYZE helper script | [templates/explain-analyze-helper.sh.template](templates/explain-analyze-helper.sh.template) |

### Examples

| Scenario | File |
|---|---|
| Multi-tenant SaaS with RLS — schema + policies + JWT-bound tenant | [examples/multi-tenant-rls.md](examples/multi-tenant-rls.md) |
| Indexing strategy walkthrough — slow query → EXPLAIN → covering index | [examples/index-tuning-walkthrough.md](examples/index-tuning-walkthrough.md) |

**How to use**: new schema → `data-types-and-modeling.md`. Performance issue → `indexes-and-explain.md` + `performance-tuning.md` + `troubleshooting.md`. Multi-tenant → `roles-and-rls.md`. Upgrading PG → `pg-18-whats-new.md`. Production hardening → `recommended-defaults.md` + `troubleshooting.md`.
