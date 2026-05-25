---
name: sqlalchemy
description: "SQLAlchemy 2.0 — modern Python ORM + Core toolkit with first-class async support, type-annotated declarative mapping, and Alembic migrations. Use when: sqlalchemy, sqla, sqlalchemy 2.0, Mapped, mapped_column, DeclarativeBase, select(), AsyncSession, async sqlalchemy, asyncpg, psycopg, alembic, autogenerate, env.py, relationship, back_populates, selectinload, joinedload, lazyload, raiseload, postgres orm, python orm, sqlalchemy core, text(), N+1 lazy load, DetachedInstanceError, expire_on_commit, MissingGreenlet, sessionmaker, async_sessionmaker, async_scoped_session, AsyncAttrs, on_conflict_do_update, JSONB column, fastapi sqlalchemy session dependency. SKIP: Django ORM (→django cascade), Tortoise ORM/Pony/Peewee (niche), raw SQL with no ORM (→postgresql), Prisma/Drizzle TS ORMs (→prisma)."
stacks:
  - sqlalchemy
  - python
  - postgresql
  - orm
tags:
  - orm
  - sqlalchemy
  - python
  - database
  - async
  - alembic
  - migrations
packages:
  - sqlalchemy
  - alembic
  - asyncpg
  - psycopg
  - aiosqlite
  - greenlet
manifests:
  - pyproject.toml
  - alembic.ini
  - alembic/env.py
