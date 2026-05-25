# Declarative ORM — `Mapped[T]` annotated style

The 2.0-canonical mapping style. Use this exclusively in new code — the old `Column(...)` class-attribute style still works but isn't typed.

## The `Base` class

```python
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass
```

If you need async-friendly attribute access on relationships, add `AsyncAttrs`:

```python
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.orm import DeclarativeBase

class Base(AsyncAttrs, DeclarativeBase):
    pass
```

That gives every mapped instance an `.awaitable_attrs` proxy for lazy-loading single attributes from async code. Still prefer eager loading on the query; `awaitable_attrs` is the escape hatch.

## A canonical mapped class

```python
from __future__ import annotations
from datetime import datetime
from sqlalchemy import String, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    full_name: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    posts: Mapped[list[Post]] = relationship(back_populates="author")
```

Rules:

- `Mapped[T]` carries the Python type — SQLAlchemy infers column type from `T` for common cases (`int`, `str`, `bool`, `datetime`, `Decimal`, `bytes`).
- `T | None` (or `Optional[T]`) marks the column `nullable=True`; bare `T` is `nullable=False`. Do not set `nullable=` manually.
- `mapped_column(...)` accepts the same kwargs as the old `Column(...)`: `primary_key`, `unique`, `index`, `nullable` (override the inference), `default`, `server_default`, `onupdate`, `server_onupdate`, `comment`.
- Override the SQL column type explicitly when needed: `mapped_column(String(50))`, `mapped_column(Numeric(12, 2))`.
- Provide string forward references for self-referential or out-of-order classes: `Mapped[list["Comment"]]`.

## Foreign keys and relationships

```python
class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    author: Mapped[User] = relationship(back_populates="posts")
```

- `ForeignKey("users.id")` — string ref to `__tablename__.column`. Use this, not `ForeignKey(User.id)`, to avoid import-order issues.
- `ondelete="CASCADE"` is a database-level rule; it doesn't trigger ORM cascade. For ORM cascade, set `relationship(..., cascade="all, delete-orphan")`.
- `back_populates="posts"` declares the inverse side. Always pair both ends — never use the older `backref` shortcut in new code.

See [relationships.md](relationships.md) for many-to-many, polymorphic, and viewonly.

## Composite indexes and table args

```python
from sqlalchemy import Index, UniqueConstraint, CheckConstraint

class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(20))
    total: Mapped[int]  # cents

    __table_args__ = (
        Index("ix_orders_user_status", "user_id", "status"),
        UniqueConstraint("user_id", "external_ref", name="uq_orders_user_ext"),
        CheckConstraint("total >= 0", name="ck_orders_total_nonneg"),
    )
```

Constraint names should follow your `MetaData(naming_convention=...)` — see [recommended-defaults.md](recommended-defaults.md).

## Server defaults vs Python defaults

```python
created_at: Mapped[datetime] = mapped_column(server_default=func.now())     # DB sets it
updated_at: Mapped[datetime] = mapped_column(
    server_default=func.now(),
    server_onupdate=func.now(),                                             # works in Postgres via triggers / explicit logic
)
priority: Mapped[int] = mapped_column(default=0)                            # Python-side default
```

- `default=` runs in Python at INSERT time — useful when the DB shouldn't know about it (e.g., generated tokens).
- `server_default=` produces a DEFAULT clause in DDL — visible in `pg_dump`, applied for INSERTs that don't list the column. Required if other apps insert into the table.
- `onupdate=` runs in Python on UPDATE; `server_onupdate=` is rarely supported and usually needs a trigger.

## Money: never use `float`

```python
from sqlalchemy import Numeric
from decimal import Decimal

class Invoice(Base):
    __tablename__ = "invoices"
    id: Mapped[int] = mapped_column(primary_key=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
```

`Mapped[Decimal]` maps to `NUMERIC` automatically. `Mapped[float]` maps to `DOUBLE PRECISION` — wrong for money.

## Enum

For string enums backed by the DB, use Python's `enum.Enum`:

```python
import enum
from sqlalchemy import Enum

class OrderStatus(enum.Enum):
    pending = "pending"
    paid = "paid"
    cancelled = "cancelled"

class Order(Base):
    __tablename__ = "orders"
    id: Mapped[int] = mapped_column(primary_key=True)
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, name="order_status", native_enum=True),
        default=OrderStatus.pending,
    )
```

For Postgres, `native_enum=True` creates an actual PG ENUM type — be aware that adding values requires `ALTER TYPE` and Alembic autogenerate has limited support for it. Many teams prefer `native_enum=False` (stores VARCHAR) for migration ergonomics.

## `registry` and multiple bases

`DeclarativeBase` creates a default `registry`. Most apps have exactly one. If you have multiple isolated schemas, declare separate Bases:

```python
class PublicBase(DeclarativeBase): pass
class AnalyticsBase(DeclarativeBase): pass
```

Each Base has its own `.metadata`. Alembic then needs `target_metadata=[PublicBase.metadata, AnalyticsBase.metadata]`. See [migrations-alembic.md](migrations-alembic.md).
