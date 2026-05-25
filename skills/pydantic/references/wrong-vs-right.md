# Wrong vs Right

Contrasted code pairs for the highest-traffic mistakes.

## v1 @validator vs v2 @field_validator

```python
# WRONG — v1 syntax, removed in v2
from pydantic import validator

class User(BaseModel):
    name: str
    age: int

    @validator('name')
    def strip(cls, v, values, config, field):
        return v.strip()
```

```python
# RIGHT — v2
from pydantic import field_validator, ValidationInfo

class User(BaseModel):
    name: str
    age: int

    @field_validator('name', mode='after')
    @classmethod
    def strip(cls, v: str) -> str:
        return v.strip()
```

`@validator` is removed. The four-arg signature (`values`, `config`, `field`) is gone — replaced by a single optional `info: ValidationInfo`. Add `@classmethod` explicitly.

## .dict() vs .model_dump()

```python
# WRONG
data = user.dict()
raw = user.json()
copy = user.copy(update={'name': 'x'})
schema = User.schema()
```

```python
# RIGHT
data = user.model_dump()
raw = user.model_dump_json()
copy = user.model_copy(update={'name': 'x'})
schema = User.model_json_schema()
```

The deprecation shims may still work today but emit warnings and will be removed. Update on sight.

## values dict vs info.data

```python
# WRONG — v1 pattern
@field_validator('confirm_password')
@classmethod
def match(cls, v, values):           # `values` arg is GONE in v2
    if v != values['password']:
        raise ValueError('mismatch')
    return v
```

```python
# RIGHT
@field_validator('confirm_password', mode='after')
@classmethod
def match(cls, v: str, info: ValidationInfo) -> str:
    if v != info.data.get('password'):
        raise ValueError('mismatch')
    return v
```

`info.data` contains fields validated BEFORE the current one (declaration order). For cross-field invariants involving fields validated later, use `@model_validator(mode='after')` instead.

## class Config vs model_config

```python
# WRONG
class User(BaseModel):
    name: str

    class Config:
        allow_population_by_field_name = True
        orm_mode = True
        extra = 'forbid'
```

```python
# RIGHT
from pydantic import ConfigDict

class User(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,        # renamed
        from_attributes=True,         # renamed (was orm_mode)
        extra='forbid',
    )
    name: str
```

Inner `class Config` is gone. Several option names changed — see [migration-from-v1.md](migration-from-v1.md).

## constr/conint/confloat vs Annotated

```python
# WRONG — removed
from pydantic import constr, conint

class M(BaseModel):
    name: constr(min_length=1, max_length=64, regex=r'^[a-z]+$')
    age: conint(ge=0, le=120)
```

```python
# RIGHT
from typing import Annotated
from pydantic import BaseModel, Field

class M(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=64, pattern=r'^[a-z]+$')]
    age: Annotated[int, Field(ge=0, le=120)]
```

Note `regex` → `pattern`, `min_items` → `min_length`.

## Mutating a frozen model

```python
# WRONG
class Coord(BaseModel):
    model_config = ConfigDict(frozen=True)
    x: float
    y: float

c = Coord(x=1, y=2)
c.x = 3                                # raises ValidationError
```

```python
# RIGHT
c2 = c.model_copy(update={'x': 3})     # new instance
```

`frozen=True` blocks mutation. `model_copy(update=...)` returns a new validated instance with the patch. (Note: `model_copy(update=...)` does NOT re-validate the patched values by default — use `dump → mutate → model_validate` if re-validation matters.)

## TypeAdapter in a hot path

```python
# WRONG — rebuilds schema every call
def parse_users(raw: bytes) -> list[User]:
    return TypeAdapter(list[User]).validate_json(raw)
```

```python
# RIGHT — build once at module scope
_users_adapter = TypeAdapter(list[User])

def parse_users(raw: bytes) -> list[User]:
    return _users_adapter.validate_json(raw)
```

Schema construction dominates cost; cache it.

## json.loads + model_validate vs model_validate_json

```python
# WRONG — two passes
import json
def parse(raw: bytes) -> User:
    return User.model_validate(json.loads(raw))
```

```python
# RIGHT — single Rust-core pass
def parse(raw: bytes) -> User:
    return User.model_validate_json(raw)
```

Faster and avoids intermediate dict construction.

## model_validate(json_string) vs model_validate_json

```python
raw = '{"id": 1}'

# WRONG — string is not a dict
User.model_validate(raw)               # raises model_type
```

```python
# RIGHT
User.model_validate_json(raw)
```

`model_validate` only accepts dicts, objects, and instances. JSON strings → `model_validate_json`.

## bare Union vs discriminated

```python
# WRONG — slow, ambiguous errors
class Owner(BaseModel):
    pet: Cat | Dog | Lizard

# Pydantic tries each variant; error path is just 'pet'
```

```python
# RIGHT
class Cat(BaseModel):
    kind: Literal['cat']
    meows: int

class Dog(BaseModel):
    kind: Literal['dog']
    barks: float

class Lizard(BaseModel):
    kind: Literal['lizard']
    scales: bool

class Owner(BaseModel):
    pet: Cat | Dog | Lizard = Field(discriminator='kind')
```

O(1) dispatch, error path includes the resolved variant (`pet.dog.barks`).

## model_construct on untrusted data

```python
# WRONG — bypasses ALL validation
raw = await get_external_payload()
user = User.model_construct(**raw)     # no validation, possibly broken instance
```

```python
# RIGHT
user = User.model_validate(raw)
```

`model_construct` is for trusted internal data (loading from DB rows that Pydantic already validated). Untrusted input always uses `model_validate`.

## BaseSettings from wrong package

```python
# WRONG
from pydantic import BaseSettings   # ImportError in v2
```

```python
# RIGHT
from pydantic_settings import BaseSettings, SettingsConfigDict
# pip install pydantic-settings
```

`BaseSettings` lives in a separate package since v2.

## Mutable default

```python
# WRONG — Pydantic catches this, but the intent is wrong
class M(BaseModel):
    items: list[str] = []
```

```python
# RIGHT
class M(BaseModel):
    items: list[str] = Field(default_factory=list)
```

Even if Pydantic raises a clear error, the factory form is the idiom — extends to `dict`, `set`, `datetime.now`, etc.

## str(ValidationError) for clients

```python
# WRONG — fragile, opaque to clients
return {'error': str(err)}
```

```python
# RIGHT
return {'errors': err.errors(include_url=False, include_input=False)}
# [{'type': 'missing', 'loc': ['email'], 'msg': 'Field required'}, ...]
```

Structured errors let clients map them back to UI fields by `loc` and dispatch on `type`.

## Optional vs not-required

```python
# WRONG — required, can be None
class M(BaseModel):
    x: int | None
M()                                     # raises — x is required

# RIGHT — optional
class M(BaseModel):
    x: int | None = None
M()                                     # OK — x = None
```

In Pydantic v2, `Optional` is purely a type-level concept. Add `= None` to make the field optional at construction.
