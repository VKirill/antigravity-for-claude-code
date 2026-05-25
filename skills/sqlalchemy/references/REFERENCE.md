# SQLAlchemy — Decision Map

Slim index. Open the specific reference once you know what you need.

## Core vs ORM — which to use?

| Use Core (`select(table)`, `Table` objects, `Connection.execute`) | Use ORM (`select(Model)`, `Session`, `Mapped[T]`) |
|---|---|
| Bulk inserts of millions of rows | Domain-shaped CRUD with identity map |
| Reporting / read-only analytical queries with many joins | Multi-step writes coupled by relationships |
| Schema not stable, mostly ad-hoc SQL | Long-lived domain model, refactor-friendly |
| Need maximum performance + minimal overhead | Need typed attributes + change tracking |

You can mix — write the schema in ORM, drop to Core for hot paths. See [raw-sql-and-core.md](raw-sql-and-core.md).

## Sync vs Async — which to use?

| Sync (`create_engine`, `Session`) | Async (`create_async_engine`, `AsyncSession`) |
|---|---|
| Sync framework (Flask, Django via SQLAlchemy, scripts, ETL) | Async framework (FastAPI, Starlette, aiohttp, ASGI) |
| Long-running CPU-bound jobs that hit the DB occasionally | High-concurrency HTTP APIs |
| Test fixtures with synchronous fixtures | Tasks fan out concurrent DB calls |

**Do not mix paradigms in the same process.** Pick one. The async layer uses greenlets under the hood — install with `sqlalchemy[asyncio]`.

## When to drop to raw SQL

- Recursive CTEs that the ORM expression API makes verbose
- Vendor-specific DDL not covered by the dialect (e.g., Postgres `CREATE EXTENSION`)
- Bulk operations where building ORM instances is wasteful — use `Connection.execute(text(...), [params, ...])`
- Query-plan-critical reports that need hand-tuned SQL

Use `text()` with named bindparams. Never f-string user input — that's SQL injection.

## Reading order by task

| Task | Open in order |
|---|---|
| Brand-new FastAPI + Postgres project | `setup.md` → `declarative-orm.md` → `sessions.md` → `fastapi-integration.md` → `migrations-alembic.md` |
| Adding a new model + migration | `declarative-orm.md` → `migrations-alembic.md` |
| Optimizing slow endpoints | `loading-strategies.md` → `queries.md` → `troubleshooting.md` |
| Bulk import | `raw-sql-and-core.md` → `postgres-features.md` (`on_conflict_do_update`) |
| Test setup | `testing.md` → `sessions.md` |
| Debug `MissingGreenlet` / `DetachedInstanceError` | `troubleshooting.md` → `sessions.md` → `loading-strategies.md` |
| Migrating legacy 1.x code | `wrong-vs-right.md` → `queries.md` → `sessions.md` |

## Loading strategy quick-reference

| Relationship cardinality | Default `lazy` | Hot-path option |
|---|---|---|
| Many-to-one | `select` (single query, usually fine) | `joinedload(Child.parent)` |
| One-to-many collection | `select` (N+1 risk in loops) | `selectinload(Parent.children)` |
| Many-to-many | `select` | `selectinload(Parent.tags)` |
| Should never lazy-load (catch bugs) | — | `lazy="raise"` on the relationship, or `raiseload("*")` per query |

Full decision tree: [loading-strategies.md](loading-strategies.md).

## Naming conventions

Set `MetaData(naming_convention=...)` BEFORE running the first migration. Adding it later forces rewriting existing constraint names. See [recommended-defaults.md](recommended-defaults.md).
