# Troubleshooting

Symptom-indexed common Python failures with the typical fix.

## `ModuleNotFoundError` vs `ImportError`

- `ModuleNotFoundError: No module named 'foo'` — package isn't installed (or isn't on `sys.path`)
- `ImportError: cannot import name 'X' from 'foo'` — package is installed but `X` doesn't exist there

```python
import foo                # ModuleNotFoundError → install: uv add foo
from foo import bar       # ImportError → wrong symbol name or wrong version
```

**Fix steps**:
1. Verify the venv is active: `which python` should point inside `.venv/bin/python` (or use `uv run`)
2. `uv sync` to ensure lockfile is installed
3. `uv pip list` to confirm package is present
4. If installed in another venv: check `sys.path` — `python -c "import sys; print(sys.path)"`
5. For installed-but-wrong-API: `uv pip show foo` to see the version, compare to docs

## Circular imports

Two modules import each other, one fails:

```
ImportError: cannot import name 'User' from partially initialized module 'models'
(most likely due to a circular import)
```

**Fixes** (in order of preference):
1. **Restructure** — extract the shared type into a third module; both A and B import from it
2. **Move the import** — push the cross-module import into the function body, executed when needed:
   ```python
   def use_b():
       from .b import B   # imported lazily
       return B()
   ```
3. **TYPE_CHECKING guard** — for type-only imports, defer evaluation:
   ```python
   from typing import TYPE_CHECKING
   if TYPE_CHECKING:
       from .b import B   # only for type-checkers, not runtime
   ```

## Venv pollution / wrong interpreter

Symptom: `pip install x` succeeds, but `python -c "import x"` fails.

Causes:
- Two Python installs; `pip` and `python` point to different ones
- Global system-site-packages bleeding through
- `.venv` not activated

**Fix**:
```bash
which python
which pip
python --version
pip --version
# These should all reference the same venv
```

With `uv`: always use `uv run python` or `uv pip install` — uv resolves the right interpreter automatically. Never call bare `pip install` outside a venv.

## Encoding errors

```
UnicodeDecodeError: 'utf-8' codec can't decode byte 0xff in position 0: invalid start byte
UnicodeEncodeError: 'charmap' codec can't encode character '☃' in position 0
```

**Cause**: `open()` without `encoding=` falls back to a platform default — `utf-8` on macOS/Linux, but `cp1252` on Windows.

**Fix**: always specify encoding:

```python
text = Path("data.txt").read_text(encoding="utf-8")
with open("out.txt", "w", encoding="utf-8") as f:
    f.write(content)
```

For unknown encoding inputs: `chardet` (slower, third-party) or read as bytes and detect.

PYTHONUTF8=1 (or `python -X utf8=1`) forces UTF-8 mode globally and is recommended on Windows.

## `RuntimeError: asyncio.run() cannot be called from a running event loop`

You called `asyncio.run()` from inside an `async def` or from a context that already has a running loop (Jupyter, IPython, Streamlit).

**Fix**: just `await` the coroutine inside async context:

```python
# WRONG
async def main():
    asyncio.run(sub_async_fn())   # nested loop

# RIGHT
async def main():
    await sub_async_fn()
```

In Jupyter: most async functions can be awaited at cell top-level directly (Jupyter runs them on the existing loop).

## Coroutine never awaited

```
RuntimeWarning: coroutine 'fetch' was never awaited
```

You called an async function but didn't `await` it:

```python
# WRONG — creates a coroutine, doesn't run it
result = fetch_user(42)

# RIGHT
result = await fetch_user(42)
```

In a test context, add `pytest-asyncio` and ensure `asyncio_mode = "auto"` (or mark test with `@pytest.mark.asyncio`).

## Mutable default argument

```python
# WRONG — list shared across all calls!
def add(item, bag=[]):
    bag.append(item)
    return bag

add(1)   # [1]
add(2)   # [1, 2]  ← surprise!
```

**Fix**:

