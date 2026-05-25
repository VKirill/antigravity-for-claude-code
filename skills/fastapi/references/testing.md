# FastAPI — testing

Two clients, both backed by `httpx`:

| Client | Sync/async tests | When |
|---|---|---|
| `fastapi.testclient.TestClient` | sync (test functions are `def`) | Most tests; simple |
| `httpx.AsyncClient` (+ `anyio` / `pytest-asyncio`) | async (`async def`) | Code under test calls async-only fixtures from inside the test |

Both honor `app.dependency_overrides` — that's where most testing leverage comes from.

## `TestClient` (sync)

```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
```

`TestClient` boots the ASGI app in-process — no socket, no port. Behind the scenes it uses `anyio` to bridge sync test code to async endpoints.

### Lifespan with `TestClient`

Use it as a context manager so `lifespan` startup/shutdown actually run:

```python
with TestClient(app) as client:
    r = client.get("/users/me")
    ...
# shutdown ran here
```

Without `with`, the lifespan does NOT execute — `app.state.engine` etc. will be missing.

## `httpx.AsyncClient` (async)

```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.anyio    # or @pytest.mark.asyncio with pytest-asyncio
async def test_read_root():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.get("/")
    assert r.status_code == 200
```

For modern `httpx` (≥ 0.27) the `app=` kwarg is replaced by `transport=ASGITransport(app=app)`. Older code uses `AsyncClient(app=app, base_url=...)`.

To trigger lifespan in async tests, wrap with `asgi-lifespan`:

```python
from asgi_lifespan import LifespanManager

async with LifespanManager(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        ...
```

## `pytest-asyncio` vs `anyio`

FastAPI itself uses `anyio` internally. Pick one for your test suite:

- `pytest-asyncio` — most popular; `@pytest.mark.asyncio`. Requires `asyncio_mode = "auto"` or per-test marker.
- `anyio` — works with both asyncio and trio. `@pytest.mark.anyio` with a parametrized `anyio_backend` fixture.

For a pure FastAPI/SQLAlchemy stack, `pytest-asyncio` is simpler. Either works.

```toml
# pyproject.toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
```

## `dependency_overrides` — the key pattern

```python
# tests/conftest.py
import pytest
from app.main import create_app
from app.deps import get_db, get_current_user

@pytest.fixture
def app(db_session):
    app = create_app()

    async def _get_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_current_user] = lambda: FakeUser(id=1, scopes=["read", "write"])

    yield app
    app.dependency_overrides.clear()

@pytest.fixture
def client(app):
    with TestClient(app) as c:
        yield c
```

Override the dependency, not the underlying module. Mocking `app.security.get_user_from_token` patches the wrong layer; `dependency_overrides[get_current_user]` patches the layer FastAPI actually invokes.

## DB rollback fixture

```python
@pytest.fixture
async def db_session(test_engine):
    async with test_engine.connect() as conn:
        async with conn.begin() as trans:
            async with AsyncSession(bind=conn, expire_on_commit=False) as session:
                yield session
            await trans.rollback()
```

Each test gets a clean transactional state; no global truncates needed.

## Parametrized routes

```python
@pytest.mark.parametrize("path,expected", [
    ("/items/", 200),
    ("/items/1", 200),
    ("/items/0", 422),   # path validation: ge=1
    ("/items/abc", 422), # type validation
])
def test_routes(client, path, expected):
    assert client.get(path).status_code == expected
```

## Async client + WebSockets

`TestClient` supports WebSockets via `client.websocket_connect`:

```python
def test_ws_echo(client):
    with client.websocket_connect("/ws/lobby") as ws:
        ws.send_json({"hello": "world"})
        assert ws.receive_json() == {"echo": {"hello": "world"}, "room": "lobby"}
```

## Testing auth flows

For routes guarded by `OAuth2PasswordBearer`, two options:

1. **Real flow** — call `/auth/token` to get a token, then attach `Authorization: Bearer ...` to subsequent requests. Verifies the full stack but slow.
2. **Override** — `dependency_overrides[get_current_user] = lambda: FakeUser(...)`. Fast and isolates the unit under test.

Mix both: a single end-to-end happy-path test using the real flow; everything else uses the override.

## Snapshot / contract tests for OpenAPI

Pin your OpenAPI schema to catch unintended drift:

```python
def test_openapi_snapshot(client, snapshot):
    schema = client.get("/openapi.json").json()
    snapshot.assert_match(json.dumps(schema, sort_keys=True, indent=2), "openapi.json")
```

When the schema changes, the test fails — review and accept the new snapshot.

## Anti-patterns

- ❌ Booting Uvicorn in a subprocess for tests — slow, fragile. Use `TestClient` or `AsyncClient(ASGITransport(...))`.
- ❌ Patching `requests`/`httpx` at the module level instead of replacing the dependency.
- ❌ Tests that share state via globals — every test should get a fresh `dependency_overrides` map.
- ❌ Forgetting `with TestClient(app)` → lifespan never runs → `AttributeError: ... has no attribute 'engine'`.
- ❌ Mixing `pytest-asyncio` and `anyio` markers in the same project — pick one.
