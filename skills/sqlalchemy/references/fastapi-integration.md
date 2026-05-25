# FastAPI integration

The canonical pattern: one `AsyncSession` per request, scoped via FastAPI's `Depends`. Engine and `async_sessionmaker` live on `app.state`, configured in `lifespan`.

## Engine + sessionmaker in `lifespan`

```python
# app/db.py
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

def make_engine(url: str):
    return create_async_engine(
        url,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
        pool_recycle=1800,
    )


def make_sessionmaker(engine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
```

```python
# app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.db import make_engine, make_sessionmaker


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine = make_engine(settings.database_url)
    app.state.engine = engine
    app.state.sessionmaker = make_sessionmaker(engine)
    try:
        yield
    finally:
        await engine.dispose()


app = FastAPI(lifespan=lifespan)
```

`expire_on_commit=False` is **mandatory** in async — see [sessions.md](sessions.md). `pool_pre_ping=True` matters whenever idle connections might be killed by a pooler or load balancer.

## The session dependency

```python
# app/deps.py
from typing import AsyncIterator
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession


async def get_db(request: Request) -> AsyncIterator[AsyncSession]:
    sessionmaker = request.app.state.sessionmaker
    async with sessionmaker() as session:
        yield session
```

The `async with` ensures `session.close()` runs even if the route raises. The session auto-begins on first execute; if the route doesn't commit, the implicit transaction is rolled back when the session closes (no partial writes).

If you want **commit-on-success / rollback-on-error** as the dependency's contract:

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

Trade-off: every route now writes regardless of `commit()` calls — convenient for CRUD, error-prone for routes that intentionally roll back. Pick one contract and document it.

## Using the session in a route

```python
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.deps import get_db

router = APIRouter(prefix="/users")


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    user = await db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise HTTPException(404, "user not found")
    return user
```

If `UserOut` is a Pydantic model with `model_config = ConfigDict(from_attributes=True)`, FastAPI serializes the SQLAlchemy instance directly.

## Eager-load before returning

If `UserOut` references relationships, eager-load them in the query — never let FastAPI's serializer trigger lazy loads, especially in async:

```python
stmt = (
    select(User)
    .options(selectinload(User.roles))
    .where(User.id == user_id)
)
user = await db.scalar(stmt)
```

Without `selectinload`, accessing `user.roles` during Pydantic serialization raises `MissingGreenlet`.

## Transaction-per-request pattern

For routes that do multiple writes and need atomicity:

```python
@router.post("/orders", response_model=OrderOut)
async def create_order(
    payload: OrderIn,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    async with db.begin():
        order = Order(user_id=payload.user_id, total=payload.total)
        db.add(order)
        await db.flush()                # get order.id
        for item in payload.items:
            db.add(OrderItem(order_id=order.id, ...))
    # auto-commits at end of `async with db.begin()`; rolls back on exception
    return order
```

If you use the commit-on-success dependency, you don't need the inner `async with db.begin()`. But the inner block makes the atomicity explicit.

## Background tasks — don't share sessions

`BackgroundTasks` runs after the response is sent; the request-scoped session has already closed by then. Trying to use it raises errors.

Wrong:

```python
@router.post("/things")
async def create_thing(
    payload: ThingIn,
    bg: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    thing = Thing(...)
    db.add(thing)
    await db.commit()
    bg.add_task(send_email, db, thing.id)    # WRONG — db is closed when this runs
    return thing
```

Right — open a fresh session inside the background task:

```python
async def send_email(sessionmaker, thing_id):
    async with sessionmaker() as db:
        thing = await db.get(Thing, thing_id)
        # ... use thing.email ...


@router.post("/things")
async def create_thing(
    payload: ThingIn,
    bg: BackgroundTasks,
    request: Request,
):
    sessionmaker = request.app.state.sessionmaker
    async with sessionmaker() as db:
        thing = Thing(...)
        db.add(thing)
        await db.commit()
        thing_id = thing.id
    bg.add_task(send_email, sessionmaker, thing_id)
    return {"id": thing_id}
```

Pass the sessionmaker (or the engine), not the session. Pass IDs, not ORM instances.

## Avoid global module-level engines

You'll see code that imports `engine` from a module at top-level. That works only if `import time = startup time`. In tests, where you want a different engine per test config, it bites. Keep engines on `app.state` and reach them via `request.app.state` / `Depends`.

## Health check

```python
from sqlalchemy import text

@router.get("/health")
async def health(db: Annotated[AsyncSession, Depends(get_db)]):
    await db.execute(text("SELECT 1"))
    return {"ok": True}
```

Run this through your load balancer. It catches the case where the app is up but its DB pool is exhausted or the DB is unreachable.

## Tests with `dependency_overrides`

```python
@pytest.fixture
async def app_with_test_db(test_sessionmaker):
    async def override_get_db():
        async with test_sessionmaker() as db:
            yield db
    app.dependency_overrides[get_db] = override_get_db
    yield app
    app.dependency_overrides.clear()
```

See [testing.md](testing.md) for the SAVEPOINT-per-test pattern that goes underneath `test_sessionmaker`.