source: vechkasov-global-skills
risk: high-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- SQLAlchemy: `2.0.x`
- Python: `3.14.x`
- PostgreSQL: `18.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded automatically when its description matches the active task. Read only the reference file you need — SKILL.md is the navigator.

## Use this skill when

- Designing or evolving 2.0-style declarative mappings — `class Foo(Base)`, `id: Mapped[int] = mapped_column(primary_key=True)`, `relationship(back_populates=...)`
- Writing 2.0-style queries with `select()` + `session.execute(...).scalars()` (never the legacy `Query` class)
- Wiring a sync engine (`create_engine`) or async engine (`create_async_engine`) with `asyncpg`/`psycopg`/`aiosqlite`
- Configuring `sessionmaker` / `async_sessionmaker` and choosing the right `expire_on_commit` setting
- Choosing a relationship loading strategy — `selectinload`, `joinedload`, `subqueryload`, `lazyload`, `raiseload` — and diagnosing N+1 query bursts
- Diagnosing `DetachedInstanceError`, `MissingGreenlet`, pool exhaustion (`QueuePool limit ... overflow ... reached`), or "object already attached to session"
- Setting up Alembic — `alembic init -t async`, `target_metadata`, `MetaData(naming_convention=...)`, autogenerate, data migrations, multi-DB
- Adding Postgres-only features — `JSONB`, `ARRAY`, `UUID`, `Insert.on_conflict_do_update`, `Computed`, `ENUM`
- Wiring FastAPI's `AsyncSession` dependency with proper `try/finally` and transaction boundaries
- Writing tests with SAVEPOINT-per-test fixtures or `NullPool` for parallel test isolation
- Migrating legacy 1.x code (`Query`, `query.filter_by`, `autocommit`) to 2.0-style

## Do not use this skill when

- Task is Django ORM (`models.Model`, `objects.filter`) — use `django` (cascade)
- Task is a different Python ORM — Tortoise, Pony, Peewee, SQLModel-specific patterns (use SQLModel docs; this skill covers the SQLAlchemy layer underneath)
- Task is purely raw SQL operations or Postgres DBA work (vacuum, replication, RLS authoring) — use `postgresql`
- Task is a TypeScript ORM — Prisma → `prisma`, Drizzle → cascade
- Task is Pydantic schema authoring without persistence — use `pydantic`
- Task is FastAPI HTTP layer without DB specifics — use `fastapi`

## Purpose

SQLAlchemy 2.0 is the de facto Python SQL toolkit and ORM in 2026. It is two layered libraries: **Core** (`Engine`, `Connection`, `Table`, `select()` SQL-expression DSL) and **ORM** (declarative mapping with `DeclarativeBase`/`Mapped[T]`/`mapped_column`, unit-of-work `Session`/`AsyncSession`, relationships, loader strategies). The 2.0 release unified Core and ORM under the same `select()` construct, deprecated the legacy `Query` class for new code, added first-class `asyncio` support via greenlets, and embraced PEP 484 typing through `Mapped[T]` annotations.

This skill covers the production stack: engine + URL + driver choice, declarative ORM with type annotations, sync and async session lifecycles, query construction with `select()`, the five relationship loading strategies (and when each one is the right call), Alembic migrations (sync + async, autogenerate, naming conventions, data migrations), raw SQL via `text()`, Postgres-specific column types and upserts, FastAPI integration patterns, testing strategies with SAVEPOINTs, and a symptom-indexed troubleshooting guide for the failure modes that bite production. Out of scope: Django ORM (`django`), Pydantic schema authoring (`pydantic`), Postgres DBA work (`postgresql`), test runner mechanics (`pytest`).

## Capabilities

Each capability points to its canonical reference. References own the code, gotchas, and edge cases — SKILL.md does not duplicate them.

- **Setup & engine** — install with `sqlalchemy[asyncio]`, driver choice (`asyncpg` vs `psycopg`), URL construction, `pool_size`/`max_overflow`/`pool_pre_ping`/`pool_recycle`, `create_engine` vs `create_async_engine`. → [setup.md](references/setup.md)
- **Declarative ORM** — `DeclarativeBase`, `Mapped[T]`, `mapped_column`, `__tablename__`, `__table_args__`, `Optional` mapping, `server_default`, `registry`. → [declarative-orm.md](references/declarative-orm.md)
- **Sessions** — `Session` vs `AsyncSession`, `sessionmaker`/`async_sessionmaker`, `async_scoped_session` deprecation note, `expire_on_commit`, identity map, `begin()`/`commit()`/`rollback()`, session-per-request pattern. → [sessions.md](references/sessions.md)
- **Queries** — `select()`, `.where()`, `.filter_by()`, `.options()`, `.scalars()`, `.execute()`, `.unique()`, `.one()`/`.one_or_none()`/`.first()`, `func.count`, `exists()`. → [queries.md](references/queries.md)
- **Relationships** — `relationship()`, `back_populates`, one-to-many, many-to-many `secondary`, `viewonly`, default `lazy` values, async-specific constraints. → [relationships.md](references/relationships.md)
- **Loading strategies** — `selectinload` vs `joinedload` vs `subqueryload` vs `lazyload` vs `raiseload`, N+1 detection, Cartesian-product `.unique()` rule, chained loader options. → [loading-strategies.md](references/loading-strategies.md)
- **Alembic migrations** — `alembic init` templates (`generic`/`async`/`multidb`), `env.py`, `target_metadata`, `MetaData(naming_convention=...)`, autogenerate gotchas, data migrations, downgrade safety. → [migrations-alembic.md](references/migrations-alembic.md)
- **Raw SQL & Core** — `text()` with `bindparams`, `executemany`, `Table` object, when to drop from ORM to Core, hybrid `select(Core.table).join(...)`. → [raw-sql-and-core.md](references/raw-sql-and-core.md)
- **FastAPI integration** — `AsyncSession` dependency, `get_db` with `try/finally`, transaction-per-request, background-task pitfalls. → [fastapi-integration.md](references/fastapi-integration.md)
- **Postgres features** — `JSONB`, `ARRAY`, `UUID`, `Insert.on_conflict_do_update`, `Computed` generated columns, `ENUM`, `INET`, `NOTIFY/LISTEN`. → [postgres-features.md](references/postgres-features.md)
- **Testing** — SAVEPOINT-per-test fixture, `join_transaction_mode="create_savepoint"`, `NullPool` for parallel runs, in-memory SQLite limits, `factory-boy` integration. → [testing.md](references/testing.md)
- **Recommended defaults** — `pool_size`, `pool_pre_ping`, `pool_recycle`, `expire_on_commit`, Alembic naming convention dict, isolation level. → [recommended-defaults.md](references/recommended-defaults.md)
- **Troubleshooting** — symptom-indexed: `DetachedInstanceError`, `MissingGreenlet`, pool exhaustion, lazy-load-after-close, "object already attached", migration drift, deadlock, isolation surprises. → [troubleshooting.md](references/troubleshooting.md)
- **Wrong vs Right** — legacy `Query` vs `select()`, N+1 lazy in loop vs `selectinload`, sync session in async path, mutating after session close, `autocommit` mode (gone), bare `engine.execute` (gone). → [wrong-vs-right.md](references/wrong-vs-right.md)
- **Eval cases** — routing positive/negative prompts. → [eval-cases.md](references/eval-cases.md)

## Behavioral Traits

- Always uses 2.0-style — `session.execute(select(Model).where(...))`, never `session.query(Model).filter(...)`
- Annotates every mapped column with `Mapped[T]`/`mapped_column(...)` — `Optional[T]` or `T | None` for nullable, not `nullable=True` alone
- Defers numeric pool/timeout values to [recommended-defaults.md](references/recommended-defaults.md) — no inline magic numbers in advice
- Picks `selectinload` for collections by default; `joinedload` only for many-to-one references where N+1 of small parents is the real cost
- Sets `expire_on_commit=False` on `async_sessionmaker` so attribute access after `await session.commit()` doesn't trigger implicit IO
- Uses `async with async_sessionmaker.begin()` / `async with session.begin()` to scope transactions explicitly
- Never lazy-loads relationships in `async` code paths — either `selectinload` eagerly, or use `AsyncAttrs` `awaitable_attrs` for one-off access
- Always sets an Alembic `MetaData(naming_convention=...)` so autogenerated constraints have stable names — required to ever rename or drop them later
- Pairs every async engine driver with the matching dialect prefix — `postgresql+asyncpg://`, `postgresql+psycopg://` (psycopg 3 async), `sqlite+aiosqlite://`
- Uses `Insert.on_conflict_do_update` from `sqlalchemy.dialects.postgresql` for Postgres upserts — never tries to emulate via SELECT-then-INSERT
- Calls `.unique()` on results when a `joinedload` is applied to a collection — required to deduplicate rows
- Disposes async engines on shutdown — `await engine.dispose()` in lifespan teardown

