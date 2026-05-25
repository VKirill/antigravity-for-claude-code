# Migration from Pydantic v1

The most-read reference. Pydantic v2 is a near-total redesign — Rust core, new method names, new validator API. v1 code does not run on v2 unchanged. Use the `bump-pydantic` codemod (`pip install bump-pydantic`) for bulk conversion, then hand-fix the residuals listed below.

## Method renames — full table

| Pydantic v1 | Pydantic v2 |
|---|---|
| `Model.parse_obj(data)` | `Model.model_validate(data)` |
| `Model.parse_raw(raw)` | `Model.model_validate_json(raw)` |
| `Model.parse_file(path)` | `Model.model_validate_json(Path(path).read_bytes())` |
| `Model.from_orm(obj)` | `Model.model_validate(obj)` (with `model_config = ConfigDict(from_attributes=True)`) |
| `instance.dict()` | `instance.model_dump()` |
| `instance.json()` | `instance.model_dump_json()` |
| `instance.copy()` | `instance.model_copy()` |
| `Model.construct(**data)` | `Model.model_construct(**data)` |
| `Model.schema()` | `Model.model_json_schema()` |
| `Model.schema_json()` | `json.dumps(Model.model_json_schema())` |
| `Model.update_forward_refs()` | `Model.model_rebuild()` |
| `Model.validate(data)` | `Model.model_validate(data)` |

Pydantic ships shims that emit `DeprecationWarning` for v1 names where feasible — but they're slated for removal and silently shadow the new API in IDE auto-complete. Replace them.

## Config class → model_config

```python
# v1
class User(BaseModel):
    name: str

    class Config:
        allow_population_by_field_name = True
        orm_mode = True
        anystr_strip_whitespace = True
        validate_assignment = True
        extra = 'forbid'
        use_enum_values = True

# v2
from pydantic import BaseModel, ConfigDict

class User(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,             # was allow_population_by_field_name
        from_attributes=True,              # was orm_mode
        str_strip_whitespace=True,         # was anystr_strip_whitespace
        validate_assignment=True,
        extra='forbid',
        use_enum_values=True,
    )
    name: str
```

### Config option renames

| v1 | v2 |
|---|---|
| `allow_population_by_field_name` | `populate_by_name` |
| `orm_mode` | `from_attributes` |
| `anystr_strip_whitespace` | `str_strip_whitespace` |
| `anystr_lower` | `str_to_lower` |
| `anystr_upper` | `str_to_upper` |
| `min_anystr_length` / `max_anystr_length` | `str_min_length` / `str_max_length` |
| `error_msg_templates` | removed — customize via `__pydantic_core_schema__` |
| `fields = {...}` | removed — use `Field(...)` directly |
| `schema_extra` | `json_schema_extra` |
| `json_encoders = {...}` | removed — use `@field_serializer` or `Annotated[..., PlainSerializer(...)]` |
| `json_loads` / `json_dumps` | removed — Pydantic core handles JSON natively |
| `keep_untouched` | removed — use `model_config = ConfigDict(arbitrary_types_allowed=True)` |
| `arbitrary_types_allowed` | same name, still in `ConfigDict` |
| `copy_on_model_validation` | removed |

## @validator → @field_validator

```python
# v1
from pydantic import BaseModel, validator

class User(BaseModel):
    name: str
    age: int

    @validator('name')
    def name_strip(cls, v):
        return v.strip()

    @validator('age', pre=True)
    def coerce_age(cls, v, values):
        return int(v) if isinstance(v, str) else v

# v2
from pydantic import BaseModel, field_validator, ValidationInfo

class User(BaseModel):
    name: str
    age: int

    @field_validator('name', mode='after')
    @classmethod
    def name_strip(cls, v: str) -> str:
        return v.strip()

    @field_validator('age', mode='before')
    @classmethod
    def coerce_age(cls, v: object, info: ValidationInfo) -> object:
        # v1 `values` dict is gone; use info.data instead
        return int(v) if isinstance(v, str) else v
```

Differences:

- Decorator: `@validator` → `@field_validator`.
- `pre=True` → `mode='before'` (and `pre=False` is now `mode='after'`).
- `always=True` is gone — use `validate_default=True` on the model.
- `each_item=True` is gone — use a separate validator inside an `Annotated` element type or a `BeforeValidator` that iterates.
- `values: dict` arg removed — use `info.data` from `ValidationInfo`.
- `cls` is no longer auto-injected — add `@classmethod` explicitly.

### @root_validator → @model_validator

```python
# v1
from pydantic import root_validator

class Reservation(BaseModel):
    start: datetime
    end: datetime

    @root_validator
    def check(cls, values):
        if values['end'] <= values['start']:
            raise ValueError('bad range')
        return values

# v2
from typing_extensions import Self
from pydantic import model_validator

class Reservation(BaseModel):
    start: datetime
    end: datetime

    @model_validator(mode='after')
    def check(self) -> Self:
        if self.end <= self.start:
            raise ValueError('bad range')
        return self
```

