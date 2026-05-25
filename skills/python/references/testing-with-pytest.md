# Testing with pytest (foundation)

`pytest` is the de facto Python test runner. This page covers the minimum needed for any Python project. A dedicated `pytest` skill (in development) will cover advanced patterns.

## Setup

```bash
uv add --dev pytest pytest-asyncio pytest-cov
```

`pyproject.toml`:

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py", "*_test.py"]
asyncio_mode = "auto"           # treat async def test_* as async tests
addopts = "-ra --strict-markers --strict-config"
markers = [
    "slow: long-running tests",
    "integration: hits real services",
]
```

## Test file layout

```
project/
├── src/
│   └── myproject/
│       ├── __init__.py
│       └── core.py
└── tests/
    ├── conftest.py
    ├── test_core.py
    └── integration/
        └── test_api.py
```

Use `src/` layout — prevents accidentally testing your working tree instead of the installed package.

## Basic tests

```python
# tests/test_core.py
from myproject.core import normalize

def test_normalize_strips_whitespace() -> None:
    assert normalize("  hello  ") == "hello"

def test_normalize_handles_empty() -> None:
    assert normalize("") == ""

def test_normalize_raises_on_none() -> None:
    import pytest
    with pytest.raises(TypeError):
        normalize(None)   # type: ignore[arg-type]
```

Test names: `test_<thing>_<behavior>` is the typical convention; descriptive over short.

## Fixtures

```python
import pytest
from pathlib import Path

@pytest.fixture
def sample_data() -> dict[str, int]:
    return {"a": 1, "b": 2, "c": 3}

def test_uses_fixture(sample_data: dict[str, int]) -> None:
    assert sample_data["a"] == 1

# Scope: function (default), class, module, package, session
@pytest.fixture(scope="session")
def db_connection():
    conn = create_test_db()
    yield conn
    conn.close()
```

`yield`-style fixtures get cleanup for free — code after `yield` runs in teardown.

## conftest.py

Place shared fixtures and hooks at the directory level. Fixtures defined in `conftest.py` are auto-discovered by tests in that directory tree — no import needed.

```python
# tests/conftest.py
import pytest

@pytest.fixture
def tmp_config_dir(tmp_path: Path) -> Path:
    cfg = tmp_path / "config"
    cfg.mkdir()
    return cfg
```

## Parametrize

Run the same test with different inputs:

```python
import pytest

@pytest.mark.parametrize("input_value, expected", [
    ("hello", 5),
    ("", 0),
    ("multi word", 10),
    ("ünïcødé", 7),
])
def test_length(input_value: str, expected: int) -> None:
    assert len(input_value) == expected

# Multiple parametrize → cartesian product
@pytest.mark.parametrize("x", [1, 2, 3])
@pytest.mark.parametrize("y", ["a", "b"])
def test_combo(x: int, y: str) -> None: ...    # 6 test instances
```

For ID labels in test output:

```python
@pytest.mark.parametrize("path", [
    pytest.param("/abs/path", id="absolute"),
    pytest.param("rel/path", id="relative"),
])
def test_path_handling(path: str) -> None: ...
```

## Built-in fixtures

| Fixture | What |
|---|---|
| `tmp_path` | `Path` to per-test temp dir, auto-cleaned |
| `tmp_path_factory` | Session-scoped temp dirs |
| `monkeypatch` | Reversible patching of attrs/env/sys.path |
| `caplog` | Capture log records for assertion |
| `capsys` / `capfd` | Capture stdout/stderr |
| `request` | Access to test context (params, node) |

```python
def test_with_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DEBUG", "1")
    assert os.environ["DEBUG"] == "1"   # restored after test

def test_logs(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.WARNING):
        do_thing()
    assert "expected warning" in caplog.text
```

## Mocking with `unittest.mock`

```python
from unittest.mock import MagicMock, patch, AsyncMock

# Patch by string path
@patch("myproject.core.httpx.get")
def test_fetch(mock_get: MagicMock) -> None:
    mock_get.return_value.json.return_value = {"id": 1}
    result = fetch("/users/1")
    assert result == {"id": 1}
    mock_get.assert_called_once_with("/users/1")

# Async equivalents
@patch("myproject.core.async_fetch", new_callable=AsyncMock)
async def test_async_fetch(mock_fn: AsyncMock) -> None:
    mock_fn.return_value = {"ok": True}
    result = await fetch_remote()
    mock_fn.assert_awaited_once()
```

Prefer `patch` as a context manager or decorator over `patch.object` unless you specifically need to patch an attribute.

For richer mock APIs: `pytest-mock` provides a `mocker` fixture that wraps `unittest.mock`.

## Async tests

With `asyncio_mode = "auto"` in pyproject.toml, every `async def test_*` runs in an event loop:

```python
async def test_fetch_user() -> None:
    user = await api.fetch_user(42)
    assert user.id == 42
```

For fixtures:

```python
import pytest

@pytest.fixture
async def client():
    async with httpx.AsyncClient() as c:
        yield c
```

## Markers

```python
import pytest

@pytest.mark.slow
def test_long_running() -> None: ...

@pytest.mark.skipif(sys.platform == "win32", reason="POSIX only")
def test_unix_path() -> None: ...

@pytest.mark.xfail(reason="known bug #123")
def test_known_failure() -> None: ...
```

Run subsets:

```bash
pytest -m slow                 # only slow tests
pytest -m "not slow"           # exclude slow
pytest -m "integration and not flaky"
```

## Running

```bash
uv run pytest                                # all
uv run pytest tests/test_core.py             # one file
uv run pytest tests/test_core.py::test_normalize_strips_whitespace
uv run pytest -k "normalize and not slow"   # keyword filter
uv run pytest -x                             # stop on first failure
uv run pytest --lf                           # rerun last failures
uv run pytest -v                             # verbose
uv run pytest --cov=src --cov-report=term-missing  # coverage
```

## Coverage

`pytest-cov` wraps `coverage.py`:

```toml
[tool.coverage.run]
source = ["src"]
branch = true

[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "if TYPE_CHECKING:",
    "raise NotImplementedError",
    "\\.\\.\\.",
]
fail_under = 80
```

```bash
uv run pytest --cov=src --cov-report=html
open htmlcov/index.html
```

## Anti-patterns

- ❌ Tests that depend on test execution order — use fixtures for setup, never globals
- ❌ Mocking what you don't own (e.g. mocking stdlib `open`) — use `tmp_path` for filesystem
- ❌ `time.sleep` in tests — use fake time (`freezegun`) or restructure code to inject time
- ❌ `assert obj.method.called` — use `assert_called_once_with(...)` for arg verification
- ❌ Skipping with `pytest.skip("flaky")` instead of fixing — flaky tests rot the suite
- ❌ Sharing state via class attributes or module-level mutable globals — fixtures isolate state
- ❌ Hitting real network/DB in unit tests — push integration tests behind a marker

## Pointer to dedicated pytest skill

A separate `pytest` skill (planned) will cover: plugin architecture, custom markers, advanced parametrization (`pytest_generate_tests`), hypothesis property-based testing, xdist parallelism, fixture composition, Doctest integration, snapshot testing, mocker patterns, and CI gating. This page gives the foundation every Python project needs.
