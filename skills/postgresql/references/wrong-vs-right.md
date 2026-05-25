# Wrong vs Right — postgresql

Five paste-runnable contrasts. High-stakes SQL patterns where naïve usage compiles but breaks at scale.

---

## 1. `SELECT *` vs explicit column list

**❌ Wrong — drags every column, breaks the planner's index-only-scan optimization**
```sql
SELECT * FROM users WHERE active = true ORDER BY created_at DESC LIMIT 50;
```

**✅ Right — explicit columns, can ride a covering index**
```sql
SELECT id, email, name, created_at
FROM users
WHERE active = true
ORDER BY created_at DESC
LIMIT 50;

-- Covering index — index-only scan, no heap fetch
CREATE INDEX CONCURRENTLY idx_users_active_created
  ON users (active, created_at DESC)
  INCLUDE (id, email, name)
  WHERE active = true;
```

**Why it matters**: `SELECT *` re-binds every column ordinal across schema migrations, leaks new sensitive columns to clients, and disables index-only scans (because the planner must still fetch the heap to satisfy unlisted columns). Performance overhead is real on wide tables.

---

## 2. Implicit `READ COMMITTED` for write-skew vs explicit `SERIALIZABLE` + retry

**❌ Wrong — race condition on balance check + update under default isolation**
```sql
BEGIN;
SELECT balance FROM accounts WHERE id = 1;     -- reads 100
-- (another tx debits 60 in parallel; commits)
UPDATE accounts SET balance = balance - 80 WHERE id = 1;   -- now -40
COMMIT;
```

**✅ Right — explicit `SERIALIZABLE` with `SQLSTATE 40001` retry**
```sql
BEGIN ISOLATION LEVEL SERIALIZABLE;
SELECT balance FROM accounts WHERE id = 1;
-- if balance < 80 raise application error
UPDATE accounts SET balance = balance - 80 WHERE id = 1;
COMMIT;
-- On SQLSTATE 40001 (serialization_failure): retry up to 3× with backoff
```

**✅ Alternative — `SELECT ... FOR UPDATE` under `READ COMMITTED`**
```sql
BEGIN;
SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;   -- exclusive row lock
UPDATE accounts SET balance = balance - 80 WHERE id = 1;
COMMIT;
```

**Why it matters**: Under default `READ COMMITTED`, the SELECT and UPDATE see independent snapshots — two concurrent transactions can both pass the balance check and overdraw the account. `SERIALIZABLE` makes Postgres detect the conflict and raise `40001` (you retry). `FOR UPDATE` serializes via row lock (single account ↔ single writer).

---

## 3. `CREATE INDEX` vs `CREATE INDEX CONCURRENTLY` on live tables

**❌ Wrong — `ACCESS EXCLUSIVE` lock blocks reads AND writes for the duration**
```sql
CREATE INDEX idx_orders_user_id ON orders (user_id);
-- 12 minutes on a 50 GB table = 12 min of complete table outage
```

**✅ Right — `CREATE INDEX CONCURRENTLY` takes only `SHARE UPDATE EXCLUSIVE`**
```sql
CREATE INDEX CONCURRENTLY idx_orders_user_id ON orders (user_id);
-- Takes 2-3× longer; reads + writes proceed normally
-- Run outside any transaction (CONCURRENTLY can't be in a tx block)
```

**Verify it succeeded**
```sql
SELECT indexrelid::regclass, indisvalid
FROM pg_index
WHERE indexrelid = 'idx_orders_user_id'::regclass;
-- If indisvalid = false → DROP it and rerun (it failed silently mid-build)
```

**Why it matters**: On a hot OLTP table, a non-concurrent index build is a multi-minute production outage. Always use `CONCURRENTLY` for live tables. The cost is longer build time and the requirement to verify validity after.

---

## 4. `json` vs `jsonb` columns

**❌ Wrong — `json` stores raw text; every read re-parses**
```sql
CREATE TABLE events (
  id   uuid PRIMARY KEY,
  data json NOT NULL    -- raw text, no indexing, parse on every read
);
SELECT data->>'user_id' FROM events WHERE id = ?;   -- parses entire blob
```

**✅ Right — `jsonb` stores binary parsed form, indexable**
```sql
CREATE TABLE events (
  id   uuid PRIMARY KEY DEFAULT uuidv7(),     -- PG18 built-in
  data jsonb NOT NULL
);

-- Index for jsonb path queries
CREATE INDEX CONCURRENTLY idx_events_data_gin ON events USING gin (data jsonb_path_ops);

-- Or a specific path
CREATE INDEX CONCURRENTLY idx_events_user_id ON events ((data->>'user_id'));

SELECT data->>'user_id' FROM events WHERE data @> '{"action": "login"}';
```

**Why it matters**: `json` keeps the original text bytes (preserves key order, duplicates, whitespace) — useful only if you need byte-exact round-tripping. `jsonb` is faster to read, supports GIN indexes, and is the right choice 99% of the time. Never use `json` "to save space" — `jsonb` is competitive on size and dramatically faster.

---

## 5. `timestamp` vs `timestamptz`

**❌ Wrong — `timestamp without time zone` discards timezone, silently corrupts**
```sql
CREATE TABLE orders (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  created_at  timestamp NOT NULL DEFAULT now()
);
-- INSERT from a session with TimeZone='Europe/Moscow' stores localtime
-- SELECT from a session with TimeZone='UTC' returns the same number with UTC label
-- Result: data shifts by 3 hours, silently
```

**✅ Right — `timestamptz` stores UTC; converts on input/output based on session TZ**
```sql
CREATE TABLE orders (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  scheduled_for timestamptz
);

-- Input '2026-05-15 14:00+03' stored as '2026-05-15 11:00 UTC'
-- Output renders in the session's TimeZone setting
```

**When `timestamp` (no tz) is correct**
- Wall-clock time decoupled from timezone (e.g., a recurring 09:00 daily reminder that should fire at 09:00 wherever the user is)
- Logical timestamps in domain logic (e.g., a fiscal period boundary)

**Why it matters**: Postgres `timestamp` has no timezone associated, so a value like `2026-05-15 14:00:00` is ambiguous — readers must "know" what timezone it was written in. `timestamptz` always stores UTC internally and renders in the reader's TimeZone. 99% of business data should be `timestamptz`. The classic bug is logging "user signed in at 14:00" in Moscow, deploying the API in UTC, and seeing "user signed in at 14:00 UTC" three hours later — same number, different meaning, broken analytics.

---

## See also

- All defaults referenced above: [recommended-defaults.md](recommended-defaults.md)
- Symptom-indexed fixes: [troubleshooting.md](troubleshooting.md)
- PG18-specific features (uuidv7, skip-scan, virtual columns): [pg-18-whats-new.md](pg-18-whats-new.md)
- Locking deep-dive: [transactions-and-isolation.md](transactions-and-isolation.md)