```python
def add(item, bag=None):
    if bag is None:
        bag = []
    bag.append(item)
    return bag
```

Ruff rule `B006` catches this.

## `KeyError` on dict access

```python
d = {"a": 1}
d["b"]    # KeyError: 'b'
```

**Fix options**:

```python
d.get("b")          # None if missing
d.get("b", 0)       # default
d.setdefault("b", 0)  # set if missing, then return
from collections import defaultdict
d = defaultdict(int)   # auto-creates 0 on access
```

## `AttributeError: 'NoneType' object has no attribute X`

You're operating on something that came back `None`. Trace upstream — usually a function that returns `None` on missing data:

```python
user = find_user(id)        # returns User | None
print(user.name)            # AttributeError if user is None

# Fix
if user is None:
    raise NotFoundError(...)
print(user.name)
```

With strict typing (`mypy --strict`, `noUncheckedIndexedAccess`-equivalent flags), the type-checker catches this before runtime.

## GIL deadlocks / threading hangs

Symptom: a multi-threaded Python program with C extensions hangs or deadlocks.

Causes:
- C extension acquires a non-Python lock while holding the GIL, another thread waits for the GIL
- Recursive lock acquisition without `RLock`
- Fork after threads have been started — child process inherits locks in unknown state

**Fixes**:
- Use `RLock` for recursive locking
- Avoid `os.fork()` after starting threads; use `multiprocessing` with `spawn` start method (default on macOS/Windows; set explicitly on Linux: `multiprocessing.set_start_method("spawn")`)
- Profile with `py-spy dump --pid <PID>` to see where threads are stuck

## Slow imports

Top-level imports run at startup. A slow third-party import adds latency to every CLI invocation.

```bash
python -X importtime myscript.py 2>&1 | sort -k2 -n -r | head -20
```

Lazy-import inside the function that needs them:

```python
def render_pdf():
    import weasyprint   # heavy import, defer until needed
    ...
```

PEP 690 lazy imports (Cinder / Meta proposal) — not yet in CPython.

## SIGPIPE / `BrokenPipeError`

Piping output to `head`, `less`, etc., closes the pipe before your program finishes:

```bash
python myscript.py | head     # BrokenPipeError: [Errno 32] Broken pipe
```

**Fix**:

```python
import signal
signal.signal(signal.SIGPIPE, signal.SIG_DFL)   # default: silent exit on closed pipe
```

(POSIX only; on Windows this scenario doesn't apply.)

## `RecursionError: maximum recursion depth exceeded`

```python
sys.setrecursionlimit(10_000)   # tactical bump; not a real fix
```

**Real fix**: convert recursion to iteration, or use an explicit stack. Deep recursion is rarely a win in Python — frames are heavy.

## `AssertionError` in production

`assert` statements are stripped when running with `python -O` or `PYTHONOPTIMIZE=1`. If you ever ran production code under `-O` and your invariants relied on `assert`, they silently disappeared.

**Fix**: never use `assert` for runtime validation; use real exceptions:

```python
# WRONG
assert user_id > 0, "user_id must be positive"

# RIGHT
if user_id <= 0:
    raise ValueError("user_id must be positive")
```

Reserve `assert` for tests and developer-only invariants where stripping is OK.

## Long-running process memory growth

Python's allocator returns memory to the OS conservatively. Real leaks show up as monotonic growth across cycles. Diagnose with:

- `tracemalloc.take_snapshot()` at intervals; diff snapshots
- `memray run --live myscript.py` for sampled live view
- `gc.get_objects()` and `objgraph.show_growth()` to find growing object types

Common culprits: caches without bounds (`functools.cache` instead of `lru_cache`), circular references with `__del__` methods, large objects held by closures.

## When stuck

1. Re-read the traceback bottom-up — Python tells you where the failure originated
2. Confirm your Python version (`python --version`) and venv (`which python`)
3. `uv sync` to ensure deps match the lockfile
4. Minimum reproducer — strip code to the smallest failing case
5. Search the exact exception message; many failures have well-known causes
