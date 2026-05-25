# Troubleshooting — SQLAlchemy

Symptom-indexed. Find your symptom, follow the diagnosis steps, apply the fix.

---

## `MissingGreenlet: greenlet_spawn has not been called`

**Symptoms**
- Async code path raises `sqlalchemy.exc.MissingGreenlet`
- Often during a Pydantic response serialization or a `for x in obj.children:` after an `await session.execute(...)`

**Diagnose**
```python
# Add this to confirm greenlet is installed
import greenlet
print(greenlet.__version__)
```

**Common causes**
- `greenlet` is not installed — install with `uv add "sqlalchemy[asyncio]"` (pulls greenlet)
- Accessing a lazy-loaded relationship in an `async def` block without eager loading
- `expire_on_commit=True` (the default) on `async_sessionmaker` — every commit expires attributes, the next access triggers implicit IO

**Fix**

1. Confirm `greenlet` is installed.
2. Set `expire_on_commit=False` on `async_sessionmaker`.
3. Eager-load the relationship the route serializes:

```python
stmt = select(User).options(selectinload(User.roles)).where(User.id == user_id)
user = await session.scalar(stmt)
```

4. Or use `AsyncAttrs` mixin and access via `await obj.awaitable_attrs.field`.

---

## `DetachedInstanceError: Instance ... is not bound to a Session`

**Symptoms**
- Code accesses an attribute on an ORM object after the session closed
- Stack trace from Pydantic serialization or a function called after `session.close()`

**Common causes**
- Session closed via `async with` exit, but the object is still being used downstream
- `expire_on_commit=True` expired the attribute on commit, and a later access tries to reload it without a session

**Fix**

- Set `expire_on_commit=False` on the sessionmaker.
- Keep the session open for the entire scope where the object is accessed.
- Or, before closing, serialize to a Pydantic model / dataclass DTO and return that.

```python
async with sessionmaker() as session:
    user = await session.scalar(select(User).where(User.id == 1))
    dto = UserOut.model_validate(user, from_attributes=True)
# session closed; dto has no session dependency
return dto
```

---

## `QueuePool limit of size 5 overflow 10 reached, connection timed out`

**Symptoms**
- Under load, requests stall and then raise `TimeoutError: QueuePool limit ... reached`
- Symptom appears under bursts; quiet periods recover

**Diagnose**

```bash
# Check what Postgres sees
psql -c "SELECT count(*) FROM pg_stat_activity WHERE application_name LIKE '%your_app%';"
# Per-state breakdown
psql -c "SELECT state, count(*) FROM pg_stat_activity GROUP BY state;"
```

**Common causes**
- A session is leaked — a request handler raised before `session.close()`. Always use `async with sessionmaker()` or a `try/finally` in the dependency.
- A long-running transaction (e.g., external HTTP call inside `session.begin()`) holds the connection.
- Background tasks open sessions without closing them.
- Pool too small for actual concurrency.

**Fix**
- Wrap session in `async with`.
- Move external network calls OUTSIDE the transaction:

```python
# BAD
async with session.begin():
    result = await httpx_client.get(url)         # holds DB conn during HTTP latency
    session.add(Log(data=result.json()))

# GOOD
result = await httpx_client.get(url)
async with session.begin():
    session.add(Log(data=result.json()))
```

- Raise `pool_size` / `max_overflow` for real concurrency needs, AFTER fixing the leak. Raising the pool to mask a leak just delays the failure.

---

## `sqlalchemy.exc.InvalidRequestError: Object ... is already attached to session`

**Symptoms**
- Error when adding an object that was loaded from another session
- Common in tests when fixtures span scopes

**Common causes**
- Object loaded in session A, then `session_b.add(obj)` called

**Fix**

```python
# instead of session.add(obj)
obj = await session_b.merge(obj)        # detaches and re-attaches
```

Or, ensure all access to the object goes through the same session.

---

## `LazyLoadingNotPermittedError` / `InvalidRequestError: 'lazy=raise'`

**Symptoms**
- `lazy="raise"` on a relationship; some code path lazy-accesses the relation
- The exception message names the attribute that wasn't eager-loaded

**Fix**
- Add `.options(selectinload(Parent.attr))` to the query that loads the parent
- Or use `await parent.awaitable_attrs.attr` (with `AsyncAttrs` mixin)

This error is a feature — it surfaces N+1 bugs you'd otherwise not see until production. Treat it as a query bug, not a mapping bug.

---

## `MultipleResultsFound` / `NoResultFound` on `.one()`

**Symptoms**
- `session.scalar_one()` raises one of these
- Was expected to be a single-row query

**Common causes**
- `MultipleResultsFound`: missing `unique=True` on the column being filtered, or filter didn't constrain enough
- `NoResultFound`: row was deleted between fetches, or the filter is wrong

**Fix**
- Use `.scalar_one_or_none()` when "not found" is normal — handle the `None` explicitly:

```python
user = await session.scalar(select(User).where(User.email == email))
if user is None:
    raise HTTPException(404, "user not found")
```

