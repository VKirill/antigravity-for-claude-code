# Serializers

Customize how fields and whole models are dumped via `@field_serializer`, `@model_serializer`, or the `Annotated` variants `PlainSerializer` / `WrapSerializer`.

## Dump flags (no custom serializer needed)

```python
user.model_dump()                          # dict
user.model_dump(mode='json')               # JSON-compatible (Decimal→str, datetime→ISO, UUID→str)
user.model_dump_json()                     # → str

user.model_dump(by_alias=True)             # use serialization aliases
user.model_dump(exclude_unset=True)        # skip fields not explicitly set
user.model_dump(exclude_defaults=True)     # skip fields equal to their default
user.model_dump(exclude_none=True)         # skip None values
user.model_dump(include={'id', 'name'})    # whitelist
user.model_dump(exclude={'password'})      # blacklist
user.model_dump(round_trip=True)           # output is re-validatable
user.model_dump(warnings=False)            # silence serialization warnings
```

`mode='json'` is what you want when piping to a JSON serializer that doesn't know `Decimal` or `datetime`.

## @field_serializer

```python
from pydantic import BaseModel, field_serializer

class Student(BaseModel):
    name: str
    courses: set[str]
    enrolled_at: datetime

    @field_serializer('courses', when_used='json')
    def sort_courses(self, courses: set[str]) -> list[str]:
        return sorted(courses)

    @field_serializer('enrolled_at')
    def fmt_date(self, v: datetime) -> str:
        return v.date().isoformat()
```

### Modes

| Mode | Signature | Behavior |
|---|---|---|
| `'plain'` (default) | `(self, value)` or `(self, value, info)` | Replace default serialization |
| `'wrap'` | `(self, value, nxt)` or `(self, value, nxt, info)` | Wrap default — call `nxt(value)` to delegate |

```python
@field_serializer('number', mode='wrap')
def add_one(self, value, nxt):
    return nxt(value) + 1
```

### when_used

| Value | Triggered when |
|---|---|
| `'always'` (default) | Every dump |
| `'unless-none'` | Skip if value is `None` |
| `'json'` | Only when target is JSON (`model_dump(mode='json')` or `model_dump_json()`) |
| `'json-unless-none'` | Combination |

Use `when_used='json'` to keep Python dumps human-readable while serializing JSON in a wire format (timestamps as epoch, etc.).

### Multiple fields

```python
@field_serializer('start', 'end')
def iso(self, v: datetime) -> str:
    return v.isoformat()
```

## @model_serializer

Replace the whole-model output.

```python
from typing import Literal
from pydantic import BaseModel, model_serializer

class Temperature(BaseModel):
    unit: Literal['C', 'F']
    value: float

    @model_serializer
    def to_celsius(self) -> dict:
        if self.unit == 'F':
            return {'unit': 'C', 'value': round((self.value - 32) / 1.8, 2)}
        return {'unit': 'C', 'value': self.value}
```

Wrap mode:

```python
@model_serializer(mode='wrap')
def add_meta(self, nxt) -> dict:
    out = nxt(self)
    out['_schema_version'] = 2
    return out
```

`mode='plain'` (default) returns whatever you want — usually a dict. `mode='wrap'` augments the default output. Use plain when output diverges significantly; wrap when adding metadata or applying a global transform.

## Annotated serializers

```python
from typing import Annotated
from pydantic import BaseModel, PlainSerializer, WrapSerializer

ShortFloat = Annotated[
    float,
    PlainSerializer(lambda v: round(v, 2), return_type=float, when_used='always'),
]

class Reading(BaseModel):
    temp: ShortFloat
```

`WrapSerializer` provides the inner handler for nested types:

```python
def add_sign(v: int, nxt) -> str:
    return f'{nxt(v):+d}'

SignedInt = Annotated[int, WrapSerializer(add_sign, return_type=str)]
```

**Always declare `return_type=`** when the serializer changes the type — JSON Schema generation needs it.

## SerializationInfo

```python
@model_serializer
def serialize(self, info: SerializationInfo) -> dict:
    if info.mode == 'json':
        return {'compact': self.compact_repr()}
    return {'full': self.model_dump()}
```

Attributes: `info.mode` (`'python'` / `'json'`), `info.exclude`, `info.include`, `info.exclude_unset`, `info.by_alias`, `info.round_trip`.

## Aliases on output

```python
class API(BaseModel):
    user_id: int = Field(serialization_alias='userId')

api = API(user_id=1)
api.model_dump()                  # {'user_id': 1}
api.model_dump(by_alias=True)     # {'userId': 1}
```

## Computed fields participate in serialization

```python
class Box(BaseModel):
    w: float
    h: float

    @computed_field
    @property
    def area(self) -> float:
        return self.w * self.h

Box(w=2, h=3).model_dump()   # {'w': 2.0, 'h': 3.0, 'area': 6.0}
```

To hide a computed field from dumps but keep it for templating: don't decorate it — just use a plain `@property`. To include but hide from `repr()`: `@computed_field(repr=False)`.

## Private attrs are NOT serialized

```python
class M(BaseModel):
    name: str
    _internal: int = PrivateAttr(default=0)

M(name='x').model_dump()   # {'name': 'x'}
```

By design — see [basemodel.md](basemodel.md) "Private attributes".
