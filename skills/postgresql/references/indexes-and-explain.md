# PostgreSQL — Indexes & EXPLAIN

## Index access methods

| Method | When |
|---|---|
| **B-tree** (default) | Equality + range on scalars; ORDER BY |
| **Hash** | Equality only; rarely better than B-tree (don't use) |
| **GIN** | Inverted: jsonb, arrays, full-text |
| **GiST** | Geometric (postgis), ranges, exclusion constraints |
| **SP-GiST** | Space-partitioned: phone numbers, IP, prefix matching |
| **BRIN** | Huge sequential data (logs, time-series) — tiny index, range-scan only |
| **BLOOM** (extension) | Multi-column equality with no clear leading column |

## Creating indexes

```sql
-- Standard B-tree
CREATE INDEX users_email_idx ON users (email);

-- Multi-column
CREATE INDEX orders_user_created_idx ON orders (user_id, created_at DESC);

-- Partial (WHERE clause)
CREATE INDEX orders_pending_idx ON orders (created_at) WHERE status = 'pending';

-- Expression
CREATE INDEX users_lower_email_idx ON users (lower(email));

-- Unique partial
CREATE UNIQUE INDEX users_email_active_unique ON users (email) WHERE deleted_at IS NULL;

-- Covering (INCLUDE) — index-only scans
CREATE INDEX orders_user_id_inc_idx ON orders (user_id) INCLUDE (status, amount);

-- GIN on JSONB
CREATE INDEX events_payload_gin ON events USING GIN (payload jsonb_path_ops);

-- GIN on array
CREATE INDEX posts_tags_gin ON posts USING GIN (tags);

-- BRIN on time-series
CREATE INDEX events_ts_brin ON events USING BRIN (ts) WITH (pages_per_range = 32);
```

## Always CONCURRENTLY in production

```sql
CREATE INDEX CONCURRENTLY users_email_idx ON users (email);
```

Without `CONCURRENTLY`, `CREATE INDEX` takes `ShareLock` for the duration — blocks writes. With it, the build takes longer but runs in two passes and never blocks DML.

`CONCURRENTLY` cannot run inside a transaction. If a concurrent index build fails, the resulting index is marked `INVALID`. Drop and retry: `DROP INDEX users_email_idx; CREATE INDEX CONCURRENTLY ...`.

## Column order in multi-column indexes

`CREATE INDEX (a, b)` supports queries that:
- Filter by `a`
- Filter by `a AND b`
- Order by `a, b`
- (PG18) Filter by `b` alone via **skip scan** — new in 18

For sort to use the index, the index column order must match the `ORDER BY` (with optional `DESC` per column).

## Skip scans (PG18)

Before PG18: `CREATE INDEX (a, b)` didn't help `WHERE b = ?`. You needed a separate `CREATE INDEX (b)`. PG18 adds skip scan, which iterates over distinct `a` values and uses the index for `b` within each — useful when `a` has low cardinality.

```sql
-- PG18+
CREATE INDEX orders_status_user_idx ON orders (status, user_id);
-- Now usable for: WHERE user_id = $1 (without filtering status)
```

## EXPLAIN (ANALYZE, BUFFERS, VERBOSE)

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT * FROM orders WHERE user_id = '...' AND status = 'paid' ORDER BY created_at DESC LIMIT 20;
```

Read top-down:

```
Limit  (cost=0.42..8.45 rows=20 width=80) (actual time=0.020..0.250 rows=20 loops=1)
  Buffers: shared hit=22
  ->  Index Scan Backward using orders_user_created_idx on orders
        Index Cond: (user_id = '...')
        Filter: (status = 'paid')
        Rows Removed by Filter: 3
```

Look for:
- `Seq Scan` on a large table → missing or unusable index
- `Sort` step with `Sort Method: external merge Disk:` → `work_mem` too small
- `Rows Removed by Filter` ≫ 0 → predicate isn't using an index; consider partial index
- `Heap Fetches: N` with non-zero N → index-only scan blocked by recent updates; vacuum

## `Bitmap Heap Scan` vs `Index Scan`

- `Index Scan` — one row at a time, follows the index pointer. Best for selective predicates with `ORDER BY` matching the index.
- `Bitmap Heap Scan` — collects matching TIDs into a bitmap, then sorts them by heap position. Best for moderately selective predicates touching many pages.
- `Seq Scan` — full table read. Best when the predicate matches >10–20% of rows.

The planner picks based on `random_page_cost`, `seq_page_cost`, and table statistics. Run `ANALYZE <table>` if a recent bulk load left stale stats.

## Index-only scans

For an `Index Only Scan`, the index must contain ALL columns the query references. Use `INCLUDE`:

```sql
CREATE INDEX orders_user_inc ON orders (user_id) INCLUDE (status, amount, created_at);
-- SELECT status, amount, created_at FROM orders WHERE user_id = ?;  → Index Only Scan
```

Also requires the visibility map to be up-to-date; recent writes can degrade to `Heap Fetches`.

## Statistics

```sql
ANALYZE users;                    -- updates stats for the planner
ANALYZE VERBOSE users (email);    -- targeted column
```

Run after big bulk loads. Autovacuum runs `ANALYZE` automatically when ~10% of rows change.

For columns with skewed distributions, increase stats target:

```sql
ALTER TABLE users ALTER COLUMN role SET STATISTICS 1000;
ANALYZE users;
```

Default is 100. Higher = more buckets in the histogram = better plans for skewed data.

## When NOT to add an index

- The column is rarely filtered/sorted
- The column has very few distinct values (e.g., `is_deleted bool`) — use a **partial index** instead
- Heavy write workload — every index adds INSERT/UPDATE cost
- The table is small enough that Seq Scan is faster anyway

## Reindexing

```sql
REINDEX INDEX CONCURRENTLY users_email_idx;
REINDEX TABLE CONCURRENTLY users;
REINDEX DATABASE CONCURRENTLY mydb;
```

Use after bulk deletes/updates to reclaim bloat. `CONCURRENTLY` available from PG12.

## Bloat monitoring

```sql
SELECT relname, n_dead_tup, n_live_tup, ROUND(n_dead_tup::numeric / NULLIF(n_live_tup, 0), 2) AS dead_ratio
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC LIMIT 20;
```

High `dead_ratio` (>0.3) → autovacuum not keeping up.

For index bloat, install `pgstattuple` extension and run `SELECT * FROM pgstattuple_approx('users_email_idx');`.
