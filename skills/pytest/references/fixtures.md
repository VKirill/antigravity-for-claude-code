# Fixtures

`@pytest.fixture` provides test inputs and tears them down deterministically. Fixtures resolve by name match between the test signature and the fixture function.

## Basic shape

```python
import pytest

@pytest.fixture
def user():
    return {"id": 1, "name": "Alice"}

def test_user_name(user):
    assert user["name"] == "Alice"
```

## yield + cleanup

```python
@pytest.fixture
def temp_db():
    db = create_db()
    yield db
    db.close()  # runs after the test, even on failure
```

Anything after `yield` runs in the finalizer. Use `try/finally` inside the fixture only if you need to handle teardown errors specifically — `yield` already guarantees cleanup runs.

## Scopes

| Scope | Lifetime |
|---|---|
| `function` (default) | Re-created for every test that requests it |
| `class` | Shared across methods of a class |
| `module` | Shared across tests in a file |
| `package` | Shared across tests in a package |
| `session` | One instance for the entire `pytest` invocation |

```python
@pytest.fixture(scope="session")
def db_engine():
    engine = create_engine(TEST_DSN)
    yield engine
    engine.dispose()
```

**Rule of thumb**: start at `function`; promote only when measurements show fixture setup dominates runtime. Wider scope = more cross-test coupling risk.

## autouse

```python
@pytest.fixture(autouse=True)
def reset_logger():
    yield
    logging.getLogger().handlers.clear()
```

Applies to every test in the fixture's scope without being requested by name. Use sparingly — most autouse fixtures are better as explicit requests, because the test signature documents what state matters.

## conftest.py inheritance

A fixture in `tests/conftest.py` is available to every test under `tests/`. A fixture with the same name in `tests/subdir/conftest.py` overrides it for tests below. This is how layered fixtures (e.g., `client` overridden per-module to swap auth) work.

## Built-in fixtures

| Fixture | What it gives |
|---|---|
| `tmp_path` | `pathlib.Path` to a unique per-test temp dir |
| `tmp_path_factory` | Session-scoped factory for shared temp dirs |
| `monkeypatch` | Reversible env/attr patching: `monkeypatch.setenv("KEY", "v")` |
| `capsys` | Captures stdout/stderr; `captured = capsys.readouterr()` |
| `capfd` | Like `capsys` but at file-descriptor level (subprocesses) |
| `caplog` | Captures log records; `caplog.records`, `caplog.set_level(logging.DEBUG)` |
| `request` | Introspection: `request.node`, `request.param`, `request.config` |
| `pytestconfig` | Access to the parsed config object |
| `recwarn` | Captures warnings issued during a test |

## Factory pattern

When tests need multiple variants of the same object, return a callable:

```python
@pytest.fixture
def make_user():
    def _make(name="Alice", role="member"):
        return {"id": uuid.uuid4(), "name": name, "role": role}
    return _make

def test_admin_can_delete(make_user):
    admin = make_user(name="Boss", role="admin")
    member = make_user()
    assert can_delete(admin, member)
```

Cleaner than per-shape fixtures (`admin_user`, `member_user`, ...) once you need three or more variants.

## Parametrized fixtures

A fixture with `params=[...]` produces one downstream test per param:

```python
@pytest.fixture(params=["sqlite", "postgres"])
def db(request):
    engine = create_engine(DSN_BY_BACKEND[request.param])
    yield engine
    engine.dispose()

def test_query(db):  # runs twice: sqlite + postgres
    assert db.execute("SELECT 1").scalar() == 1
```

`ids=["sqlite", "postgres"]` gives stable test IDs (otherwise pytest auto-generates).

## indirect parametrization

Route a `@pytest.mark.parametrize` param through a fixture instead of injecting directly:

```python
@pytest.fixture
def user(request):
    return User.objects.get(id=request.param)

@pytest.mark.parametrize("user", [1, 42, 99], indirect=True)
def test_user_active(user):
    assert user.is_active
```

`indirect=True` for all params; `indirect=("user",)` to be selective when multiple params exist.

## The `request` fixture

Every fixture can take `request` to introspect the call site:

- `request.param` — current param when fixture is parametrized
- `request.node` — the current test item (item.name, item.nodeid)
- `request.config` — `pytestconfig`
- `request.addfinalizer(callable)` — alternative to `yield` for cleanup

## Fixture finalization order

Finalizers run **LIFO** within a scope. If `db` fixture depends on `engine`, `db` tears down before `engine` — matches construction order in reverse.

## Common pitfalls

- **Mutable session-scoped fixture**: one test mutates it, the next test sees the mutation. Either narrow the scope or make the fixture return a fresh copy per use.
- **Fixture not found**: usually a `conftest.py` is in the wrong directory or a typo in the fixture name. Use `pytest --fixtures` to list everything visible.
- **`autouse=True` + class scope** on a fixture defined at module scope: applies to *every* class. Limit autouse fixtures to the smallest scope that makes sense.