- `mode='after'` runs as an instance method — `self` instead of a `values` dict.
- `mode='before'` runs as a classmethod and receives raw input as the first arg.
- `pre=True` → `mode='before'`. Default was `pre=False` → `mode='after'`.
- `skip_on_failure=True` is gone — `model_validator(mode='after')` only runs when all field validators pass.

## @validate_arguments → @validate_call

```python
# v1
from pydantic import validate_arguments

@validate_arguments
def f(x: int, y: str = 'a') -> bool: ...

# v2
from pydantic import validate_call

@validate_call
def f(x: int, y: str = 'a') -> bool: ...
```

`validate_call(config=ConfigDict(strict=True))` enables strict validation.

## constr / conint / confloat → Annotated

```python
# v1
from pydantic import BaseModel, constr, conint, confloat, conlist

class M(BaseModel):
    name: constr(min_length=1, max_length=64, regex=r'^[a-z]+$')
    age: conint(ge=0, le=120)
    score: confloat(gt=0, lt=1)
    tags: conlist(str, min_items=1, max_items=10)

# v2
from typing import Annotated
from pydantic import BaseModel, Field

class M(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=64, pattern=r'^[a-z]+$')]
    age: Annotated[int, Field(ge=0, le=120)]
    score: Annotated[float, Field(gt=0, lt=1)]
    tags: Annotated[list[str], Field(min_length=1, max_length=10)]
```

Also note: `min_items` / `max_items` → `min_length` / `max_length`. `regex` → `pattern`.

## BaseSettings moved package

```python
# v1
from pydantic import BaseSettings, BaseConfig

# v2
from pydantic_settings import BaseSettings, SettingsConfigDict
# pip install pydantic-settings
```

See [settings.md](settings.md) for the full new API.

## Generic models — GenericModel removed

```python
# v1
from pydantic.generics import GenericModel
from typing import Generic, TypeVar

T = TypeVar('T')

class Response(GenericModel, Generic[T]):
    data: T

# v2
from typing import Generic, TypeVar
from pydantic import BaseModel

T = TypeVar('T')

class Response(BaseModel, Generic[T]):
    data: T

# Or PEP 695:
class Response[T](BaseModel):
    data: T
```

`GenericModel` is removed — every `BaseModel` is generic-capable.

## Validators on env vars / coercion gotchas

- `bool` coercion is stricter: `'yes'`, `'on'`, `'1'`, `'true'` accepted (case-insensitive); everything else rejected. v1 accepted more strings.
- Float-to-int: only zero-decimal floats are accepted as ints (`1.0` → `1`; `1.5` → fails).
- `Union[int, str]` under default `union_mode='smart'` picks the most natural type; v1's left-to-right behavior is `union_mode='left_to_right'`.
- Optional fields require explicit `= None`: `x: int = None` is rejected — write `x: int | None = None`.

## Removed / relocated

| v1 | v2 |
|---|---|
| `pydantic.color.Color` | `pydantic-extra-types` |
| `pydantic.types.PaymentCardNumber` | `pydantic-extra-types` |
| `pydantic.utils.lenient_issubclass` | removed |
| `Model.Config.copy_on_model_validation` | removed — Pydantic always builds new instances |
| `Model.__fields__` | renamed to `Model.model_fields` |
| `Model.__fields_set__` | renamed to `instance.model_fields_set` |
| `Model.__private_attributes__` | renamed to `Model.__pydantic_private__` |
| `parse_file` | removed — read bytes manually then `model_validate_json` |
| `validate_all = True` | replaced by `validate_default = True` |

## ValidationError shape

```python
# v1
err.errors()
# [{'loc': ('name',), 'msg': 'field required', 'type': 'value_error.missing'}]

# v2
err.errors()
# [{'type': 'missing', 'loc': ('name',), 'msg': 'Field required',
#   'input': {...}, 'url': 'https://errors.pydantic.dev/...'}]
```

`type` is now a structured code (`'missing'`, `'string_too_short'`, `'int_parsing'`) — easier for clients to dispatch on. `input` includes the offending value. `url` links to a doc page describing the error.

`.errors(include_url=False, include_input=False)` trims the dict if you're serializing to clients.

## bump-pydantic codemod

```bash
pip install bump-pydantic
bump-pydantic path/to/src/
```

Covers ~80% of mechanical rewrites: `class Config` → `model_config`, `parse_obj` → `model_validate`, `dict()` → `model_dump()`, `@validator` → `@field_validator`, `constr` → `Annotated`. Always review the diff — semantic changes (e.g., `values` dict access, `each_item`) need hand-fixing.

## Migration order — recommended

1. Pin both packages: `pydantic>=2,<3` and `pydantic-settings>=2`.
2. Run `bump-pydantic` on the codebase.
3. Fix `class Config` residuals (option renames).
4. Replace `@validator(values=...)` patterns with `info: ValidationInfo` + `info.data`.
5. Migrate `BaseSettings` imports to `pydantic_settings`.
6. Replace `json_encoders` config with `@field_serializer` / `Annotated[..., PlainSerializer]`.
7. Run tests; fix Optional/Union narrowing changes; address `Strict` boolean coercion.
8. Update fixtures: `model_validate` instead of constructor kwargs for fixtures built from dicts.