## Important Constraints

- NEVER use the legacy `session.query(Model)` API in new code — write `session.execute(select(Model))` instead
- NEVER share a single `AsyncSession` across concurrent tasks — sessions are stateful per-transaction; one task = one session
- NEVER access lazy-loaded relationship attributes in `async def` code unless they were eagerly loaded or wrapped via `AsyncAttrs.awaitable_attrs` — raises `MissingGreenlet`
- NEVER set `expire_on_commit=True` (the default) when objects are used after commit in async code — every attribute access triggers implicit IO, which is invalid in pure async
- NEVER call `session.commit()` and then read attributes outside the session context without `expire_on_commit=False` — raises `DetachedInstanceError`
- NEVER use `autocommit=True` mode — removed in 2.0; explicit transactions only via `session.begin()` / `engine.begin()`
- NEVER pass `connection=` to `Session()` from a request thread without isolating its lifetime — the pool will leak
- NEVER mix sync `Session` with `AsyncEngine` (or vice versa) — pick one paradigm per process and stay there
- NEVER run `alembic upgrade head` against production without a `migrate deploy`-style CI gate — drift breaks production
- NEVER autogenerate a migration without inspecting the diff — autogenerate does not detect column renames, anonymous constraints, or some server defaults
- ALWAYS pin `MetaData(naming_convention=...)` before the first migration — adding it later requires manual rewrites of existing constraint names
- ALWAYS set `pool_pre_ping=True` for long-lived processes behind a connection-killing proxy (pgbouncer in transaction mode, AWS RDS Proxy, load-balancer idle timeout)
- ALWAYS install with the `[asyncio]` extra (`sqlalchemy[asyncio]`) when using `AsyncSession` — pulls in the `greenlet` dependency
- ALWAYS use `await session.close()` (or rely on `async with`) — leaked sessions exhaust the pool

## Wrong vs Right (high-stakes — full pairs)

Six paste-runnable contrasts live in [references/wrong-vs-right.md](references/wrong-vs-right.md):

1. Legacy `session.query(Model)` vs 2.0-style `session.execute(select(Model))`
2. N+1 lazy load in a for-loop vs `selectinload(Parent.children)`
3. Lazy attribute access in async path vs eager loading or `AsyncAttrs.awaitable_attrs`
4. `expire_on_commit=True` causing `DetachedInstanceError` vs `expire_on_commit=False` on async sessionmaker
5. `engine.execute("...")` (removed) vs `with engine.connect() as conn: conn.execute(text("..."))`
6. SELECT-then-INSERT race vs `Insert.on_conflict_do_update`

