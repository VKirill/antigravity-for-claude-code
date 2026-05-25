# Field(...)

`Field` declares per-field metadata: defaults, constraints, aliases, JSON-schema info, behavior flags.

## Two forms

```python
from typing import Annotated
from pydantic import BaseModel, Field

class A(BaseModel):
    # default-form (works but couples Field with default semantics)
    name: str = Field(min_length=1, max_length=64, description='Display name')

class B(BaseModel):
    # Annotated form — preferred; metadata stays on the type
    name: Annotated[str, Field(min_length=1, max_length=64, description='Display name')]
    # equivalent and reusable:
    # Name = Annotated[str, Field(min_length=1, max_length=64)]
```

The `Annotated` form lets you alias the constrained type and reuse it. Default values still go on the right side: `name: Annotated[str, Field(min_length=1)] = 'guest'`.

## default vs default_factory

```python
class Item(BaseModel):
    name: str = 'unnamed'
    tags: list[str] = Field(default_factory=list)            # mutable default — must be factory
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    # factory can read already-validated data:
    slug: str = Field(default_factory=lambda data: data['name'].lower())
```

NEVER write `tags: list[str] = []` — Pydantic catches this and raises, because that would share the list across instances.

## Constraints (replacing v1 constr/conint/confloat)

```python
class Account(BaseModel):
    age: Annotated[int, Field(ge=0, le=120)]
    balance: Annotated[float, Field(gt=0, multiple_of=0.01, allow_inf_nan=False)]
    username: Annotated[str, Field(min_length=3, max_length=32, pattern=r'^[a-z_]+$')]
    tags: Annotated[list[str], Field(min_length=1, max_length=10)]
    price: Annotated[Decimal, Field(max_digits=10, decimal_places=2)]
```

| Constraint | Applies to |
|---|---|
| `gt`, `ge`, `lt`, `le` | numeric, datetime |
| `multiple_of` | numeric |
| `allow_inf_nan` | float |
| `min_length`, `max_length` | str, bytes, list, tuple, set, dict |
| `pattern` | str (compiled once) |
| `max_digits`, `decimal_places` | Decimal |
| `strict` | per-field strict override |

## JSON Schema metadata

```python
class User(BaseModel):
    email: Annotated[str, Field(
        title='Email address',
        description='Primary contact email',
        examples=['ada@example.com'],
        json_schema_extra={'format': 'email', 'x-extra': 'whatever'},
    )]
```

`title`, `description`, `examples`, and `json_schema_extra` all flow into `model_json_schema()` output — FastAPI shows them in `/docs`.

## Behavior flags

```python
class Profile(BaseModel):
    id: int = Field(frozen=True)                      # field-level immutability
    raw_password: str = Field(repr=False)             # excluded from repr() output
    legacy_token: str = Field(deprecated='Use bearer instead')
    internal_flag: bool = Field(init=False, default=False)   # not in __init__ signature
    cache_key: str = Field(init_var=True)                    # init-only — not stored
    api_key: str = Field(exclude=True)                       # excluded from model_dump default
    secret: str = Field(exclude_if=lambda v: not v)          # exclude when condition matches
```

- `frozen=True` per-field overrides whole-model `frozen` and locks just that field.
- `exclude=True` always excludes from `model_dump()` and serialization.
- `exclude_if=callable` excludes conditionally on dump time.
- `repr=False` hides from `repr(model)` — use for secrets.
- `deprecated='msg'` emits `DeprecationWarning` on access.
- `init=False` removes the field from `__init__` — must have a default or factory.

## Aliases — full pattern

See [basemodel.md](basemodel.md) "Aliases". Set `populate_by_name=True` on the model when you want both alias and field name accepted on input.

```python
class Webhook(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    event_type: str = Field(alias='eventType')
```

Now `Webhook(event_type='x')` AND `Webhook.model_validate({'eventType': 'x'})` both work.

## Discriminator

For tagged unions:

```python
class Cat(BaseModel):
    kind: Literal['cat']
    meows: int

class Dog(BaseModel):
    kind: Literal['dog']
    barks: float

class Pet(BaseModel):
    animal: Cat | Dog = Field(discriminator='kind')
```

See [discriminated-unions.md](discriminated-unions.md) for full coverage including callable discriminators.

## include / exclude at dump time

Field-level `Field(exclude=True)` is static. For dynamic selection:

```python
user.model_dump(include={'id', 'name'})
user.model_dump(exclude={'password', 'secret'})
user.model_dump(include={'profile': {'name', 'bio'}})   # nested
```

## Union mode

```python
value: int | str = Field(union_mode='left_to_right')   # default 'smart'
```

`smart` tries to pick the best match without ambiguous coercion. `left_to_right` matches v1 behavior — first variant wins.

## fail_fast

```python
ids: list[int] = Field(fail_fast=True)
```

Stop at the first invalid element instead of collecting all errors for the list. Useful for very large arrays in hot paths.
