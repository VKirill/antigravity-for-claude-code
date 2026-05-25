# Stdlib Essentials

Python's standard library covers most everyday needs. Reach for these before adding a dependency.

## `pathlib` — filesystem

Replace all string-based path manipulation with `Path`. Cross-platform, composable, type-safe.

```python
from pathlib import Path

cwd = Path.cwd()
home = Path.home()
config = Path("~/.config/myapp/conf.toml").expanduser()

# Joining
data_file = Path("data") / "raw" / "events.json"
log_path = Path("/var/log") / "myapp" / f"{date}.log"

# Existence and type
data_file.exists()
data_file.is_file()
data_file.is_dir()

# Read / write text
text = data_file.read_text(encoding="utf-8")
data_file.write_text(text, encoding="utf-8")

# Bytes
raw = data_file.read_bytes()

# Iteration
for log in Path("logs").glob("*.log"):
    process(log)

for f in Path(".").rglob("*.py"):    # recursive
    print(f.relative_to(Path.cwd()))

# Components
p = Path("/var/log/app.log")
p.name      # "app.log"
p.stem      # "app"
p.suffix    # ".log"
p.parent    # PosixPath('/var/log')
p.parts     # ('/', 'var', 'log', 'app.log')

# Operations
p.mkdir(parents=True, exist_ok=True)
p.unlink(missing_ok=True)
p.rename(new_path)
```

## `itertools` — iteration

Combinatorial and composition helpers, all lazy.

```python
import itertools as it

# Chain iterables
list(it.chain([1, 2], [3, 4]))         # [1, 2, 3, 4]

# Group consecutive items by key
for key, group in it.groupby(sorted_items, key=lambda x: x.category):
    print(key, list(group))

# Cartesian product
for x, y in it.product(range(3), repeat=2): ...

# Combinations / permutations
list(it.combinations("abc", 2))        # [('a','b'),('a','c'),('b','c')]
list(it.permutations("abc", 2))        # 6 permutations

# Sliding pairs (3.10+)
list(it.pairwise([1, 2, 3, 4]))        # [(1,2),(2,3),(3,4)]

# Take N
first_10 = list(it.islice(infinite_stream(), 10))

# Batched (3.12+)
for batch in it.batched([1,2,3,4,5,6,7], 3):
    print(batch)   # (1,2,3) (4,5,6) (7,)
```

## `functools` — composition

```python
from functools import cache, lru_cache, partial, reduce, wraps

# Memoize
@cache                      # unbounded; use when input space is small
def fib(n: int) -> int:
    return n if n < 2 else fib(n - 1) + fib(n - 2)

@lru_cache(maxsize=128)     # bounded
def expensive(x: int) -> int: ...

# Partial application
add5 = partial(operator.add, 5)
add5(10)   # 15

# Decorator preserving metadata
def timed(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        ...
    return wrapper

# Reduce
total = reduce(operator.add, [1, 2, 3, 4])  # 10 — but sum() is clearer
```

## `collections` — data structures

```python
from collections import Counter, defaultdict, deque, ChainMap, OrderedDict

# Counter — count occurrences, math operations on multisets
votes = Counter(ballots)
votes.most_common(3)            # top 3
votes + Counter(other_votes)    # combined

# defaultdict — supply factory for missing keys
groups: defaultdict[str, list[int]] = defaultdict(list)
for item in items:
    groups[item.category].append(item.value)

# deque — O(1) append/pop on both ends; use for queues
buffer: deque[str] = deque(maxlen=1000)   # bounded ring buffer
buffer.append(msg)
oldest = buffer.popleft()

# ChainMap — look up across multiple mappings
config = ChainMap(cli_args, env_vars, defaults)
config["database_url"]    # checks cli_args first, then env, then defaults
```

`OrderedDict` is rarely needed — dicts maintain insertion order since 3.7.

## `json` — serialization

```python
import json

# Parse
data = json.loads(text)               # str → object
data = json.load(fp)                  # file → object

# Serialize
text = json.dumps(data, indent=2, ensure_ascii=False)
json.dump(data, fp, indent=2, ensure_ascii=False)

# Custom types
from datetime import datetime
def default(o: object) -> object:
    if isinstance(o, datetime):
        return o.isoformat()
    raise TypeError

json.dumps({"now": datetime.now()}, default=default)
```

`ensure_ascii=False` avoids `\u` escapes for non-ASCII characters. For performance-sensitive serialization, use `orjson` or `msgspec`.

## `datetime` and `zoneinfo` — time

