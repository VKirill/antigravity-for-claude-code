# Prisma — Migrations

## Commands

| Command | What |
|---|---|
| `prisma migrate dev --name <name>` | Dev: create migration, apply to dev DB, regenerate client. Uses **shadow DB** to validate. |
| `prisma migrate deploy` | Prod: apply pending migrations from `prisma/migrations/`. Idempotent. |
| `prisma migrate status` | Check what's applied vs pending |
| `prisma migrate diff` | Compute SQL diff between two sources (file vs URL vs another file) |
| `prisma migrate reset` | DROP database, re-run all migrations, run seed. DESTRUCTIVE — dev only. |
| `prisma migrate resolve --applied <name>` | Mark a migration as applied (drift recovery) |
| `prisma migrate resolve --rolled-back <name>` | Mark a migration as rolled back |
| `prisma db push` | Sync schema to DB **without** a migration file. Prototype only. |
| `prisma db pull` | Generate schema FROM existing DB (introspection) |
| `prisma db seed` | Run the seed script |
| `prisma db execute --file ./script.sql` | Run a raw SQL file against the DB |
| `prisma generate` | Regenerate the typed client (auto-runs after `migrate dev`) |

## Shadow DB

`migrate dev` creates a temporary "shadow" DB to detect drift (i.e., the prod DB doesn't match migration history). Configure:

```ts
// prisma.config.ts
export default defineConfig({
  datasource: { url: env('DATABASE_URL') },
  migrations: { shadowDatabaseUrl: env('SHADOW_DATABASE_URL') },
});
```

When working against managed Postgres (Neon, RDS) where you can't `CREATE DATABASE`, point `shadowDatabaseUrl` to a second Postgres database you control. On a local Docker Postgres, the default behavior creates and drops it automatically.

## CI vs production flow

```bash
# CI (build step)
prisma generate                  # type-safe client baked into bundle

# Deploy step (in a one-off task before traffic switch)
prisma migrate deploy            # apply pending migrations
```

NEVER run `prisma migrate dev` in production — it creates new migration files.

## Custom SQL migrations

Sometimes you need DDL Prisma can't generate (CHECK constraints, partial indexes, triggers):

```bash
prisma migrate dev --create-only --name add_check_price_positive
# edits prisma/migrations/<ts>_add_check_price_positive/migration.sql before applying
prisma migrate dev
```

Add SQL manually:

```sql
ALTER TABLE "Product" ADD CONSTRAINT price_positive CHECK (price > 0);
CREATE UNIQUE INDEX user_email_active_unique
  ON "User" (email)
  WHERE "deletedAt" IS NULL;
```

Prisma stores the contents; `migrate deploy` runs them verbatim.

## Drift detection

`migrate dev` detects drift on startup:

```text
Drift detected: Your database schema is not in sync with your migration history.
```

Common causes:
- Someone hand-edited the DB directly (`ALTER TABLE` outside Prisma)
- A migration was rolled back manually
- The DB was restored from a backup with a stale `_prisma_migrations` table

Fix paths:
1. Re-create the DB and re-run all migrations: `prisma migrate reset`
2. Mark the divergent migration as applied: `prisma migrate resolve --applied <name>`
3. Generate a corrective migration: `prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-url $DATABASE_URL --script > fix.sql`

## Renaming columns / tables

Prisma sees a rename as `DROP + CREATE` by default — data loss. To rename safely:

```bash
prisma migrate dev --create-only --name rename_user_email
# edit the generated SQL to use ALTER TABLE ... RENAME COLUMN
prisma migrate dev
```

## Splitting large migrations

Split into multiple `--create-only` migrations and apply them in order:

```bash
prisma migrate dev --create-only --name 001_add_table
prisma migrate dev --create-only --name 002_backfill_data
prisma migrate dev --create-only --name 003_drop_old_column
prisma migrate deploy
```

The intermediate step gives you a chance to backfill data before dropping the old column.

## Zero-downtime migration pattern (expand-contract)

Stage 1 (expand): add new column / table; deploy app that **writes to both**.
Stage 2: backfill data.
Stage 3: deploy app that **reads from new only**.
Stage 4 (contract): drop the old column.

Each stage is a separate migration; each is safe to roll back independently.

## Migration file format

```
prisma/
  schema.prisma
  migrations/
    20260515103000_initial/
      migration.sql
    20260515110000_add_user_role/
      migration.sql
    migration_lock.toml        # provider lock
```

`migration_lock.toml` prevents accidental cross-provider migrations (e.g., generating a Postgres migration against a SQLite DB).

## Seeding via migrations

Seeding is **separate** from migrations. Configure in `prisma.config.ts`:

```ts
export default defineConfig({
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
```

`prisma migrate reset` runs seed by default. `prisma db seed` runs only the seed.

## Anti-patterns

- ❌ `prisma db push` in production — bypasses migration history
- ❌ Editing an applied migration file — drift detector triggers next deploy
- ❌ Skipping shadow DB — drift goes undetected
- ❌ One huge migration with destructive changes — split into expand/backfill/contract
- ❌ Forgetting `prisma generate` after schema changes — IDE shows stale types
