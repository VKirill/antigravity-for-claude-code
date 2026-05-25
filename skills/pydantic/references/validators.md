# Validators

Pydantic v2 ships four mechanisms: `@field_validator`, `@model_validator`, `Annotated` validators (`AfterValidator` / `BeforeValidator` / `WrapValidator` / `PlainValidator`), and `@computed_field`. The `@validator` and `@root_validator` decorators from v1 are removed.

## @field_validator

Per-field hook with explicit `mode=`.

```python
from typing import Self
from pydantic import BaseModel, field_validator, ValidationInfo

class User(BaseModel):
    name: str
    age: int

    @field_validator('name', mode='after')
    @classmethod
    def strip_and_check(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError('name must not be empty')
        return v

    @field_validator('age', mode='before')
    @classmethod
    def parse_age(cls, v: object) -> object:
        if isinstance(v, str) and v.endswith('y'):
            return int(v[:-1])
        return v
```

**Modes**:

| Mode | Receives | Returns | Use for |
|---|---|---|---|
| `'after'` (default) | already-coerced value of declared type | same type | Constraint checks, normalization (strip, lowercase) |
| `'before'` | raw input (any type) | anything (will be re-validated) | Pre-parsing custom formats, type sniffing |
| `'wrap'` | raw input + handler callable | anything | Pre + post hooks around default validation, error recovery |
| `'plain'` | raw input | final value (NO further validation) | Full replacement of validation — terminates the chain |

Always write `@field_validator(...)` then `@classmethod` immediately below — the decorator order matters.

### Multiple fields, wildcard

```python
@field_validator('first_name', 'last_name', mode='after')
@classmethod
def title_case(cls, v: str) -> str:
    return v.title()

@field_validator('*', mode='before')
@classmethod
def strip_all_strings(cls, v: object) -> object:
    return v.strip() if isinstance(v, str) else v
```

### Accessing other fields via info.data

```python
@field_validator('end_date', mode='after')
@classmethod
def end_after_start(cls, end: date, info: ValidationInfo) -> date:
    start = info.data.get('start_date')
    if start and end < start:
        raise ValueError('end_date must be ≥ start_date')
    return end
```

`info.data` contains fields validated BEFORE this one (declaration order). For cross-field invariants involving fields validated AFTER, use `@model_validator(mode='after')` instead.

### info attributes

| Attribute | Description |
|---|---|
| `info.data` | Dict of already-validated fields (field validators only) |
| `info.context` | User context passed via `Model.model_validate(data, context={...})` |
| `info.mode` | `'python'` \| `'json'` \| `'strings'` |
| `info.field_name` | Current field name (field validators only) |
| `info.config` | The active `ConfigDict` |

## @model_validator

Whole-model hook.

```python
from typing_extensions import Self
from pydantic import BaseModel, model_validator

class Reservation(BaseModel):
    start: datetime
    end: datetime

    @model_validator(mode='after')
    def check_range(self) -> Self:
        if self.end <= self.start:
            raise ValueError('end must be after start')
        return self          # MUST return self
```

```python
class Payment(BaseModel):
    amount: Decimal
    currency: str

    @model_validator(mode='before')
    @classmethod
    def normalize(cls, data: Any) -> Any:
        if isinstance(data, str):
            amount, _, currency = data.partition(' ')
            return {'amount': amount, 'currency': currency}
        return data
```

**Modes**:

| Mode | `cls`/`self` | Receives | Returns | Notes |
|---|---|---|---|---|
| `'before'` | `cls` (classmethod) | raw input (dict, str, anything) | dict / object to validate | Use for shape coercion before field validation |
| `'after'` | `self` (instance method) | n/a | `Self` | Use for invariants requiring all fields validated |
| `'wrap'` | `cls` (classmethod) | raw input + handler | `Self` | Full control — pre, post, error recovery |

`mode='after'` runs LAST. `mode='before'` runs FIRST. Validators chain in declaration order within a mode.

## Annotated validators

Reusable across models. Each is a single-arg callable.

```python
from typing import Annotated, Any
from pydantic import BaseModel, AfterValidator, BeforeValidator, WrapValidator
from pydantic_core import ValidatorFunctionWrapHandler

def must_be_positive(v: int) -> int:
    if v <= 0:
        raise ValueError('must be > 0')
    return v

def parse_csv(v: Any) -> Any:
    return v.split(',') if isinstance(v, str) else v

def with_fallback(v: Any, handler: ValidatorFunctionWrapHandler) -> Any:
    try:
        return handler(v)
    except ValueError:
        return 0

class Form(BaseModel):
    count: Annotated[int, AfterValidator(must_be_positive)]
    tags: Annotated[list[str], BeforeValidator(parse_csv)]
    quota: Annotated[int, WrapValidator(with_fallback)]
```

Promote a reusable annotated alias:

```python
PositiveInt = Annotated[int, AfterValidator(must_be_positive)]
```

### Ordering in Annotated

When multiple validators stack:

- `WrapValidator` runs first (wraps everything inside)
- `BeforeValidator`s run right-to-left
- Default Pydantic validation runs in the middle
- `AfterValidator`s run left-to-right

## @computed_field

Adds a derived field that participates in serialization and JSON Schema.

```python
from pydantic import BaseModel, computed_field

class Rectangle(BaseModel):
    width: float
    height: float

    @computed_field
    @property
    def area(self) -> float:
        return self.width * self.height

    @computed_field(repr=False, alias='diag')
    @property
    def diagonal(self) -> float:
        return (self.width ** 2 + self.height ** 2) ** 0.5

r = Rectangle(width=3, height=4)
r.model_dump()      # {'width': 3.0, 'height': 4.0, 'area': 12.0, 'diagonal': 5.0}
```

`@computed_field` REQUIRES the `@property` underneath. The return type annotation feeds JSON Schema.

## Async validators

Mark with `async def` and call `await Model.model_validate_async(data)` — actually use `model_validate` since the inner validator runs on the event loop only for clearly-async paths. For most CRUD validation, prefer sync.

## context — runtime per-call data

```python
@field_validator('text', mode='after')
@classmethod
def censor(cls, v: str, info: ValidationInfo) -> str:
    blocklist = (info.context or {}).get('blocklist', set())
    for word in blocklist:
        v = v.replace(word, '***')
    return v

Model.model_validate({'text': 'hello world'}, context={'blocklist': {'world'}})
# → text='hello ***'
```

Pass dependency data (allowlist, locale, current user) into the validation pass without polluting model fields.

## Raising errors

Three accepted exceptions:

```python
raise ValueError('plain message')         # most common
assert v > 0, 'must be positive'          # AssertionError — SKIPPED with python -O

from pydantic_core import PydanticCustomError
raise PydanticCustomError(
    'custom_code',
    'Value {v!r} is bad',
    {'v': value},
)
```

Pydantic wraps the raised error in `ValidationError`. Use `PydanticCustomError` when you need a programmatic error code (clients dispatch on it).