- For `MultipleResultsFound`, debug with `.all()` and inspect; usually the WHERE clause is wrong or you forgot a uniqueness constraint.

---

## Alembic autogenerate produces no changes

**Symptoms**
- You edited a model; `alembic revision --autogenerate -m "..."` produces an empty migration

**Common causes**
- `target_metadata` in `env.py` points to the wrong `Base.metadata`
- The model module isn't imported, so the class wasn't registered on the metadata
- You're connected to the database you've already migrated to head (autogenerate is a diff between metadata and DB)

**Fix**
- Confirm `env.py` imports your model module: `from app.models import Base, User, Post, ...` (importing the module triggers the class registrations)
- Confirm the DB connection URL points to the right database
- Run `alembic current` and `alembic history` to see where Alembic thinks the DB is

---

## Migration drift — schema in production differs from `alembic_version`

**Symptoms**
- A column exists in DB but not in code (or vice versa)
- Autogenerate proposes to drop columns that are clearly in use

**Common causes**
- Manual `ALTER TABLE` ran in production
- A migration was applied then reverted in code but not in the DB
- Two branches each created migration files; one merged without the other

**Fix**
1. Don't run autogenerate yet — it'll generate destructive ops.
2. Inspect the DB: `\d table_name` in `psql`.
3. Either:
   - Bring code up to match DB: add the missing column to the model, write a `alembic stamp head`-only migration (no `op.add_column`) since the DB already has it.
   - Or bring DB down to match code: write a manual migration that drops the rogue column.
4. Long-term: enable `alembic check` in CI to catch drift before it merges.

---

## Deadlock — `DBAPIError: deadlock detected`

**Symptoms**
- Sporadic 500s under concurrent load
- Postgres log: `deadlock detected`

**Common causes**
- Two transactions update the same rows in different orders (Order A acquires row 1 then row 2; Order B acquires row 2 then row 1)
- Long-held transactions holding row locks while waiting on external IO
- Missing index causing full-table locks during UPDATE

**Fix**
- Update rows in a consistent order across all code paths (e.g., always `ORDER BY id`).
- Keep transactions short — no HTTP calls, no slow CPU work inside `session.begin()`.
- For known hotspots, use `SELECT ... FOR UPDATE SKIP LOCKED` (job queue pattern) instead of normal locking.
- Add a retry loop for transient deadlocks (3 attempts, exponential backoff).

---

## `SerializationFailure` under `REPEATABLE READ` / `SERIALIZABLE`

**Symptoms**
- `could not serialize access due to concurrent update`
- Only at higher isolation levels

**Fix**
- It's expected — retry the transaction. See [recommended-defaults.md](recommended-defaults.md) for the retry pattern.
- If retries are spiking, reduce isolation to `READ COMMITTED` if your invariants allow, or partition the workload to reduce contention.

---

## `OperationalError: server closed the connection unexpectedly`

**Symptoms**
- First query after long idle fails
- Subsequent queries succeed (pool churned)

**Common causes**
- pgbouncer / load balancer / firewall killed an idle TCP connection
- Postgres restarted between checkouts

**Fix**
- Set `pool_pre_ping=True` (issues a cheap `SELECT 1` before each checkout).
- Set `pool_recycle=1800` to proactively recycle older than 30 minutes (under your idle-timeout).
- For pgbouncer in transaction mode: also disable prepared statement caching (see [setup.md](setup.md)).

---

## `cannot perform operation: another operation is in progress`

**Symptoms** (asyncpg specifically)
- Raised mid-await

**Cause**
- Sharing an `AsyncSession` (or its underlying connection) across concurrent tasks. asyncpg connections are NOT concurrent-safe.

**Fix**
- One session per task. If a parent coroutine spawns subtasks (`asyncio.gather`), each subtask creates its own session via the shared `async_sessionmaker`.

---

## "I changed `expire_on_commit` and nothing changed"

**Symptoms**
- Set `expire_on_commit=False` on `async_sessionmaker(...)` but the route still raises `MissingGreenlet` after commit

**Cause**
- Two different sessionmaker instances; the one used by the route still has the default
- Or, the access happens on a different object that was loaded in a different session

**Fix**
- Search for all `async_sessionmaker(`/`sessionmaker(` constructions; ensure exactly one factory per app, configured once.
- For tests, override at the dependency layer — don't construct ad-hoc sessionmakers in fixtures with different settings than prod.

---

## Postgres `prepared statement "..." already exists`

**Symptoms** (asyncpg / pgbouncer)
- Random failures when the app is behind pgbouncer in transaction mode

**Cause**
- asyncpg auto-caches prepared statements per-connection; pgbouncer rotates the underlying server connection, so the cached name doesn't match.

**Fix**
```python
engine = create_async_engine(
    url,
    connect_args={"prepared_statement_cache_size": 0},   # asyncpg
)
```

For psycopg async: `connect_args={"prepare_threshold": None}`.
