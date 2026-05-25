# Loading strategies — the decision that shapes performance

Five strategies. Pick deliberately per query. The wrong choice is either N+1 (too lazy) or a Cartesian product (too greedy).

## The five strategies

| Strategy | What it emits | Use when |
|---|---|---|
| `lazyload` (`lazy="select"`) — default | One extra SELECT per parent on attribute access | Single parent + you may not need the relation |
| `selectinload` | One extra SELECT with `WHERE parent_id IN (...)` after the main SELECT | One-to-many or many-to-many collections; preferred default for eager loading |
| `joinedload` | LEFT OUTER JOIN (or INNER) in the main SELECT | Many-to-one references; small payloads where round-trip dominates |
| `subqueryload` | Re-wraps the main query in a subquery + JOIN | Legacy; only useful for composite PKs on SQL Server |
| `raiseload` | Raises on lazy-load attempt | Hardening / debug — surface accidental N+1 |

## When to use which

### Many-to-one (`child.parent`)

Default `lazy="select"` is usually fine — one extra SELECT for the parent isn't catastrophic, and SQLAlchemy may even hit the identity map.

Optimize with **`joinedload`** when you're loading many children and need each parent:

```python
stmt = select(Post).options(joinedload(Post.author)).limit(20)
posts = session.scalars(stmt).all()
# one SELECT with LEFT JOIN authors; 20 posts + their authors loaded together
```

### One-to-many collection (`parent.children`)

Default `lazy="select"` is an **N+1 trap** when iterating parents:

```python
# DON'T — N+1
authors = session.scalars(select(Author)).all()
for a in authors:
    for b in a.books:        # one SELECT per author!
        print(b.title)
```

Use **`selectinload`**:

```python
stmt = select(Author).options(selectinload(Author.books))
authors = session.scalars(stmt).all()
for a in authors:
    for b in a.books:        # two SELECTs total: authors, then books WHERE author_id IN (...)
        print(b.title)
```

`selectinload` chunks the IN list (default 500 parents per query) — works fine even for huge collections.

### Many-to-many

Same answer: `selectinload`. The association table joins are emitted in the second SELECT.

```python
stmt = select(Post).options(selectinload(Post.tags))
```

### `joinedload` on collections — beware Cartesian

If you `joinedload(Author.books)`, the SELECT returns one row per (author, book) combination. Five authors with 10 books each = 50 rows, each duplicating author columns. Two consequences:

1. **You MUST call `.unique()` on the result** — the ORM raises an error otherwise:

```python
authors = session.execute(
    select(Author).options(joinedload(Author.books))
).unique().scalars().all()
```

2. **Pagination breaks** — `LIMIT 10` on the join doesn't mean "10 authors", it means "10 rows" (so maybe 1 author with 10 books). Use `selectinload` for paginated collections.

Rule of thumb: `joinedload` for many-to-one and one-to-one. `selectinload` for one-to-many and many-to-many.

## Chaining loader options

To eager-load multiple levels:

```python
stmt = select(Author).options(
    selectinload(Author.books).joinedload(Book.publisher)
)
```

This loads authors, then books for those authors, then for each book joins its publisher in the books-SELECT. Three levels deep nest the same way.

Several relationships at the same level:

```python
stmt = select(Author).options(
    selectinload(Author.books),
    selectinload(Author.reviews),
)
```

## `raiseload` — catch accidental lazy loads

```python
from sqlalchemy.orm import raiseload

stmt = select(Author).options(
    selectinload(Author.books),
    raiseload("*"),         # any relationship not eager-loaded → InvalidRequestError
)
```

Or at mapping time on a specific relationship:

```python
class Author(Base):
    books: Mapped[list[Book]] = relationship(lazy="raise")
```

`raise_on_sql` (`lazy="raise_on_sql"`) is similar but only fires if the lazy load would actually emit SQL — silently allows identity-map hits.

## The async lazy-load problem

`lazy="select"` (the default) raises `MissingGreenlet` when triggered inside `async def`:

```python
async def handler():
    author = await session.scalar(select(Author).where(Author.id == 1))
    for book in author.books:        # MissingGreenlet
        ...
```

Three fixes:

1. **Eager**: `select(Author).options(selectinload(Author.books))`.
2. **`AsyncAttrs`**: declare `class Base(AsyncAttrs, DeclarativeBase): pass`, then `for book in await author.awaitable_attrs.books: ...`.
3. **`lazy="raise"`** on the relationship so it fails loudly in dev with a clear message.

The `awaitable_attrs` escape hatch is for occasional access (one or two attributes on one object). For collections, eager-load.

## `contains_eager` — filter inside the eager join

When you JOIN with a WHERE filter and want the eager load to use that same join (not run a fresh one):

```python
from sqlalchemy.orm import contains_eager

stmt = (
    select(Author)
    .join(Author.books)
    .where(Book.published_year == 2026)
    .options(contains_eager(Author.books))
)
authors = session.execute(stmt).unique().scalars().all()
# Each author.books is filtered to 2026 books only — not the full collection!
```

Use deliberately. `contains_eager` produces a **filtered collection** that won't match a `Author.books` access elsewhere in the request.

## `defer` and `undefer` — column-level loading

For columns you don't want to load by default (large text, BLOB):

```python
class Article(Base):
    __tablename__ = "articles"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str]
    body: Mapped[str] = mapped_column(Text, deferred=True)   # not loaded by default
```

Override per query:

```python
from sqlalchemy.orm import undefer
stmt = select(Article).options(undefer(Article.body))
```

## Detecting N+1 in tests

Hook into engine events and assert query count:

```python
from sqlalchemy import event

queries = []

@event.listens_for(engine.sync_engine, "before_cursor_execute")
def _on_query(conn, cursor, statement, *args):
    queries.append(statement)

# run code under test
assert len(queries) <= 3, f"Too many queries: {queries}"
```

For async engine: `engine.sync_engine` accesses the underlying sync engine to attach the event listener.

## Per-relationship default vs per-query option

You can pin `lazy=` on the `relationship()` declaration. Trade-offs:

- **Mapping-level `lazy="selectin"`**: every query of that parent eagerly loads the collection. Easier for new devs, can over-fetch when not needed.
- **Per-query `options(selectinload(...))`**: explicit at the call site. Preferred for production code — performance is a property of the query, not the mapping.

Pin `lazy="raise"` at the mapping level (catches bugs); use per-query loader options for actually loading.
