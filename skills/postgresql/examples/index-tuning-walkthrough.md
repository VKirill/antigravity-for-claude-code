# Example — Index tuning walkthrough

A slow query, diagnosed via `EXPLAIN ANALYZE`, fixed with a covering index.

## Setup

```sql
CREATE TABLE orders (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id    uuid NOT NULL,
  status     text NOT NULL,
  amount     numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed 10M rows
INSERT INTO orders (user_id, status, amount)
SELECT
  (ARRAY['11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222222'])[1 + floor(random() * 2)::int],
  (ARRAY['pending', 'paid', 'refunded'])[1 + floor(random() * 3)::int],
  random() * 1000
FROM generate_series(1, 10_000_000);

ANALYZE orders;
```

## The slow query

The app wants the user's recent paid orders:

```sql
SELECT id, amount, created_at
FROM orders
WHERE user_id = '11111111-1111-1111-1111-111111111111'
  AND status = 'paid'
ORDER BY created_at DESC
LIMIT 20;
```

## Step 1 — Baseline EXPLAIN

```sql
EXPLAIN (ANALYZE, BUFFERS) <query>;
```

```text
Limit  (cost=234567.89..234567.94 rows=20 width=40) (actual time=1842.123..1842.130 rows=20 loops=1)
  Buffers: shared hit=4823 read=85432
  ->  Sort  (cost=234567.89..238456.78 rows=1555556 width=40) (actual time=1842.121..1842.124 rows=20 loops=1)
        Sort Key: created_at DESC
        Sort Method: top-N heapsort  Memory: 28kB
        ->  Seq Scan on orders  (cost=0.00..193219.50 rows=1555556 width=40) (actual time=0.018..1567.234 rows=1666234 loops=1)
              Filter: ((user_id = '11111111-...'::uuid) AND (status = 'paid'))
              Rows Removed by Filter: 8333766
Planning Time: 0.421 ms
Execution Time: 1842.205 ms
```

Diagnosis:
- **Seq Scan** on 10M rows
- 1.6M rows pass the filter, then sorted, then 20 returned
- 1.8 seconds for what should be a sub-ms query
- `Rows Removed by Filter: 8.3M` — most of the work is wasted

## Step 2 — First attempt: index on `user_id`

```sql
CREATE INDEX CONCURRENTLY orders_user_id_idx ON orders (user_id);
```

```text
Limit  (cost=12345.67..12345.72 rows=20 width=40) (actual time=145.234..145.241 rows=20 loops=1)
  ->  Sort  (cost=12345.67..12500.34 rows=61867 width=40) (actual time=145.232..145.235 rows=20 loops=1)
        Sort Method: top-N heapsort  Memory: 28kB
        ->  Bitmap Heap Scan on orders  (cost=1234.56..10987.65 rows=61867 width=40) (actual time=23.45..132.5 rows=833117 loops=1)
              Recheck Cond: (user_id = '11111111-...'::uuid)
              Filter: (status = 'paid')
              Rows Removed by Filter: 4166573
              Heap Blocks: exact=85234
              ->  Bitmap Index Scan on orders_user_id_idx  (cost=0.00..1219.09 rows=4999690 width=0)
                    Index Cond: (user_id = '11111111-...'::uuid)
Execution Time: 145.300 ms
```

Better (1.8s → 145ms) but still:
- 833k rows pass the user_id filter
- Sort still happens after
- Heap-fetches `85k` blocks

## Step 3 — Composite index matching the query shape

The ideal index covers `WHERE user_id = ? AND status = ? ORDER BY created_at DESC`:

```sql
CREATE INDEX CONCURRENTLY orders_user_status_created_idx
  ON orders (user_id, status, created_at DESC);
```

```text
Limit  (cost=0.56..120.45 rows=20 width=40) (actual time=0.045..0.350 rows=20 loops=1)
  ->  Index Scan using orders_user_status_created_idx on orders
        (cost=0.56..372456.78 rows=61867 width=40) (actual time=0.044..0.346 rows=20 loops=1)
        Index Cond: ((user_id = '11111111-...'::uuid) AND (status = 'paid'))
Execution Time: 0.420 ms
```

**0.4 ms**. The index now satisfies:
- Equality on `user_id`
- Equality on `status`
- Sort on `created_at DESC`

No sort step. 20-row LIMIT short-circuits after reading the first 20 index entries.

## Step 4 — Covering index for index-only scan

If the app also reads `amount`, add it via `INCLUDE`:

```sql
DROP INDEX orders_user_status_created_idx;
CREATE INDEX CONCURRENTLY orders_user_status_created_amount_inc
  ON orders (user_id, status, created_at DESC) INCLUDE (amount);
```

```text
Limit  (...)
  ->  Index Only Scan using orders_user_status_created_amount_inc on orders
        Heap Fetches: 0
Execution Time: 0.180 ms
```

**0.18 ms** — Index Only Scan, no heap touch.

## Caveats

- `INCLUDE` columns are NOT in the search key — only `(user_id, status, created_at)` is searchable
- `Heap Fetches > 0` means the visibility map is stale; run `VACUUM` after bulk inserts/updates
- Index size: ~1.5× the search-key-only index. Worth it for hot read paths.

## Verify the win in production

```sql
SELECT mean_exec_time, calls, query
FROM pg_stat_statements
WHERE query LIKE '%FROM orders WHERE user_id%'
ORDER BY total_exec_time DESC LIMIT 5;
```

Watch `mean_exec_time` drop from milliseconds to sub-ms.

## Lessons

1. Multi-column index order: equality first, then equality, then sort
2. Match index column order to the query's WHERE + ORDER BY
3. Use `INCLUDE` for additional projected columns to enable Index-Only Scan
4. Always run `EXPLAIN (ANALYZE, BUFFERS)`, not just `EXPLAIN` — the latter is just the planner's estimate
5. In PG18, you might NOT need the `(user_id, status, ...)` ordering — skip scan handles `status` first if `user_id` is more selective. But explicit ordering still wins for tightest plans.
