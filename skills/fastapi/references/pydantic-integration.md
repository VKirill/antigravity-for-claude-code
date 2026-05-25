# FastAPI — Pydantic v2 integration

FastAPI's validation engine is Pydantic v2. This reference covers the *integration* points; see the `pydantic` skill for Pydantic itself.

## Request body as `BaseModel`

```python
from pydantic import BaseModel, Field

class ItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    price: float = Field(gt=0)
    tags: list[str] = Field(default_factory=list)

@app.post("/items/", response_model=ItemOut, status_code=201)
async def create_item(item: ItemCreate):
    ...
```

The single non-path-non-query parameter is implicitly the body. FastAPI generates the OpenAPI schema, validates the JSON, and the 422 response on failure.

## `response_model` vs return annotation

Two forms work; both are valid:

```python
# (1) Return annotation
@app.get("/items/{id}")
async def get_item(id: int) -> ItemOut: ...

# (2) Explicit response_model — wins when the runtime return type differs
@app.get("/items/{id}", response_model=ItemOut)
async def get_item(id: int) -> ItemRow:   # ORM row → filtered to ItemOut
    return await db.get(ItemRow, id)
```

Form (2) is the right choice when returning ORM models that contain more fields than you want to expose. FastAPI runs the return value through the Pydantic model's serialization (`from_attributes=True` required if using attribute access on ORM rows).

```python
class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    price: float
```

## `response_model_exclude_*` flags

| Flag | Effect |
|---|---|
| `response_model_exclude_unset=True` | omit fields not explicitly set by the user — useful for PATCH responses |
| `response_model_exclude_none=True` | omit fields whose value is `None` — slimmer JSON |
| `response_model_exclude_defaults=True` | omit fields whose value equals the default |
| `response_model_by_alias=True` | serialize using `Field(alias=...)` names |

```python
@app.patch("/items/{id}", response_model=ItemOut, response_model_exclude_unset=True)
```

Pick `response_model_exclude_none=True` as a default for list-heavy responses — see [recommended-defaults.md](recommended-defaults.md).

## Multiple bodies — `Body(embed=True)`

A single `BaseModel` param is implicitly the *whole* body. When you mix two body models or want a wrapped envelope, use `embed=True`:

```python
@app.post("/items/")
async def create(
    item: Annotated[ItemCreate, Body(embed=True)],
    audit: Annotated[AuditInfo, Body(embed=True)],
):
    ...
# expects: { "item": {...}, "audit": {...} }
```

## Body fields + path params

```python
@app.post("/folders/{folder_id}/items/", response_model=ItemOut, status_code=201)
async def create_in_folder(
    folder_id: Annotated[int, Path(ge=1)],
    item: ItemCreate,
):
    ...
```

Path params take their values from the URL; the body is JSON. No conflict.

## `Field` with validation

```python
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    age: int = Field(ge=13, le=120)
    bio: str | None = Field(default=None, max_length=500)
```

Validators of the form `pattern=`, `min_length=`, `gt=`, `ge=`, `lt=`, `le=`, `multiple_of=` are exposed in the OpenAPI schema. Use `field_validator` for cross-field logic.

## `model_config` / `ConfigDict`

```python
from pydantic import ConfigDict

class ItemOut(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,        # ORM mode
        populate_by_name=True,       # accept both alias and field name on input
        str_strip_whitespace=True,
        extra="forbid",              # reject unknown fields on input
    )
    id: int
    name: str
```

`extra="forbid"` on **input** models hardens against client typos / future field rename mistakes. On **output** models it's irrelevant (you control the dict).

## `AliasChoices` for backward-compatible fields

When a field has been renamed but you must accept both forms:

```python
from pydantic import AliasChoices

class UserCreate(BaseModel):
    full_name: str = Field(validation_alias=AliasChoices("full_name", "fullName", "name"))
```

The serialization (response) name is still `full_name`; input is flexible.

## `computed_field` for derived response fields

```python
from pydantic import BaseModel, computed_field

class OrderOut(BaseModel):
    items: list[OrderItem]

    @computed_field
    @property
    def total(self) -> float:
        return sum(i.price * i.qty for i in self.items)
```

Computed fields are serialization-only — they appear in the JSON response and OpenAPI schema, never in input.

## Discriminated unions

```python
from typing import Literal
from pydantic import BaseModel, Field
from typing import Annotated

class Cat(BaseModel):
    kind: Literal["cat"]
    purrs: bool

class Dog(BaseModel):
    kind: Literal["dog"]
    barks: bool

Pet = Annotated[Cat | Dog, Field(discriminator="kind")]

@app.post("/pets/")
async def add_pet(pet: Pet): ...
```

FastAPI emits a proper `oneOf` with discriminator in OpenAPI 3.1 — clients generate clean tagged unions.

## Pydantic Settings for config

See `setup.md` for `BaseSettings`. Inject `Settings` instance via `Depends(get_settings)` — never import a module-level singleton (kills testability).

## What goes in the `pydantic` skill instead

- Detailed validator authoring (`field_validator`, `model_validator`, mode='before'/'after')
- `TypeAdapter` for stand-alone validation outside of FastAPI
- Strict vs lax mode
- Pydantic v1 → v2 migration patterns
- JSON Schema customization beyond what FastAPI exposes

Stay here for FastAPI-specific binding patterns.
