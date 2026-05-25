# Async and Concurrency

Three concurrency models in Python — pick by workload, not by habit.

| Workload | Use |
|---|---|
| I/O-bound (network, disk, DB) | `asyncio` (or threading for legacy sync libs) |
| CPU-bound (math, parsing) | `multiprocessing` or the free-threaded build (PEP 703) |
| Many cores + isolated state | `concurrent.interpreters` (PEP 734, 3.14+) |
| Mixed | `asyncio` + `run_in_executor` for sync calls |

## asyncio fundamentals

```python
import asyncio

async def fetch(url: str) -> str:
    # ... awaitable I/O
    await asyncio.sleep(0.1)
    return "ok"

async def main() -> None:
    result = await fetch("https://example.com")
    print(result)

asyncio.run(main())  # entry point — exactly one per program
```

Rules:
- `async def` defines a coroutine; calling it returns a coroutine object, doesn't run it
- `await` runs a coroutine and yields control to the event loop on I/O
- `asyncio.run()` is the entrypoint — never call it from within an already-running loop
- The event loop is implicit; you rarely need `asyncio.get_event_loop()` (deprecated for top-level use)

## Structured concurrency: `TaskGroup` (PEP 654, 3.11+)

`TaskGroup` is the **2026 default** for spawning concurrent tasks. It guarantees all tasks complete (or all are cancelled together) before the `async with` block exits.

```python
async def main() -> None:
    async with asyncio.TaskGroup() as tg:
        a = tg.create_task(fetch("https://a.com"))
        b = tg.create_task(fetch("https://b.com"))
    # both done here; exceptions collected into ExceptionGroup
    print(a.result(), b.result())
```

If any task raises, all sibling tasks are cancelled, and the exceptions surface as an `ExceptionGroup`:

```python
try:
    async with asyncio.TaskGroup() as tg:
        tg.create_task(might_fail())
        tg.create_task(also_runs())
except* ValueError as eg:
    for e in eg.exceptions:
        log.warning("validation", exc_info=e)
except* TimeoutError as eg:
    log.error("timeout")
```

**Prefer `TaskGroup` over `asyncio.gather()`** for most concurrent fan-out. Use `gather` only when:
- You need `return_exceptions=True` to keep going on partial failure without using `except*`
- You're targeting Python ≤ 3.10 (no TaskGroup)

## `asyncio.gather` (older idiom)

```python
results = await asyncio.gather(
    fetch("a"),
    fetch("b"),
    return_exceptions=True,   # return exceptions instead of raising
)
for r in results:
    if isinstance(r, Exception):
        log.warning("fetch failed", exc_info=r)
    else:
        process(r)
```

Without `return_exceptions=True`, the first failing task raises, others continue in the background (potentially leaking).

## Timeouts

```python
async with asyncio.timeout(5.0):                    # 3.11+ context manager
    result = await fetch("https://slow.example")

# OR per-call
try:
    result = await asyncio.wait_for(fetch("..."), timeout=5.0)
except asyncio.TimeoutError:
    ...
```

Prefer `async with asyncio.timeout()` — composes with cancellation correctly.

## Cancellation

```python
task = asyncio.create_task(long_running())
await asyncio.sleep(1)
task.cancel()
try:
    await task
except asyncio.CancelledError:
    pass
```

Inside a task, **never swallow `CancelledError`**:

```python
async def worker() -> None:
    try:
        await long_io()
    except asyncio.CancelledError:
        # cleanup, then re-raise
        await release_resources()
        raise
```

Swallowing `CancelledError` is the #1 reason `TaskGroup`/`timeout` "hangs".

## Mixing sync and async

To call a sync function from async without blocking the loop:

```python
result = await asyncio.to_thread(blocking_function, arg1, arg2)
```

`to_thread` (3.9+) runs the call in the default thread executor. Use for legacy sync I/O libs (psycopg2, requests, file I/O on slow disks).

To call an async function from sync code:

```python
result = asyncio.run(my_async_fn())   # if no loop running
# inside an existing event loop, you cannot start another — restructure to be async
```

## anyio bridge

`anyio` lets the same library work on both asyncio and Trio backends. Used by FastAPI, httpx, and others.

```python
import anyio

async def main() -> None:
    async with anyio.create_task_group() as tg:
        tg.start_soon(do_work, 1)
        tg.start_soon(do_work, 2)

anyio.run(main)
```

If your library is async, accept that consumers may use Trio; depend on `anyio` instead of raw `asyncio` to support both.

## Threading

For CPU-light, blocking-IO-bound work where rewriting to async is impractical:

```python
import threading
from concurrent.futures import ThreadPoolExecutor

with ThreadPoolExecutor(max_workers=8) as pool:
    futures = [pool.submit(blocking_fn, x) for x in inputs]
    results = [f.result() for f in futures]
```

Threads share memory but contend for the GIL — only one runs Python bytecode at a time (in standard CPython builds). GIL releases on I/O (network, file, C extensions that release it), so threads are still useful for I/O parallelism. In **free-threaded** builds (3.13 experimental, 3.14 officially supported per PEP 779), the GIL is gone — threads can run true parallel Python.

## Multiprocessing

For CPU-bound work in standard CPython builds:

```python
from concurrent.futures import ProcessPoolExecutor

def heavy(x: int) -> int:
    return x * x

with ProcessPoolExecutor() as pool:
    results = list(pool.map(heavy, range(1_000_000)))
```

Each worker is a separate Python process — no GIL contention but full process overhead (memory, IPC pickling). Functions passed to `ProcessPoolExecutor` must be importable (top-level, not nested or lambdas).

## Subinterpreters (PEP 734, 3.14+)

`concurrent.interpreters` exposes subinterpreters from Python. Each has its own GIL; share data via `memoryview`-backed primitives.

```python
from concurrent.interpreters import Interpreter

interp = Interpreter()
interp.exec("import math; result = math.sqrt(16)")
```

Use for CPU-bound work with lighter overhead than processes, once you've verified your extension modules are subinterpreter-safe (many are not yet).

## Free-threaded Python (PEP 703 / 779)

In a free-threaded build (`python3.14t` / `--disable-gil`), the GIL is removed. Threads run truly in parallel. Trade-off: ~5–10% single-thread slowdown vs default build (improvement vs 3.13).

Check at runtime:

```python
import sys
print(sys._is_gil_enabled())  # False in free-threaded build
```

Adopt cautiously: many C extensions are not yet free-threaded-safe. Watch the package metadata `Free-threaded` tag.

## Anti-patterns

- ❌ Calling `asyncio.run()` from within an already-running loop — raises `RuntimeError`; use `await`
- ❌ `time.sleep()` inside `async def` — blocks the entire event loop; use `await asyncio.sleep()`
- ❌ Blocking I/O (requests, psycopg2, open()) inside `async def` without `to_thread` — same as above
- ❌ Swallowing `CancelledError` — breaks cancellation and timeouts; always re-raise after cleanup
- ❌ Mixing `gather(...)` results with non-async callables — `gather` only accepts awaitables
- ❌ Storing coroutines without awaiting them — they leak; `RuntimeWarning: coroutine was never awaited`
- ❌ Creating tasks with `asyncio.create_task()` and discarding the reference — task may be garbage-collected mid-flight (use `TaskGroup` instead)
- ❌ Using threads for CPU-bound work in standard CPython — GIL prevents parallelism; use multiprocessing or free-threaded build
- ❌ Using `multiprocessing` for I/O-bound work — way more overhead than threads or async
