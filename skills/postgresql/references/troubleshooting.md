# Troubleshooting — postgresql

Symptom-indexed. Required for `risk: high-stakes` skills (skill-evaluation v3).

---

## Connection refused / `FATAL: sorry, too many clients already`

**Symptoms**
- App logs: `connection refused` from the Postgres host
- `psql` returns `FATAL: sorry, too many clients already`
- App p99 latency spikes; some requests fail outright

**Diagnose**
```sql
-- How many connections are open and what are they doing?
SELECT state, count(*)
FROM pg_stat_activity
GROUP BY state
ORDER BY count DESC;

SHOW max_connections;
SELECT count(*) FROM pg_stat_activity;
```

**Common causes**
- ❌ `max_connections` ≤ `app_replicas × pool_size` → math doesn't fit
- ❌ Connection leak — code paths that open connections without releasing
- ❌ `idle in transaction` rows piling up (long open transactions)
- ❌ No pgBouncer in front of Postgres; every app process holds N backend slots
- ❌ Migration / batch tool ran with its own connection on top of the app pool

**Fix**
1. Front the DB with **pgBouncer transaction mode** (see [recommended-defaults.md](recommended-defaults.md))
2. Lower app pool size per process; multiply by replicas to compute total demand
3. Set `idle_in_transaction_session_timeout = '60s'` per role
4. Audit any `BEGIN;` without a corresponding `COMMIT/ROLLBACK` in code

```sql
-- Kill stuck idle-in-transaction
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND now() - state_change > interval '5 min';
```

---

## Slow query (need EXPLAIN ANALYZE)

**Symptoms**
- One endpoint takes 2–30 s
- DB CPU spike correlates
- App logs show DB latency dominant

**Diagnose**
```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT ... FROM ... WHERE ...;
```

Read the plan top-down. Red flags:
- `Seq Scan on big_table` when you expected `Index Scan`
- `Rows Removed by Filter: N` where N is large → wrong index
- `Sort Method: external merge Disk` → `work_mem` too small for this query
- `Buffers: ... read=N` where N is huge → cold cache or missing index
- `Index Scan` but `Filter:` line drops 90%+ of rows → covering / partial index could help

**Common causes**
- ❌ Missing index on filter / join column
- ❌ `WHERE LOWER(email) = ?` without an expression index on `LOWER(email)`
- ❌ `SELECT *` on a wide table when only 3 cols needed
- ❌ Bad statistics — run `ANALYZE table_name` after bulk loads
- ❌ Sort spilling to disk (raise `work_mem` for the session, or pre-sort via index)

**Fix**
```sql
-- Confirm with EXPLAIN
CREATE INDEX CONCURRENTLY idx_users_email_lower ON users (LOWER(email));
ANALYZE users;
```

See [indexes-and-explain.md](indexes-and-explain.md).

---

## Deadlock detected — `SQLSTATE 40P01`

**Symptoms**
- App logs: `ERROR: deadlock detected`
- Sometimes followed by `DETAIL: Process N waits for ... Process M waits for ...`
- One transaction is automatically rolled back; the other continues

**Diagnose**
```sql
-- Identify the relations involved
-- (also visible in DB logs with log_lock_waits=on)
SELECT pid, query, locktype, relation::regclass, mode, granted
FROM pg_locks
JOIN pg_stat_activity USING (pid)
WHERE NOT granted;
```

**Common causes**
- ❌ Two transactions acquire row locks in different orders (`UPDATE A then B` vs `UPDATE B then A`)
- ❌ Schema migration on a hot table holding `ACCESS EXCLUSIVE`
- ❌ Trigger or cascade FK causing implicit locks beyond what you wrote

**Fix**
1. **Always sort the keys before locking**:
   ```ts
   for (const id of ids.sort()) {
     await tx.account.update({ where: { id }, data: { ... } });
   }
   ```
2. Catch `40P01` at the app layer and retry with backoff (same pattern as serialization failure)
3. For DDL on hot tables: take `lock_timeout='2s'` and break the migration into smaller, retryable steps

---

## Vacuum bloat — `n_dead_tup` growing, autovacuum behind

**Symptoms**
- Table size grows but row count is stable
- Sequential scans slower over time
- `pg_stat_user_tables.last_autovacuum` shows it ran days ago
- "Wraparound" autovacuum log warnings

**Diagnose**
```sql
SELECT relname,
       n_live_tup, n_dead_tup,
       last_autovacuum, last_autoanalyze,
       round(n_dead_tup::numeric / NULLIF(n_live_tup, 0), 3) AS dead_ratio
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC LIMIT 20;
```

