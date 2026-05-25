# Wrong vs Right — production-grade contrasts

Six paste-runnable pairs. The "wrong" column is code that runs (otherwise we'd never see it in real PRs); the "right" column is the 2.0-canonical fix.

---

## 1. Legacy `Query` API vs 2.0-style `select()`

### Wrong — legacy 1.x style

```python
# Works in 1.x, deprecated in 2.0 for new code
users = session.query(User).filter(User.is_active == True).order_by(User.created_at).all()
count = session.query(User).filter_by(is_active=True).count()
user = session.query(User).get(42)
```

Problems:
- `Query` is grandfathered — new SQLAlchemy features go to `select()` only.
- `.get(pk)` is fine but reads inconsistently with the rest of the codebase.
- Loader strategy options on `Query` are different from `select()` (`Query.options()` exists but the rest of the chain is split-brain).

### Right — 2.0-canonical

```python
from sqlalchemy import select, func

users = session.scalars(
    select(User).where(User.is_active.is_(True)).order_by(User.created_at)
).all()
count = session.scalar(select(func.count()).select_from(User).where(User.is_active.is_(True)))
user = session.get(User, 42)                            # session.get is still the right call by PK
```

Why:
- Same `select()` works for sync and async, ORM and Core.
- `func.count()` is the canonical aggregate.
- `User.is_active.is_(True)` avoids ruff/pylint `E712` "comparison to True should use is".

---

## 2. N+1 lazy in a loop vs `selectinload`

### Wrong — N+1 burst

```python
authors = await session.scalars(select(Author))
for a in authors:
    for book in a.books:           # one extra SELECT per author
        print(book.title)
```

For 50 authors → 51 queries. In an async path it's also `MissingGreenlet` because lazy loading isn't possible.

### Right — eager load

```python
from sqlalchemy.orm import selectinload

stmt = select(Author).options(selectinload(Author.books))
authors = (await session.scalars(stmt)).all()
for a in authors:
    for book in a.books:           # already loaded; no extra SQL
        print(book.title)
```

Two SELECTs total regardless of author count: `SELECT authors ...`, `SELECT books WHERE author_id IN (...)`.

---

## 3. Lazy attribute in async path vs eager loading

### Wrong — lazy access after commit

```python
async with async_session() as session:
    order = await session.scalar(select(Order).where(Order.id == order_id))
    await session.commit()
    return {"id": order.id, "items": [i.sku for i in order.items]}    # MissingGreenlet
```

`expire_on_commit=True` (default) expired everything on commit; the comprehension now tries to lazy-reload `order.items` — implicit IO in async → boom.

### Right — eager load + `expire_on_commit=False`

```python
async_session = async_sessionmaker(engine, expire_on_commit=False)

async with async_session() as session:
    stmt = (
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id == order_id)
    )
    order = await session.scalar(stmt)
    await session.commit()
    return {"id": order.id, "items": [i.sku for i in order.items]}    # works
```

Both fixes matter — eager-loading is non-negotiable in async; `expire_on_commit=False` prevents the post-commit reload that would also break.

---

## 4. `engine.execute(...)` (removed in 2.0) vs `engine.connect()` context manager

### Wrong — legacy implicit connection

```python
# 1.x style — REMOVED in 2.0
result = engine.execute("SELECT 1")           # AttributeError in 2.0
```

The "implicit autocommit + connectionless execution" pattern is gone. SQLAlchemy now requires explicit connection scope.

### Right — explicit connection + `text()`

```python
from sqlalchemy import text

with engine.connect() as conn:
    result = conn.execute(text("SELECT 1"))
    val = result.scalar()

# Or for writes that must commit:
with engine.begin() as conn:
    conn.execute(text("INSERT INTO t (col) VALUES (:v)"), {"v": "x"})
# committed on clean exit
```

`engine.connect()` opens a connection without auto-commit. `engine.begin()` opens AND begins a transaction. Both close the connection at the end of the block.

---

## 5. SELECT-then-INSERT race vs `Insert.on_conflict_do_update`

### Wrong — race condition

```python
existing = await session.scalar(select(User).where(User.email == email))
if existing is None:
    session.add(User(email=email, full_name=name))
else:
    existing.full_name = name
await session.commit()
```

Two concurrent requests both see "not found", both INSERT, the second crashes with `UniqueViolation`. The retry is on you, and it's unreliable.

### Right — atomic upsert

```python
from sqlalchemy.dialects.postgresql import insert as pg_insert

stmt = pg_insert(User).values(email=email, full_name=name)
stmt = stmt.on_conflict_do_update(
    index_elements=["email"],
    set_={"full_name": stmt.excluded.full_name},
)
await session.execute(stmt)
await session.commit()
```

One round trip. The DB serializes the conflict. No race.

Equivalent skip-on-conflict if you don't want to update existing rows:

```python
stmt = pg_insert(User).values(...).on_conflict_do_nothing(index_elements=["email"])
```

---

## 6. Sync session in async path vs `AsyncSession`

### Wrong — mixing paradigms

```python
# app/main.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

engine = create_engine("postgresql+psycopg://...")
SessionLocal = sessionmaker(engine)


@app.get("/users/{user_id}")
async def get_user(user_id: int):
    db: Session = SessionLocal()              # SYNC session
    try:
        user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
        # ...
    finally:
        db.close()
    return user
```

Problems:
- Sync session inside `async def` blocks the event loop for every query — every request stalls every other request.
- Pool is psycopg-sync; you don't get the asyncpg speedup or proper async cancellation.
- Tools like `asyncio.gather` won't parallelize DB I/O at all.

### Right — `AsyncSession` end-to-end

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

engine = create_async_engine("postgresql+asyncpg://...")
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


@app.get("/users/{user_id}")
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.id == user_id))
    return user
```

The query awaits cleanly; the event loop runs other requests during the DB round-trip; `asyncio.gather` actually parallelizes.

Mixing rule: **one paradigm per process**. If you need sync (e.g., for a Celery worker) and async (for FastAPI), they run in different processes with different engines.
