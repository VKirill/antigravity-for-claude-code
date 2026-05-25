# postgresql skill — CHANGELOG

## [2.0.0] — 2026-05-15

skill-evaluation v3 retrofit.

### Added
- `risk: high-stakes` in frontmatter (data layer → automatic)
- `references/recommended-defaults.md` — single-source-of-truth covering connection pool sizing formula `(cores * 2) + spindles`, memory (`shared_buffers` 25% RAM, `work_mem`, `effective_cache_size`), WAL settings (`wal_level`, `max_wal_size`, `checkpoint_timeout`), autovacuum thresholds + tune-up triggers, statement / idle / lock timeouts, index types + fill factor, backup retention tiers, pgBouncer pool mode (`transaction` vs `session` vs `statement`). Format: `| Knob | Default | Range | Tune-up when | Tune-down when | Why |`
- `references/troubleshooting.md` — symptom-indexed covering too many clients, slow query EXPLAIN, deadlock (40P01), vacuum bloat, replication lag (physical + logical), tablespace / disk full, WAL archive failure, lock contention blocking DDL, statement timeout (57014), `pg_stat_statements` not loaded, OOM from `work_mem × parallel`. Each entry: Symptoms → Diagnose → Causes → Fix with paste-runnable `psql` / `pg_stat_*` queries
- `references/wrong-vs-right.md` — five paste-runnable contrasts: `SELECT *` vs explicit + covering index, default isolation vs `SERIALIZABLE`+retry vs `FOR UPDATE`, `CREATE INDEX` vs `CONCURRENTLY`, `json` vs `jsonb`, `timestamp` vs `timestamptz`

### Changed
- SKILL.md compressed 242 → 183 lines (Pattern 2 target ≤ 250). Capability descriptions collapsed; long code blocks already in references/
- Frontmatter description trimmed from 730 → 593 chars (≤ 600 target)
- `references/eval-cases.md` rewritten in v3 format — user-voice prompts (Russian/typos) + "Expected behavior" column. 10 positive / 10 negative / 5 edge
- API Reference table now includes recommended-defaults, troubleshooting, wrong-vs-right entries

### Audited — verified-clean (Context7 `/websites/postgresql_18`)
- `uuidv7()` is built-in in PG18 (no extension needed) — confirmed
- `PRIMARY KEY (a, b WITHOUT OVERLAPS)` temporal constraint syntax — confirmed
- `UNIQUE (a, b WITHOUT OVERLAPS)` and FK variant — confirmed
- Virtual generated columns DEFAULT in PG18; `STORED` is opt-in — confirmed
- `io_method = 'worker'` / `'io_uring'` and `pg_aios` view — confirmed
- Skip-scan B-tree on multicolumn indexes — confirmed; visible in EXPLAIN as `Index Scan ... Skip Scan Cond:`
- `gen_random_uuid()` no longer requires `pgcrypto` in PG18 — confirmed
- `pg_stat_io` view (per-I/O-type stats) — confirmed
- OAuth auth params `oauth_client_id`, `oauth_issuer_url` — confirmed
- `pg_stat_replication` columns `write_lag`, `flush_lag`, `replay_lag` and LSN diff functions — confirmed
- `pg_replication_slots`, `confirmed_flush_lsn`, `pg_wal_lsn_diff` — confirmed

### Notes
- No SQL hallucinations found in the original — all syntax verified against PG18 docs
- The only JS/TS import in the skill (`import { Pool } from 'pg'` in `multi-tenant-rls.md`) is canonical
- Symptom routing across `troubleshooting.md` reflects production patterns: connection-related symptoms route to pgBouncer, slow queries to indexes, disk-full to replication slots

## [1.0.0] — 2026-05-15

### Added
- Initial skill generation under skill-evaluation v2 standards (Pattern 2)
- SKILL.md navigator with 9 reference files + eval-cases
- `references/data-types-and-modeling.md` — types, constraints, generated cols
- `references/indexes-and-explain.md` — B-tree/partial/GIN/GiST/BRIN, EXPLAIN reading
- `references/transactions-and-isolation.md` — levels, locks, SKIP LOCKED, advisory
- `references/roles-and-rls.md` — GRANT/REVOKE, RLS policies, multi-tenant patterns
- `references/extensions.md` — pgvector, pg_partman, postgis, pg_trgm, pg_stat_statements
- `references/replication-and-backup.md` — streaming/logical replication, pg_basebackup, PITR
- `references/performance-tuning.md` — shared_buffers, work_mem, autovacuum, PgBouncer
- `references/migrations-tools.md` — dbmate / sqitch / Atlas / Alembic (ORM-agnostic)
- `references/pg-18-whats-new.md` — async I/O, virtual generated cols, OAuth, uuidv7, skip-scan, temporal
- `references/eval-cases.md` — 10 positive + 10 negative + 5 edge routing tests
- `templates/schema-migration.sql.template` — UUIDv7, FK indexes, RLS-ready
- `templates/role-setup.sql.template` — app + readonly roles
- `templates/explain-analyze-helper.sh.template` — runner for EXPLAIN with formatting
- `examples/multi-tenant-rls.md` — RLS-based tenancy walkthrough
- `examples/index-tuning-walkthrough.md` — slow query diagnosis to covering index

### Verified versions (Context7, 2026-05-15)
- PostgreSQL: `18` (current major; release notes confirm async I/O, virtual generated cols as default, OAuth auth, uuidv7(), skip-scan B-tree, temporal PK/UK/FK)
- Source: `/websites/postgresql_18`, `/websites/postgresql_current`

### Notes
- PG18 release fundamentally changes index access patterns via skip-scan
- Async I/O is configurable via server variables; `pg_aios` view exposes outstanding I/O
- Pair with `prisma` for ORM workflows; with `linux-sysadmin` for host config
