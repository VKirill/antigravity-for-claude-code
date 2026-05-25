# PostgreSQL 18 — What's New

> Source: https://www.postgresql.org/docs/18/release-18.html (Context7 `/websites/postgresql_18`, verified 2026-05-15)

## Headlines

1. **Asynchronous I/O subsystem** — backends queue multiple read requests; major boost for sequential scans, bitmap heap scans, and VACUUM
2. **Skip-scan B-tree lookups** — multicolumn indexes now usable when filtering on a non-leading column
3. **`uuidv7()` built-in** — timestamp-ordered UUIDs without an extension
4. **Virtual generated columns as default** — computed on read, no storage
5. **OAuth authentication** — `oauth_client_id` / `oauth_issuer_url` connection params
6. **Temporal constraints** — `PRIMARY KEY`/`UNIQUE`/`FOREIGN KEY ... WITHOUT OVERLAPS` natively

## Async I/O

```conf
io_method = 'worker'      # or 'io_uring' on Linux 5.x+
io_workers = 3
io_max_concurrency = 8
```

Pre-PG18: each backend issued reads synchronously. PG18 lets backends queue multiple outstanding reads — the kernel (worker thread pool or io_uring) services them in parallel. Sequential scan throughput improves 2–5× on NVMe.

Inspect:

```sql
SELECT * FROM pg_aios;        -- outstanding async I/Os
```

`io_method = 'sync'` reverts to PG17 behavior if you hit a regression.

## Skip-scan B-tree

PG17 and earlier: `CREATE INDEX (a, b)` couldn't serve `WHERE b = ?`. PG18 adds skip scan — the planner iterates distinct `a` values and probes `b` within each.

Useful when:
- `a` has low cardinality (e.g., `status` with 3–4 values)
- `b` is the actually-selective predicate
- You'd otherwise duplicate the index as `(b, a)`

Confirm via `EXPLAIN`:

```text
Index Scan using orders_status_user_idx on orders
  Skip Scan Cond: (user_id = $1)
```

## `uuidv7()`

```sql
CREATE TABLE orders (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  ...
);
SELECT uuidv7();   -- 01863c47-7f2e-7c00-8000-...
```

UUIDv7 = unix-ms-timestamp prefix + random suffix. Sortable, indexable without page-splits, no extension needed. Replaces `uuid_generate_v4()` and `cuid()` workarounds.

Use this for new tables unless you specifically need v4 randomness.

## Virtual generated columns (default)

```sql
-- Virtual (PG18 default) — no storage
CREATE TABLE products (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  price_cents bigint NOT NULL,
  price_rub   numeric(10,2) GENERATED ALWAYS AS (price_cents::numeric / 100)
);

-- Explicit virtual
... GENERATED ALWAYS AS (...) VIRTUAL

-- Stored (was the only mode pre-PG18)
... GENERATED ALWAYS AS (...) STORED
```

Virtual cols compute on read (cheap writes, slower reads). STORED cols compute on write (more storage, faster reads, indexable). Index a generated col → must be STORED.

## OAuth authentication

```
# connection string
postgresql://example.com/mydb?oauth_client_id=my-client&oauth_issuer_url=https://auth.example.com
```

`pg_hba.conf`:

```
host all all 0.0.0.0/0 oauth issuer="https://auth.example.com" trust_validator_authn_id=1
```

Custom validator hooks (`ValidatorValidateCB`) integrate with your IDP. Best fit: enterprises with central SSO that don't want to manage Postgres passwords.

## Temporal constraints

```sql
-- Pre-PG18: GIST exclusion constraint
CREATE TABLE rentals (
  car_id uuid,
  period tstzrange,
  EXCLUDE USING GIST (car_id WITH =, period WITH &&)
);

-- PG18 native:
CREATE TABLE rentals (
  car_id uuid,
  period tstzrange,
  PRIMARY KEY (car_id, period WITHOUT OVERLAPS)
);

-- Or unique:
ALTER TABLE rentals ADD UNIQUE (car_id, period WITHOUT OVERLAPS);

-- Or foreign keys:
FOREIGN KEY (car_id, period) REFERENCES cars (car_id, period) PERIOD MATCH ...
```

Reading: "no two rentals for the same car can have overlapping periods". Cleaner than EXCLUDE; queryable by the planner.

## Other notable improvements

- `pg_stat_statements` adds query-plan tracking
- Better `EXPLAIN` output (per-worker statistics for parallel queries)
- Improved partition-wise joins
- TLS 1.3 requirements tightened
- New `pg_stat_io` view (per-I/O-type statistics)
- `gen_random_uuid()` now uses platform CSPRNG (no `pgcrypto` needed)
- COPY parallelism for partitioned tables
- `ALTER TABLE ... ADD COLUMN ... NOT NULL DEFAULT volatile_expr()` still rewrites — for stable defaults, instant; volatile defaults force the rewrite

## Upgrade notes (PG17 → PG18)

### `pg_upgrade` (in-place, fastest)

```bash
sudo apt install postgresql-18 postgresql-18-contrib
pg_upgrade \
  --old-bindir=/usr/lib/postgresql/17/bin \
  --new-bindir=/usr/lib/postgresql/18/bin \
  --old-datadir=/var/lib/postgresql/17/main \
  --new-datadir=/var/lib/postgresql/18/main \
  --link            # hard-link mode = fast, but old cluster unusable after
```

After: regenerate optimizer stats:

```bash
/var/lib/postgresql/18/main/analyze_new_cluster.sh
```

### Logical replication (zero downtime)

1. Bring up PG18 standby.
2. Create `PUBLICATION` on PG17, `SUBSCRIPTION` on PG18.
3. Wait for catch-up.
4. Switch traffic to PG18.

### Compatibility flags

- Old `int2vector` removal hits some extensions — check pgvector, postgis versions
- `wal_keep_segments` removed (replaced by `wal_keep_size` since PG13)
- `replication_slot_failover` is new — verify behavior on managed providers (Neon, Crunchy, RDS)

## Performance migration tips

After upgrading to PG18:

1. Set `io_method = 'worker'` (or `'io_uring'` on modern Linux)
2. Run `ANALYZE` across the cluster
3. Check `pg_stat_io` for I/O hotspots
4. Consider replacing `uuid_generate_v4()` defaults with `uuidv7()` for new columns
5. Re-evaluate which `(a, b)` indexes you have — some may no longer need the duplicate `(b)` thanks to skip scans
