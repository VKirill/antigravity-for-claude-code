# BaseModel

The core Pydantic v2 class. Subclass it, annotate fields with type hints, and you get validation, serialization, and JSON Schema for free.

## Defining a model

```python
from pydantic import BaseModel

class User(BaseModel):
    id: int
    name: str
    is_active: bool = True
```

Constructor accepts keyword arguments; missing fields without defaults raise `ValidationError`.

```python
User(id=1, name='Ada')                 # OK
User(id='1', name='Ada')               # OK — lax coercion
User.model_validate({'id': 1, 'name': 'Ada'})  # explicit
```

## Validation methods

| Method | Input | Returns | Use when |
|---|---|---|---|
| `Model(**data)` | kwargs | instance | Trusted internal call sites |
| `Model.model_validate(obj)` | dict / object | instance | Generic untrusted dict input |
| `Model.model_validate_json(raw)` | str / bytes | instance | Incoming JSON (HTTP body, file) — faster than `json.loads` + `model_validate` |
| `Model.model_validate_strings(d)` | dict of str→str | instance | Form data, query strings, env vars |
| `Model.model_construct(**data)` | kwargs | instance | TRUSTED data only — skips all validation |

`model_validate_json` parses straight from the JSON bytes into the validated model in a single pass through the Rust core — prefer it over `json.loads(raw)` + `model_validate(data)`.

## Serialization methods

```python
user.model_dump()                          # → {'id': 1, 'name': 'Ada', 'is_active': True}
user.model_dump(mode='json')               # JSON-compatible values (Decimal→str, datetime→ISO)
user.model_dump_json()                     # → '{"id":1,"name":"Ada","is_active":true}'
user.model_dump(exclude={'is_active'})     # drop fields
user.model_dump(exclude_unset=True)        # only fields explicitly set at construction
user.model_dump(exclude_defaults=True)     # drop fields matching their default
user.model_dump(exclude_none=True)         # drop None values
user.model_dump(by_alias=True)             # use serialization aliases
user.model_dump(include={'id'})            # whitelist
```

Deep selection on nested fields: pass `{'nested': {'sub_field': ...}}`.

## Copy

```python
copy = user.model_copy()                          # shallow copy
copy = user.model_copy(update={'name': 'Lin'})    # new instance with override
copy = user.model_copy(deep=True)                 # deep copy of nested models
```

`update` does NOT re-validate the patched fields by default. To re-validate, dump → update → `model_validate`.

## Introspection

```python
User.model_fields           # {'id': FieldInfo(...), 'name': FieldInfo(...), ...}
user.model_fields_set       # {'id', 'name'} — fields explicitly provided
User.model_computed_fields  # mapping of @computed_field
User.__pydantic_core_schema__  # the underlying core schema (rarely needed)
```

`model_fields_set` is the right way to detect "was this field passed?" — not `getattr(user, 'name', None)`.

## model_config / ConfigDict

`model_config` is a class-level dict (use `ConfigDict` for typing). Replaces v1's inner `class Config`.

```python
from pydantic import BaseModel, ConfigDict

class User(BaseModel):
    model_config = ConfigDict(
        extra='forbid',           # 'ignore' (default) | 'allow' | 'forbid'
        frozen=True,              # immutable instances; mutation raises
        strict=False,             # default lax coercion
        populate_by_name=True,    # accept both field name and alias
        str_strip_whitespace=True,
        str_to_lower=False,
        str_max_length=None,
        validate_assignment=False,  # re-validate on attr set after init
        validate_default=False,     # validate field defaults on class creation
        from_attributes=False,      # ORM mode — read from object attrs
        arbitrary_types_allowed=False,
        use_enum_values=False,      # store enum.value not enum member
        json_schema_extra=None,
        ser_json_timedelta='iso8601',
        ser_json_bytes='utf8',
        ser_json_inf_nan='null',
        loc_by_alias=True,
    )

    id: int
    name: str
```

### Key config options

| Option | Default | Effect |
|---|---|---|
| `extra` | `'ignore'` | Behavior for unknown input keys |
| `frozen` | `False` | Block mutation; makes instance hashable |
| `strict` | `False` | Reject coercion (`'1'` → `int` fails) |
| `populate_by_name` | `False` | Allow both alias and field name |
| `validate_assignment` | `False` | Re-validate on `instance.attr = x` |
| `validate_default` | `False` | Run validators on default values |
| `from_attributes` | `False` | Read from object attrs (former `orm_mode`) |
| `arbitrary_types_allowed` | `False` | Accept non-pydantic types like custom classes |
| `use_enum_values` | `False` | Serialize/store `Enum.value` not the member |

`from_attributes=True` is what FastAPI / SQLAlchemy users want for reading rows.

## Aliases

```python
from pydantic import BaseModel, Field, AliasChoices, AliasPath

class User(BaseModel):
    user_id: int = Field(alias='id')                                # both directions
    full_name: str = Field(validation_alias='name')                 # input only
    api_key: str = Field(serialization_alias='apiKey')              # output only
    email: str = Field(validation_alias=AliasChoices('email', 'mail', 'e_mail'))
    nested_id: int = Field(validation_alias=AliasPath('meta', 'id'))
```

- `alias`: applies to both validation and serialization.
- `validation_alias`: accept this name on input.
- `serialization_alias`: emit this name on dump (`by_alias=True`).
- `AliasChoices(*names)`: try each in order.
- `AliasPath(*keys)`: pull from a nested key path.

`populate_by_name=True` lets `User(user_id=1)` AND `User.model_validate({'id': 1})` both work.

## RootModel — non-object roots

```python
from pydantic import RootModel

Pets = RootModel[list[str]]

pets = Pets(['dog', 'cat'])
pets.root                  # ['dog', 'cat']
pets.model_dump()          # ['dog', 'cat']
pets.model_dump_json()     # '["dog","cat"]'

Pets.model_validate(['fish'])
Pets.model_validate_json('["fish"]')
```

Often `TypeAdapter(list[str])` is simpler — see [strict-vs-lax.md](strict-vs-lax.md). Use `RootModel` when you want a named, importable class with validators attached.

## model_construct — skip validation

```python
user = User.model_construct(id=1, name='Ada')   # NO validation
```

For known-good internal data (e.g., loading from a trusted ORM after Pydantic already validated upstream). The output may violate constraints — don't use on untrusted input.

## __pydantic_extra__ with extra='allow'

```python
class Loose(BaseModel):
    model_config = ConfigDict(extra='allow')
    id: int

obj = Loose(id=1, role='admin', extra_field=42)
obj.__pydantic_extra__   # {'role': 'admin', 'extra_field': 42}
```

`extra='forbid'` raises `ValidationError` on unknown keys — recommended at API boundaries.

## Private attributes

```python
from pydantic import BaseModel, PrivateAttr

class Cache(BaseModel):
    name: str
    _hits: int = PrivateAttr(default=0)

    def hit(self) -> None:
        self._hits += 1
```

Private attrs are excluded from validation, serialization, and `model_fields`. Use for caches, observers, computed state that mustn't leak into dumps.

## Inheritance

```python
class Base(BaseModel):
    id: int
    created_at: datetime

class User(Base):
    name: str
```

Children inherit `model_config`, fields, and validators. Override `model_config` by re-declaring it (it's merged in Pydantic 2 — base config is the starting point).