## Related Skills

**90%-filter applied** — mainstream 2026 pairings with SQLAlchemy in production.

### Language & runtime
- ✓ `python` — Python 3.14 LTS-aligned baseline (parent skill)
- ✓ `pydantic` — Pydantic v2; used to shape API payloads that feed ORM models

### Web frameworks (primary consumers)
- ✓ `fastapi` — primary consumer; `AsyncSession` dependency pattern
- ✓ `flask` — sync `Session`/`scoped_session` pattern (cascade)

### Databases
- ✓ `postgresql` — Postgres 18 (the most common target)
- ✓ `mysql` — MySQL 8.4 (also first-class) [cascade marker]
- ✓ `redis` — Redis 8 for query/result cache around SQLAlchemy

### ORM peers
- ✓ `prisma` — TypeScript peer ORM; useful when comparing patterns across stacks

### Testing
- ✓ `pytest` — pytest 9 (fixtures, async tests, SAVEPOINT rollback pattern)

### Deploy & ops
- ✓ `linux-sysadmin` — Ubuntu 24.04 / systemd / Angie reverse proxy

### Code discipline
- ✓ `karpathy-guidelines` — simplicity, surgical changes
- ✓ `skill-evaluation` — meta

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Index — decision map (Core vs ORM, sync vs async, when to drop to raw SQL) | [references/REFERENCE.md](references/REFERENCE.md) |
| Setup — install, drivers (asyncpg/psycopg/aiosqlite), engine creation, URL, pool tuning | [references/setup.md](references/setup.md) |
| Declarative ORM — `DeclarativeBase`, `Mapped[T]`, `mapped_column`, `__table_args__`, `server_default` | [references/declarative-orm.md](references/declarative-orm.md) |
| Sessions — `Session` vs `AsyncSession`, sessionmaker patterns, `expire_on_commit`, lifecycle | [references/sessions.md](references/sessions.md) |
| Queries — `select()`, `.where()`, `.filter_by()`, `.scalars()`, `.one()`/`.first()`, `func.count`, `exists()` | [references/queries.md](references/queries.md) |
| Relationships — `relationship()`, `back_populates`, many-to-many `secondary`, `viewonly`, async caveats | [references/relationships.md](references/relationships.md) |
| Loading strategies — `selectinload` vs `joinedload` vs `subqueryload` vs `lazyload` vs `raiseload`, N+1 | [references/loading-strategies.md](references/loading-strategies.md) |
| Alembic migrations — `init` templates, `env.py`, autogenerate, naming convention, data migrations | [references/migrations-alembic.md](references/migrations-alembic.md) |
| Raw SQL & Core — `text()`, `bindparams`, `executemany`, `Table` object, hybrid patterns | [references/raw-sql-and-core.md](references/raw-sql-and-core.md) |
| FastAPI integration — `AsyncSession` dependency, `try/finally`, transaction boundary, background tasks | [references/fastapi-integration.md](references/fastapi-integration.md) |
| Postgres features — `JSONB`, `ARRAY`, `UUID`, `on_conflict_do_update`, `Computed`, `ENUM`, `NOTIFY` | [references/postgres-features.md](references/postgres-features.md) |
| Testing — SAVEPOINT-per-test, `join_transaction_mode`, `NullPool`, in-memory SQLite, factory-boy | [references/testing.md](references/testing.md) |
| **Recommended defaults** — pool, `expire_on_commit`, isolation, naming convention | [references/recommended-defaults.md](references/recommended-defaults.md) |
| **Troubleshooting** — `DetachedInstanceError`, `MissingGreenlet`, pool exhaustion, drift, deadlock | [references/troubleshooting.md](references/troubleshooting.md) |
| **Wrong vs Right** — 6 paste-runnable production-grade contrasts | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases | [references/eval-cases.md](references/eval-cases.md) |

**How to use**: new project → `setup.md` + `declarative-orm.md` + `sessions.md`. Adding queries → `queries.md` + `loading-strategies.md`. Setting up migrations → `migrations-alembic.md` + `recommended-defaults.md`. FastAPI integration → `fastapi-integration.md`. Production hardening → `recommended-defaults.md` + `troubleshooting.md`. Postgres-specific work → `postgres-features.md`.
