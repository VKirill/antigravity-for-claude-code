# Type Hints and Mypy

Python's type system is gradual — you can add hints incrementally. In production code, target full coverage at module boundaries; tolerate `Any` only behind explicit walls.

## Core annotations

```python
from typing import Annotated, Final, Literal

count: int = 0
name: str = "alice"
flag: bool = True
maybe_id: int | None = None              # 3.10+ union syntax
ratios: list[float] = [0.5, 0.7]         # built-in generics (3.9+)
mapping: dict[str, int] = {}
labels: tuple[str, ...] = ("a", "b")
exact: tuple[int, str, bool] = (1, "x", True)
pi: Final[float] = 3.14159
mode: Literal["read", "write", "append"] = "read"
```

Prefer `int | None` over `Optional[int]`. Prefer `list[T]` over `List[T]` (the `typing.List` form is now stylistically discouraged).

## Functions

```python
def greet(name: str, *, greeting: str = "hello") -> str:
    return f"{greeting}, {name}"

# Callable type
from collections.abc import Callable
Handler = Callable[[int, str], bool]   # (int, str) -> bool

# Variadic
def log(*args: object, **kwargs: object) -> None: ...
```

## Protocols (structural typing)

`Protocol` defines a shape — any class matching the shape is accepted, no inheritance needed. Use this for duck-typing with type safety.

```python
from typing import Protocol, runtime_checkable

class SupportsClose(Protocol):
    def close(self) -> None: ...

def shutdown(resource: SupportsClose) -> None:
    resource.close()

# Works with any class that has close() — no inheritance from SupportsClose required
class File:
    def close(self) -> None: ...

shutdown(File())  # type-checks
```

`@runtime_checkable` enables `isinstance(obj, SupportsClose)` — but it only checks attribute presence, not signatures. Don't rely on it for safety.

## TypedDict (dict shapes)

`TypedDict` annotates dict shapes without runtime cost — purely a type-checker concept.

```python
from typing import TypedDict, NotRequired

class User(TypedDict):
    id: int
    name: str
    email: NotRequired[str]   # optional key

def render(u: User) -> str:
    return f"{u['name']} ({u['id']})"

# Inline form
Coord = TypedDict("Coord", {"x": float, "y": float})
```

**Use for**: API response shapes, JSON parsing results, kwargs blobs.
**Don't use when**: you need runtime validation — use Pydantic instead.

## Generics (PEP 695 syntax)

```python
# 3.12+ syntax
class Stack[T]:
    def __init__(self) -> None:
        self._items: list[T] = []
    def push(self, item: T) -> None:
        self._items.append(item)
    def pop(self) -> T:
        return self._items.pop()

def first_or_default[T](items: list[T], default: T) -> T:
    return items[0] if items else default
```

Constraints and bounds:

```python
from typing import Hashable

def unique[T: Hashable](items: list[T]) -> set[T]:
    return set(items)

# Multiple constraints — T must be int or str
def parse_id[T: (int, str)](raw: str, kind: type[T]) -> T: ...
```

## ParamSpec (decorator typing)

`ParamSpec` lets decorators preserve the wrapped function's signature.

```python
from typing import Callable
from functools import wraps

def timed[**P, R](fn: Callable[P, R]) -> Callable[P, R]:
    @wraps(fn)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        start = time.perf_counter()
        try:
            return fn(*args, **kwargs)
        finally:
            print(f"{fn.__name__}: {time.perf_counter() - start:.3f}s")
    return wrapper

@timed
def slow_add(a: int, b: int) -> int:
    return a + b

slow_add(1, 2)  # type-checks correctly with (int, int) -> int
```

## Self type

Returns the actual subclass type from builders.

```python
from typing import Self

class QueryBuilder:
    def where(self, cond: str) -> Self:
        self._where.append(cond)
        return self

class UserQueryBuilder(QueryBuilder):
    def by_email(self, email: str) -> Self:  # returns UserQueryBuilder
        return self.where(f"email = '{email}'")
```

## Annotated (metadata)

`Annotated[T, metadata]` lets frameworks read extra info while the type-checker still sees `T`.

```python
from typing import Annotated

# Pydantic v2 / FastAPI dependency
UserId = Annotated[int, "primary key"]
Email = Annotated[str, "RFC 5322"]

def find(user_id: UserId) -> User: ...
```

## `override` decorator

```python
from typing import override

class Base:
    def handle(self, event: Event) -> None: ...

class Derived(Base):
    @override
    def handle(self, event: Event) -> None:  # fails type-check if Base.handle removed/renamed
        super().handle(event)
        self._log(event)
```

## Narrowing patterns

The type-checker narrows after these checks:

```python
def use(x: int | str | None) -> None:
    if x is None:
        return
    # x: int | str
    if isinstance(x, int):
        print(x + 1)  # x: int
    else:
        print(x.upper())  # x: str

# Discriminated union via Literal
class Cat(TypedDict):
    kind: Literal["cat"]
    meow_volume: int

class Dog(TypedDict):
    kind: Literal["dog"]
    bark_volume: int

def describe(pet: Cat | Dog) -> str:
    match pet["kind"]:
        case "cat":
            return f"meow {pet['meow_volume']}"  # narrowed to Cat
        case "dog":
            return f"bark {pet['bark_volume']}"  # narrowed to Dog
```

## Type guards

```python
from typing import TypeGuard

def is_str_list(x: list[object]) -> TypeGuard[list[str]]:
    return all(isinstance(item, str) for item in x)

def join_strs(x: list[object]) -> str:
    if is_str_list(x):
        return ", ".join(x)  # x: list[str]
    raise TypeError
```

## Mypy configuration

In `pyproject.toml`:

```toml
[tool.mypy]
python_version = "3.14"
strict = true                      # enables ~9 strict flags
warn_unreachable = true
warn_return_any = true
show_error_codes = true
pretty = true

# Per-module relaxation
[[tool.mypy.overrides]]
module = "tests.*"
disallow_untyped_defs = false

[[tool.mypy.overrides]]
module = "untyped_lib.*"
ignore_missing_imports = true
```

The `strict = true` flag enables: `disallow_untyped_defs`, `disallow_incomplete_defs`, `check_untyped_defs`, `disallow_untyped_decorators`, `no_implicit_optional`, `warn_redundant_casts`, `warn_unused_ignores`, `warn_return_any`, `no_implicit_reexport`, `strict_equality`, `strict_concatenate`.

## Mypy vs Pyright

| Aspect | mypy | pyright |
|---|---|---|
| Author | Python core team / Dropbox | Microsoft (VS Code Pylance) |
| Language | Python | TypeScript |
| Speed | Slower (incremental cache helps) | Faster on large repos |
| Inference | Conservative | More aggressive narrowing |
| IDE integration | Plugins available | Native via Pylance |
| Default in PEP-driven projects | More common | Rising fast |

Pick **mypy** for CI-first projects with shared config; **pyright** for IDE-first projects with VS Code. Both are valid; don't run both — pick one.

## Anti-patterns

- ❌ Sprinkling `Any` to silence the type-checker — use `object` for "anything" and narrow with `isinstance`
- ❌ `# type: ignore` without an error code — use `# type: ignore[arg-type]` so future fixes uncover the ignore
- ❌ Using `cast()` instead of fixing the actual type
- ❌ Adding `from __future__ import annotations` in 3.14 code — already deferred by default
- ❌ Using `TypeVar`/`Generic` in new 3.12+ code — use PEP 695 syntax
- ❌ Treating `TypedDict` as runtime-validated — it's a type-checker fiction
