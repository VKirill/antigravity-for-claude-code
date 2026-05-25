# PostgreSQL-specific features

When you target Postgres, the dialect-specific module unlocks features the generic types don't expose.

```python
from sqlalchemy.dialects.postgresql import (
    JSONB, ARRAY, UUID, ENUM, INET, CIDR, MACADDR,
    insert as pg_insert,
)
```

## `JSONB` — binary JSON with operators

```python
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

class Event(Base):
    __tablename__ = "events"
    id: Mapped[int] = mapped_column(primary_key=True)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
```

Querying:

```python
# Path access (JSON traversal)
select(Event).where(Event.payload["user_id"].astext == "123")

# Containment
select(Event).where(Event.payload.contains({"action": "click"}))

# Has key
select(Event).where(Event.payload.has_key("session_id"))
```

Indexes — usually a GIN index for containment queries:

```python
__table_args__ = (
    Index("ix_events_payload", "payload", postgresql_using="gin"),
)
```

## `ARRAY`

```python
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy import String

class Article(Base):
    __tablename__ = "articles"
    id: Mapped[int] = mapped_column(primary_key=True)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
```

Querying:

```python
# tag in array
select(Article).where(Article.tags.any("python"))

# overlap (any of these tags)
select(Article).where(Article.tags.overlap(["python", "ml"]))

# contains all
select(Article).where(Article.tags.contains(["python", "fastapi"]))
```

## `UUID`

```python
from sqlalchemy.dialects.postgresql import UUID
import uuid

class ApiKey(Base):
    __tablename__ = "api_keys"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
```

`as_uuid=True` makes the Python attribute a `uuid.UUID`, not a string. Postgres stores it as native UUID. For server-side generation:

```python
from sqlalchemy import text

id: Mapped[uuid.UUID] = mapped_column(
    UUID(as_uuid=True),
    primary_key=True,
    server_default=text("gen_random_uuid()"),     # Postgres 13+: built-in
)
```

For UUIDv7 (time-ordered, better for index locality), Postgres 18 exposes `uuidv7()` — use the same `server_default=text("uuidv7()")` pattern.

## `Insert.on_conflict_do_update` — Postgres upsert

The right way to do "insert or update":

```python
from sqlalchemy.dialects.postgresql import insert as pg_insert

stmt = pg_insert(User).values(
    email="a@b.c",
    full_name="Alice",
)
stmt = stmt.on_conflict_do_update(
    index_elements=["email"],
    set_={"full_name": stmt.excluded.full_name},
)
await session.execute(stmt)
await session.commit()
```

- `index_elements=` — the conflict target column(s) (must have a unique constraint or unique index).
- Alternatively `constraint="uq_users_email"` references a named constraint.
- `set_=` — what to update on conflict. `stmt.excluded` is the "would-have-been-inserted" row.
- `where=` — conditional update: `on_conflict_do_update(..., where=User.updated_at < stmt.excluded.updated_at)`.

Skip on conflict:

```python
stmt = pg_insert(User).values(...).on_conflict_do_nothing(index_elements=["email"])
```

Never emulate this with SELECT-then-INSERT — that's a race between two requests; both will see "no row", both will INSERT, the second will fail with `UniqueViolation`.

## `ENUM` (native Postgres ENUM)

```python
from sqlalchemy import Enum
import enum

class OrderStatus(enum.Enum):
    pending = "pending"
    paid = "paid"
    cancelled = "cancelled"

class Order(Base):
    __tablename__ = "orders"
    id: Mapped[int] = mapped_column(primary_key=True)
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, name="order_status", native_enum=True, create_type=True),
    )
```

Caveats:

- Adding values requires `ALTER TYPE order_status ADD VALUE 'refunded'` — Alembic autogenerate does NOT detect this. Write the migration manually.
- Removing values is not supported by Postgres (you must rename the type, recreate, swap).
- Many teams prefer `native_enum=False` (stores as VARCHAR) so migrations are simpler.

## `Computed` (generated columns)

```python
from sqlalchemy import Computed

class FullName(Base):
    __tablename__ = "people"
    id: Mapped[int] = mapped_column(primary_key=True)
    first: Mapped[str]
    last: Mapped[str]
    full: Mapped[str] = mapped_column(Computed("first || ' ' || last"))
```

By default Postgres creates a STORED generated column. Add `persisted=False` for VIRTUAL (Postgres 18+):

```python
full: Mapped[str] = mapped_column(Computed("first || ' ' || last", persisted=False))
```

The Python side cannot assign to a generated column — the DB computes it.

## `RETURNING`

```python
from sqlalchemy import insert

stmt = insert(User).values(email="a@b.c").returning(User.id, User.created_at)
row = (await session.execute(stmt)).one()
print(row.id, row.created_at)
```

Works for INSERT, UPDATE, DELETE. ORM `flush` already uses RETURNING under the hood for primary keys.

## `INET`, `CIDR`, `MACADDR`

```python
from sqlalchemy.dialects.postgresql import INET

class LoginEvent(Base):
    __tablename__ = "login_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    ip: Mapped[str] = mapped_column(INET)
```

Stored as native PG `inet`; the Python type is a string by default.

## `NOTIFY` / `LISTEN`

SQLAlchemy can issue `NOTIFY`:

```python
from sqlalchemy import text
await session.execute(text("NOTIFY channel_name, :payload"), {"payload": "hello"})
```

LISTEN is trickier — Postgres delivers notifications on the connection that called LISTEN. For `asyncpg` you typically grab the raw connection from the SQLAlchemy AsyncConnection and use `asyncpg`-native `add_listener()`. For long-lived listeners, run them on a dedicated connection outside the request pool.

## Row Level Security (RLS) — setting session variables

Postgres RLS policies often reference `current_setting('app.user_id')`. Set it per session/request:

```python
@asynccontextmanager
async def request_scoped_session(sessionmaker, user_id: int):
    async with sessionmaker() as session:
        await session.execute(
            text("SELECT set_config('app.user_id', :uid, true)"),
            {"uid": str(user_id)},
        )
        yield session
```

The third arg `true` makes the setting transaction-scoped (resets on commit/rollback). With pgbouncer in transaction mode, this is the right scope — the next checkout starts clean.

## Skip-locked / row locks

For job queue patterns:

```python
stmt = (
    select(Task)
    .where(Task.status == "pending")
    .order_by(Task.created_at)
    .limit(1)
    .with_for_update(skip_locked=True)
)
task = await session.scalar(stmt)
```

`skip_locked=True` → Postgres `FOR UPDATE SKIP LOCKED`. Required for concurrent workers consuming the same table.

## Schema selection at runtime

For multi-tenant Postgres with one schema per tenant:

```python
await session.execute(text("SET search_path TO tenant_42, public"))
```

Or per-engine via `connect_args`:

```python
engine = create_async_engine(url, connect_args={"server_settings": {"search_path": "tenant_42,public"}})
```