**Common causes**
- ❌ `autovacuum_vacuum_scale_factor` at default 0.2 → fires at 20% dead on a giant table (millions of dead rows)
- ❌ Long-running transaction holding xmin horizon back — vacuum can't clean up dead rows newer than the oldest open xact
- ❌ Autovacuum cost limit too low; can't keep up with write rate
- ❌ Replication slot or `hot_standby_feedback` holding xmin

**Fix**
```sql
-- Tighten thresholds for the hot table
ALTER TABLE events SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_limit = 2000
);

-- Run a one-shot manual vacuum during low-traffic window
VACUUM (VERBOSE, ANALYZE) events;
-- Or for severe bloat:
VACUUM FULL events;       -- locks table; rebuilds
-- Or online:
-- pg_repack -t events -d mydb
```

Also: kill `idle in transaction` xacts holding the xmin horizon back.

---

## Replication lag (logical or physical)

**Symptoms**
- App reads from replica show stale data
- Streaming replication monitor shows `replay_lag` growing
- Logical subscription `pg_stat_subscription.last_msg_receipt_time` stale

**Diagnose**
```sql
-- Physical (on primary)
SELECT application_name, client_addr, state, sync_state,
       pg_wal_lsn_diff(sent_lsn,   write_lsn)   AS write_lag_bytes,
       pg_wal_lsn_diff(write_lsn,  flush_lsn)   AS flush_lag_bytes,
       pg_wal_lsn_diff(flush_lsn,  replay_lsn)  AS replay_lag_bytes,
       write_lag, flush_lag, replay_lag
FROM pg_stat_replication;

-- Logical (on subscriber)
SELECT subname, received_lsn, latest_end_lsn,
       (latest_end_time - last_msg_receipt_time) AS lag_time
FROM pg_stat_subscription;

-- Replication slots
SELECT slot_name, active, confirmed_flush_lsn,
       pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn) AS lag_bytes
FROM pg_replication_slots;
```

**Common causes**
- ❌ Network bandwidth between primary and standby exhausted
- ❌ Standby CPU/IO can't replay WAL fast enough
- ❌ Large transaction on primary (bulk load) → standby replays as a single block
- ❌ `synchronous_commit = remote_apply` with a slow replica
- ❌ Logical subscription stuck on a conflict (PK collision, schema mismatch)

**Fix**
1. Check standby disk I/O (`iostat`) — replay is single-process WAL replay; CPU + I/O matter
2. Split bulk loads into smaller transactions
3. For logical: inspect `pg_stat_subscription_stats` for error counts and apply errors
4. For temporary fixes: drop `synchronous_commit` to `local` on the primary

---

## Tablespace / disk full

**Symptoms**
- Postgres logs: `could not write to file ...: No space left on device`
- Database operations return errors; connections still work
- `df -h /var/lib/postgresql` near 100%

**Diagnose**
```sql
-- Biggest tables
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog','information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC LIMIT 20;

-- WAL size
SELECT pg_size_pretty(sum(size)) AS wal_size FROM pg_ls_waldir();

-- Replication slot lag (often the culprit)
SELECT slot_name, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)) AS lag
FROM pg_replication_slots
ORDER BY pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn) DESC;
```

**Common causes**
- ❌ Orphaned replication slot — consumer gone, WAL accumulates
- ❌ Bloat — dead rows not vacuumed
- ❌ Misconfigured `max_wal_size` (too high) on a small disk
- ❌ Log retention (`log_directory`) growing unbounded
- ❌ `pg_stat_statements` history bloating

**Fix (urgent)**
```sql
-- Drop the orphaned slot AFTER confirming the consumer is gone
SELECT pg_drop_replication_slot('orphaned_slot_name');

-- Clean up old log files (separate from data files)
-- Rotate via logrotate
```

For long-term: monitor `pg_replication_slots` lag in your alerts; alert at 50% of disk capacity.

---

## WAL archive failure — `archive_command failed`

**Symptoms**
- Logs: `archive command failed with exit code N`
- `pg_stat_archiver.failed_count` rising
- WAL accumulates in `pg_wal/` (never recycled)
- Disk fills up

**Diagnose**
```sql
SELECT * FROM pg_stat_archiver;
```

Run the command manually as the postgres user:
```bash
sudo -u postgres /your/archive_command /var/lib/postgresql/18/main/pg_wal/<segment>
echo "exit: $?"
```

**Common causes**
- ❌ Destination (S3, NFS, rsync target) unreachable
- ❌ Credentials expired
- ❌ Disk full at the destination
- ❌ Permissions on local archive directory
- ❌ Command times out (slow upload, no progress)

