# Raw SQL and Core

The ORM is great for domain CRUD; Core is great for bulk operations, reporting, and any time you'd rather just write SQL. They use the same `Engine`, the same `Connection`, the same dialects.

## `text()` for literal SQL

```python
from sqlalchemy import text

with engine.connect() as conn:
    result = conn.execute(
        text("SELECT id, email FROM users WHERE created_at > :since"),
        {"since": "2026-01-01"},
    )
    for row in result:
        print(row.id, row.email)
```

Async version:

```python
async with engine.connect() as conn:
    result = await conn.execute(
        text("SELECT id, email FROM users WHERE created_at > :since"),
        {"since": "2026-01-01"},
    )
    for row in result:
        print(row.id, row.email)
```

Rules:

- **Always use named bindparams** (`:foo`). Never f-string or `%`-format SQL with values — that's SQL injection.
- The dict at the second argument provides bind values.
- `text()` returns a `TextClause` you can pass to `Connection.execute` or even compose with ORM `select()` (use sparingly).

## `bindparams` with type hints

When the driver can't infer the param type:

```python
from sqlalchemy import bindparam, Integer

stmt = text("SELECT * FROM events WHERE id = ANY(:ids)").bindparams(
    bindparam("ids", type_=ARRAY(Integer))
)
conn.execute(stmt, {"ids": [1, 2, 3]})
```

## `executemany` for bulk inserts

Passing a list of dicts as the second argument auto-fires `executemany`:

```python
with engine.begin() as conn:                    # transaction context manager
    conn.execute(
        text("INSERT INTO events (kind, payload) VALUES (:kind, :payload)"),
        [
            {"kind": "click", "payload": "{}"},
            {"kind": "view", "payload": "{}"},
            ...,
        ],
    )
```

`engine.begin()` opens a connection AND begins a transaction; commits on clean exit.

## Core `Table` objects

When you want SQL-expression composition without ORM mapping:

```python
from sqlalchemy import Table, Column, Integer, String, MetaData, ForeignKey

metadata = MetaData()
events = Table(
    "events",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("kind", String(50)),
    Column("payload", String),
)
```

Then build statements:

```python
from sqlalchemy import select, insert, update, delete

stmt = select(events).where(events.c.kind == "click")
result = conn.execute(stmt)

ins = insert(events).values(kind="purchase", payload="{}")
conn.execute(ins)
```

`events.c.kind` accesses the column. Note: `events` is a `Table`, not a class.

## Hybrid — ORM mapped class as Core `Table`

Every mapped class exposes its underlying `Table` via `Class.__table__`:

```python
from sqlalchemy import insert
conn.execute(
    insert(User.__table__),
    [{"email": "a@b.c"}, {"email": "d@e.f"}],
)
```

This INSERTs without instantiating any ORM objects — great for bulk loads where the ORM overhead (identity map, attribute tracking) is wasted.

## Bulk operations: ORM vs Core trade-off

| Operation | ORM cost | Core cost |
|---|---|---|
| 10 inserts with mutation tracking | Negligible | Negligible |
| 100k inserts | 5–10s overhead | Sub-second |
| 1M inserts | Minutes | A few seconds + DB write speed |

For million-row imports use Core + `executemany` (or PostgreSQL `COPY` via `psycopg.copy`).

## When to drop from ORM to Core

- **Pure read reporting** — aggregations across many tables, no need for change-tracked objects.
- **Bulk INSERT/UPDATE/DELETE** where you don't need the in-memory objects after.
- **Database-specific SQL** where the ORM mapping adds nothing — e.g., recursive CTE expansions, window functions, `UNNEST(array)` joins.
- **Migration scripts** — Alembic `op.execute(...)` calls live entirely in Core land.

You can mix per-statement. Nothing stops a request handler from doing one ORM `select` and one `conn.execute(text("..."))` against the same session-bound connection:

```python
async with session.begin():
    user = await session.scalar(select(User).where(User.id == 1))
    # raw SQL on the same connection / transaction
    await session.execute(
        text("UPDATE counters SET hits = hits + 1 WHERE name = :n"),
        {"n": "view"},
    )
```

## CTE (Common Table Expressions)

ORM-aware:

```python
from sqlalchemy import select

active_users = (
    select(User.id)
    .where(User.is_active.is_(True))
    .cte("active_users")
)

stmt = select(Post).join(active_users, Post.author_id == active_users.c.id)
```

For recursive CTEs (org charts, threaded comments), the chain gets long — often easier as `text("WITH RECURSIVE ...")`.

## Returning generated values

Postgres / SQLite (3.35+) / MSSQL support `RETURNING`:

```python
from sqlalchemy import insert

stmt = (
    insert(User.__table__)
    .values(email="a@b.c")
    .returning(User.__table__.c.id, User.__table__.c.created_at)
)
row = conn.execute(stmt).one()
print(row.id, row.created_at)
```

ORM `session.add(); session.flush()` already does this for primary keys — `RETURNING` is for explicit Core inserts.

## `conn.execution_options` for one-off tweaks

```python
with engine.connect().execution_options(isolation_level="REPEATABLE READ") as conn:
    ...
```

Common isolation levels:

- `"READ COMMITTED"` — default for Postgres
- `"REPEATABLE READ"`
- `"SERIALIZABLE"` — full isolation; expect serialization errors under contention
- `"AUTOCOMMIT"` — each statement is its own transaction; useful for non-transactional ops like `CREATE INDEX CONCURRENTLY`

```python
with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
    conn.execute(text("CREATE INDEX CONCURRENTLY ix_users_email ON users (email)"))
```

`CREATE INDEX CONCURRENTLY` cannot run inside a transaction block — `AUTOCOMMIT` is required.

## Streaming large result sets

```python
with engine.connect() as conn:
    result = conn.execute(
        text("SELECT * FROM huge_table"),
        execution_options={"stream_results": True, "yield_per": 1000},
    )
    for row in result:
        process(row)
```

`stream_results=True` uses server-side cursors (Postgres / MySQL). `yield_per` is the batch size. Without these, the driver buffers all rows in memory.

ORM equivalent: `session.execute(select(Huge), execution_options={"yield_per": 1000})`.
