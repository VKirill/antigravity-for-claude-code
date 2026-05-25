# Troubleshooting

## Reading ValidationError

```python
from pydantic import ValidationError

try:
    User.model_validate({'name': '', 'age': 'not-a-number'})
except ValidationError as e:
    print(e)               # human-readable multi-line
    for err in e.errors():
        print(err['type'], err['loc'], err['msg'], err.get('input'))
```

Each entry:

| Key | Meaning |
|---|---|
| `type` | Structured code (`'missing'`, `'int_parsing'`, `'string_too_short'`, etc.) |
| `loc` | Tuple of keys / indices into input (`('items', 0, 'price')`) |
| `msg` | Human message |
| `input` | The offending value |
| `ctx` | Extra context (e.g., `{'min_length': 1}`) |
| `url` | Doc link |

To deserialize cleanly for API clients:

```python
err.errors(include_url=False, include_input=False)
```

`loc` lets clients map errors back to form fields — `('items', 3, 'name')` means `data.items[3].name`.

## Common ValidationError causes

### `model_type` — wrong shape

```
1 validation error for User
   Input should be a valid dictionary or instance of User
```

You passed a list / scalar where a dict was expected. Check call sites — easy to mix up `User(...)` vs `User.model_validate([...])`.

### `int_parsing` / `float_parsing`

Lax mode coerces strings; if the string isn't numeric, this fires. With `strict=True`, any non-int-type input fails. Inspect `input` to see what arrived.

### `missing` on Optional field

```python
x: int | None      # NOT optional — still required (value can be None or int)
x: int | None = None   # optional — defaults to None
```

`= None` is the difference between "must be present (and can be None)" and "may be omitted".

### `string_too_short` / `string_too_long`

Hits when `Field(min_length=...)` / `Field(max_length=...)` are violated. Check `ctx.min_length` / `ctx.max_length` for the limit.

## Performance pitfalls

### TypeAdapter built inside hot path

```python
# WRONG
def parse(raw: bytes) -> list[Item]:
    return TypeAdapter(list[Item]).validate_json(raw)   # rebuilds schema every call

# RIGHT
_adapter = TypeAdapter(list[Item])
def parse(raw: bytes) -> list[Item]:
    return _adapter.validate_json(raw)
```

Schema construction is the expensive step (~50× slower than validation). Always hoist to module scope.

### model_validate vs model_validate_json

```python
raw = b'{"id": 1}'
User.model_validate(json.loads(raw))    # slower — two passes
User.model_validate_json(raw)            # faster — single pass through Rust core
```

For JSON input always use `model_validate_json`. The Rust JSON parser is integrated with the validator.

### Large list of dicts → TypeAdapter, not iteration

```python
# WRONG
items = [Item.model_validate(d) for d in payload]   # N model_validate calls

# RIGHT
items = TypeAdapter(list[Item]).validate_python(payload)   # one batched call
```

The batched call avoids per-call overhead and re-uses the validator.

### validate_assignment in tight loops

`model_config = ConfigDict(validate_assignment=True)` re-validates on every attribute set. Useful in test fixtures, expensive in hot paths.

## Recursive / self-referential models

```python
from typing import Optional, List
from pydantic import BaseModel

class Node(BaseModel):
    name: str
    children: List['Node'] = []

Node.model_rebuild()   # resolves the forward reference
```

Use string-quoted self-reference (`'Node'`) and call `Model.model_rebuild()` once after definition. Without it, you'll see `PydanticUserError: class is not fully defined`.

For mutual recursion:

```python
class Folder(BaseModel):
    files: List['File'] = []

class File(BaseModel):
    parent: Optional['Folder'] = None

Folder.model_rebuild()
File.model_rebuild()
```

## Timezone drift

```python
from datetime import datetime, UTC

class Event(BaseModel):
    at: datetime

Event.model_validate({'at': '2026-05-16T12:00:00'})   # naive — no tzinfo!
Event.model_validate({'at': '2026-05-16T12:00:00Z'}).at.tzinfo   # UTC
```

Default `datetime` accepts both naive AND aware. To require aware:

```python
from pydantic import AwareDatetime
class Event(BaseModel):
    at: AwareDatetime
```

To always normalize to UTC, add an `AfterValidator`:

```python
def to_utc(v: datetime) -> datetime:
    if v.tzinfo is None:
        raise ValueError('datetime must be timezone-aware')
    return v.astimezone(UTC)

UtcDatetime = Annotated[datetime, AfterValidator(to_utc)]
```

## JSON-string vs dict input confusion

```python
raw = '{"id": 1, "name": "Ada"}'    # JSON string

User.model_validate(raw)              # WRONG — treats string as the model itself
User.model_validate_json(raw)         # RIGHT
```

`model_validate` accepts dicts, objects (with `from_attributes=True`), and instances. It does NOT auto-detect JSON strings.

## extra='forbid' missing keys

```python
class User(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id: int

User(id=1, namee='typo')   # raises — 'namee' is extra
```

When clients pass typo'd field names, `extra='forbid'` surfaces the bug instead of silently ignoring. Set it on every API-boundary model.

## populate_by_name + alias surprises

```python
class API(BaseModel):
    user_id: int = Field(alias='userId')

API(user_id=1)              # WRONG — raises by default
API.model_validate({'userId': 1})   # OK
API(userId=1)               # OK with populate_by_name=True
```

Without `populate_by_name=True`, the Python field name is NOT accepted on the constructor. Either pass via the alias or enable both.

## Frozen mutation

```python
class V(BaseModel):
    model_config = ConfigDict(frozen=True)
    x: int

v = V(x=1)
v.x = 2                      # raises ValidationError
v2 = v.model_copy(update={'x': 2})   # OK — returns a new instance
```

`frozen=True` makes instances hashable (usable as dict keys / set elements). The trade-off: no in-place mutation — use `model_copy(update=...)`.

## ENUM serialization

```python
class Status(str, Enum):
    OPEN = 'open'

class Ticket(BaseModel):
    status: Status

Ticket(status=Status.OPEN).model_dump()
# {'status': <Status.OPEN: 'open'>}   — keeps enum member by default
```

To dump the value:

```python
class Ticket(BaseModel):
    model_config = ConfigDict(use_enum_values=True)
    status: Status

Ticket(status=Status.OPEN).model_dump()   # {'status': 'open'}
```

JSON mode always converts: `Ticket(status=Status.OPEN).model_dump(mode='json')` → `{'status': 'open'}`.

## Discriminated union "no tag found"

```
PydanticUserError: callable-discriminator-no-tag — 
   Variant 'Foo' missing Tag('...')
```

Every arm of a callable-discriminator union must carry `Annotated[Variant, Tag('value')]`. See [discriminated-unions.md](discriminated-unions.md).

## model_construct skipped validators

```python
class M(BaseModel):
    n: int = Field(gt=0)

M.model_construct(n=-1)   # n = -1, no error — validation skipped
```

`model_construct` is by-design unsafe — only use with trusted data (e.g., loading from a DB after Pydantic already validated on insert). Otherwise, use `model_validate`.

## Circular imports with forward refs

```python
# user.py
class User(BaseModel):
    posts: list['Post'] = []

# post.py
class Post(BaseModel):
    author: User

# init module
from user import User
from post import Post
User.model_rebuild()
```

Forward refs (`'Post'`) defer resolution until `model_rebuild()`. Call it AFTER all referenced classes are imported.
