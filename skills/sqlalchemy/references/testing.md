# Testing

Two goals: isolate each test (no state leaking between tests) and keep the suite fast (no per-test re-creation of schema). The SAVEPOINT-per-test pattern delivers both.

## The SAVEPOINT-per-test pattern (sync)

The canonical recipe: open a connection, begin an outer transaction, bind a session to that connection in `create_savepoint` join mode, run the test, rollback the outer transaction.

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session


engine = create_engine("postgresql+psycopg://test_user:pw@localhost/test_db")
Session = sessionmaker()


@pytest.fixture(scope="function")
def db_session():
    connection = engine.connect()
    trans = connection.begin()                  # outer transaction
    session = Session(
        bind=connection,
        join_transaction_mode="create_savepoint",
    )
    try:
        yield session
    finally:
        session.close()
        trans.rollback()                        # discards EVERYTHING from this test
        connection.close()
```

What this gets you:

- Every test sees a clean slate.
- The schema and any seeded fixture data are loaded once per suite, not per test.
- The session can call `session.commit()` freely — it commits the SAVEPOINT, not the outer transaction.

`join_transaction_mode="create_savepoint"` is the 2.0 replacement for the older deprecated approach of manually creating savepoints around each commit.

## The async equivalent

```python
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession


@pytest_asyncio.fixture(scope="session")
async def engine():
    e = create_async_engine("postgresql+asyncpg://test_user:pw@localhost/test_db")
    yield e
    await e.dispose()


@pytest_asyncio.fixture
async def db_session(engine):
    async with engine.connect() as connection:
        trans = await connection.begin()
        async_session_factory = async_sessionmaker(
            bind=connection,
            expire_on_commit=False,
            class_=AsyncSession,
            join_transaction_mode="create_savepoint",
        )
        async with async_session_factory() as session:
            try:
                yield session
            finally:
                await session.close()
        await trans.rollback()
```

The same idea translated to async primitives. Note `expire_on_commit=False` — same rule as production.

## Why not `Base.metadata.drop_all` per test?

It works but is slow. For 200+ tests, dropping/creating the schema each time can stretch a 30-second suite to 5 minutes. The SAVEPOINT pattern keeps the schema warm.

For first-time schema setup at session scope:

```python
@pytest_asyncio.fixture(scope="session")
async def setup_schema(engine):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
```

## `NullPool` for parallel tests

When running `pytest-xdist` with multiple workers, each worker process must use its own pool. `NullPool` (no pooling, fresh connection per checkout) is simplest:

```python
from sqlalchemy import NullPool
engine = create_async_engine(test_url, poolclass=NullPool)
```

Without this, multiple workers may exhaust the DB's `max_connections`.

## In-memory SQLite — limitations

For unit-test speed many people use `sqlite+aiosqlite:///:memory:`. Caveats:

- Each connection gets its own private memory DB. Use `StaticPool` so the same in-memory DB is shared:

```python
from sqlalchemy.pool import StaticPool

engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
```

- SQLite supports much less than Postgres: no `JSONB` (only `JSON`), no `ARRAY`, no proper `FOR UPDATE`, no native ENUM, limited `ALTER TABLE`.
- Migrations behave differently — `render_as_batch=True` in Alembic enables the table-recreate pattern.

For SQLAlchemy logic tests SQLite-in-memory is fine. For tests that exercise Postgres-specific SQL (`JSONB` queries, `on_conflict_do_update`), use a real Postgres test DB.

## FastAPI + dependency_overrides

```python
from app.main import app
from app.deps import get_db

@pytest_asyncio.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db

    from httpx import AsyncClient, ASGITransport
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()
```

The route's `Depends(get_db)` now returns the test session, which is bound to the rollback-at-end transaction.

## Factories: `factory-boy` / `polyfactory`

`factory-boy` works with SQLAlchemy via `SQLAlchemyModelFactory`:

```python
import factory
from factory.alchemy import SQLAlchemyModelFactory

class UserFactory(SQLAlchemyModelFactory):
    class Meta:
        model = User
        sqlalchemy_session_persistence = "flush"   # add+flush, not commit

    email = factory.Sequence(lambda n: f"user{n}@test.local")
    full_name = factory.Faker("name")
```

Wire `Meta.sqlalchemy_session` per test:

```python
@pytest.fixture
def user_factory(db_session):
    UserFactory._meta.sqlalchemy_session = db_session
    return UserFactory
```

`sqlalchemy_session_persistence = "flush"` is correct for the SAVEPOINT pattern — the test's eventual `trans.rollback()` discards everything anyway.

For async, `factory-boy` has limited support — `polyfactory` is friendlier for async-only code.

## Asserting query count (catch N+1)

```python
from sqlalchemy import event

@pytest.fixture
def query_counter(engine):
    counter = {"n": 0}
    @event.listens_for(engine.sync_engine, "before_cursor_execute")
    def before(*args):
        counter["n"] += 1
    yield counter
    event.remove(engine.sync_engine, "before_cursor_execute", before)


async def test_list_authors_no_n_plus_one(client, query_counter, user_factory):
    for _ in range(10):
        user_factory()
    await db_session.commit()

    query_counter["n"] = 0
    resp = await client.get("/authors")
    assert resp.status_code == 200
    assert query_counter["n"] <= 3, f"too many queries: {query_counter['n']}"
```

Tune the budget per endpoint. A regression that adds an N+1 will blow it.

## Don't forget `pytest-asyncio` config

`pyproject.toml`:

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
```

With `asyncio_mode = "auto"`, plain `async def test_...` works without `@pytest.mark.asyncio` decoration.
