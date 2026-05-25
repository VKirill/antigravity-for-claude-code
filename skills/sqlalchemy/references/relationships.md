# Relationships

`relationship()` declares how mapped classes link. Always pair both ends with `back_populates`. Drives both query traversal and ORM-level cascade.

## One-to-many

```python
class Author(Base):
    __tablename__ = "authors"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    books: Mapped[list["Book"]] = relationship(back_populates="author")


class Book(Base):
    __tablename__ = "books"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str]
    author_id: Mapped[int] = mapped_column(ForeignKey("authors.id"))
    author: Mapped[Author] = relationship(back_populates="books")
```

- `Mapped[list[Book]]` (collection) implies the "many" side.
- `Mapped[Author]` (scalar) implies the "one" side.
- The foreign key lives on the "many" side as `author_id: Mapped[int] = mapped_column(ForeignKey("authors.id"))`.

## Many-to-one

Already covered above — `Book.author` is the many-to-one side. The default loader for many-to-one is `lazy="select"` (one extra SELECT on attribute access). For hot paths where you know you'll always need the parent, set `lazy="joined"` on the relationship or apply `joinedload(Book.author)` per query.

## One-to-one

```python
class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    profile: Mapped["Profile"] = relationship(back_populates="user", uselist=False)


class Profile(Base):
    __tablename__ = "profiles"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    user: Mapped[User] = relationship(back_populates="profile")
```

`uselist=False` on the parent side tells the ORM to expose a scalar instead of a list. The `unique=True` on the FK enforces the relationship at the DB level.

## Many-to-many with `secondary`

```python
from sqlalchemy import Table, Column, ForeignKey

tag_post = Table(
    "tag_post",
    Base.metadata,
    Column("tag_id", ForeignKey("tags.id"), primary_key=True),
    Column("post_id", ForeignKey("posts.id"), primary_key=True),
)


class Post(Base):
    __tablename__ = "posts"
    id: Mapped[int] = mapped_column(primary_key=True)
    tags: Mapped[list["Tag"]] = relationship(secondary=tag_post, back_populates="posts")


class Tag(Base):
    __tablename__ = "tags"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(unique=True)
    posts: Mapped[list[Post]] = relationship(secondary=tag_post, back_populates="tags")
```

Add `post.tags.append(tag_obj)` or remove — the ORM inserts/deletes association rows for you.

If the join table needs extra columns (e.g., `added_at`), promote it to its own mapped class (the **association object** pattern), drop `secondary`, and use two one-to-many relationships through the association class.

## Cascade

```python
class Author(Base):
    __tablename__ = "authors"
    id: Mapped[int] = mapped_column(primary_key=True)
    books: Mapped[list[Book]] = relationship(
        back_populates="author",
        cascade="all, delete-orphan",
    )
```

- `cascade="all"` — propagate `save-update`, `merge`, `refresh-expire`, `expunge`, `delete`.
- `cascade="all, delete-orphan"` — also delete the child when it's removed from the parent collection.

**ORM cascade ≠ DB cascade.** ORM cascade fires Python-side `DELETE` statements during flush. `ondelete="CASCADE"` on the FK is a DB-side rule. Use both for safety; never one as a substitute for the other:

```python
author_id: Mapped[int] = mapped_column(ForeignKey("authors.id", ondelete="CASCADE"))
```

## `viewonly=True`

Read-only relationship — useful for derived links (e.g., "latest order"):

```python
class Customer(Base):
    __tablename__ = "customers"
    id: Mapped[int] = mapped_column(primary_key=True)
    latest_order: Mapped["Order"] = relationship(
        primaryjoin="and_(Customer.id==Order.customer_id, Order.id==select(func.max(Order.id)).where(Order.customer_id==Customer.id).scalar_subquery())",
        viewonly=True,
        uselist=False,
    )
```

`viewonly=True` means the ORM won't track changes through this attribute — no INSERTs/UPDATEs/DELETEs will be generated from collection mutations on it.

## Default `lazy` values per cardinality

| Cardinality | Default `lazy` | Notes |
|---|---|---|
| Many-to-one | `select` | One extra SELECT on access; usually fine since the FK is on the same row |
| One-to-many | `select` | **N+1 risk** when iterating parents; usually want `selectinload` per query |
| Many-to-many | `select` | Same N+1 risk via the secondary join |
| One-to-one | `select` | Effectively a many-to-one with `uselist=False` |

You can override at mapping time (`relationship(..., lazy="selectin")`) — but pinning a loader strategy on the mapping forces it on every query. Prefer per-query `options(...)` so the query author chooses.

## Async constraints

In `async def` code, lazy loading raises `MissingGreenlet` — there's no greenlet stack from which to issue the implicit IO. Three escape hatches:

1. **Eager load**: `options(selectinload(Parent.children))` in the query.
2. **`AsyncAttrs` mixin**: `class Base(AsyncAttrs, DeclarativeBase): pass`, then access via `await parent.awaitable_attrs.children`.
3. **`lazy="raise"`** on the relationship to surface accidental lazy loads at dev time.

```python
class Parent(Base):
    __tablename__ = "parents"
    id: Mapped[int] = mapped_column(primary_key=True)
    children: Mapped[list["Child"]] = relationship(
        back_populates="parent",
        lazy="raise",      # any unwitting lazy access → InvalidRequestError
    )
```

The catalog of loader strategies is in [loading-strategies.md](loading-strategies.md).

## Self-referential relationships

```python
class Category(Base):
    __tablename__ = "categories"
    id: Mapped[int] = mapped_column(primary_key=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"))

    children: Mapped[list["Category"]] = relationship(
        back_populates="parent",
        remote_side=lambda: [Category.parent_id],   # actually wrong — see below
    )
    parent: Mapped["Category | None"] = relationship(
        back_populates="children",
        remote_side="Category.id",
    )
```

`remote_side` tells SQLAlchemy which column is the "remote" side of the self-join. For a tree (parent_id → id), `remote_side` on the `parent` relationship is the `id` column.

## `primaryjoin` and `secondaryjoin`

When the FK relationship is non-obvious (multiple FKs between the same tables, soft-delete filtering, conditional joins), spell out `primaryjoin` as a string expression:

```python
class Author(Base):
    __tablename__ = "authors"
    id: Mapped[int] = mapped_column(primary_key=True)
    active_books: Mapped[list[Book]] = relationship(
        primaryjoin="and_(Book.author_id==Author.id, Book.deleted_at.is_(None))",
        viewonly=True,
    )
```

Always pass as a string (forward reference) so it resolves after all classes are mapped.
