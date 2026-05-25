# FastAPI — routing

## Path operations

```python
from typing import Annotated
from fastapi import FastAPI, Path, Query, Body, status
from pydantic import BaseModel

app = FastAPI()

class Item(BaseModel):
    name: str
    price: float

class ItemOut(Item):
    id: int

@app.get("/items/{item_id}", response_model=ItemOut, status_code=status.HTTP_200_OK)
async def get_item(
    item_id: Annotated[int, Path(ge=1)],
    q: Annotated[str | None, Query(max_length=50)] = None,
):
    ...
```

Key points:

- Always use `Annotated[T, ...]` for parameter metadata (FastAPI's recommended form since `Annotated` matured in Python typing).
- `response_model` is the contract for the response — it filters fields, validates the return shape, and drives the OpenAPI schema.
- `status_code` is the **default success status** for the route; override per response with `Response(status_code=...)` or `JSONResponse(..., status_code=...)`.
- The decorator order (`@app.get`, `@app.post`, etc.) doubles as path matching order — define `/users/me` before `/users/{user_id}`.

## Parameter sources

| Source | Marker | Notes |
|---|---|---|
| Path | `Path(...)` | Required, comes from URL template `{item_id}` |
| Query | `Query(...)` | Optional unless no default; supports `list[str]` |
| Body | `Body(...)` / Pydantic `BaseModel` | Single body model is implicit; mixing models requires `Body(embed=True)` |
| Header | `Header(...)` | Headers are case-insensitive; `convert_underscores=True` default |
| Cookie | `Cookie(...)` | |
| Form | `Form(...)` | Requires `python-multipart` |
| File | `File(...)` / `UploadFile` | `UploadFile` streams; `bytes` loads to memory |

Example combining sources:

```python
@app.post("/items/{folder_id}", response_model=ItemOut, status_code=201)
async def create_item(
    folder_id: Annotated[int, Path(ge=1)],
    item: Item,                                  # body from JSON
    x_request_id: Annotated[str | None, Header()] = None,
):
    ...
```

## `response_model` vs return annotation

In modern FastAPI you can often skip `response_model=` and use a return type annotation:

```python
@app.get("/items/{item_id}")
async def get_item(item_id: int) -> ItemOut:
    return ItemOut(id=item_id, name="x", price=1.0)
```

Use `response_model=` explicitly when:
- The runtime return type differs from the declared output schema (e.g., return ORM model, declare `response_model=ItemOut`).
- You want OpenAPI to show a different schema from the in-process type.
- You're using `response_model_exclude_unset=True`, `response_model_exclude_none=True`, or `response_model_by_alias=True`.

## Multiple responses

```python
from fastapi.responses import JSONResponse

@app.get(
    "/items/{item_id}",
    response_model=ItemOut,
    responses={
        404: {"description": "Item not found"},
        403: {"description": "Forbidden"},
    },
)
async def get_item(item_id: int):
    if not allowed(item_id):
        return JSONResponse(status_code=403, content={"detail": "forbidden"})
    ...
```

`responses=` only documents the schema; returning a different shape still requires the explicit `JSONResponse`.

## Tags, summary, description, deprecated

```python
@app.post(
    "/items/",
    response_model=ItemOut,
    status_code=201,
    tags=["items"],
    summary="Create a new item",
    description="Long-form description; supports **markdown**.",
    deprecated=False,
)
async def create_item(item: Item):
    ...
```

The `tags` and `summary` flow into OpenAPI and become the SDK method's namespace/name.

## `APIRouter` and module split

```python
# src/app/routers/items.py
from fastapi import APIRouter, Depends

router = APIRouter(
    prefix="/items",
    tags=["items"],
    dependencies=[Depends(verify_api_key)],   # applied to every route
    responses={404: {"description": "Not found"}},
)

@router.get("/")
async def list_items(): ...

@router.get("/{item_id}")
async def get_item(item_id: int): ...
```

```python
# src/app/main.py
from fastapi import FastAPI
from app.routers import items, users

app = FastAPI()
app.include_router(items.router)
app.include_router(users.router, prefix="/v2/users", tags=["v2-users"])  # override
```

`include_router` parameters override the router-level ones at the call site:

- `prefix=` — concatenates onto the router's prefix.
- `tags=` — appended.
- `dependencies=` — appended.
- `responses=` — merged.

## Router-level dependencies

`dependencies=[Depends(...)]` runs the dependency for its side effect (auth check, rate limit). The return value is discarded — use a regular `Depends` in the function signature to actually receive the value.

```python
router = APIRouter(dependencies=[Depends(require_authenticated)])

@router.get("/me")
async def me(current_user: Annotated[User, Depends(get_current_user)]):
    # require_authenticated already ran; we just need the user here
    return current_user
```

## Path operation order matters

```python
@app.get("/users/me")          # MUST come first
async def me(): ...

@app.get("/users/{user_id}")   # otherwise matches "/users/me" as user_id="me"
async def get_user(user_id: int): ...
```

## Streaming and websocket routes

`StreamingResponse`, `WebSocket` endpoints — see [background-and-streaming.md](background-and-streaming.md).

## Defaults this skill always sets

- `response_model` (or return annotation) on every public route — see [wrong-vs-right.md](wrong-vs-right.md).
- `status_code=201` on POST routes that create a resource.
- `tags=` on every router — drives docs grouping.
- Router-level `dependencies=` for auth checks instead of repeating `Depends(get_current_user)` per route.
