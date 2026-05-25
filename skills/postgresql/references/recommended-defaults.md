# Recommended defaults — postgresql

Canonical PostgreSQL 18 production values. **All other files in this skill cite this table — do not redefine inline.**
Source: synthesized from `/websites/postgresql_18` Context7 + PG18 release notes, verified 2026-05-15.

> Citation rule: every recommendation has a default + range + "tune up when…" / "tune down when…". Cargo-culting is worse than no defaults.

## Connection pool sizing

The classic formula for a CPU-bound OLTP workload (PgBouncer or app-side pool):

```
pool_size = ((core_count * 2) + effective_spindle_count)
```

- `core_count` = number of physical CPU cores on the DB host
- `effective_spindle_count` = 1 per HDD spindle; 0 for SSD/NVMe (already parallel); 0–1 for cloud block storage

| Workload | App pool per process | Total app pool (cluster) | `max_connections` |
|---|---|---|---|
| Small OLTP (1–2 cores, NVMe) | 10 | 50 | 100 |
| Medium SaaS (8 cores, NVMe) | 20 | 200 | 300 (front w/ pgBouncer) |
| Big OLTP (32 cores) | 30 | 500+ via pgBouncer | 500 |
| Analytics / batch | 4–8 | 30 | 100 |

Backend connections cost ~10 MB RAM each plus context switches. **Always cap `max_connections` ≤ 300 and front with pgBouncer for higher fan-out.**

## Memory (`postgresql.conf`)

For host with N GB RAM dedicated to Postgres:

| Knob | Default (PG18) | Recommended | Range | Tune-up when | Tune-down when | Why |
|---|---|---|---|---|---|---|
| `shared_buffers` | 128 MB | **25% of RAM** | 1 GB – 16 GB | DB working set fits → cache pressure | mixed-use host with other services | Postgres's own page cache. Beyond ~16 GB diminishing returns — give to OS cache |
| `effective_cache_size` | 4 GB | **50–75% of RAM** | — | underestimating leads to seq scans | — | Planner hint only, not allocation |
| `work_mem` | 4 MB | **(RAM − shared_buffers) / (max_connections × 2)** typically 16–64 MB | 4 MB – 256 MB | sorts/hashes spill to disk (see `log_temp_files`) | many parallel queries OOM the box | Per-operation, multiplied by parallel ops within each query |
| `maintenance_work_mem` | 64 MB | **1 GB** | 256 MB – 4 GB | slow VACUUM / CREATE INDEX | small machine | Used by VACUUM, CREATE INDEX, ALTER TABLE |
| `effective_io_concurrency` | 1 | **200** on NVMe / **2** on HDD | — | NVMe / SSD | spinning disk | Bitmap heap scan prefetch concurrency |

## WAL

| Knob | Default | Recommended | Range | Tune-up when | Tune-down when | Why |
|---|---|---|---|---|---|---|
| `wal_level` | `replica` | **`replica`** (or `logical` if you use logical repl) | — | need logical replication / Pulse | — | `minimal` disables replicas |
| `max_wal_size` | 1 GB | **4 GB** | 1 GB – 16 GB | write-heavy bursts cause checkpoints to thrash | small disk | Soft cap; triggers checkpoint when reached |
| `min_wal_size` | 80 MB | **1 GB** | 80 MB – 4 GB | bursty writes recycling WAL files | — | Avoids the OS reallocating space repeatedly |
| `checkpoint_timeout` | 5 min | **15 min** | 5 min – 30 min | high write rate, frequent checkpoints | — | Less frequent checkpoint flush = smoother I/O |
| `checkpoint_completion_target` | 0.9 | **0.9** | — | — | — | Spread checkpoint I/O over 90% of the interval |
| `wal_buffers` | -1 (auto) | **16 MB** (auto-tuned) | 4 MB – 128 MB | high concurrent commit rate | — | Buffer between WAL writers and disk |
| `wal_keep_size` | 0 | **1 GB** | 0 – 16 GB | standby disconnects briefly | replicas use slots | Streaming repl fallback if no slot |

## Autovacuum

```sql
-- Per-table tuning for hot tables
ALTER TABLE events SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_limit = 2000
);
```

| Knob | Default | Recommended | Tune-up trigger | Why |
|---|---|---|---|---|
| `autovacuum` | on | **on** | never disable | required for MVCC bloat reclamation |
| `autovacuum_vacuum_scale_factor` | 0.2 (20%) | 0.05–0.10 on hot tables | `n_dead_tup / n_live_tup > 20%` (query `pg_stat_user_tables`) | default fires at 20% dead = huge tables get vacuumed too late |
| `autovacuum_analyze_scale_factor` | 0.1 | 0.02 on hot tables | stale planner stats causing bad plans | analyze updates pg_statistic, planner relies on it |
| `autovacuum_max_workers` | 3 | **3** (raise to 5 with many DBs) | many small DBs sharing a cluster | parallel autovacuum jobs |
| `autovacuum_vacuum_cost_limit` | -1 (200) | **2000** on fast disks | autovacuum can't keep up on hot tables | higher = more work per round, less throttling |

**Tune-up trigger** for any table: `SELECT n_dead_tup, n_live_tup, last_autovacuum FROM pg_stat_user_tables WHERE relname='X'`. If `n_dead_tup / n_live_tup > 0.20` and `last_autovacuum` is recent, autovacuum is keeping up but the threshold is too loose — tighten `scale_factor`. If `last_autovacuum` is old, raise `autovacuum_max_workers` and/or `autovacuum_vacuum_cost_limit`.

