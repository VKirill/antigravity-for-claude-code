# Error Handling

Exceptions are the only sanctioned signaling mechanism for failure. Build a small hierarchy, chain causes, never use bare `except:`.

## Exception hierarchy

Python's built-in tree (abridged):

```
BaseException
├── KeyboardInterrupt
├── SystemExit
├── GeneratorExit
└── Exception                  ← catch-all for "real" errors
    ├── ArithmeticError
    │   ├── ZeroDivisionError
    │   └── OverflowError
    ├── AttributeError
    ├── LookupError
    │   ├── IndexError
    │   └── KeyError
    ├── NameError
    │   └── UnboundLocalError
    ├── OSError                ← FileNotFoundError, PermissionError, etc.
    ├── RuntimeError
    │   └── RecursionError
    ├── TypeError
    ├── ValueError
    │   └── UnicodeError
    ├── StopIteration / StopAsyncIteration
    ├── TimeoutError
    ├── ImportError
    │   └── ModuleNotFoundError
    └── ExceptionGroup         ← 3.11+ for batched failures
```

**Catch `Exception`, never `BaseException`**. Catching `BaseException` swallows `KeyboardInterrupt`/`SystemExit` and stops Ctrl-C from working.

## Custom exception hierarchy

Build a small hierarchy rooted at one domain exception. Other code catches by category, not by every leaf.

```python
class AppError(Exception):
    """Base for all application errors."""

class NotFoundError(AppError):
    """A required resource doesn't exist."""

class ValidationError(AppError):
    """User-supplied input is invalid."""

class ExternalServiceError(AppError):
    """Upstream service failed."""

class TimeoutError_(ExternalServiceError):
    """Upstream service didn't respond in time."""

# Callers:
try:
    user = fetch_user(user_id)
except NotFoundError:
    return 404
except ValidationError as e:
    return 400, {"error": str(e)}
except AppError:
    return 500
```

Rules of thumb:
- Inherit from `Exception`, not `BaseException`
- Group by handling strategy, not implementation detail
- 3–7 concrete error types per domain is usually enough; resist the urge to subclass for every code path

## Exception chaining (`raise ... from`)

When wrapping a lower-level exception, preserve the cause:

```python
try:
    response = httpx.get(url, timeout=5)
    response.raise_for_status()
except httpx.HTTPError as e:
    raise ExternalServiceError(f"upstream {url} failed") from e
```

`from e` sets `__cause__` and shows "The above exception was the direct cause of..." in the traceback. Use `from None` to suppress the original (rarely needed; intentional only).

```python
try:
    process(data)
except ValueError:
    raise ValidationError("bad input") from None   # suppress technical detail
```

## `ExceptionGroup` and `except*` (PEP 654)

Concurrent or batched failures can produce multiple unrelated exceptions. `ExceptionGroup` packages them; `except*` matches by type and surfaces handled subgroups.

```python
import asyncio

async def main() -> None:
    try:
        async with asyncio.TaskGroup() as tg:
            tg.create_task(fetch_a())
            tg.create_task(fetch_b())
            tg.create_task(fetch_c())
    except* TimeoutError as eg:
        log.error("timeouts: %s", eg.exceptions)
    except* ValidationError as eg:
        for e in eg.exceptions:
            log.warning("validation", exc_info=e)
```

You can raise `ExceptionGroup` manually:

```python
def validate_all(items: list[dict]) -> None:
    errors = []
    for item in items:
        try:
            validate(item)
        except ValidationError as e:
            errors.append(e)
    if errors:
        raise ExceptionGroup("validation failures", errors)
```

## `contextlib` patterns

`@contextmanager` for ad-hoc context managers:

```python
from contextlib import contextmanager

@contextmanager
def temporary_log_level(level: int):
    old = logging.getLogger().level
    logging.getLogger().setLevel(level)
    try:
        yield
    finally:
        logging.getLogger().setLevel(old)

with temporary_log_level(logging.DEBUG):
    do_thing()
```

`ExitStack` for dynamic context manager composition:

```python
from contextlib import ExitStack

with ExitStack() as stack:
    files = [stack.enter_context(open(p)) for p in paths]
    process_all(files)
```

`suppress` to swallow specific exceptions:

```python
from contextlib import suppress

with suppress(FileNotFoundError):
    os.remove(stale_path)
```

`closing` for objects with `close()` but no `__enter__/__exit__`:

```python
from contextlib import closing

with closing(legacy_resource()) as r:
    r.use()
```

## `try / except / else / finally`

```python
try:
    result = risky_operation()
except SpecificError as e:
    handle(e)
    # if you can't recover, re-raise (with or without wrapping)
    raise
except Exception as e:
    # broad catch only at outer boundaries (HTTP handler, CLI main)
    log.exception("unexpected")
    raise AppError("internal") from e
else:
    # ran only if no exception
    commit(result)
finally:
    # always runs (cleanup)
    cleanup()
```

Use `else` to clearly separate "this happens only on success" from "this happens always" — it shrinks the `try` block to just the line that could raise.

## PEP 765 — control flow in `finally` (3.14)

Python 3.14 emits a `SyntaxWarning` when `return`, `break`, or `continue` exits a `finally` block. This **swallows in-flight exceptions silently** and is almost always a bug.

```python
# WRONG — eats the exception
def lookup(key):
    try:
        return cache[key]
    finally:
        return None     # ← SyntaxWarning in 3.14: any exception is dropped

# RIGHT
def lookup(key):
    try:
        return cache[key]
    except KeyError:
        return None
```

## Logging exceptions

Always log with traceback context:

```python
import logging
log = logging.getLogger(__name__)

try:
    do_thing()
except Exception:
    log.exception("do_thing failed")    # includes stack
    raise
```

`log.exception(...)` is `log.error(..., exc_info=True)` — call it inside an `except` block.

## Custom error context

Attach context to exceptions for richer logs without losing the type:

```python
class AppError(Exception):
    def __init__(self, message: str, **context: object) -> None:
        super().__init__(message)
        self.context = context

raise AppError("user not found", user_id=42, tenant="acme")
```

Or use the `add_note()` method (PEP 678, 3.11+):

```python
try:
    process(item)
except ProcessingError as e:
    e.add_note(f"while processing item {item.id}")
    raise
```

## Sentinel return vs exception

Exceptions for exceptional conditions; explicit return values for expected outcomes.

```python
# Expected: "not found" is normal
def find_user(user_id: int) -> User | None: ...

# Exceptional: missing config = startup failure
def load_config() -> Config:
    if not Path("config.toml").exists():
        raise FileNotFoundError("config.toml required")
```

When in doubt: if the caller has a sensible default for failure, return `None` / sentinel. If failure means stop the operation, raise.

## Anti-patterns

- ❌ Bare `except:` — catches `KeyboardInterrupt`, `SystemExit`; use `except Exception:` at worst
- ❌ `except Exception: pass` — silent failure; at minimum `log.exception("...")`
- ❌ `assert` for runtime validation — stripped by `python -O`; use real exceptions
- ❌ `raise Exception("msg")` — too generic; use a specific subclass or your own
- ❌ Re-wrapping without `from`: `raise NewError("wrapped")` drops the original cause — always `raise NewError(...) from e`
- ❌ Catching errors you can't handle — let them bubble; the outer handler logs once
- ❌ `return` / `break` / `continue` in a `finally` block — silently eats exceptions (warned in 3.14)
- ❌ Returning error codes — Pythonic style raises; only use sentinels (`None`, `-1`) for genuinely-expected misses
- ❌ Subclassing `BaseException` for application errors — always use `Exception`
