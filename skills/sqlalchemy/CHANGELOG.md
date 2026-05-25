# Changelog — sqlalchemy

## v1.0.0 — 2026-05-16

Initial release. Pattern 2 structure for SQLAlchemy 2.0 + Alembic, with FastAPI/PostgreSQL as primary integration targets.

### Added
- `SKILL.md` navigator with the audit-checklist sections, 2.0-style trigger terms, and `## Related Skills` filtered to 2026 mainstream pairings (python, fastapi, postgresql, redis, pytest, prisma)
- `references/REFERENCE.md` — decision map (Core vs ORM, sync vs async, when to drop to raw SQL, reading order by task)
- `references/setup.md` — install + `[asyncio]` extra, driver matrix (asyncpg/psycopg/aiosqlite), engine creation, URL construction, pgbouncer caveats
- `references/declarative-orm.md` — `DeclarativeBase`, `Mapped[T]`, `mapped_column`, `AsyncAttrs`, `server_default`, `__table_args__`, composite indexes, Decimal/Numeric, native ENUM trade-offs
- `references/sessions.md` — `sessionmaker`/`async_sessionmaker`, `expire_on_commit` rationale, `begin()` / nested SAVEPOINT, `async_scoped_session` deprecation note, identity map, flush vs commit, concurrency rules
- `references/queries.md` — `select()`, `.where()`/`.filter_by()`, `.scalars()`/`.scalar()`, `.one()`/`.one_or_none()`/`.first()`, joins/aliases, `func.count`, `exists()`, `.any()`/`.has()`, `.unique()` rule, bulk `update()`/`delete()`
- `references/relationships.md` — `relationship()`, `back_populates`, one-to-many / many-to-many `secondary` / one-to-one (`uselist=False`), `cascade` vs DB `ondelete`, `viewonly`, default `lazy` per cardinality, self-referential, `primaryjoin`
- `references/loading-strategies.md` — `selectinload` vs `joinedload` vs `subqueryload` vs `lazyload` vs `raiseload`, async lazy-load problem, `AsyncAttrs.awaitable_attrs`, `contains_eager`, `defer`/`undefer`, N+1 detection via engine events
- `references/migrations-alembic.md` — `alembic init -t async/generic/multidb`, full sync + async `env.py` templates, `MetaData(naming_convention=...)` dict, autogenerate detection matrix, data migrations with `sa.table`/`sa.column`, `alembic check`, command cheatsheet
- `references/raw-sql-and-core.md` — `text()` with bindparams, `executemany`, Core `Table` objects, hybrid ORM + Core, CTEs, `RETURNING`, isolation level via `execution_options`, server-side cursors / `stream_results`
- `references/fastapi-integration.md` — engine + sessionmaker on `app.state` via `lifespan`, `get_db` dependency (with `try/finally` and commit-on-success variants), transaction-per-request, background-task session pitfalls, health check, `dependency_overrides` for tests
- `references/postgres-features.md` — `JSONB` (operators, GIN index), `ARRAY`, `UUID`/UUIDv7, `Insert.on_conflict_do_update`/`do_nothing`, native vs non-native `ENUM` trade-offs, `Computed`, `INET`/`CIDR`/`MACADDR`, `NOTIFY`/`LISTEN`, RLS `set_config`, `FOR UPDATE SKIP LOCKED`, multi-tenant search_path
- `references/testing.md` — SAVEPOINT-per-test fixture (sync + async) with `join_transaction_mode="create_savepoint"`, schema setup at session scope, `NullPool` for `pytest-xdist`, SQLite-in-memory `StaticPool` caveats, FastAPI `dependency_overrides` wiring, `factory-boy` `SQLAlchemyModelFactory`, query-count assertion to catch N+1
- `references/recommended-defaults.md` — pool sizing math, `pool_size`/`max_overflow`/`pool_pre_ping`/`pool_recycle`/`pool_timeout`, `expire_on_commit` decision matrix, isolation levels per use case, Alembic naming convention dict + `env.py` flags, session lifecycle by scope, loader-strategy defaults by cardinality, bulk-insert thresholds, money/UUID conventions, serialization-failure retry policy
- `references/troubleshooting.md` — symptom-indexed: `MissingGreenlet`, `DetachedInstanceError`, pool exhaustion (`QueuePool limit ...`), "object already attached", `lazy="raise"` triggered, `MultipleResultsFound`/`NoResultFound`, autogenerate produces no changes, migration drift, deadlock, `SerializationFailure`, connection closed unexpectedly, asyncpg concurrent-operation, expire_on_commit changes not taking effect, pgbouncer prepared-statement collision
- `references/wrong-vs-right.md` — six paste-runnable contrasts: legacy `Query` → `select()`; N+1 lazy → `selectinload`; lazy access in async → eager + `expire_on_commit=False`; `engine.execute(...)` → `engine.connect()` + `text()`; SELECT-then-INSERT race → `on_conflict_do_update`; sync session in async path → `AsyncSession`
- `references/eval-cases.md` — positive / negative / boundary routing prompts

### Notes
- Frontmatter: `risk: high-stakes` (data layer correctness)
- Stacks: `sqlalchemy`, `python`, `postgresql`, `orm` (drive version block injection on next `sync_skill_versions.py` run)
- No hardcoded version numbers in any markdown body — versioned info lives in `STACK_VERSIONS.md` and the sync-managed version block
