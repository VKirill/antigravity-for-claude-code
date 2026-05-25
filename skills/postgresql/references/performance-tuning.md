# PostgreSQL — Performance Tuning

## Memory settings (`postgresql.conf`)

For a server with N GB of RAM dedicated to Postgres:

| Param | Recommendation |
|---|---|
| `shared_buffers` | ~25% of RAM (max ~8 GB benefit; beyond that, give it to OS cache) |
| `effective_cache_size` | 50–75% of RAM — planner hint, not allocation |
| `work_mem` | (RAM − shared_buffers) / (max_connections × 2 to 4) — typically 4–64 MB |
| `maintenance_work_mem` | 1 GB for VACUUM / CREATE INDEX |
| `wal_buffers` | 16 MB (default 4 MB) |
| `max_wal_size` | 4–8 GB for write-heavy |
| `min_wal_size` | 1 GB |
| `checkpoint_completion_target` | 0.9 |
| `random_page_cost` | 1.1 on SSD/NVMe (default 4.0 was for spinning disks) |
| `effective_io_concurrency` | 200 on NVMe, 2 on HDD |

## Sample for a 16 GB host

```conf
shared_buffers = 4GB
effective_cache_size = 12GB
work_mem = 32MB
maintenance_work_mem = 1GB
max_connections = 200
wal_buffers = 16MB
max_wal_size = 4GB
min_wal_size = 1GB
checkpoint_completion_target = 0.9
random_page_cost = 1.1
effective_io_concurrency = 200
```

## Autovacuum

Default thresholds are conservative for large tables. Tune per-table for hot tables:

```sql
ALTER TABLE events SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_limit = 2000
);
```

Monitor:

```sql
SELECT relname, last_autovacuum, last_autoanalyze, n_dead_tup, n_live_tup
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC LIMIT 20;
```

If autovacuum can't keep up, you'll see `n_dead_tup` growing without bound. Crank `autovacuum_max_workers` (default 3) or run a manual `VACUUM` during a low-traffic window.

## PG18 async I/O

```conf
# Enable async I/O (default 'sync' in PG17, 'worker' or 'io_uring' in PG18)
io_method = 'worker'
io_workers = 3
io_max_concurrency = 8
```

`io_uring` on Linux 5.x+ is highest throughput. `worker` works everywhere. Inspect outstanding I/O:

```sql
SELECT * FROM pg_aios;
```

Async I/O speeds up sequential scans, bitmap heap scans, and VACUUM. No-op for indexed lookups.

## Connection pooling — PgBouncer

Backend connections in Postgres are expensive (~10 MB RAM each, plus context switches). Cap `max_connections` at 100–300 and front it with PgBouncer.

`/etc/pgbouncer/pgbouncer.ini`:

```ini
[databases]
mydb = host=127.0.0.1 dbname=mydb

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = 6432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 2000
default_pool_size = 25
reserve_pool_size = 5
server_idle_timeout = 600
```

### Pool modes

- **session** — client gets one server conn for its session. Supports all features (SET, prepared statements, advisory locks). Lowest multiplication factor.
- **transaction** — server conn released at COMMIT. Highest multiplication. Breaks: `SET` (use `SET LOCAL`), prepared statements (unless `--enable-prepared-statements` PG14+), advisory locks (use `pg_advisory_xact_lock`), LISTEN/NOTIFY.
- **statement** — released per statement. Very restrictive. Rarely used.

Pick **transaction** mode unless you need SET / prepared statements.

### Prepared statements with PgBouncer transaction mode (PG14+)

PgBouncer 1.21+ supports prepared statement passthrough:

```ini
max_prepared_statements = 100
```

Or disable prepared statements client-side (`prepare: false` in Prisma adapter).

## Query timeouts

```sql
ALTER ROLE app SET statement_timeout = '5s';
ALTER ROLE app SET idle_in_transaction_session_timeout = '60s';
ALTER ROLE app SET lock_timeout = '2s';
```

Bound runaway queries. The DB will cancel them; the app sees `SQLSTATE 57014` (query canceled).

## Stats / planner

`ANALYZE` after big bulk loads. For columns with non-uniform distribution:

```sql
ALTER TABLE users ALTER COLUMN role SET STATISTICS 1000;
ANALYZE users;
```

For correlated multi-column predicates, extended statistics:

```sql
CREATE STATISTICS users_role_country (dependencies, ndistinct) ON role, country FROM users;
ANALYZE users;
```

The planner uses this to estimate joint cardinality.

## Bloat reclamation

```sql
VACUUM FULL users;       -- locks table; rebuilds from scratch
CLUSTER users USING users_pkey;  -- reorder rows by index
REINDEX TABLE CONCURRENTLY users;
```

`VACUUM FULL` blocks reads/writes. Use `pg_repack` (extension) for online table rewrite — same effect, no downtime.

## Logging slow queries

```conf
log_min_duration_statement = 200     # ms; 0 = log everything
log_statement = 'ddl'                # also log DDL
log_lock_waits = on
log_temp_files = 0                   # log all temp file usage (sort spills)
```

## TOP-N slow queries (`pg_stat_statements`)

```sql
SELECT query, calls, mean_exec_time, total_exec_time, rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC LIMIT 20;
```

`mean_exec_time × calls = total_exec_time` — fix the one with highest total first.

## Common bottlenecks

| Symptom | Cause | Fix |
|---|---|---|
| All queries slow | Disk contention | Check `iostat`, raise IOPS |
| One query slow | Bad plan | EXPLAIN; missing index |
| CPU saturated | Many small queries | Cache (Redis), batch |
| Locks piling up | Long transactions | `pg_stat_activity`; kill or refactor |
| Memory grows unbounded | Per-conn allocations | Lower `work_mem` × `max_connections` |
| Sort spills to disk | `work_mem` too low | Raise it, or index for sorted scan |
| WAL growing | Replication slot lag | Drop orphaned slots |
| Autovacuum behind | Hot writes | Tune `autovacuum_*` per table |
