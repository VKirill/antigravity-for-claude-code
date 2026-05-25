# Modern Python Syntax (3.12 → 3.14)

Idiomatic syntax for current Python. Skip features only available pre-3.12 unless explicitly migrating.

## Type parameter syntax (PEP 695, 3.12+)

Replaces the older `TypeVar`/`Generic` pattern with native syntax.

```python
# Modern (3.12+)
def first[T](items: list[T]) -> T:
    return items[0]

class Container[T]:
    def __init__(self, value: T) -> None:
        self.value = value

# Old (still valid, but verbose)
from typing import TypeVar, Generic
T = TypeVar("T")
def first(items: list[T]) -> T: ...
class Container(Generic[T]): ...
```

Bounds and constraints inline:

```python
def max_value[T: (int, float)](items: list[T]) -> T:
    return max(items)

def sort_keys[K: Hashable](d: dict[K, object]) -> list[K]:
    return sorted(d.keys())  # type: ignore[type-var]
```

## `type` statement (PEP 695)

Lazy-evaluated, generic-aware type aliases.

```python
type Vector = list[float]
type Matrix[T] = list[list[T]]
type JSON = dict[str, JSON] | list[JSON] | str | int | float | bool | None
```

Forward references work naturally — the right-hand side is evaluated lazily.

## Deferred annotation evaluation (PEP 649/749, 3.14)

Annotations are stored as deferred-evaluation closures, not evaluated at function-definition time. **You rarely need `from __future__ import annotations` anymore.**

```python
class Tree:
    # No string-quoted "Tree" needed; no __future__ import needed
    parent: Tree | None
    children: list[Tree]
```

To introspect annotations at runtime, use `annotationlib`:

```python
from annotationlib import get_annotations, Format

get_annotations(Tree, format=Format.VALUE)       # evaluates to real types
get_annotations(Tree, format=Format.FORWARDREF)  # unresolved -> ForwardRef
get_annotations(Tree, format=Format.STRING)      # raw source strings
```

## Structural pattern matching (`match` / `case`, 3.10+)

Use for sum-type dispatch, not as a fancy `if/elif`.

```python
def describe(point: object) -> str:
    match point:
        case (0, 0):
            return "origin"
        case (x, 0):
            return f"on x-axis at {x}"
        case (0, y):
            return f"on y-axis at {y}"
        case (x, y) if x == y:
            return f"diagonal at {x}"
        case [x, y, *rest]:
            return f"point with extras: {rest}"
        case {"kind": "circle", "radius": r}:
            return f"circle r={r}"
        case Point(x=x, y=y):
            return f"named point ({x}, {y})"
        case _:
            return "unknown"
```

**Anti-pattern**: matching on values where a dict lookup would do — `match` shines on shape and structure, not equality.

## Walrus operator (`:=`, 3.8+)

Assign-and-test in a single expression.

```python
# Read in chunks
while chunk := file.read(8192):
    process(chunk)

# Avoid recomputing
if (n := len(data)) > 1000:
    print(f"large dataset: {n}")
```

**Anti-pattern**: walrus inside complex expressions — readability tanks.

## f-strings, PEP 701 (3.12+)

f-strings now allow nested quotes, multi-line expressions, and backslashes inside braces.

```python
# All valid in 3.12+
name = "world"
print(f"hello {name.upper()}")
print(f"items: {", ".join(["a", "b", "c"])}")   # same quote inside
print(f"escape: {"line1\nline2"}")
print(f"""
{
  some_long_expression
  .with_chained_calls()
}
""")
```

## Template strings, PEP 750 (3.14+)

The `t""` prefix yields a `Template` object — separate static and interpolated parts for safe-by-default SQL, shell, HTML, etc.

```python
name = "Alice"
template = t"Hello, {name}!"
# Iterates as [static_str, Interpolation(value, expression_str, ...), static_str]
for part in template:
    ...
```

Use t-strings for libraries that need to escape interpolations (SQL parameter binding, HTML escaping). Use f-strings for everyday string formatting.

## `except` / `except*` without parentheses (PEP 758, 3.14+)

```python
try:
    do_io()
except TimeoutError, ConnectionRefusedError:  # no parens
    retry()
```

Stylistic; not breaking.

## Exception groups (PEP 654, 3.11+)

Raise multiple unrelated exceptions concurrently and handle them by type.

```python
try:
    async with asyncio.TaskGroup() as tg:
        tg.create_task(fetch_a())
        tg.create_task(fetch_b())
except* ValueError as eg:
    for e in eg.exceptions:
        log.warning("validation failed", exc_info=e)
except* TimeoutError:
    log.error("at least one task timed out")
```

`except*` always re-raises unhandled groups; matched exceptions are removed from the group.

## Annotated types (`typing.Annotated`)

Attach metadata to a type without changing what the type-checker sees.

```python
from typing import Annotated

UserId = Annotated[int, "primary key"]
Age = Annotated[int, "0 <= age <= 130"]

def greet(user_id: UserId, age: Age) -> str: ...
```

Frameworks (FastAPI, Pydantic) read `Annotated` metadata at runtime to derive validators/parsers.

## `Self` type (PEP 673, 3.11+)

Return-type for builder methods and `__copy__` patterns.

```python
from typing import Self

class Builder:
    def with_x(self, x: int) -> Self:
        self.x = x
        return self

    @classmethod
    def empty(cls) -> Self:
        return cls()
```

Subclasses get the subclass type back automatically — no manual generic gymnastics.

## `override` decorator (PEP 698, 3.12+)

Statically verify that you're overriding a parent method.

```python
from typing import override

class Animal:
    def speak(self) -> str: ...

class Dog(Animal):
    @override
    def speak(self) -> str:  # type-checker errors if `speak` is removed from Animal
        return "woof"
```

## Anti-patterns

- ❌ `from __future__ import annotations` in new 3.14 code — annotations are deferred by default
- ❌ Using `TypeVar`/`Generic` in new 3.12+ code — use PEP 695 syntax
- ❌ Bare `except:` — use `except Exception:` at minimum, ideally specific exception classes
- ❌ `match` for simple equality checks — use `if/elif`
- ❌ Mutable default arguments (`def f(x=[]):`) — use `None` and assign inside