```python
from datetime import datetime, date, time, timedelta, UTC
from zoneinfo import ZoneInfo

# Always timezone-aware
now_utc = datetime.now(tz=UTC)
now_msk = datetime.now(tz=ZoneInfo("Europe/Moscow"))

# Conversion
in_paris = now_utc.astimezone(ZoneInfo("Europe/Paris"))

# Parsing
dt = datetime.fromisoformat("2026-05-16T12:30:00+00:00")

# Arithmetic
deadline = now_utc + timedelta(days=7, hours=2)
elapsed = end - start                 # timedelta

# Components
today = date.today()
yesterday = today - timedelta(days=1)
```

**Never use naive `datetime.now()` or `datetime.utcnow()`** (the latter is deprecated). Always pass `tz=...`.

## `os` and `sys`

```python
import os, sys

os.environ.get("MY_VAR", "default")   # env var
os.cpu_count()                         # logical CPUs
os.getpid()

sys.argv                               # CLI args (use argparse / typer instead)
sys.exit(1)                            # raises SystemExit
sys.path                               # import search path
sys.platform                           # 'linux' / 'darwin' / 'win32'
sys.version_info >= (3, 14)
```

For env var validation, parse with Pydantic Settings or `os.environ["X"]` (raises on missing).

## `subprocess` — running commands

```python
import subprocess

# Run, check, capture
result = subprocess.run(
    ["git", "status", "--porcelain"],
    check=True,
    capture_output=True,
    text=True,
    timeout=10,
)
print(result.stdout)

# Stream output
proc = subprocess.Popen(["long-running-cmd"], stdout=subprocess.PIPE, text=True)
for line in proc.stdout:
    print(line, end="")
```

**Never** `shell=True` on untrusted input — RCE vector. Pass commands as a list. If you must use a shell, sanitize with `shlex.quote`.

## `logging` — structured output

Configure once at module entry:

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

log = logging.getLogger(__name__)
log.info("user logged in", extra={"user_id": 42})
log.exception("operation failed")    # includes traceback (inside except)
```

For production JSON logs, use `structlog` or `python-json-logger`. **Never `print()` in library code** — `print` can't be silenced, redirected, or leveled.

## CLI tools

| Tool | When |
|---|---|
| `argparse` (stdlib) | Simple CLIs, zero deps |
| `click` | Mature, decorator-based, group commands |
| `typer` | Type-hints-driven, built on click, ergonomic for modern code |

```python
# argparse — stdlib
import argparse
parser = argparse.ArgumentParser()
parser.add_argument("path", type=Path)
parser.add_argument("--verbose", action="store_true")
args = parser.parse_args()

# typer — recommended for new typed CLIs
import typer
app = typer.Typer()

@app.command()
def hello(name: str, count: int = 1) -> None:
    for _ in range(count):
        typer.echo(f"hello {name}")

if __name__ == "__main__":
    app()
```

For a richer terminal UI (tables, progress, prompts), pair with `rich` (often used alongside typer/click).

## Other useful stdlib

| Module | Purpose |
|---|---|
| `re` | Regex (use raw strings: `r"\d+"`) |
| `secrets` | Cryptographically-secure random (tokens, IDs) — never `random` for security |
| `hashlib` | SHA-256, HMAC; `hashlib.sha256(b"x").hexdigest()` |
| `hmac` | Constant-time comparison: `hmac.compare_digest(a, b)` |
| `base64` | Encoding (urlsafe variants for tokens) |
| `uuid` | `uuid.uuid4()` random ID; `uuid.uuid7()` time-ordered (3.14+ preview via 3rd-party) |
| `tomllib` | Read TOML (3.11+); writing still needs `tomli-w` |
| `dataclasses` | Covered in `dataclasses-and-data.md` |
| `enum` | `class Color(Enum): RED = 1`; `StrEnum` (3.11+) for str-valued |
| `contextlib` | Covered in `error-handling.md` |
| `concurrent.futures` | `ThreadPoolExecutor`, `ProcessPoolExecutor` |
| `asyncio` | Covered in `async-and-concurrency.md` |
| `urllib.parse` | URL encode/decode/join |
| `csv` | Stream-friendly CSV reader/writer |
| `sqlite3` | Embedded SQL DB; built in |
| `inspect` | Introspect functions, classes, frames |
| `weakref` | Weak references for caches |
| `tempfile` | `TemporaryDirectory`, `NamedTemporaryFile` |

## Anti-patterns

- ❌ String-concatenating paths — use `Path` and `/`
- ❌ `open("file.txt")` without `encoding=` — picks platform default; always specify `encoding="utf-8"`
- ❌ Using `print` in library code — use `logging`
- ❌ `subprocess.run(cmd, shell=True)` with user input — RCE
- ❌ `random` for security tokens — use `secrets`
- ❌ `datetime.now()` without `tz=` — silently naive; will compare incorrectly with aware datetimes
- ❌ `==` for HMAC/secret comparison — timing-attack-prone; use `hmac.compare_digest`
- ❌ Manual JSON escaping for SQL/HTML — use a parser, not regex
