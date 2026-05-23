# Async Testing

Install `pytest-asyncio`. It's the dominant plugin for `async def` test functions.

## Modes: strict vs auto

### Strict (default)

Every async test needs `@pytest.mark.asyncio`. Every async fixture needs `@pytest_asyncio.fixture`. Coexists cleanly with other async libraries (e.g., `trio`).

```python
import pytest
import pytest_asyncio

@pytest_asyncio.fixture
async def client():
    async with AsyncClient() as c:
        yield c

@pytest.mark.asyncio
async def test_fetches(client):
    result = await client.get("/api")
    assert result.status_code == 200
```

### Auto

Any `async def test_*` is auto-marked, and `@pytest.fixture` on async functions is auto-handled. Best for projects using only asyncio.

```toml
# pyproject.toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
```

```python
@pytest.fixture
async def client():
    async with AsyncClient() as c:
        yield c

async def test_fetches(client):  # auto-marked
    ...
```

**Always set `asyncio_mode` explicitly** in config — implicit defaults shift between versions.

## loop_scope

By default, every test gets a fresh event loop (function-scoped). Share a loop across a scope with `loop_scope`:

```python
@pytest.mark.asyncio(loop_scope="session")
async def test_uses_session_loop():
    ...

@pytest_asyncio.fixture(loop_scope="session")
async def app_pool():
    pool = await create_pool()
    yield pool
    await pool.close()
```

Loop scope choices: `function`, `class`, `module`, `package`, `session`.

The fixture loop scope must match (or be wider than) the test loop scope that uses it. A `session`-scoped fixture cannot live inside a `function`-scoped loop.

## Async fixtures

```python
@pytest_asyncio.fixture
async def db_session():
    async with AsyncSession(engine) as session:
        yield session
        await session.rollback()
```

`yield` works identically to sync fixtures — the teardown awaits naturally.

## Testing exceptions

```python
@pytest.mark.asyncio
async def test_raises():
    with pytest.raises(TimeoutError):
        await call_with_timeout()
```

`pytest.raises` works inside async tests without modification.

## Mocking async code

```python
from unittest.mock import AsyncMock

@pytest.mark.asyncio
async def test_calls_api(mocker):
    mock = mocker.patch("myapp.api.fetch", new_callable=AsyncMock)
    mock.return_value = {"ok": True}
    result = await myapp.api.call()
    mock.assert_awaited_once()
```

`AsyncMock` is required — `MagicMock` returns a non-awaitable. With `autospec=True` against an async target, pytest-mock substitutes `AsyncMock` automatically.

## anyio — testing both asyncio and trio backends

For libraries supporting both, use `anyio` (not `pytest-asyncio`):

```python
import pytest

pytestmark = pytest.mark.anyio

async def test_works():
    ...

@pytest.fixture(params=["asyncio", "trio"])
def anyio_backend(request):
    return request.param
```

Each test runs once per backend. Install `anyio[trio]` to enable the trio path.

## event_loop fixture (legacy)

Older pytest-asyncio versions exposed an `event_loop` fixture for customizing the loop. In recent versions this approach is deprecated in favor of `loop_scope` on the marker / fixture. Prefer `loop_scope` for new code; only override `event_loop` if you have a concrete need (e.g., custom selector loop) and pin the pytest-asyncio version explicitly.

## Common pitfalls

- **`@pytest.fixture` on `async def` in strict mode**: pytest doesn't await it; the test receives a coroutine, not the awaited value. Use `@pytest_asyncio.fixture` or switch to auto mode.
- **Test hangs forever**: usually a missing `await` on an awaitable, or `pytest-asyncio` not installed. Run with `--timeout=10` (via `pytest-timeout`) to surface.
- **Mixing `pytest-asyncio` and `pytest-anyio`** in one project: pick one. They contest event-loop ownership.
- **Session-scoped async fixture with default loop_scope**: tries to share state across function-scoped loops and crashes. Set `loop_scope="session"` on both fixture and tests.
- **`MagicMock` for `await`-ed target**: `TypeError: object MagicMock can't be used in 'await' expression`. Use `AsyncMock`.
