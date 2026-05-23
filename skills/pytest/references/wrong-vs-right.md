# Wrong vs Right — Common pytest Mistakes

Side-by-side fixes for the patterns that bite new pytest users hardest.

## 1. Mocking the wrong import path

### Wrong

```python
# myapp/service.py
from emailer import send_email

def signup(email):
    send_email(email)

# tests/test_service.py
@patch("emailer.send_email")          # patches the source, not the import
def test_signup(mock_send):
    signup("a@b.c")
    mock_send.assert_called_once()    # FAILS — real send_email was called
```

### Right

```python
@patch("myapp.service.send_email")     # patches where it's LOOKED UP
def test_signup(mock_send):
    signup("a@b.c")
    mock_send.assert_called_once()
```

**Rule**: patch at the import site (`module.symbol_used_there`), not the definition site.

---

## 2. Mocking too deep

### Wrong

```python
# Patching deep into a third-party lib's internals
mocker.patch("requests.adapters.HTTPAdapter.send")
mocker.patch("urllib3.connectionpool.HTTPConnectionPool._make_request")
```

You're testing requests + urllib3, not your code. Brittle: any version bump breaks the test.

### Right

```python
# Mock your own boundary
mocker.patch("myapp.http_client.fetch", return_value={"ok": True})
```

Or use `pytest-httpx` to mock at the protocol level:

```python
def test_call(httpx_mock):
    httpx_mock.add_response(json={"ok": True})
    assert call_api() == {"ok": True}
```

**Rule**: mock your collaborator's public surface, not its internals.

---

## 3. Mocking the thing under test

### Wrong

```python
def test_compute_score(mocker):
    mocker.patch("myapp.scoring.compute_score", return_value=42)
    assert myapp.scoring.compute_score(user) == 42   # tests the mock
```

The mock IS the test. Nothing is verified.

### Right

```python
def test_compute_score():
    user = make_user(activity=100, age_days=30)
    assert compute_score(user) == 42   # exercises the real function
```

Mock only the function's **dependencies**, never the function itself.

---

## 4. Fixture scope mismatch

### Wrong

```python
@pytest.fixture(scope="session")
def db():
    return create_test_db()

def test_insert_user(db):
    db.insert({"name": "A"})        # mutates session-scoped DB
    assert db.count() == 1

def test_insert_order(db):
    db.insert({"name": "B"})
    assert db.count() == 1          # FAILS — DB has 2 rows
```

Session scope + mutable state = order-dependent tests.

### Right

```python
@pytest.fixture
def db():                            # function-scoped
    db = create_test_db()
    yield db
    db.drop_all()
```

Or, for performance:

```python
@pytest.fixture(scope="session")
def engine():
    return create_engine(...)

@pytest.fixture
def db(engine):                      # fresh transaction per test
    with engine.begin() as conn:
        yield conn
        conn.rollback()
```

**Rule**: scope matches lifetime of independence. Mutable state defaults to `function`.

---

## 5. Sharing mutable state between tests

### Wrong

```python
# tests/test_cache.py
_cache = {}

def test_set():
    _cache["x"] = 1
    assert _cache["x"] == 1

def test_isolation():
    assert "x" not in _cache         # FAILS when run after test_set
```

### Right

```python
@pytest.fixture
def cache():
    return {}

def test_set(cache):
    cache["x"] = 1
    assert cache["x"] == 1

def test_isolation(cache):
    assert "x" not in cache          # always passes
```

**Rule**: no module-level mutable state in tests. Always go through a fixture.

---

## 6. Time-dependent tests without freeze

### Wrong

```python
def test_token_not_expired():
    token = create_token()
    assert not token.expired()       # works today, fails in 30 days
```

### Right

```python
def test_token_not_expired(freezer):
    freezer.move_to("2026-01-01")
    token = create_token()
    freezer.move_to("2026-01-15")
    assert not token.expired()

def test_token_expired(freezer):
    freezer.move_to("2026-01-01")
    token = create_token()           # 30-day TTL
    freezer.move_to("2026-02-15")
    assert token.expired()
```

**Rule**: any test that reads "now" needs frozen time.

---

## 7. Async test forgetting `await`

### Wrong

```python
@pytest.mark.asyncio
async def test_fetch():
    result = fetch_data()             # missing await
    assert result["ok"]               # AttributeError on coroutine
```

### Right

```python
@pytest.mark.asyncio
async def test_fetch():
    result = await fetch_data()
    assert result["ok"]
```

Symptom: `AttributeError: 'coroutine' object has no attribute 'X'` + `RuntimeWarning: coroutine 'fetch_data' was never awaited`.

**Rule**: every `async def` call in the test body needs `await` (or `asyncio.create_task`).

---

## 8. Sync mock for async target

### Wrong

```python
def test_call(mocker):
    mocker.patch("myapp.api.fetch", return_value={"ok": True})

@pytest.mark.asyncio
async def test_uses_api():
    result = await myapp.api.fetch()   # TypeError: MagicMock not awaitable
```

### Right

```python
from unittest.mock import AsyncMock

@pytest.mark.asyncio
async def test_uses_api(mocker):
    mocker.patch("myapp.api.fetch", new_callable=AsyncMock,
                 return_value={"ok": True})
    result = await myapp.api.fetch()
    assert result == {"ok": True}
```

Or:

```python
mocker.patch("myapp.api.fetch", autospec=True)   # AsyncMock auto-selected
```

**Rule**: async target → `AsyncMock` (or `autospec=True` against a real async function).

---

## 9. Bare `pytest.raises(Exception)`

### Wrong

```python
def test_signup_fails():
    with pytest.raises(Exception):    # too broad — catches anything
        signup(invalid_payload)
```

A typo (`signp(...)`) raises `NameError`, which `Exception` catches. Test passes without testing.

### Right

```python
def test_signup_fails():
    with pytest.raises(ValidationError, match="email is required"):
        signup({"name": "A"})         # missing email
```

**Rule**: narrowest exception type + `match=` regex on the message.

---

## 10. `assert mock.called` instead of explicit assertion

### Wrong

```python
mocker.patch("myapp.service.log")
do_work()
assert myapp.service.log.called       # truthy check, hides multi-call bugs
```

If `log` is called 17 times by accident, the test still passes.

### Right

```python
mock_log = mocker.patch("myapp.service.log")
do_work()
mock_log.assert_called_once_with("event_x", user_id=ANY)
```

**Rule**: prefer `assert_called_once_with`, `assert_called_with`, `assert_has_calls`. Use `assert_not_called` for negative assertions.

---

## 11. `==` for floats

### Wrong

```python
def test_average():
    assert average([0.1, 0.2, 0.3]) == 0.2   # FAILS — float math
```

### Right

```python
def test_average():
    assert average([0.1, 0.2, 0.3]) == pytest.approx(0.2)
    # with tolerance:
    assert average([1.0, 2.0]) == pytest.approx(1.5, rel=1e-6)
```

**Rule**: `pytest.approx` for floats; `Decimal` if exact semantics matter.

---

## 12. `autouse` for non-invariant setup

### Wrong

```python
@pytest.fixture(autouse=True)
def admin_user():
    return User(role="admin")         # applied to every test, even those that don't want admin
```

Coupling: a test signing up as a member also gets an admin created.

### Right

```python
@pytest.fixture
def admin_user():
    return User(role="admin")

def test_admin_can_delete(admin_user):  # explicit consumption
    ...
```

**Rule**: `autouse=True` only when the fixture is truly always-applicable (e.g., DB rollback, log capture).
