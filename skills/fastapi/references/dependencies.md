# FastAPI — dependencies

## Core idea

`Depends(callable)` runs `callable` before the path operation. The return value is injected. Callables can be sync or async; FastAPI runs sync callables in a threadpool automatically.

```python
from typing import Annotated
from fastapi import Depends, FastAPI

app = FastAPI()

async def common_params(q: str | None = None, skip: int = 0, limit: int = 100):
    return {"q": q, "skip": skip, "limit": limit}

@app.get("/items/")
async def list_items(params: Annotated[dict, Depends(common_params)]):
    return params
```

Always use `Annotated[T, Depends(...)]` — never `params: dict = Depends(common_params)`. The `Annotated` form composes with type checkers and survives across function signatures.

## Sub-dependencies

A dependency can depend on other dependencies. FastAPI builds the DAG and caches each node per request.

```python
async def get_settings() -> Settings: ...
async def get_db_url(s: Annotated[Settings, Depends(get_settings)]) -> str:
    return s.database_url
async def get_engine(url: Annotated[str, Depends(get_db_url)]):
    return create_async_engine(url)
```

If two parameters both depend on `get_settings`, it's called **once** per request — `Depends(callable, use_cache=True)` is the default. Disable with `use_cache=False` when you want fresh each invocation.

## Dependencies with `yield` (cleanup)

The canonical pattern for database sessions, file handles, network connections.

```python
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

async def get_db(
    sessionmaker: Annotated[async_sessionmaker, Depends(get_sessionmaker)],
):
    async with sessionmaker() as session:
        try:
            yield session
            # commit on success — see databases.md for variations
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        # `async with` handles close
```

Notes:

- Code before `yield` runs before the path operation; the value is injected.
- Code after `yield` runs **after the response has been sent** (since FastAPI 0.106 in newer versions; check release notes if you depend on pre-response cleanup behaviour).
- Exceptions raised in the path operation propagate into the dependency at `yield` — wrap with `try/except` for rollback semantics.
- `yield` dependencies cannot be used in `BackgroundTasks` reliably — schedule cleanup via the request lifecycle, not the background task.

## Classes as dependencies

Any callable works, including class constructors. Useful for grouping config knobs.

```python
class Pagination:
    def __init__(self, skip: int = 0, limit: int = 100):
        self.skip = skip
        self.limit = limit

@app.get("/items/")
async def list_items(p: Annotated[Pagination, Depends()]):  # Depends() infers Pagination
    return {"skip": p.skip, "limit": p.limit}
```

`Depends()` with no arg uses the type from the annotation. This is the most ergonomic form for class dependencies.

## Global / router-level dependencies

For checks that run on every route (auth, rate limit) — but where you don't need the return value at the call site.

```python
# Global
app = FastAPI(dependencies=[Depends(rate_limit), Depends(require_auth)])

# Router-scoped
router = APIRouter(prefix="/admin", dependencies=[Depends(require_admin)])
```

Routes still call `Depends(get_current_user)` in their signature when they need the actual user object. Treat router-level `dependencies=` as a guard, the in-signature `Depends` as a value source.

## `dependency_overrides` for tests

The killer feature for testability — swap any dependency without touching production code.

```python
# conftest.py
from app.main import create_app
from app.deps import get_db, get_current_user

@pytest.fixture
def app():
    app = create_app()
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: FakeUser(id=1)
    yield app
    app.dependency_overrides.clear()
```

The override must match the original's signature shape — same params, same return type (FastAPI doesn't enforce it; mismatches surface as 500 with cryptic tracebacks).

## Security as `Depends`

`OAuth2PasswordBearer` is just a dependency that extracts and validates the `Authorization` header.

```python
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    payload = decode_jwt(token)
    return await load_user(db, payload["sub"])
```

See [security.md](security.md) for full JWT lifecycle.

## Caching nuance

Per-request caching means: if `get_current_user` is in `dependencies=[]` of the router AND in the signature of the endpoint, it runs once. If you want fresh state per call (e.g., rate-limit counter), pass `use_cache=False`:

```python
Depends(consume_rate_limit_token, use_cache=False)
```

## Sync vs async dependencies

| Dep flavour | Endpoint flavour | Runs in |
|---|---|---|
| `def` (sync) | `async def` | threadpool |
| `async def` | `async def` | event loop |
| `def` (sync) | `def` (sync) | threadpool |
| `async def` | `def` (sync) | event loop (but endpoint blocks the worker — avoid) |

Rule of thumb: write `async def` dependencies whenever your dependency does I/O. Sync dependencies are fine for pure-CPU work or quick lookups that the threadpool can absorb.

## Anti-patterns

- ❌ Mutable module-level state instead of `Depends(get_settings)` — defeats `dependency_overrides`.
- ❌ Calling `get_db()` directly inside a handler instead of `Depends(get_db)` — bypasses cleanup ordering.
- ❌ `Depends(get_user)` *and* `request.state.user` for the same value — drift hazard.
- ❌ Raising inside `yield` cleanup — if you must, raise via `HTTPException` before yield so the error handler still works.

See [wrong-vs-right.md](wrong-vs-right.md) for blocking-I/O pitfalls inside dependencies.
