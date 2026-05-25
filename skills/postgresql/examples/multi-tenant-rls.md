# Example — Multi-tenant SaaS with Row-Level Security

End-to-end RLS setup that isolates data per organization via a session variable bound from a JWT claim.

## Schema

```sql
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE organizations (
  id    uuid PRIMARY KEY DEFAULT uuidv7(),
  slug  text NOT NULL UNIQUE,
  name  text NOT NULL
);

CREATE TABLE users (
  id    uuid PRIMARY KEY DEFAULT uuidv7(),
  email citext NOT NULL UNIQUE,
  name  text
);

CREATE TABLE memberships (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role    text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  PRIMARY KEY (user_id, org_id)
);

CREATE INDEX memberships_org_id_idx ON memberships (org_id);

CREATE TABLE notes (
  id        uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id    uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id),
  body      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notes_org_idx ON notes (org_id);
```

## Roles

```sql
CREATE ROLE app LOGIN PASSWORD '...';
GRANT SELECT, INSERT, UPDATE, DELETE ON notes, memberships TO app;
GRANT SELECT ON users, organizations TO app;
GRANT USAGE ON SCHEMA public TO app;
```

## RLS policies

```sql
ALTER TABLE notes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes       FORCE  ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE  ROW LEVEL SECURITY;

-- Notes: only visible/writable for current org
CREATE POLICY notes_tenant_all ON notes
  FOR ALL
  USING       (org_id = current_setting('app.org_id', true)::uuid)
  WITH CHECK  (org_id = current_setting('app.org_id', true)::uuid);

-- Memberships: a user sees their own memberships only
CREATE POLICY memb_self ON memberships
  FOR ALL
  USING (user_id = current_setting('app.user_id', true)::uuid);
```

## Connection pattern (Node.js + pg)

```ts
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function withTenant<T>(
  userId: string,
  orgId: string,
  fn: (client: import('pg').PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    await client.query("SELECT set_config('app.org_id',  $1, true)", [orgId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

`set_config(name, value, true)` is the SQL form of `SET LOCAL` — scoped to the transaction. Works with PgBouncer in transaction mode.

## In a Fastify route

```ts
app.get('/notes', { preHandler: app.authenticate }, async (req) => {
  return withTenant(req.user.sub, req.user.orgId, async (client) => {
    const { rows } = await client.query(
      'SELECT id, body, created_at FROM notes ORDER BY created_at DESC LIMIT 50',
    );
    return rows;
  });
});

app.post('/notes', { preHandler: app.authenticate, schema: { body: noteSchema } }, async (req) => {
  return withTenant(req.user.sub, req.user.orgId, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO notes (org_id, author_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, body, created_at`,
      [req.user.orgId, req.user.sub, req.body.body],
    );
    return rows[0];
  });
});
```

The `org_id = $1` here is redundant — RLS would block the insert if the org_id didn't match `app.org_id`. But sending it explicitly avoids accidental NULLs.

## Verifying isolation

```sql
-- Seed two orgs
INSERT INTO organizations (id, slug, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'org-a', 'Org A'),
  ('00000000-0000-0000-0000-000000000002', 'org-b', 'Org B');

-- Login as Org A
SET app.org_id = '00000000-0000-0000-0000-000000000001';
SET app.user_id = '...';
INSERT INTO notes (org_id, author_id, body) VALUES (current_setting('app.org_id')::uuid, current_setting('app.user_id')::uuid, 'org A note');

-- Login as Org B — should NOT see Org A's note
SET app.org_id = '00000000-0000-0000-0000-000000000002';
SELECT * FROM notes;   -- 0 rows

-- Attempt to insert into Org A while authenticated as Org B — REJECTED
INSERT INTO notes (org_id, body) VALUES ('00000000-0000-0000-0000-000000000001', 'sneaky');
-- ERROR: new row violates row-level security policy for table "notes"
```

## Edge cases

- **Admin bypass**: grant `BYPASSRLS` to an `admin_app` role used by support tooling. Never to the main app.
- **Backup user**: `pg_dump` won't see RLS-filtered rows unless run as superuser or a `BYPASSRLS` role.
- **Aggregates / counts**: `SELECT count(*) FROM notes` already respects RLS — no special handling needed.
- **Cross-tenant reads**: explicit `BYPASSRLS` role + audited code path. Never special-case in the app role.

## Anti-patterns

- ❌ Using `SET app.org_id = ...` without `LOCAL` (or `set_config(..., true)`) in pooled connections — value leaks across requests
- ❌ Forgetting `WITH CHECK` on FOR ALL policy — users can UPDATE rows out of their tenant
- ❌ Granting `BYPASSRLS` to the app role
- ❌ Not testing — write SQL tests that switch `app.org_id` and assert visibility
- ❌ Adding `org_id = $1` only at the SQL layer "instead of RLS" — one missed query is a leak; RLS is a backstop
