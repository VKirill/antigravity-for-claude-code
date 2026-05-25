# Data Modeling: dataclasses, NamedTuple, TypedDict, Pydantic, attrs

Pick by the question, not by habit.

## Decision tree

```
Do you need runtime validation / parsing / serialization?
├── YES → Pydantic (BaseModel)
└── NO  → Are values immutable + small + tuple-like?
          ├── YES → NamedTuple
          └── NO  → Is this purely a type-checker annotation for a dict shape?
                    ├── YES → TypedDict
                    └── NO  → @dataclass (frozen=True for value objects)
```

attrs sits next to dataclass — slightly more features, slightly more ceremony. Pick dataclass for stdlib-only; pick attrs only if you need its specific features (converters, validators without Pydantic, hooks).

## `@dataclass`

Stdlib, idiomatic since 3.7. Generates `__init__`, `__repr__`, `__eq__` from annotated class fields.

```python
from dataclasses import dataclass, field

@dataclass
class Point:
    x: float
    y: float = 0.0

p = Point(1.5, 2.5)
p.x, p.y  # 1.5, 2.5
```

Key options:

```python
@dataclass(
    frozen=True,      # immutable; __hash__ generated
    slots=True,       # __slots__ defined; smaller memory, no __dict__
    kw_only=True,     # keyword-only fields by default
    eq=True,          # __eq__ from fields (default)
    order=False,      # __lt__/__le__/__gt__/__ge__ generated (default False)
)
class Money:
    amount: int       # store in minor units (cents) to avoid float
    currency: str
```

Default factories for mutable defaults (NEVER use `= []` directly):

```python
@dataclass
class Bag:
    items: list[str] = field(default_factory=list)
    metadata: dict[str, object] = field(default_factory=dict)
    _internal: str = field(default="", repr=False, compare=False)
```

`field(...)` options: `default`, `default_factory`, `init`, `repr`, `compare`, `hash`, `metadata`, `kw_only`.

`__post_init__` runs after `__init__` for derived/computed setup:

```python
@dataclass
class Range:
    low: int
    high: int

    def __post_init__(self) -> None:
        if self.low > self.high:
            raise ValueError("low > high")
```

For inheritance with defaults, prefer `kw_only=True` to avoid the "non-default argument follows default argument" error.

## `NamedTuple`

Immutable tuple subclass with field access. Lighter than dataclass; iteration / unpacking works as tuple.

```python
from typing import NamedTuple

class Point(NamedTuple):
    x: float
    y: float

p = Point(1.5, 2.5)
p.x, p[0]                   # both work
x, y = p                    # tuple unpacking
```

**Use when**: values are conceptually a tuple (coordinates, RGB), need hash-equality, want positional access too.
**Don't use when**: shape will grow with optional fields, you need methods beyond `_asdict()/_replace()`, or fields need defaults beyond a few.

## `TypedDict`

Annotates dict shapes at the type-checker level. **Zero runtime cost, zero validation** — it is purely a static-typing construct.

```python
from typing import TypedDict, NotRequired

class User(TypedDict):
    id: int
    name: str
    email: NotRequired[str]      # optional key

u: User = {"id": 1, "name": "Alice"}   # type-checks
u["id"]                                # type: int
```

`total=False` makes all keys optional:

```python
class PartialUser(TypedDict, total=False):
    id: int
    name: str
```

Mixing required and optional: use `NotRequired` / `Required` (PEP 655):

```python
class User(TypedDict):
    id: int                       # required
    email: NotRequired[str]       # optional
```

**Use when**: parsing JSON-shaped dicts where you already trust the source (after Pydantic validation, or stable internal data).
**Don't use when**: input comes from untrusted source — TypedDict will not catch malformed data at runtime.

## Pydantic (when you need runtime validation)

Pydantic is the de facto standard for input validation, settings, and API payloads in modern Python (covered in detail by the `pydantic` skill — this section is the pointer).

```python
from pydantic import BaseModel, Field, field_validator

class User(BaseModel):
    id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=100)
    email: str

    @field_validator("email")
    @classmethod
    def email_must_contain_at(cls, v: str) -> str:
        if "@" not in v:
            raise ValueError("email missing '@'")
        return v

# Validates and parses
u = User(id=1, name="Alice", email="alice@example.com")
u.model_dump()   # dict
u.model_dump_json()  # JSON string
```

**Use when**: external input (HTTP request bodies, env vars, config files, message-queue payloads, untrusted JSON). Pydantic generates JSON Schema, FastAPI ties it to routes, and v2 is Rust-backed and fast.

## attrs (alternative to dataclass)

```python
import attrs

@attrs.define
class Point:
    x: float
    y: float = 0.0

@attrs.define(frozen=True, slots=True)
class Money:
    amount: int = attrs.field(validator=attrs.validators.gt(-1))
    currency: str = attrs.field(validator=attrs.validators.matches_re(r"^[A-Z]{3}$"))
```

Features dataclass lacks: built-in validators, converters (transform at `__init__`), `attrs.evolve()` for safe copy-with-changes, separate slots class.

**Use when**: existing project uses attrs; or you need converters/validators but don't want a full Pydantic dep.
**Don't use when**: stdlib-only constraint — pick dataclass.

## Quick comparison

| | dataclass | NamedTuple | TypedDict | Pydantic | attrs |
|---|---|---|---|---|---|
| Stdlib | ✓ | ✓ | ✓ | ✗ | ✗ |
| Runtime validation | manual via `__post_init__` | ✗ | ✗ | ✓ (built-in) | ✓ (validators) |
| Immutable option | `frozen=True` | always | ✗ (it's a dict) | `model_config = ConfigDict(frozen=True)` | `frozen=True` |
| Slots | `slots=True` | always (tuple) | ✗ | configurable | `slots=True` |
| Inheritance | yes | limited | yes | yes | yes |
| JSON serialization | manual / `dataclasses.asdict()` | `_asdict()` | dict already | `model_dump_json()` | `attrs.asdict()` |
| Best for | internal records | small immutable tuples | dict-shape typing | external input | rich models without Pydantic |

## Anti-patterns

- ❌ `@dataclass` with `= []` or `= {}` as default — mutable default shared across instances; use `field(default_factory=list)`
- ❌ Subclassing `dict` to add type hints — use `TypedDict` (type-checker only) or Pydantic (runtime)
- ❌ Using `NamedTuple` then adding methods — refactor to dataclass; NamedTuple is for tuple-shaped data
- ❌ Pydantic for purely internal types — overhead vs dataclass is real; reserve Pydantic for I/O boundaries
- ❌ TypedDict for external/untrusted input — it does not validate at runtime
- ❌ Manually writing `__init__`/`__repr__`/`__eq__` on a value class — use `@dataclass`
- ❌ Mixing `@dataclass` and `@attrs.define` on different classes in the same project — pick one
