# Strict vs Lax & TypeAdapter

Pydantic v2 defaults to LAX validation — strings coerce to ints, ISO strings coerce to `date`, etc. This matches v1 and matches what most HTTP / form / env input looks like. Strict mode rejects coercion.

## Lax (default)

```python
class M(BaseModel):
    n: int
    d: date

M.model_validate({'n': '123', 'd': '2026-05-16'})    # OK — coerced
```

## Strict

Four ways, narrowest to broadest:

```python
# 1. Per-call override
M.model_validate({'n': '123'}, strict=True)            # raises

# 2. Per-field via Field
class M(BaseModel):
    n: int = Field(strict=True)

# 3. Per-field via Annotated[Strict]
from pydantic import Strict
class M(BaseModel):
    n: Annotated[int, Strict()]

# 4. Whole-model via ConfigDict
class M(BaseModel):
    model_config = ConfigDict(strict=True)
    n: int
```

When all four conflict, **per-call beats per-field beats per-model**.

## JSON parsing exception

```python
TypeAdapter(date).validate_python('2026-05-16', strict=True)   # raises
TypeAdapter(date).validate_json('"2026-05-16"', strict=True)   # OK
```

JSON input has no native `date` / `Decimal` / `UUID` types — strings are the only carrier. Pydantic always parses them from JSON, even in strict mode. Use `validate_json` for JSON wires; reserve `validate_python` strict mode for in-process trust boundaries.

## When to use strict

- Internal service boundaries where caller controls the type (other Python services, agent tools producing typed JSON).
- Pipeline stages where coercion would silently mask a bug ("we received a string, kept going").
- Numeric ID fields where `'42'` from a malformed client is a data quality issue, not a normal case.
- LLM-generated tool args — when the LLM is supposed to emit a number, accept only numbers.

When to leave lax: HTTP request bodies parsed from query / form / multipart, env var loading, anywhere strings-to-numbers are the norm.

## TypeAdapter — validate anything

`TypeAdapter` wraps any type (including non-BaseModel types) and exposes the validation / dump / schema API.

```python
from pydantic import TypeAdapter

# Lists
adapter = TypeAdapter(list[int])
adapter.validate_python(['1', '2', '3'])    # [1, 2, 3]
adapter.validate_json('[1, 2, 3]')           # [1, 2, 3]
adapter.dump_python([1, 2, 3])               # [1, 2, 3]
adapter.dump_json([1, 2, 3])                 # b'[1,2,3]'
adapter.json_schema()                        # {'items': {'type': 'integer'}, 'type': 'array'}

# List of models
from pydantic import BaseModel
class Item(BaseModel):
    id: int

items = TypeAdapter(list[Item]).validate_python([{'id': 1}, {'id': 2}])
# [Item(id=1), Item(id=2)]

# TypedDict
from typing import TypedDict
class User(TypedDict):
    name: str
    age: int

users = TypeAdapter(list[User]).validate_python([{'name': 'a', 'age': 1}])

# Dataclass
from pydantic.dataclasses import dataclass
@dataclass
class Foo:
    f: int

TypeAdapter(Foo).validate_python({'f': 1})
TypeAdapter(Foo).dump_python(Foo(f=1))

# Plain int with constraints
PositiveInt = Annotated[int, Field(gt=0)]
TypeAdapter(PositiveInt).validate_python(5)
```

## TypeAdapter performance — instantiate ONCE

The single biggest perf trap: building a `TypeAdapter` per call.

```python
# WRONG — rebuilds schema on every call
def parse_items(raw: bytes) -> list[Item]:
    return TypeAdapter(list[Item]).validate_json(raw)

# RIGHT — build once at module scope
_items_adapter = TypeAdapter(list[Item])

def parse_items(raw: bytes) -> list[Item]:
    return _items_adapter.validate_json(raw)
```

Schema construction is the expensive step. The Rust-backed validator is the fast step. If you see Pydantic showing up high in a flame graph, this is almost always why.

## TypeAdapter vs RootModel

| Need | Pick |
|---|---|
| One-off validation of `list[X]` / `dict[K, V]` | `TypeAdapter` |
| Named, importable validator class with attached validators | `RootModel` |
| FastAPI response model returning a top-level list | `RootModel` (FastAPI requires a model class) |
| Validating in a script / library where the schema is internal | `TypeAdapter` |

## strict + JSON together

```python
TypeAdapter(int).validate_python('42', strict=True)   # raises
TypeAdapter(int).validate_json('42', strict=True)     # 42 (number in JSON)
TypeAdapter(int).validate_json('"42"', strict=True)   # raises (string in JSON)
```

JSON parsing relaxes only string→date / string→UUID / string→Decimal — pure number/int/float coercion stays strict if you ask for it.

## Smart vs left-to-right union mode

```python
class M(BaseModel):
    value: int | str = Field(union_mode='left_to_right')
```

Default `'smart'` picks the variant whose validator best matches the input — `value=1` stays int, `value='a'` stays str. `'left_to_right'` is the v1 behavior — first variant that parses wins (can be ambiguous: `1` parses as both int and str).
