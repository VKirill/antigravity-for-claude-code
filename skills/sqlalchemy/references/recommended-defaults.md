# Recommended defaults

Single source of truth for numeric / boolean knobs. Other references link here instead of inlining values.

## Engine + pool

| Knob | Recommended | Why |
|---|---|---|
| `pool_size` | 5 per process | Match expected concurrent active queries per worker, not total RPS |
| `max_overflow` | 10 | Burst headroom above `pool_size` |
| `pool_pre_ping` | `True` | Catches stale connections killed by intermediaries (pgbouncer, load balancer, RDS Proxy) |
| `pool_recycle` | 1800 (seconds) | Recycle connections older than 30 min — preempts server-side idle timeouts |
| `pool_timeout` | 30 (seconds) | Default; raise to 60 if you see frequent `QueuePool limit ... reached` under spike |
| `echo` | `False` | Production logging belongs in app logger + DB slow-query log; `True` is dev-only |

Pool sizing rule of thumb for a FastAPI app:

```
total_db_connections_in_use_max = num_workers × (pool_size + max_overflow)
```

This must be ≤ your Postgres `max_connections` minus headroom for migrations, psql, monitoring, etc.

For 4 Uvicorn workers with `pool_size=5, max_overflow=10`, the max is `4 × 15 = 60` connections. With `max_connections=100`, you have 40 headroom — comfortable.

## `expire_on_commit`

| Context | Value | Rationale |
|---|---|---|
| Sync `sessionmaker` | `True` (default) | Default is fine; objects are expired after commit and reload lazily on next access |
| Async `async_sessionmaker` | **`False`** | Lazy reload after commit is implicit IO; in async it raises `MissingGreenlet` |
| Sync where objects are returned across function boundaries after commit | `False` | Same problem, different mechanism: post-commit attribute access reload may fail if session is closed |

## Isolation level

| Use case | Level |
|---|---|
| Default web API | `READ COMMITTED` (Postgres default) |
| Long-running report that should see a consistent snapshot | `REPEATABLE READ` (set per-connection) |
| Hot multi-row updates that must serialize | `SERIALIZABLE` + retry-on-`SerializationFailure` |
| Single statement DDL like `CREATE INDEX CONCURRENTLY` | `AUTOCOMMIT` |

Set per-connection: `engine.connect().execution_options(isolation_level="REPEATABLE READ")`.

## Alembic — `MetaData(naming_convention=...)`

Set this BEFORE the first migration. The canonical dict:

```python
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
```

Adding this AFTER you have a populated DB requires manual `ALTER ... RENAME CONSTRAINT` for every existing constraint that Alembic now expects under a new name.

## Alembic — `env.py` configure flags

| Flag | Value | Notes |
|---|---|---|
| `target_metadata` | `Base.metadata` | The single base of comparison for autogenerate |
| `compare_type` | `True` | Default since Alembic 1.12; be explicit anyway |
| `compare_server_default` | `True` | Helpful but imperfect for non-trivial defaults |
| `include_schemas` | `True` if you use schemas | Default `False` |
| `render_as_batch` | `True` for SQLite | Required for ALTER COLUMN on SQLite |
| `poolclass` | `NullPool` | Migrations shouldn't reuse pooled connections |

## Session lifecycle pattern

| Scope | Pattern |
|---|---|
| Web request | One session per request, opened in dependency, closed in `finally` |
| Background task | New session inside the task, NEVER reused from the request |
| Worker job (RQ/Celery/BullMQ-equivalent) | One session per job |
| CLI script | One session per logical operation, `with sessionmaker.begin()` |
| Tests | One session per test, bound to a connection inside a SAVEPOINT'd outer transaction |

## Loading strategy defaults

| Cardinality | Production hot path | Notes |
|---|---|---|
| Many-to-one | `joinedload(Child.parent)` per query | Cheap; no row multiplication |
| One-to-many collection | `selectinload(Parent.children)` per query | No Cartesian; no `.unique()` needed |
| Many-to-many | `selectinload(...)` | Same |
| "Should never be lazy-loaded" | `relationship(..., lazy="raise")` at mapping | Surface accidental N+1 in dev |

## Bulk-insert threshold

| Row count | Pattern |
|---|---|
| < 100 | ORM `session.add_all(...)` |
| 100 – 10,000 | Core `connection.execute(insert(table), [dicts])` |
| > 10,000 | Database-native bulk load (Postgres `COPY` via `psycopg.copy`) |

## Money type

Always `Numeric(precision, scale)` mapped to `Decimal`. Never `Float`. Pick precision by max expected magnitude:

| Domain | Type |
|---|---|
| USD up to $10 million, cents precision | `Numeric(10, 2)` |
| Crypto (8 decimal places) | `Numeric(28, 8)` |
| Ratios / percentages (0.0–1.0, 6dp) | `Numeric(8, 6)` |

## UUID generation

| Source | When |
|---|---|
| Python: `default=uuid.uuid4` | Tests, apps that need ID before INSERT |
| Postgres: `server_default=text("gen_random_uuid()")` | Most cases; PG 13+ has it built-in |
| Postgres: `server_default=text("uuidv7()")` | PG 18+; better index locality (time-ordered) |

## Retry policy on serialization failures

Postgres can raise `SerializationFailure` under `REPEATABLE READ` / `SERIALIZABLE`. Pattern: catch, rollback, retry up to 3 times with small backoff:

```python
import asyncio
from sqlalchemy.exc import DBAPIError

async def with_retry(coro_factory, attempts=3):
    for attempt in range(attempts):
        try:
            return await coro_factory()
        except DBAPIError as e:
            if e.orig is not None and "could not serialize" in str(e.orig):
                if attempt < attempts - 1:
                    await asyncio.sleep(0.05 * (2 ** attempt))
                    continue
            raise
```

Three attempts with exponential backoff (50ms, 100ms, 200ms) is the standard production default.
