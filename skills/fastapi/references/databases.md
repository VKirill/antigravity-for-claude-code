# FastAPI — databases

This reference covers FastAPI-specific *integration* patterns for async SQLAlchemy 2.0. For ORM modeling, query API, and migrations themselves, see the `sqlalchemy` skill (when available) and the `postgresql` skill for Postgres-side concerns.

## Async engine + session factory in lifespan

```python
# src/app/db/engine.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

def make_engine(url: str):
    return create_async_engine(
        url,
        pool_size=10,            # see recommended-defaults.md
        max_overflow=10,
        pool_pre_ping=True,      # cheap health check on checkout
        pool_recycle=1800,       # recycle after 30 min — avoids stale connections
        future=True,
    )

def make_sessionmaker(engine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
```

```python
# lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.engine = make_engine(settings.database_url)
    app.state.sessionmaker = make_sessionmaker(app.state.engine)
    try:
        yield
    finally:
        await app.state.engine.dispose()
```

Drivers:

| DB | Driver | URL prefix |
|---|---|---|
| Postgres | `asyncpg` (preferred) | `postgresql+asyncpg://...` |
| Postgres | `psycopg` v3 async | `postgresql+psycopg://...` |
| MySQL/MariaDB | `asyncmy` | `mysql+asyncmy://...` |
| SQLite (dev/tests) | `aiosqlite` | `sqlite+aiosqlite:///...` |

`expire_on_commit=False` is important: it stops SQLAlchemy from refreshing every attribute after `commit()`, which would re-issue a query and break the request flow.

## Per-request `AsyncSession` dependency

```python
async def get_db(request: Request) -> AsyncIterator[AsyncSession]:
    sessionmaker = request.app.state.sessionmaker
    async with sessionmaker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

Strategy: **commit-on-success**. The dependency owns the transaction lifecycle. Endpoints just use the session.

Alternative: **endpoint-managed transactions** (common in larger apps):

```python
async def get_db(request: Request) -> AsyncIterator[AsyncSession]:
    sessionmaker = request.app.state.sessionmaker
    async with sessionmaker() as session:
        yield session
        # no commit here — endpoint controls it

# In the endpoint:
@app.post("/items/")
async def create(item: ItemIn, db: Annotated[AsyncSession, Depends(get_db)]):
    async with db.begin():
        db.add(Item(**item.model_dump()))
    # block exits → commits or rolls back
```

Pick one style and apply it everywhere — mixing creates "did this commit or not?" bugs.

## Query patterns

```python
from sqlalchemy import select

@app.get("/items/{item_id}", response_model=ItemOut)
async def get_item(item_id: int, db: Annotated[AsyncSession, Depends(get_db)]):
    item = await db.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404)
    return item

@app.get("/items/", response_model=list[ItemOut])
async def list_items(db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(Item).order_by(Item.created_at.desc()).limit(50))
    return result.scalars().all()
```

For streaming large result sets, use `db.stream(...)`:

```python
async for row in db.stream(select(User)):
    yield row
```

## Pool sizing

Pool size × number of workers = peak DB connections. Postgres default `max_connections` is small — coordinate.

Formula (starting point):

```
pool_size = ceil(target_concurrent_requests_per_worker / 1)
max_overflow = pool_size       # allow brief spikes
total_db_connections = (pool_size + max_overflow) × workers + headroom
```

Real values → [recommended-defaults.md](recommended-defaults.md).

For high-fan-out workloads, place **PgBouncer** in transaction-pooling mode between FastAPI and Postgres. SQLAlchemy needs `pool_pre_ping=True` and *no* prepared-statement cache when using transaction pooling.

## Alembic migrations

`alembic` is the standard. Async-friendly setup:

```python
# alembic/env.py — async variant
from sqlalchemy.ext.asyncio import async_engine_from_config

async def run_migrations_online():
    connectable = async_engine_from_config(config.get_section(config.config_ini_section))
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()

def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()
```

Run via `alembic upgrade head` in a one-shot job (not in `lifespan` startup — that would race across workers).

## Tests with rollback isolation

Two patterns:

### A) `dependency_overrides` to a transactional session

```python
@pytest.fixture
async def db_session(test_engine):
    connection = await test_engine.connect()
    transaction = await connection.begin()
    session = AsyncSession(bind=connection)
    try:
        yield session
    finally:
        await session.close()
        await transaction.rollback()
        await connection.close()

@pytest.fixture
def app(db_session):
    app = create_app()
    async def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db
    yield app
    app.dependency_overrides.clear()
```

Every test runs in a transaction that's rolled back at teardown — fast, fully isolated.

### B) Truncate-per-test

Slower but simpler — wipe all tables before each test.

## Anti-patterns

- ❌ Creating `AsyncSession` per call inside an endpoint instead of via `Depends(get_db)` — no consistent commit/rollback handling.
- ❌ Sharing a single `AsyncSession` across requests (e.g., put on `app.state`) — sessions are not thread-safe nor request-shareable.
- ❌ Not setting `pool_pre_ping=True` behind PgBouncer / a load balancer — first request after idle gets `OperationalError: server closed connection unexpectedly`.
- ❌ Running `alembic upgrade head` in `lifespan` startup — race condition with N workers; only one should migrate.
- ❌ Returning ORM models directly without `from_attributes=True` on the response model — silent `ValidationError`.

See [troubleshooting.md](troubleshooting.md) for session-leak symptoms (pool exhausted) and the [wrong-vs-right.md](wrong-vs-right.md) entry on leaking sessions.