**Fix**
1. Repair the destination (network, credentials, space)
2. After repair, Postgres retries automatically on the next WAL segment
3. If the backlog is huge, you may need to clear `archive_status/*.ready` AFTER manually shipping the segments

```bash
# Reset archiver stats after fixing
psql -c "SELECT pg_stat_reset_shared('archiver');"
```

---

## Lock contention — long-running transaction blocking DDL

**Symptoms**
- `ALTER TABLE` or `CREATE INDEX CONCURRENTLY` hangs
- `pg_stat_activity` shows the DDL `state = 'active'` but no progress
- Other queries on the table are blocked or slow

**Diagnose**
```sql
-- Find what's blocking
SELECT
  blocked.pid     AS blocked_pid,
  blocked.query   AS blocked_query,
  blocking.pid    AS blocking_pid,
  blocking.query  AS blocking_query,
  now() - blocking.query_start AS blocking_age
FROM pg_stat_activity blocked
JOIN pg_stat_activity blocking ON blocking.pid = ANY(pg_blocking_pids(blocked.pid))
WHERE blocked.wait_event_type = 'Lock';
```

**Common causes**
- ❌ Long-running SELECT on the same table holds `ACCESS SHARE`
- ❌ `idle in transaction` from app
- ❌ Replication using `hot_standby_feedback = on` with a slow query on the replica
- ❌ Autovacuum on the same table (worth waiting; don't kill)

**Fix**
```sql
-- After confirming it's safe:
SELECT pg_cancel_backend(<pid>);     -- soft cancel
SELECT pg_terminate_backend(<pid>);  -- hard kill (last resort)
```

For routine DDL: set `lock_timeout = '2s'` per statement and retry with backoff. Avoid running DDL during business hours on hot tables.

---

## Statement timeout — `canceling statement due to statement timeout` (`SQLSTATE 57014`)

**Symptoms**
- App logs: `ERROR: canceling statement due to statement timeout`
- Happens after exactly N seconds (your timeout)

**This is by design** — it's PROTECTING you. Investigate why the query is slow, don't just raise the timeout.

**Diagnose** — same as "Slow query" above. EXPLAIN ANALYZE on a similar-sized dataset.

**Fix**
- Add the missing index (the usual answer)
- Rewrite the query (LIMIT, paginate, avoid `SELECT *`)
- For legitimate slow queries (reports, batch): use a dedicated role with raised timeout:
  ```sql
  ALTER ROLE analytics SET statement_timeout = '5min';
  ```

---

## `pg_stat_statements` not loaded — `relation "pg_stat_statements" does not exist`

**Symptoms**
- `SELECT * FROM pg_stat_statements` errors
- Want to find top-N slow queries but can't

**Fix**
```conf
# postgresql.conf
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.max = 10000
pg_stat_statements.track = all
```

Restart Postgres (not just reload — `shared_preload_libraries` is restart-only), then:

```sql
CREATE EXTENSION pg_stat_statements;
SELECT query, calls, mean_exec_time, total_exec_time, rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC LIMIT 20;
```

---

## OOM from `work_mem × many parallel queries`

**Symptoms**
- Linux OOM killer kills `postgres` processes
- `dmesg` shows `Out of memory: Killed process ... postgres`
- App sees connections reset

**Diagnose**
```bash
# Memory usage during normal load
free -h
ps -eo pid,user,rss,cmd | grep postgres | sort -k3 -nr | head
```

```sql
SHOW work_mem;
SHOW max_connections;
-- worst case: max_connections × work_mem × max_parallel_workers_per_gather
```

**Common causes**
- ❌ `work_mem = 256 MB` × `max_connections = 200` × parallel ops per query → can exceed RAM under load
- ❌ Single bad query allocating multiple sort/hash buckets at high `work_mem`
- ❌ Overcommit setting on Linux (`vm.overcommit_memory = 0`) plus no swap

**Fix**
1. Lower `work_mem` to a safer default; **selectively raise** per session for reporting queries:
   ```sql
   SET LOCAL work_mem = '256MB';   -- this query only
   ```
2. Cap `max_connections` and use pgBouncer for high fan-out
3. Disable overcommit, add swap, or use `cgroup` memory limits
4. Track `log_temp_files = 0` to find the worst spillers

---

## More symptoms?

Capture: `SELECT version();`, the failing query + `EXPLAIN (ANALYZE, BUFFERS)`, `pg_stat_activity` snapshot, `dmesg` if OOM, `df -h`, recent log lines from `/var/log/postgresql/postgresql-18-main.log`. The PG18 error code reference: <https://www.postgresql.org/docs/18/errcodes-appendix.html>.
