# Sessions — `Session` and `AsyncSession`

A `Session` is the unit-of-work boundary: identity map for loaded objects, change tracking, and transaction scope. Every read/write goes through one. Get the lifecycle right and most "weird ORM bugs" go away.

## `sessionmaker` / `async_sessionmaker`

A factory bound to the engine. Build once at app startup, reuse for every request/task.

```python
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine

engine = create_engine("postgresql+psycopg://...")
SessionLocal = sessionmaker(engine, expire_on_commit=False)
```

Async equivalent:

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

engine = create_async_engine("postgresql+asyncpg://...")
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
```

`class_=AsyncSession` is the default; pass it explicitly only when subclassing.

## Why `expire_on_commit=False`?

By default, every `commit()` expires all instances in the identity map — the next attribute access reloads from the database via implicit IO. In sync code that's fine. In async code that IO is invalid — implicit lazy reload raises `MissingGreenlet`.

Set `expire_on_commit=False` on async sessionmakers. For sync sessionmakers it's optional but often desirable when objects are passed across functions after commit.

```python
async with async_session() as session:
    result = await session.execute(select(User).where(User.id == 1))
    user = result.scalar_one()
    user.full_name = "Renamed"
    await session.commit()
    # With expire_on_commit=False this is fine:
    print(user.full_name)
    # With expire_on_commit=True it would trigger a lazy reload and crash in async.
```

## Sync session lifecycle — context manager

```python
with SessionLocal() as session:
    user = session.execute(select(User).where(User.id == 1)).scalar_one()
    user.full_name = "Edited"
    session.commit()
# session.close() runs automatically; pool connection returned
```

The session auto-begins a transaction on first use, and `commit()` / `rollback()` close that transaction. The `with` block then closes the session itself.

For a session that should auto-commit at the end of the block (or rollback on exception), use `Session.begin()`:

```python
with SessionLocal.begin() as session:
    session.add(SomeObject(...))
# commit happens on clean exit, rollback on exception
```

## Async session lifecycle

```python
async with AsyncSessionLocal() as session:
    result = await session.execute(select(User).where(User.id == 1))
    user = result.scalar_one()
    user.full_name = "Edited"
    await session.commit()
```

Explicit transaction block:

```python
async with AsyncSessionLocal.begin() as session:
    session.add(SomeObject(...))
# commits on success, rolls back on exception, closes session
```

You can also use `session.begin()` after creating the session for an explicit inner transaction:

```python
async with AsyncSessionLocal() as session:
    async with session.begin():
        session.add(SomeObject(...))
    # transaction is committed; session still open
    # next use auto-begins a new transaction
```

## Nested transactions (SAVEPOINTs)

`begin_nested()` creates a SAVEPOINT. Useful when you want a partial-rollback boundary inside a larger transaction (and essential for the test fixture pattern).

```python
with Session.begin() as session:
    session.add(u1)
    savepoint = session.begin_nested()
    session.add(u2)
    savepoint.rollback()        # rolls back u2 only
    # u1 still pending; commit() fires at end of outer block
```

## `async_scoped_session` — avoid in new code

The docs explicitly note: "SQLAlchemy generally does not recommend the 'scoped' pattern for new development." `async_scoped_session` ties a session to `current_task` and requires `await ScopedSession.remove()` to flush — error-prone in modern frameworks.

Prefer **session-per-request** via a framework dependency. FastAPI example in [fastapi-integration.md](fastapi-integration.md). If you must wire scoped sessions for legacy parity:

```python
from asyncio import current_task
from sqlalchemy.ext.asyncio import async_scoped_session

AsyncScopedSession = async_scoped_session(
    AsyncSessionLocal,
    scopefunc=current_task,
)
# session = AsyncScopedSession()
# ... use ...
# await AsyncScopedSession.remove()   # at end of outer await
```

## Identity map

Every loaded object lives in `session.identity_map` keyed by `(class, primary_key)`. A second query for the same row returns the **same Python object**:

```python
u1 = session.execute(select(User).where(User.id == 1)).scalar_one()
u2 = session.execute(select(User).where(User.id == 1)).scalar_one()
assert u1 is u2                # True — identity map
```

Implications:

- Setting `u1.name = "x"` and then re-selecting User #1 in the same session still returns the modified instance — the query result is the identity-map hit, not a fresh row.
- To force a fresh read: `session.refresh(u1)` or pass `populate_existing=True` to `.execution_options(...)`.

## Detached instances

An object is "detached" when its session has been closed. Detached objects:

- Cannot lazy-load relationships (`DetachedInstanceError`).
- Can be re-attached to another session via `session.merge(detached_obj)`.
- Cannot be `add()`-ed back — they're already persisted; use `merge` instead.

If you need to access attributes after the session closes, either:

1. Use `expire_on_commit=False` AND keep the object in scope without further lazy access, OR
2. Eagerly load every attribute/relationship you'll need before close, OR
3. Convert to a Pydantic / dataclass DTO before returning the object from the session boundary.

## Flush vs commit

- `flush()` — sends pending changes to the DB (within the current transaction). The DB-side rows now exist but the transaction is still open. Useful to obtain server-generated IDs before committing.
- `commit()` — flushes + commits the transaction.

```python
new_user = User(email="a@b.c")
session.add(new_user)
session.flush()         # INSERT runs; new_user.id is populated
session.add(Post(author_id=new_user.id, ...))
session.commit()        # both rows commit atomically
```

Async equivalents: `await session.flush()` / `await session.commit()`.

## `session.add()` vs `session.add_all()`

```python
session.add(user)                     # one
session.add_all([user1, user2, user3])  # many; no perf difference vs loop
```

For bulk inserts of thousands of rows, use Core (`Connection.execute(insert(table), [rows])`) — see [raw-sql-and-core.md](raw-sql-and-core.md).

## Concurrency safety

A single `Session` (sync or async) is **not safe to share across threads or tasks**. The rule:

- One thread or coroutine = one session for its entire active scope.
- Use `sessionmaker` to create fresh sessions inside the thread/task.
- Never store a session on `app.state` or a global — only the sessionmaker is shared.
