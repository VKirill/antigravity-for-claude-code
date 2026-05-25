# Generic Models

Parametrized `BaseModel`s via `Generic[T]` or PEP 695 syntax.

## PEP 695 (Python 3.12+)

```python
from pydantic import BaseModel

class Response[DataT](BaseModel):
    data: DataT
    request_id: str

Response[int](data=1, request_id='r1')
Response[str](data='ok', request_id='r2')
```

Cleanest form when targeting modern Python.

## typing.Generic (3.9+)

```python
from typing import Generic, TypeVar
from pydantic import BaseModel

DataT = TypeVar('DataT')

class Response(BaseModel, Generic[DataT]):
    data: DataT
    request_id: str

Response[int](data=1, request_id='r1')
```

Pydantic caches parametrizations by type-argument tuple — `Response[int]` is built once and reused. Don't create new TypeVars per call.

## TypeVar bounds and defaults

```python
from typing import Generic
from typing_extensions import TypeVar
from pydantic import BaseModel

T = TypeVar('T')
NumT = TypeVar('NumT', bound=int | float)        # constraint
StrT = TypeVar('StrT', default=str)              # PEP 696 default

class Metric(BaseModel, Generic[T, NumT, StrT]):
    name: StrT
    value: NumT
    extra: T
```

`bound=` enforces that the parameter is a subtype. `default=` lets users omit later type arguments.

## Nested generic models

```python
class Page[T](BaseModel):
    items: list[T]
    total: int

class User(BaseModel):
    id: int
    name: str

UserPage = Page[User]
UserPage(items=[{'id': 1, 'name': 'a'}], total=1)
```

`Page[User]` is a regular `BaseModel` subclass — pass it anywhere a `BaseModel` is expected, including `response_model=` in FastAPI.

## Generic with discriminated union

```python
from typing import Literal

class Ok[T](BaseModel):
    status: Literal['ok']
    data: T

class Err(BaseModel):
    status: Literal['err']
    message: str

class Result[T](BaseModel):
    payload: Ok[T] | Err = Field(discriminator='status')
```

## Generic subclassing

```python
class BaseClass(BaseModel, Generic[TypeX, TypeY]):
    x: TypeX
    y: TypeY

class ChildClass(BaseClass[int, TypeY], Generic[TypeY, TypeZ]):
    z: TypeZ

ChildClass[str, float](x=1, y='a', z=2.0)
```

Replace some superclass type variables, keep others open.

## Validation behavior

```python
try:
    Response[int](data='not-a-number', request_id='r')
except ValidationError as e:
    e.errors()
    # [{'type': 'int_parsing', 'loc': ('data',), ...}]
```

`Response[int]` and `Response[str]` are distinct validators — Pydantic builds the right one for each parametrization.

## Unparametrized usage

```python
class Response(BaseModel, Generic[DataT]):
    data: DataT

Response(data='anything')   # DataT defaults to Any — validation passes
```

Without parametrization the TypeVar resolves to `Any`. Provide a `TypeVar(default=...)` or parametrize at use site for real validation.

## Anti-patterns

```python
# DON'T — TypeVar in function scope
def make_response[T](data: T) -> Response[T]:
    return Response[T](data=data)
# Pydantic must rebuild the schema for every call. Cache parametrizations at module scope.

# DON'T — runtime-only generics
class Bag(BaseModel):
    items: list   # generic but unparameterized — degenerates to list[Any]
```

Type-erase at use sites only; declare the generic parameters explicitly on the class.
