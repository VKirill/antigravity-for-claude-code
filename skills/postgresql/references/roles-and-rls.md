# PostgreSQL — Roles & Row-Level Security

## Roles

Postgres treats users and groups as the same thing: **roles**. A role can `LOGIN` (user) or not (group).

```sql
CREATE ROLE app LOGIN PASSWORD 'xxx' NOINHERIT;
CREATE ROLE readonly NOLOGIN;
GRANT readonly TO app;        -- app inherits readonly's privileges

CREATE ROLE migrator LOGIN PASSWORD 'yyy' SUPERUSER;  -- DDL only
```

`NOINHERIT` means privileges via `GRANT role TO role` require explicit `SET ROLE` — safer in multi-app DBs.

## Privileges

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app;

-- Default for future tables (run AS the user that creates tables):
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app;
```

`ALTER DEFAULT PRIVILEGES` is scoped to the role that runs it. Run it as the migration user (the one that does `CREATE TABLE`).

## Read-only role

```sql
CREATE ROLE readonly NOLOGIN;
GRANT CONNECT ON DATABASE mydb TO readonly;
GRANT USAGE ON SCHEMA public TO readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO readonly;

CREATE ROLE reporter LOGIN PASSWORD '...';
GRANT readonly TO reporter;
```

## Limits per role

```sql
ALTER ROLE app SET statement_timeout = '5s';
ALTER ROLE app SET idle_in_transaction_session_timeout = '60s';
ALTER ROLE app SET search_path = 'public, billing';
ALTER ROLE app CONNECTION LIMIT 50;
```

## Row-Level Security (RLS)

Enable per table, then create policies. Once enabled, **no rows** are visible unless a policy permits them.

```sql
CREATE TABLE messages (
  id        uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id    uuid NOT NULL,
  body      text NOT NULL,
  author_id uuid NOT NULL
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE  ROW LEVEL SECURITY;   -- enforce even for table owner

CREATE POLICY tenant_isolation_select ON messages
  FOR SELECT
  USING (org_id = current_setting('app.org_id')::uuid);

CREATE POLICY tenant_isolation_modify ON messages
  FOR ALL
  USING (org_id = current_setting('app.org_id')::uuid)
  WITH CHECK (org_id = current_setting('app.org_id')::uuid);
```

App sets the tenant at connection / transaction start:

```sql
-- App-side, after authentication:
SET LOCAL app.org_id = '...';     -- LOCAL = scoped to current transaction
```

Or set it permanently per session via `SET app.org_id = '...'`.

### `USING` vs `WITH CHECK`

- `USING (...)` — filters rows the policy makes visible (SELECT, UPDATE, DELETE)
- `WITH CHECK (...)` — validates rows about to be written (INSERT, UPDATE)

Without `WITH CHECK`, a user could INSERT a row they couldn't then read.

### Multiple policies

Multiple `FOR SELECT` policies are OR'd. To enforce conjunction, use a single policy with `AND`.

```sql
-- Org isolation
CREATE POLICY p_org ON messages FOR SELECT USING (org_id = current_setting('app.org_id')::uuid);

-- Author can see own deleted; others can't
CREATE POLICY p_author_or_active ON messages FOR SELECT
  USING (deleted_at IS NULL OR author_id = current_setting('app.user_id')::uuid);
```

A user sees a row iff `p_org` passes AND (`p_author_or_active` OR any other SELECT policy) passes — actually, by default they're OR'd. To AND, use a single policy.

### Bypass for migrators

```sql
GRANT BYPASS RLS TO migrator;  -- PG14+ syntax via ALTER ROLE migrator BYPASSRLS
```

Or `SUPERUSER` (also bypasses RLS). Be careful with `FORCE ROW LEVEL SECURITY` — it forces RLS even on table owners; in that case `BYPASSRLS` is necessary.

## Per-tenant connection pattern

Two common patterns:

### A) One DB role per tenant (rare; high overhead)

`CREATE ROLE tenant_<id>` + `GRANT ... TO tenant_<id>` — limits to ~100s of tenants.

### B) Shared role + `SET LOCAL`

App connects as `app`, sets `app.tenant_id` per transaction.

```ts
await db.query('BEGIN');
await db.query('SET LOCAL app.org_id = $1', [orgId]);
await db.query('SELECT * FROM messages');   // RLS applies
await db.query('COMMIT');
```

Pair with PgBouncer in **session** pooling mode (or skip `LOCAL` and `SET` per session). In **transaction** pooling mode, only `SET LOCAL` works.

## RLS with JWT-bound tenancy

```sql
-- Function to read JWT-bound claim
CREATE FUNCTION jwt_org_id() RETURNS uuid AS $$
  SELECT current_setting('request.jwt.claims.org_id', true)::uuid
$$ LANGUAGE sql STABLE;

CREATE POLICY tenant ON messages USING (org_id = jwt_org_id());
```

App passes the JWT-decoded org_id via `SET LOCAL request.jwt.claims.org_id = '...'`.

## Common gotchas

- ❌ Forgetting `WITH CHECK` on UPDATE policies → users move rows out of their tenant
- ❌ `SET app.org_id` without `LOCAL` in pooled connections → leaks across requests
- ❌ Granting `BYPASSRLS` to the app role → defeats the whole point
- ❌ Not testing RLS — write SQL tests that connect as different tenants and assert visibility
- ❌ Treating `current_setting('foo', true)` as fast — it's a per-call function; cache via SET in the same txn

## Audit & verification

```sql
-- See policies on a table
SELECT polname, polcmd, polpermissive, polroles::regrole[], polqual, polwithcheck
FROM pg_policy WHERE polrelid = 'public.messages'::regclass;

-- Test as different role
SET ROLE tenant_a;
SET app.org_id = '...';
SELECT * FROM messages;        -- should only show org_a's rows
RESET ROLE;
```
