# Performance

Profile before optimizing. Most "Python is slow" complaints are about the wrong code path.

## The GIL (Global Interpreter Lock)

Standard CPython holds one **Global Interpreter Lock** — only one thread executes Python bytecode at a time. The GIL releases on:

- I/O (network, file, OS calls)
- Long-running C extension code that releases it (NumPy, SciPy, requests' C parts, hashlib, ...)
- Explicit `time.sleep()`

So multi-threading is **still useful for I/O-bound workloads** (network calls in parallel, etc.). The GIL only blocks CPU-bound Python-bytecode workloads from scaling across cores in the default build.

## Free-threaded Python (PEP 703 / PEP 779)

CPython 3.13 introduced an experimental free-threaded build (no GIL). **In 3.14 this is officially supported** (PEP 779). With `python3.14t` (the `t` suffix marks free-threaded builds) or `--disable-gil`, threads run truly in parallel.

Trade-off: ~5–10% single-thread slowdown vs the standard build (improved from ~10–15% in 3.13). Many C extensions still need adaptation — check the package's `Free-threaded` classifier or test in your specific environment.

Detect at runtime:

```python
import sys
if hasattr(sys, "_is_gil_enabled") and not sys._is_gil_enabled():
    print("free-threaded")
```

## JIT compiler (PEP 744)

CPython 3.13 shipped an experimental copy-and-patch JIT. 3.14 ships JIT support in Windows/macOS binary releases as an opt-in. The JIT is a low-overhead, non-tracing JIT — modest gains, mostly invisible. Don't restructure code for it; treat it as free speed.

Subinterpreters (PEP 734, 3.14) and the tail-call interpreter (3.14) further chip away at "Python is slow" — each typically adds 3–5% on its own.

## Profiling — measure first

### `cProfile` — call counts

```bash
uv run python -m cProfile -o profile.out -s cumtime myscript.py
uv run python -m pstats profile.out
# then: sort cumtime; stats 25
```

Or programmatically:

```python
import cProfile, pstats

with cProfile.Profile() as pr:
    expensive_function()

ps = pstats.Stats(pr).sort_stats("cumtime")
ps.print_stats(20)
```

cProfile is a deterministic profiler — measures every call, can slow code 2–10x. Good for finding "where is time spent" overall.

### `py-spy` — sampling profiler

```bash
uv tool install py-spy
py-spy record -o flame.svg --pid $(pgrep -f myscript.py)
py-spy top --pid <PID>             # live top-style view
```

py-spy samples the running process from outside — near-zero overhead, no code changes, attaches to a running process. Best tool for production diagnosis.

### `scalene` — CPU + memory + GPU line-level

```bash
uv tool install scalene
scalene myscript.py
```

Scalene shows per-line CPU, memory allocation, and GPU usage in a single web report. Best when you have a hotspot and need to understand "which line allocates / which line spins".

### `tracemalloc` — memory snapshots

```python
import tracemalloc

tracemalloc.start()
do_thing()
snapshot = tracemalloc.take_snapshot()
top_stats = snapshot.statistics("lineno")
for stat in top_stats[:10]:
    print(stat)
```

## Memory profiling

| Tool | Use |
|---|---|
| `tracemalloc` (stdlib) | Per-line allocation snapshots |
| `memray` | Sampling allocation tracker, flamegraphs, leaks |
| `objgraph` | Visualize object reference cycles |
| `psutil` | Process-level RSS / VMS |

For leaks: `memray run --leaks myscript.py` then inspect the flamegraph.

## When to optimize Python

**Don't**:
- "I want it fast" — profile first
- Premature micro-optimization (e.g., local-name caching)
- Switching to `numpy` for tiny arrays — overhead dominates

**Do**:
- Replace nested Python loops over large arrays with NumPy/Polars/Pandas operations
- Push hot loops to Cython, Numba, mypyc, or Rust via PyO3 only when measurements show benefit
- Use generators / `itertools` for memory-bound stream processing instead of materializing lists
- Cache function results (`functools.cache`/`lru_cache`) when call patterns repeat
- Use `__slots__` (or `@dataclass(slots=True)`) to cut per-instance memory for many-instance classes

## CPython speed paths

| Choice | Speed implication |
|---|---|
| `dict[k]` | O(1) hash lookup |
| `list[i]` | O(1) index, O(n) insert at front |
| `set` membership | O(1) — vs O(n) for list |
| `deque` | O(1) appends/pops on both ends |
| `tuple` literal | Slightly faster construction than `list`; immutable |
| Comprehensions | Faster than `for + append` (less bytecode) |
| `str.join` | O(n); never `s += x` in a loop (quadratic) |
| `f""` strings | Faster than `%` and `.format()` |

## CPU-bound parallelism options

```
Workload nature        →  Tool
─────────────────────────────────────────────
Pure Python CPU, std build   →  ProcessPoolExecutor / multiprocessing
Pure Python CPU, free-threaded build  →  ThreadPoolExecutor (real parallelism)
Numeric arrays              →  NumPy / Polars / SciPy (vectorized)
Tight numeric kernels       →  Numba @njit / Cython / mypyc / Rust via PyO3
GPU-friendly numeric work   →  CuPy / cuda-python / PyTorch
Isolated state per worker   →  concurrent.interpreters (3.14, PEP 734)
```

## NumPy/Polars/Pandas — the big lever

For numeric and tabular work, Python-level loops are 100–1000x slower than vectorized libraries. A NumPy operation on a 1M-element array typically takes microseconds; the Python `for` equivalent takes seconds.

Don't optimize Python loops — replace them with array operations. The dedicated `pandas`, `polars`, `pytorch`, `cuda-python` skills cover these.

## C extensions / native code

| Tool | Notes |
|---|---|
| **Cython** | Compile Python-ish source to C; mature, broad ecosystem |
| **Numba** | `@njit` JIT-compile numeric Python; great for NumPy hot loops |
| **mypyc** | Compile typed Python to C; used internally by mypy |
| **PyO3** | Write Rust extensions; modern alternative to C |
| **pybind11** | Bind existing C++ libraries |

Pick once, stick with it. Mixing Cython + Numba in one project adds cognitive load.

## Asyncio performance

- `asyncio.run()` starts a fresh loop — fine for entrypoints, slow if you call it 1000x in a loop
- `asyncio.gather()` and `TaskGroup` are similar in raw throughput; pick by structured-concurrency needs
- Watch out for synchronous calls inside `async def` — they block the entire event loop
- For CPU-bound work inside async: `await asyncio.to_thread(cpu_fn, ...)` or restructure

## Anti-patterns

- ❌ Optimizing without profiling — guesses are usually wrong
- ❌ Replacing `for` with `map()` for "speed" — both are similar; `map` is lazier, not faster
- ❌ Using `multiprocessing` for I/O-bound work — way more overhead than threads or async
- ❌ Using threads for CPU-bound work in standard CPython — GIL prevents parallel bytecode
- ❌ `str += x` in a loop — quadratic; use `"".join(parts)` or `io.StringIO`
- ❌ Materializing into a list when a generator suffices — wastes memory on large streams
- ❌ Reading the whole file with `read()` when iterating line-by-line works — same
- ❌ Assuming `numpy` is always faster — for arrays under ~100 elements, overhead beats Python-level operations
- ❌ Adding Cython/Numba/Rust before measuring — most code is fast enough; native bindings are deployment overhead