## Statement & idle timeouts

```sql
ALTER ROLE app SET statement_timeout = '5s';
ALTER ROLE app SET idle_in_transaction_session_timeout = '60s';
ALTER ROLE app SET lock_timeout = '2s';
```

| Knob | Default | Recommended | Range | Why |
|---|---|---|---|---|
| `statement_timeout` | 0 (disabled) | **5000 ms** per app role | 2 s – 60 s | bound runaway queries; cancel raises `SQLSTATE 57014` |
| `idle_in_transaction_session_timeout` | 0 (disabled) | **60000 ms** | 10 s – 300 s | kill zombie transactions holding locks |
| `lock_timeout` | 0 (disabled) | **2000 ms** | 1 s – 10 s | bound waits on contended rows; raises `SQLSTATE 55P03` |
| `idle_session_timeout` | 0 (disabled) | optional **600000 ms** (10 min) | — | close idle connections; useful with apps that hold pools |

## Indexes

| Type | When | Notes |
|---|---|---|
| **B-tree** | default; equality + range | Includes skip-scan in PG18 — multicolumn `(a,b)` usable for `WHERE b = ?` |
| **B-tree fill factor** | default 90 | Lower (70–80) for tables with high UPDATE on indexed columns — leaves space for HOT updates |
| **Partial** | `WHERE deleted_at IS NULL` | Smaller index, faster scans; works with soft-delete |
| **Expression** | `ON LOWER(email)` | Case-insensitive lookups |
| **Covering** (`INCLUDE`) | hot index-only scans | Avoid heap fetches |
| **GIN** | `jsonb`, `tsvector`, `text[]` | Large to build (raise `maintenance_work_mem`); slow to update; super fast to read |
| **GiST** | geometry, ranges, `WITHOUT OVERLAPS` | Required for temporal exclusion constraints |
| **BRIN** | huge sorted/append tables (logs, metrics) | Tiny index size; works only on naturally-clustered data |

**Always use** `CREATE INDEX CONCURRENTLY ...` on live tables — non-concurrent takes `ACCESS EXCLUSIVE` lock and blocks reads.

## Backup retention

| Tier | Frequency | Retention | Tool |
|---|---|---|---|
| **WAL archive** | continuous (every WAL segment) | 7–35 days (matches PITR window) | `archive_command` → S3/B2/MinIO with encryption |
| **Base backup** | weekly `pg_basebackup` or daily `pgBackRest --type=incr` | 4 weeks + 12 monthly | pgBackRest for > 100 GB; `pg_basebackup` for smaller |
| **Logical dump** | daily `pg_dump -F c` | 30 days (point-in-disaster recovery, cross-version restores) | `pg_dump -F c -j 4 -Z 6` |
| **Restore drill** | monthly | — | Restore to a separate host; verify row counts; promote |

**Storage rule**: backups never on the same physical host or AZ as the primary. Encrypt at rest. Verify integrity quarterly.

## pgBouncer pool mode

| Mode | When | Limitations |
|---|---|---|
| **`transaction`** (default for SaaS) | most apps; max fan-out | Breaks `SET` (use `SET LOCAL`), prepared statements unless bouncer 1.21+ with passthrough, advisory locks (use `pg_advisory_xact_lock`), `LISTEN/NOTIFY`. Use this unless you have a hard reason not to. |
| **`session`** | legacy apps relying on session state; `LISTEN/NOTIFY`; long-lived advisory locks | Lower multiplication factor — one client = one server connection for its entire session |
| **`statement`** | special — every statement gets a fresh server conn | Breaks multi-statement transactions; almost never use |

```ini
# /etc/pgbouncer/pgbouncer.ini — production transaction-mode template
[pgbouncer]
pool_mode = transaction
max_client_conn = 2000
default_pool_size = 25
reserve_pool_size = 5
server_idle_timeout = 600
max_prepared_statements = 100   # PG14+ passthrough; bouncer 1.21+ required
```

## Logging

```conf
log_min_duration_statement = 200       # ms — log queries slower than this
log_lock_waits = on                    # log when a lock wait exceeds deadlock_timeout
log_temp_files = 0                     # log all sort spills (work_mem too low)
log_checkpoints = on                   # surface checkpoint storms
log_autovacuum_min_duration = 1000     # log long autovacuums
log_statement = 'ddl'                  # log DDL only (full = noisy + sensitive)
```

| Knob | Recommended | Why |
|---|---|---|
| `log_min_duration_statement` | **200 ms** | catches slow path candidates |
| `log_lock_waits` | **on** | contention surfaces in logs |
| `log_temp_files` | **0** | every spill = `work_mem` undersized |

## Extensions to load by default

```conf
shared_preload_libraries = 'pg_stat_statements'
```

| Extension | Why | When |
|---|---|---|
| `pg_stat_statements` | top-N slow queries | always |
| `pg_trgm` | trigram fuzzy text search | when you need `LIKE '%foo%'` performant |
| `pgcrypto` | encryption + hashing | rarely needed in PG18 (`gen_random_uuid()` now built-in) |
| `pgvector` | embedding similarity | only for ML/RAG workloads |
| `pg_partman` | declarative partitioning automation | time-series tables > 100 GB |

See [extensions.md](extensions.md) for the full catalog.

## Citation rule

Other files in this skill MUST NOT redefine these values inline. Use:

> Defaults: see [recommended-defaults.md](recommended-defaults.md).

## Last verified

2026-05-15 against PG 18 release notes, `/websites/postgresql_18` Context7.
