# PostgreSQL — Migration Tooling (ORM-agnostic)

When you're NOT using Prisma / Drizzle / TypeORM and need a structured migration workflow.

## Tool matrix

| Tool | Language | Style | Best for |
|---|---|---|---|
| **dbmate** | Go (lang-agnostic) | Up/down SQL | Simple projects, multi-language teams |
| **sqitch** | Perl | DAG (deploy/revert/verify) | Big projects, complex dependencies |
| **Atlas** | Go | Declarative diff + versioned | Schema-as-code preference |
| **Alembic** | Python | Up/down Python | Python projects (SQLAlchemy) |
| **Flyway** | Java | Versioned SQL | Enterprise / JVM stacks |
| **Liquibase** | Java | Changelog (XML/YAML/SQL) | DB-agnostic teams |
| **golang-migrate** | Go | Up/down SQL | Go projects |
| **Refinery** | Rust | Up SQL | Rust projects |

## dbmate (recommended default)

Single binary; up/down SQL files; works in any language.

```bash
brew install dbmate
# or curl -fsSL -o /usr/local/bin/dbmate https://github.com/amacneil/dbmate/releases/...
```

```bash
export DATABASE_URL="postgres://user:pass@localhost:5432/mydb?sslmode=disable"

dbmate new add_users_table        # creates db/migrations/<ts>_add_users_table.sql
dbmate up                          # apply pending
dbmate down                        # roll back last
dbmate status                      # what's applied vs pending
dbmate rollback                    # alias for down
dbmate dump                        # write current schema to db/schema.sql
```

Migration file (template):

```sql
-- migrate:up
CREATE TABLE users (
  id    uuid PRIMARY KEY DEFAULT uuidv7(),
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- migrate:down
DROP TABLE users;
```

Tracks state in `schema_migrations` table.

## sqitch — DAG-style

```bash
brew install sqitch --with-postgres-support
sqitch init flipr --uri https://github.com/me/flipr/ --engine pg
sqitch add users -n 'Initial users table'
# edit deploy/users.sql, revert/users.sql, verify/users.sql
sqitch deploy db:pg://user@localhost/mydb
sqitch revert --to @HEAD^
sqitch verify
```

Each change has `deploy`, `revert`, `verify` SQL. Supports dependency declarations between changes (DAG, not linear).

Best when you need plan re-targeting and change verification.

## Atlas — declarative diff

```bash
brew install ariga/tap/atlas
```

`atlas.hcl`:

```hcl
env "local" {
  src = "file://schema.sql"
  url = env("DATABASE_URL")
  dev = "docker://postgres/18/dev"
}
```

`schema.sql` is the desired schema. Atlas diffs it against the live DB and generates the migration:

```bash
atlas migrate diff --env local "add_users"
atlas migrate apply --env local
```

Best when you want schema-as-code without an ORM. Includes a Cloud product (Atlas Cloud) for migration linting / approval workflows.

## Picking by scenario

| Scenario | Pick |
|---|---|
| New project, plain SQL preferred | **dbmate** |
| Multi-team, complex schema with rollback drills | **sqitch** |
| Schema-as-code (you edit one SQL file) | **Atlas** |
| Python / SQLAlchemy app | **Alembic** |
| Java / Spring Boot app | **Flyway** |
| Multi-DB-vendor team | **Liquibase** |
| Go app | **golang-migrate** |
| Already on Prisma / Drizzle | their migration tool |

## Best practices regardless of tool

1. **One change per migration**. Easier review, easier rollback.
2. **Write the rollback first**. If you can't, that's a sign the migration is destructive.
3. **Test on a production-shaped DB**. Empty dev DBs hide lock contention.
4. **Use `CREATE INDEX CONCURRENTLY`** — every migration tool supports raw SQL.
5. **Expand-contract for column renames**: add new → backfill → switch app → drop old. Three migrations, zero downtime.
6. **Run `migrate deploy` (or equiv) BEFORE the new app code goes live**. New code shouldn't be the first to run schema changes.
7. **Lock the migrations directory in CI**. Forbid edits to applied migrations.
8. **Snapshot `schema.sql` after every apply**. Use it for code review.

## Versioning convention

`<timestamp>_<snake_case_name>.sql` — sorts lexicographically:

```
20260515_103000_initial.sql
20260515_110000_add_user_role.sql
20260516_090000_index_orders_user_created.sql
```

Avoid sequential integers (`001_...`) — they collide on parallel feature branches.

## Branch-parallel migrations

If two PRs each add a migration, the timestamps prevent file collisions. But applying both in sequence can break if they touch the same table. Use a CI check that re-runs `migrate up` from scratch on every PR.

## State table

Every tool stores its applied state in a small table (`schema_migrations` for dbmate, `sqitch_changes` for sqitch, `atlas_schema_revisions` for Atlas). NEVER edit it by hand without a recovery plan.

## Anti-patterns

- ❌ Editing an applied migration file
- ❌ Using a non-trivial framework when `dbmate + raw SQL` would do
- ❌ Including data-DML migrations with schema-DDL in one file (DDL inside Postgres is mostly transactional; DML can be slow → split)
- ❌ Running migrations from inside the app boot path — race condition with multi-replica deploys; run as a separate step
- ❌ Skipping the `CONCURRENTLY` keyword for `CREATE INDEX` in production
