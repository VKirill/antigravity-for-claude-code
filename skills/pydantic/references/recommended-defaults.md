# Recommended Defaults

Opinionated baselines that match production usage. Override when a specific case demands it — but start here.

## API-boundary models: extra='forbid'

```python
class CreateUserRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    email: EmailStr
    password: str
```

Catches client typos (`emial=...`) and contract drift early. Without it, unknown fields silently disappear.

Internal-only models can stay `extra='ignore'` (default) when you genuinely don't care.

## Always Annotated[T, Field(...)] over default-form

```python
# Prefer
name: Annotated[str, Field(min_length=1, max_length=64)]

# Avoid
name: str = Field(min_length=1, max_length=64)
```

The `Annotated` form lets you extract a reusable alias (`Username = Annotated[str, Field(...)]`) and keeps defaults syntactically simple. Default-form mixes type metadata with default-value semantics.

## Value objects: frozen=True

```python
class Money(BaseModel):
    model_config = ConfigDict(frozen=True)
    amount: Decimal
    currency: str
```

Immutable, hashable, safe to share across threads / coroutines / cache layers. Use for IDs, money, geo coords, anything that conceptually is a value, not a record.

## validate_default=True for new code

```python
class Settings(BaseModel):
    model_config = ConfigDict(validate_default=True)
    port: int = '8080'      # WOULD pass without validate_default — int parsing skipped
```

By default Pydantic trusts the developer's defaults. Enabling validation catches typos at class-definition time. `BaseSettings` already enables this by default.

## TypeAdapter built once per module

```python
# At module scope
_user_list = TypeAdapter(list[User])
_event_adapter = TypeAdapter(WebhookEvent)

def parse_users(raw: bytes) -> list[User]:
    return _user_list.validate_json(raw)
```

Never inside a function body or a request handler. Schema construction dominates validation time.

## Explicit mode= on every decorator

```python
@field_validator('email', mode='after')
@classmethod
def lower(cls, v: str) -> str:
    return v.lower()

@model_validator(mode='after')
def check(self) -> Self:
    ...
    return self
```

Even though `'after'` is the default, writing it explicitly makes review easier and prevents drift if the default ever changes.

## Mutable defaults: default_factory

```python
# WRONG — Pydantic catches this
items: list[str] = []

# RIGHT
items: list[str] = Field(default_factory=list)
metadata: dict[str, Any] = Field(default_factory=dict)
created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
```

`default=[]` would share the list across instances. Pydantic raises, but the factory form is the idiom.

## Tagged variants: always use discriminator

```python
# Prefer
class Pet(BaseModel):
    animal: Cat | Dog | Lizard = Field(discriminator='kind')

# Avoid
class Pet(BaseModel):
    animal: Cat | Dog | Lizard   # smart union, slower, ambiguous errors
```

Whenever a literal tag field exists across variants, declare it. The performance + error-quality win is large.

## ValidationError handling at boundaries

```python
# In FastAPI / Hono / lambda handler
try:
    payload = Webhook.model_validate_json(raw)
except ValidationError as e:
    return Response(
        status=422,
        body={'errors': e.errors(include_url=False, include_input=False)},
    )
```

Surface `e.errors()` (structured) to clients — not `str(e)`. Clients dispatch on `type` codes and `loc` paths.

## Settings: cached factory

```python
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='forbid')
    database_url: str
    redis_url: str

@lru_cache
def get_settings() -> AppSettings:
    return AppSettings()
```

`extra='forbid'` on settings catches mis-spelled env vars. `lru_cache` ensures one validated instance per process — re-reading env per request is waste.

## datetime: require tz-aware

```python
from pydantic import AwareDatetime

class Event(BaseModel):
    starts_at: AwareDatetime
```

Naive datetimes are a recurring source of drift bugs (server in UTC, client in local). Require tz info at the boundary; if you need UTC normalization, layer an `AfterValidator`.

## Decimal for money

```python
from decimal import Decimal

class LineItem(BaseModel):
    price: Annotated[Decimal, Field(max_digits=10, decimal_places=2)]
    quantity: Annotated[int, Field(ge=1)]
```

`float` for prices means precision loss. Always `Decimal` with `max_digits` / `decimal_places`.

## Versioned APIs: pin model_config

```python
class V2Request(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
        str_strip_whitespace=True,
    )
```

A shared `BaseModel` subclass with the canonical config is fine, but be explicit on each public model — implicit inheritance from a project base is brittle when someone refactors the hierarchy.

## Numeric-knob summary

| Knob | Default | Recommended |
|---|---|---|
| `extra` | `'ignore'` | `'forbid'` at API boundaries |
| `frozen` | `False` | `True` for value objects |
| `strict` | `False` | `True` for internal-trust paths |
| `validate_default` | `False` (BaseModel) / `True` (BaseSettings) | `True` for both |
| `validate_assignment` | `False` | `True` when mutation must re-validate |
| `populate_by_name` | `False` | `True` when aliases are externally facing only |
| `str_strip_whitespace` | `False` | `True` for human-entered strings |
| `use_enum_values` | `False` | `True` for JSON wires |
| TypeAdapter scope | per-call | per-module |
