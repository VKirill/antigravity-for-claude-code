# Discriminated Unions

Tagged unions where each variant carries a literal discriminator field. Pydantic dispatches on the tag in O(1) instead of trying each variant in turn — faster, with cleaner error messages.

## When to use

Always prefer a discriminated union over a plain `Union[A, B, C]` when:

- Each variant has a field with a known literal value (`'kind': 'cat'`, `'type': 'login'`).
- You care about precise error paths (`pet.dog.barks` vs. ambiguous `pet`).
- The union has 3+ members or grows over time.
- LLM structured outputs — the discriminator becomes a JSON Schema `discriminator` keyword that helps the model emit the right variant.

## Basic pattern — string Field discriminator

```python
from typing import Literal, Union
from pydantic import BaseModel, Field

class Cat(BaseModel):
    kind: Literal['cat']
    meows: int

class Dog(BaseModel):
    kind: Literal['dog']
    barks: float

class Lizard(BaseModel):
    kind: Literal['lizard', 'reptile']
    scales: bool

class Owner(BaseModel):
    pet: Union[Cat, Dog, Lizard] = Field(discriminator='kind')

Owner(pet={'kind': 'dog', 'barks': 3.14})
# Owner(pet=Dog(kind='dog', barks=3.14))
```

The variant's discriminator field must be `Literal[...]`. Multiple values per variant (`Literal['lizard', 'reptile']`) are allowed.

### Error path quality

```python
try:
    Owner(pet={'kind': 'dog'})
except ValidationError as e:
    e.errors()
    # [{'type': 'missing', 'loc': ('pet', 'dog', 'barks'), ...}]
```

The `loc` includes the resolved variant (`'dog'`) — much better debugging than a generic `Union` failure dump.

## Callable Discriminator + Tag

When variants disagree on the discriminator field name (legacy formats, third-party APIs), use a callable.

```python
from typing import Annotated, Any, Literal, Union
from pydantic import BaseModel, Discriminator, Tag

class Cat(BaseModel):
    pet_type: Literal['cat']
    age: int

class Dog(BaseModel):
    pet_kind: Literal['dog']      # different field name!
    age: int

def detect(v: Any) -> str | None:
    if isinstance(v, dict):
        return v.get('pet_type', v.get('pet_kind'))
    return getattr(v, 'pet_type', getattr(v, 'pet_kind', None))

class Owner(BaseModel):
    pet: Annotated[
        Union[
            Annotated[Cat, Tag('cat')],
            Annotated[Dog, Tag('dog')],
        ],
        Discriminator(detect),
    ]

Owner.model_validate({'pet': {'pet_type': 'cat', 'age': 3}})
Owner.model_validate({'pet': {'pet_kind': 'dog', 'age': 5}})
```

Every union arm MUST carry a `Tag('value')` matching what `detect` returns. Forgetting a tag raises `PydanticUserError(code='callable-discriminator-no-tag')`.

## Nesting & state machines

```python
class Pending(BaseModel):
    state: Literal['pending']
    submitted_at: datetime

class Approved(BaseModel):
    state: Literal['approved']
    approved_by: str
    approved_at: datetime

class Rejected(BaseModel):
    state: Literal['rejected']
    reason: str
    rejected_at: datetime

OrderState = Annotated[
    Union[Pending, Approved, Rejected],
    Field(discriminator='state'),
]

class Order(BaseModel):
    id: int
    state: OrderState
```

The `Annotated[..., Field(discriminator='state')]` form lets you alias the union and reuse it.

## JSON Schema output

```python
Order.model_json_schema()
# Includes:
# {
#   "$defs": {...},
#   "properties": {
#     "state": {
#       "discriminator": {"propertyName": "state", "mapping": {...}},
#       "oneOf": [{"$ref": "#/$defs/Pending"}, ...]
#     }
#   }
# }
```

OpenAPI and JSON Schema validators understand `discriminator.propertyName` — clients can route based on it. LLMs given the schema as a tool definition (Claude, OpenAI structured outputs) emit valid variants more reliably.

## Performance

Quoting the Pydantic perf docs: "Use a discriminator field in unions to improve validation performance." For unions of 5+ variants on hot paths, the speedup is significant — Pydantic skips trying each variant against the input.

## Bare Union when no tag exists

```python
class Owner(BaseModel):
    pet: Union[Cat, Dog]   # no discriminator
```

Pydantic tries each in declaration order under default `union_mode='smart'`. Slower, ambiguous errors. Acceptable only when no literal tag field exists across the variants AND the variants are structurally distinct.

## Anti-pattern

```python
# WRONG — kind isn't Literal
class Cat(BaseModel):
    kind: str
    meows: int

class Owner(BaseModel):
    pet: Union[Cat, Dog] = Field(discriminator='kind')   # raises PydanticUserError
```

Pydantic checks at class-creation time. The discriminator field must be `Literal[...]` (or have a single static value) for every variant.
