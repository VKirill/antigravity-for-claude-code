# Types

How Pydantic v2 decides what to accept and how to coerce it. The v2 way: `Annotated[T, metadata...]`, not `constr` / `conint` / `confloat`.

## The Annotated pattern

`Annotated[T, ...]` lets you attach Pydantic metadata to a base type without changing the type itself. Static type checkers see `T`; Pydantic reads the metadata.

```python
from typing import Annotated
from pydantic import BaseModel, Field

PositiveInt = Annotated[int, Field(gt=0)]
Username = Annotated[str, Field(min_length=3, max_length=32, pattern=r'^[a-z_]+$')]

class Account(BaseModel):
    age: PositiveInt
    handle: Username
```

You can also use `annotated-types` for Pydantic-agnostic constraints:

```python
from annotated_types import Gt, MinLen, MaxLen

PositiveInt = Annotated[int, Gt(0)]
ShortStr = Annotated[str, MinLen(1), MaxLen(64)]
```

This replaces the v1 helpers:

| v1 | v2 |
|---|---|
| `conint(gt=0)` | `Annotated[int, Field(gt=0)]` |
| `constr(min_length=1)` | `Annotated[str, Field(min_length=1)]` |
| `confloat(gt=0, lt=1)` | `Annotated[float, Field(gt=0, lt=1)]` |
| `condecimal(max_digits=10)` | `Annotated[Decimal, Field(max_digits=10)]` |
| `conlist(int, min_length=1)` | `Annotated[list[int], Field(min_length=1)]` |
| `conset(str, max_length=5)` | `Annotated[set[str], Field(max_length=5)]` |

## Standard library types

Pydantic validates: `int`, `float`, `bool`, `str`, `bytes`, `Decimal`, `complex`, `datetime.date`, `datetime.datetime`, `datetime.time`, `datetime.timedelta`, `uuid.UUID`, `pathlib.Path`, `enum.Enum`, `re.Pattern`, `ipaddress.*`, `typing.Literal`, plus all container types (`list`, `tuple`, `set`, `frozenset`, `dict`, `deque`, `Counter`).

## Datetime / date

```python
from datetime import datetime, date, UTC
from pydantic import BaseModel

class Event(BaseModel):
    starts_at: datetime          # accepts ISO 8601 strings, unix timestamps
    day: date
```

Lax mode coerces `'2026-05-16T12:00:00Z'`, `'2026-05-16T12:00:00+00:00'`, and a unix int. To require timezone-aware datetimes use `AwareDatetime`; for naive use `NaiveDatetime`:

```python
from pydantic import AwareDatetime, NaiveDatetime, PastDate, FutureDate

class Booking(BaseModel):
    starts_at: AwareDatetime    # must carry tzinfo
    birthday: PastDate          # must be in the past
    expires_on: FutureDate
```

## UUID / Decimal / paths / network

```python
from uuid import UUID
from decimal import Decimal
from pathlib import Path
from pydantic import (
    BaseModel, EmailStr, AnyUrl, HttpUrl, AnyHttpUrl,
    IPvAnyAddress, IPvAnyNetwork, IPvAnyInterface,
    FilePath, DirectoryPath, NewPath,
    SecretStr, SecretBytes, Json,
    UUID1, UUID3, UUID4, UUID5,
)

class Profile(BaseModel):
    id: UUID4
    email: EmailStr                 # requires `pip install pydantic[email]`
    website: HttpUrl                # http or https only
    api: AnyUrl                     # any scheme
    ip: IPvAnyAddress
    avatar: FilePath                # path must exist and be a file
    upload_dir: DirectoryPath       # path must exist and be a directory
    target: NewPath                 # path must NOT exist (for writes)
    password: SecretStr             # repr/dump hides the value
    balance: Decimal
```

`SecretStr` round-trips: serialization shows `'**********'` unless you call `.get_secret_value()`.

## Json — embedded JSON parsing

```python
from pydantic import BaseModel, Json

class Payload(BaseModel):
    meta: Json[dict[str, int]]   # accepts a JSON string, parses then validates

Payload.model_validate({'meta': '{"a": 1}'}).meta   # {'a': 1}
```

Use for webhook bodies where a field arrives JSON-encoded inside another JSON document.

## Literal and Enum

```python
from enum import Enum
from typing import Literal

class Status(str, Enum):
    OPEN = 'open'
    CLOSED = 'closed'

class Issue(BaseModel):
    state: Status
    severity: Literal['low', 'medium', 'high']
```

For `Enum`, set `model_config = ConfigDict(use_enum_values=True)` if you want `instance.state == 'open'` (string) rather than `Status.OPEN` on dump.

## Strict[...] annotation

```python
from typing import Annotated
from pydantic import Strict

StrictInt = Annotated[int, Strict()]

class M(BaseModel):
    n: StrictInt   # rejects '1' (str), accepts 1 (int)
```

Per-field strictness without touching `model_config`. Useful when most of the model can stay lax but one field must not coerce.

## NewType

```python
from typing import NewType
from pydantic import BaseModel

UserId = NewType('UserId', int)

class Comment(BaseModel):
    author_id: UserId   # validated as int, kept distinct at the type-check level
```

Pydantic strips the `NewType` wrapper and validates the underlying type; static type checkers still complain if you mix `UserId` and `PostId` (also `NewType('PostId', int)`).

## Custom types via __get_pydantic_core_schema__

For value types that need bespoke validation and serialization:

```python
from typing import Any
from pydantic import BaseModel, GetCoreSchemaHandler
from pydantic_core import CoreSchema, core_schema

class Username(str):
    @classmethod
    def __get_pydantic_core_schema__(
        cls, source_type: Any, handler: GetCoreSchemaHandler
    ) -> CoreSchema:
        return core_schema.no_info_after_validator_function(
            cls._validate, handler(str)
        )

    @classmethod
    def _validate(cls, value: str) -> 'Username':
        if not value.islower() or not value.isidentifier():
            raise ValueError('username must be lowercase identifier')
        return cls(value)

class User(BaseModel):
    handle: Username
```

For most use cases, prefer `Annotated[str, AfterValidator(fn)]` — implement `__get_pydantic_core_schema__` only when you need full control over validation, serialization, and JSON Schema simultaneously.

## InstanceOf, SkipValidation

```python
from pydantic import BaseModel, InstanceOf, SkipValidation

class Foo: ...

class Container(BaseModel):
    foo: InstanceOf[Foo]            # isinstance check, no further coercion
    raw: SkipValidation[dict]       # bypass validation for this field
```

`SkipValidation` is the escape hatch for fields that already passed validation elsewhere — use sparingly.

## arbitrary_types_allowed

For non-Pydantic types with no schema, set on the model:

```python
import numpy as np
from pydantic import BaseModel, ConfigDict

class Tensor(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    data: np.ndarray   # accepted as-is; only isinstance check
```

## Combining validators + serializers + constraints

```python
from typing import Annotated
from pydantic import AfterValidator, PlainSerializer, Field

TruncatedFloat = Annotated[
    float,
    Field(ge=0),
    AfterValidator(lambda x: round(x, 1)),
    PlainSerializer(lambda x: f'{x:.1e}', return_type=str),
]

class Reading(BaseModel):
    value: TruncatedFloat   # validates → rounds → serializes as '1.2e+01'
```

This reusable annotation is the recommended idiom for domain-specific types.
