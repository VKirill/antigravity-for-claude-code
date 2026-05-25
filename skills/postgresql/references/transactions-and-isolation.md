# PostgreSQL — Transactions, Isolation, Locking

## Basics

```sql
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;        -- or ROLLBACK
```

Savepoints:

```sql
BEGIN;
INSERT INTO orders (id, ...) VALUES (...);
SAVEPOINT s1;
UPDATE inventory SET qty = qty - 1 WHERE sku = 'X';
-- if the update fails:
ROLLBACK TO SAVEPOINT s1;
COMMIT;
```

## Isolation levels

| Level | Reads see | Anomalies prevented |
|---|---|---|
| **READ COMMITTED** (default) | Only committed data at the time of each statement | Dirty reads |
| **REPEATABLE READ** | A consistent snapshot from the transaction's start | Non-repeatable reads, phantoms (in Postgres specifically) |
| **SERIALIZABLE** | A snapshot guaranteed equivalent to some serial execution | Write-skew, serialization anomalies |

```sql
BEGIN ISOLATION LEVEL SERIALIZABLE;
-- ...
COMMIT;
```

Or set default per session: `SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL SERIALIZABLE`.

### When to pick which

- **READ COMMITTED** — 95% of OLTP. Fastest. Default.
- **REPEATABLE READ** — Multi-row reports where consistency across statements matters.
- **SERIALIZABLE** — Multi-row writes that mustn't interleave (transferring funds, inventory). Triggers serialization-failure errors that must be retried.

## Serialization failures (40001)

```python
for attempt in range(3):
    try:
        with db.transaction(isolation_level='serializable'):
            ...
        break
    except SerializationFailure:
        time.sleep(0.05 * 2 ** attempt)
```

Same in any language. Postgres raises `SQLSTATE 40001` for serialization conflicts and `40P01` for deadlocks. Retry both with backoff.

## Locks

### Row locks

```sql
BEGIN;
SELECT * FROM orders WHERE id = ? FOR UPDATE;       -- exclusive row lock until txn ends
SELECT * FROM orders WHERE id = ? FOR SHARE;        -- shared row lock
SELECT * FROM orders WHERE id = ? FOR UPDATE NOWAIT;            -- raise if blocked
SELECT * FROM orders WHERE id = ? FOR UPDATE SKIP LOCKED;        -- skip rows locked elsewhere
COMMIT;
```

### Queue pattern with `SKIP LOCKED`

```sql
BEGIN;
SELECT id, payload FROM jobs
WHERE status = 'pending'
ORDER BY created_at
LIMIT 10
FOR UPDATE SKIP LOCKED;
-- worker processes the rows
UPDATE jobs SET status = 'done' WHERE id = ANY(?);
COMMIT;
```

Multiple workers can pull non-overlapping batches concurrently. This is how Postgres serves as a job queue (alternative to Redis BullMQ).

### Advisory locks

App-level mutex — not tied to a row:

```sql
SELECT pg_advisory_lock(hashtext('my-job'));     -- blocks until acquired
-- ... do exclusive work ...
SELECT pg_advisory_unlock(hashtext('my-job'));
```

Use `pg_try_advisory_lock(key) -> bool` for non-blocking. Use `pg_advisory_xact_lock(key)` to auto-release on COMMIT/ROLLBACK.

Common use: one-leader election in a multi-process job scheduler.

### Table locks

`LOCK TABLE foo IN EXCLUSIVE MODE;` — rarely needed. Most DDL takes an `ACCESS EXCLUSIVE` lock automatically.

DDL lock modes (most restrictive first):
- `ACCESS EXCLUSIVE` — `DROP TABLE`, `TRUNCATE`, most `ALTER TABLE`
- `EXCLUSIVE` — `REFRESH MATERIALIZED VIEW`
- `SHARE ROW EXCLUSIVE` — `CREATE TRIGGER`, some `ALTER`
- `SHARE` — `CREATE INDEX` (non-concurrent)
- `SHARE UPDATE EXCLUSIVE` — `CREATE INDEX CONCURRENTLY`, `VACUUM`
- `ROW EXCLUSIVE` — `INSERT/UPDATE/DELETE`
- `ROW SHARE` — `SELECT FOR UPDATE/SHARE`
- `ACCESS SHARE` — `SELECT`

Two locks conflict if their union table in the docs says so.

## Deadlocks

Postgres detects and aborts one transaction:

```text
ERROR:  deadlock detected
SQLSTATE: 40P01
```

Prevention: always acquire locks in a consistent order. For multi-row updates, sort the keys:

```python
for id_ in sorted(ids):
    db.execute('UPDATE accounts SET ... WHERE id = ?', id_)
```

## Idle in transaction

A long-running open transaction holds locks AND keeps WAL from being recycled (depending on what it's done). Monitor:

```sql
SELECT pid, state, query_start, xact_start, query
FROM pg_stat_activity
WHERE state = 'idle in transaction'
ORDER BY xact_start;
```

Set a timeout in `postgresql.conf` or per role:

```sql
ALTER ROLE myapp SET idle_in_transaction_session_timeout = '60s';
ALTER ROLE myapp SET statement_timeout = '30s';
```

## CTEs and transactions

Each CTE is part of the enclosing transaction. `WITH ... DELETE ... INSERT INTO ...` is atomic.

```sql
WITH archived AS (
  DELETE FROM messages WHERE sent_at < now() - interval '90 days' RETURNING *
)
INSERT INTO messages_archive SELECT * FROM archived;
```

## Two-phase commit (rare)

```sql
BEGIN;
-- ...
PREPARE TRANSACTION 'my-xid';
-- later from any session:
COMMIT PREPARED 'my-xid';
-- or:
ROLLBACK PREPARED 'my-xid';
```

Used for distributed transactions (XA). Requires `max_prepared_transactions > 0`. Most apps don't need this.

## Anti-patterns

- ❌ Long open transactions holding row locks → table-level contention
- ❌ Mixing `SELECT FOR UPDATE` with auto-commit code
- ❌ Catching SQLSTATE 40001 silently → data inconsistency
- ❌ External HTTP calls inside a transaction → backend slot held for network latency
- ❌ Forgetting `idle_in_transaction_session_timeout`
- ❌ Looping per-row `UPDATE` instead of one `UPDATE ... WHERE id IN (...)`
