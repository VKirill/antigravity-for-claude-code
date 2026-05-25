# Queries — 2.0 `select()` style

Forget `session.query(Model)` — it still works but is grandfathered. The 2.0-canonical pattern is `session.execute(select(Model)...)` for both sync and async. Same statement, same operators, same `where()`/`order_by()`/`limit()` chain.

## The basic shape

```python
from sqlalchemy import select

# sync
users = session.execute(select(User).where(User.email == "a@b.c")).scalars().all()

# async
result = await session.execute(select(User).where(User.email == "a@b.c"))
users = result.scalars().all()
```

`.scalars()` is the right call when selecting a single entity per row. Without it you get `Row` tuples (each row is `Row(User(...),)`), so `.all()` returns `[Row(User(...))]` — usable but awkward.

## `session.scalars()` shortcut (recommended)

For single-entity selects, skip `.execute(...).scalars()` and call `session.scalars(stmt)` directly:

```python
users = session.scalars(select(User)).all()            # sync
users = (await session.scalars(select(User))).all()    # async
```

For one row → `session.scalar(stmt)`:

```python
user = session.scalar(select(User).where(User.id == 1))            # sync — returns User | None
user = await session.scalar(select(User).where(User.id == 1))      # async
```

## Result accessors

| Call | Behavior |
|---|---|
| `.all()` | List of rows (empty list if none) |
| `.first()` | First row or `None` |
| `.one()` | Exactly one row; raises `NoResultFound` if 0, `MultipleResultsFound` if 2+ |
| `.one_or_none()` | Zero or one row; raises if 2+ |
| `.scalar_one()` | Like `.one()` but unwraps the single entity in the row |
| `.scalar_one_or_none()` | Like `.one_or_none()` but unwrapped |

Pick `.one()` / `.scalar_one()` when "not found" is a bug. Pick `.one_or_none()` / `.scalar_one_or_none()` when "not found" is a normal branch you handle.

## `.where()` and `.filter_by()`

```python
# Operator-style with class attributes
select(User).where(User.age >= 18, User.is_active.is_(True))

# Keyword shortcut for equality only
select(User).filter_by(email="a@b.c", is_active=True)

# Combine
select(User).where(User.age >= 18).filter_by(is_active=True)
```

Use `User.is_active.is_(True)` instead of `User.is_active == True` to avoid lint complaints (`E712`) — semantically equivalent but `.is_()` reads better.

## `IN`, `LIKE`, `BETWEEN`, NULL

```python
select(User).where(User.id.in_([1, 2, 3]))
select(User).where(User.email.like("%@example.com"))
select(User).where(User.email.ilike("%@example.com"))   # Postgres-only, case-insensitive
select(User).where(User.age.between(18, 65))
select(User).where(User.deleted_at.is_(None))
select(User).where(User.deleted_at.is_not(None))
```

For a dynamic IN list, never f-string the values into SQL — `User.id.in_(list_of_ints)` is fine and parameterized.

## Ordering, limit, offset, pagination

```python
select(User).order_by(User.created_at.desc()).limit(50).offset(100)
```

For keyset pagination (much better at scale than offset):

```python
select(User)
    .where(User.created_at < last_seen_cursor)
    .order_by(User.created_at.desc())
    .limit(50)
```

## Joins

```python
select(User, Post).join(Post, Post.author_id == User.id)
select(User).join(User.posts)                          # via relationship attribute
select(User).join(User.posts).where(Post.published.is_(True))
```

For LEFT OUTER JOIN: `.outerjoin(User.posts)`. For aliased joins (two joins to the same table):

```python
from sqlalchemy.orm import aliased
PostA = aliased(Post)
PostB = aliased(Post)
stmt = (
    select(User)
    .join(PostA, PostA.author_id == User.id)
    .join(PostB, and_(PostB.author_id == User.id, PostB.id != PostA.id))
)
```

## `func.count` and aggregates

```python
from sqlalchemy import func

# total rows
n = session.scalar(select(func.count()).select_from(User))

# count by group
rows = session.execute(
    select(User.country, func.count(User.id))
    .group_by(User.country)
    .order_by(func.count(User.id).desc())
).all()
```

Don't use `.count()` on a `Query` — that's the legacy API. `session.scalar(select(func.count()).select_from(User).where(...))` is the 2.0-canonical pattern.

## `exists()`

```python
from sqlalchemy import exists

has_admin = session.scalar(select(exists().where(User.role == "admin")))  # True/False
```

For subquery existence:

```python
stmt = select(User).where(
    exists().where(Post.author_id == User.id)
)
```

Equivalent attribute helpers: `User.posts.any()` (one-to-many) and `Post.author.has()` (many-to-one):

```python
select(User).where(User.posts.any(Post.published.is_(True)))
select(Post).where(Post.author.has(User.is_active.is_(True)))
```

## `options(...)` for loader strategies

```python
from sqlalchemy.orm import selectinload, joinedload

select(User).options(selectinload(User.posts))
select(Post).options(joinedload(Post.author)).where(Post.id == 1)
```

Full strategy decision tree: [loading-strategies.md](loading-strategies.md).

## `.unique()` requirement with joinedload-on-collection

When a `joinedload` joins a one-to-many or many-to-many collection, the SELECT returns duplicate parent rows (one per child). The ORM raises an error unless you call `.unique()`:

```python
stmt = select(User).options(joinedload(User.posts))
users = session.execute(stmt).unique().scalars().all()      # required
```

Prefer `selectinload(User.posts)` for collections — it avoids the duplication issue entirely.

## `execution_options(populate_existing=True)`

Force-refresh the identity map with the query result:

```python
fresh = session.execute(
    select(User).where(User.id == 1).execution_options(populate_existing=True)
).scalar_one()
```

Useful after external writes (or in tests) where the cached identity-map copy is stale.

## Returning specific columns

```python
rows = session.execute(select(User.id, User.email).where(User.is_active)).all()
# rows is list[Row]; rows[0].id, rows[0].email
```

Don't call `.scalars()` here — there's no single entity to unwrap. Each row is a tuple-shaped `Row`.

## `update()` and `delete()` statements

Bulk modify without loading rows:

```python
from sqlalchemy import update, delete

session.execute(
    update(User).where(User.is_active.is_(False)).values(archived=True)
)
session.execute(delete(User).where(User.id == 42))
session.commit()
```

Bulk statements DO NOT update the identity map automatically. If you've already loaded a User, that in-memory object won't reflect the bulk update without a `session.refresh()` or `populate_existing=True` re-query.
