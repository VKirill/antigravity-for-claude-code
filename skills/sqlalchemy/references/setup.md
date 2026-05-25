# Setup — install, drivers, engine creation

## Install

For sync-only usage:

```bash
uv add sqlalchemy alembic
# plus a driver:
uv add psycopg[binary]       # PostgreSQL (psycopg 3, sync or async)
# or
uv add asyncpg               # PostgreSQL async-only driver, very fast
```

For async usage, install the `[asyncio]` extra — it pulls in `greenlet`, which the async layer requires:

```bash
uv add "sqlalchemy[asyncio]" alembic
uv add asyncpg               # recommended async driver for Postgres
# or
uv add "psycopg[binary,pool]"  # psycopg 3 supports both sync + async
```

Without `greenlet` installed, every `AsyncSession` operation raises `MissingGreenlet`. See [troubleshooting.md](troubleshooting.md).

## Drivers and dialect prefixes

The URL scheme is `dialect+driver://user:pass@host:port/dbname`. Pick one driver per dialect; mixing is a footgun.

| Database | Sync URL | Async URL |
|---|---|---|
| PostgreSQL | `postgresql+psycopg://u:p@h/db` | `postgresql+asyncpg://u:p@h/db` or `postgresql+psycopg://u:p@h/db` |
| SQLite | `sqlite:///./app.db` | `sqlite+aiosqlite:///./app.db` |
| MySQL | `mysql+pymysql://u:p@h/db` | `mysql+aiomysql://u:p@h/db` |

**Postgres async — asyncpg vs psycopg 3:**

- `asyncpg`: fastest async driver, async-only, does NOT support `dialect.do_execute_no_params` and a few edge features. Recommended default for FastAPI + Postgres.
- `psycopg+async`: psycopg 3 with native async. Slightly slower than asyncpg but supports a wider set of PG features and shares one driver between sync (Alembic, ETL) and async (web app) code.

## Sync engine

```python
from sqlalchemy import create_engine

engine = create_engine(
    "postgresql+psycopg://user:pass@localhost/mydb",
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=1800,        # seconds; recycle conns older than this
    echo=False,               # True logs every SQL statement
)
```

`echo=True` is for dev only — production logging belongs in app-level loggers + DB slow-query log.

## Async engine

```python
from sqlalchemy.ext.asyncio import create_async_engine

engine = create_async_engine(
    "postgresql+asyncpg://user:pass@localhost/mydb",
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=1800,
)
```

Same pool kwargs work — `create_async_engine` uses `AsyncAdaptedQueuePool` internally (regular `QueuePool` is not asyncio-compatible).

Numeric defaults live in [recommended-defaults.md](recommended-defaults.md). Don't memorize them here.

## URL construction the safe way

For URLs that contain special characters in passwords, build with `URL.create`:

```python
from sqlalchemy import URL

url = URL.create(
    drivername="postgresql+asyncpg",
    username="me",
    password="p@ssw/ord!",   # raw — no manual urlquote
    host="db.internal",
    port=5432,
    database="myapp",
)
engine = create_async_engine(url)
```

## Dispose on shutdown

For async engines in a FastAPI lifespan:

```python
@asynccontextmanager
async def lifespan(app):
    yield
    await engine.dispose()   # closes pooled connections
```

For sync, `engine.dispose()` at process exit (atexit or test teardown). Letting the GC do it works but emits `ResourceWarning`.

## Echo vs structured logging

- `echo=True` — prints all SQL to stderr, useful in dev REPL.
- `echo="debug"` — also prints result rows; only for tiny queries.
- Production: leave `echo=False`. Configure Python logging on `sqlalchemy.engine` if needed:

```python
import logging
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
```

## Connecting through pgbouncer (transaction mode)

`pgbouncer` in `transaction` pooling mode rotates the underlying server connection per transaction. Disable client-side server-side prepared statements and ensure pool_pre_ping is on:

```python
engine = create_async_engine(
    url,
    pool_pre_ping=True,
    connect_args={"prepared_statement_cache_size": 0},  # asyncpg
    # or for psycopg: connect_args={"prepare_threshold": None}
)
```
