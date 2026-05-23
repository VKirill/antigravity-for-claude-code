# Mocking

Two paths in the Python ecosystem:

1. **`unittest.mock`** (stdlib) — `patch`, `MagicMock`, used everywhere; verbose decorators / context managers.
2. **`pytest-mock`** `mocker` fixture — thin pytest-native wrapper around `unittest.mock`. Same `MagicMock` underneath, but lifecycle is fixture-managed (auto-teardown).

Use **`mocker`** in pytest code unless you have a specific reason to nest `with patch(...)`.

## unittest.mock — the stdlib path

### As decorator

```python
from unittest.mock import patch

@patch("myapp.service.send_email")
def test_signup_sends_email(mock_send):
    mock_send.return_value = True
    signup("a@b.c")
    mock_send.assert_called_once_with("a@b.c")
```

Patched name is **where it's looked up**, not where it's defined. If `myapp/service.py` does `from emailer import send_email`, then patch `myapp.service.send_email`, not `emailer.send_email`.

Multiple decorators stack in **reverse** of the parameter order:

```python
@patch("myapp.service.db")
@patch("myapp.service.send_email")
def test_signup(mock_send, mock_db):  # innermost first
    ...
```

### As context manager

```python
def test_signup():
    with patch("myapp.service.send_email") as mock_send:
        signup("a@b.c")
        mock_send.assert_called_once_with("a@b.c")
```

### `patch.object` — patch an attribute on a known object

```python
with patch.object(payment_service, "charge", return_value={"ok": True}) as mock_charge:
    process_order(order)
    mock_charge.assert_called_once()
```

Useful when patching by import path is awkward (class methods, instance attributes).

### `patch.dict` — patch a mapping

```python
with patch.dict(os.environ, {"FEATURE_X": "1"}, clear=False):
    ...
```

For env vars in pytest, prefer the `monkeypatch` fixture (`monkeypatch.setenv`) — same effect, fixture-scoped cleanup.

## pytest-mock — the `mocker` fixture

```python
def test_signup(mocker):
    mock_send = mocker.patch("myapp.service.send_email", return_value=True)
    signup("a@b.c")
    mock_send.assert_called_once_with("a@b.c")
```

Equivalents:

| stdlib | pytest-mock |
|---|---|
| `@patch("x")` / `with patch("x")` | `mocker.patch("x")` |
| `patch.object(obj, "attr")` | `mocker.patch.object(obj, "attr")` |
| `patch.dict(d, {...})` | `mocker.patch.dict(d, {...})` |
| `MagicMock()` | `mocker.MagicMock()` |

The `mocker` fixture undoes all patches at test teardown — no need for `addCleanup` or context-manager nesting. Multiple patches stay flat.

### `mocker.spy` — observe without replacing

```python
def test_uses_helper(mocker):
    spy = mocker.spy(myapp.service, "helper")
    do_work()
    spy.assert_called_once_with(42)
    assert spy.spy_return == "result"  # actual return value
```

The real function still runs; the spy records calls. Different from `patch`, which replaces.

## MagicMock essentials

`MagicMock` is a callable that pretends to be anything. Attribute access creates child mocks lazily.

```python
m = MagicMock()
m.foo.bar.baz()              # all auto-created, returns another MagicMock
m.call_count                 # number of times m was called
m.call_args                  # last call: call(args, kwargs)
m.call_args_list             # list of all calls
m.return_value = 42          # what m() returns
m.side_effect = ValueError("nope")  # raise instead
m.side_effect = [1, 2, 3]    # iterate — first call returns 1, second 2, ...
m.side_effect = lambda x: x * 2  # compute from args
```

### Assertions

```python
m.assert_called()                         # called at least once
m.assert_called_once()                    # exactly once
m.assert_called_with(1, 2, key="v")       # last call matched
m.assert_called_once_with(1, 2)           # combined
m.assert_any_call(7)                      # was called with these args at some point
m.assert_not_called()                     # never called
m.assert_has_calls([call(1), call(2)])    # ordered subsequence
```

### `ANY` matcher — don't care about a value

```python
from unittest.mock import ANY

mock_log.assert_called_with("event", user_id=ANY, timestamp=ANY)
```

## autospec — enforce signature

Plain `Mock` accepts any method name and any args — typos pass silently. `autospec=True` introspects the target and rejects wrong calls:

```python
with patch("myapp.service.User", autospec=True) as MockUser:
    MockUser(name="A")           # ok — matches real signature
    MockUser(badarg=1)           # TypeError at call time
```

Or `spec=ClassName` / `spec_set=ClassName` for strict attribute access. **Always use `autospec=True`** unless there's a specific reason not to.

```python
mocker.patch("myapp.service.User", autospec=True)
```

## side_effect patterns

```python
# Raise an exception
mock.side_effect = TimeoutError("network")

# Different return per call
mock.side_effect = [{"id": 1}, {"id": 2}, StopIteration]

# Compute from args
def fake_compute(x, y):
    if x < 0:
        raise ValueError("negative")
    return x + y
mock.side_effect = fake_compute
```

If `side_effect` is set, `return_value` is ignored unless `side_effect` returns `mock.DEFAULT`.

## Async mocking

`MagicMock()` doesn't return an awaitable. Use `AsyncMock`:

```python
from unittest.mock import AsyncMock

mock_fetch = mocker.patch("myapp.api.fetch", new_callable=AsyncMock)
mock_fetch.return_value = {"ok": True}

result = await call_api()
mock_fetch.assert_awaited_once()
```

`AsyncMock` provides `.assert_awaited()`, `.assert_awaited_with(...)`, `.await_count`. When patching with `autospec=True`, async functions get `AsyncMock` automatically.

## Common pitfalls

- **Patching the wrong namespace**: see "where it's looked up" above. The #1 source of "why doesn't my patch take effect."
- **`Mock()` for async target**: missing `AsyncMock` means awaiting `MagicMock()` returns a `MagicMock` instead of the configured value.
- **Forgetting `autospec=True`**: tests pass on misspelled method names. Always autospec.
- **Asserting on `.called` (truthy) instead of `.assert_called_once()`**: weaker check, hides multiple-call bugs.
- **Reusing a `MagicMock` across tests**: state leaks. With `mocker`, this is impossible (fixture-scoped); with raw `patch`, use `reset_mock()` or recreate.
