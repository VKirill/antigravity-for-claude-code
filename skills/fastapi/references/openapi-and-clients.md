# FastAPI — OpenAPI & client generation

FastAPI generates an OpenAPI 3.1 schema from your path operations, Pydantic models, and security schemes — for free. The schema is the contract; everything else (Swagger UI, ReDoc, client SDKs) derives from it.

## Defaults

| Endpoint | Purpose |
|---|---|
| `/openapi.json` | The schema itself |
| `/docs` | Swagger UI |
| `/redoc` | ReDoc |

Disable any of them with the constructor flags:

```python
app = FastAPI(
    title="My API",
    version="1.4.0",
    description="...",
    docs_url=None,        # disable Swagger UI
    redoc_url=None,       # disable ReDoc
    openapi_url=None,     # disable schema entirely
)
```

Production decision: expose `/docs` only behind auth or on an internal-only host. The schema itself (`/openapi.json`) leaks every route and field — treat as semi-public.

## App-level metadata

```python
app = FastAPI(
    title="Orders API",
    description="Order management for the storefront",
    version="2.3.1",
    contact={"name": "Platform team", "email": "platform@example.com"},
    license_info={"name": "Apache 2.0", "url": "https://www.apache.org/licenses/LICENSE-2.0"},
    terms_of_service="https://example.com/tos",
    openapi_tags=[
        {"name": "orders", "description": "Order lifecycle"},
        {"name": "auth", "description": "Authentication"},
    ],
    servers=[
        {"url": "https://api.example.com", "description": "Production"},
        {"url": "https://staging-api.example.com", "description": "Staging"},
    ],
)
```

`openapi_tags` controls group ordering in Swagger UI; tags referenced from routes that aren't listed here still render but at the bottom.

## Route-level metadata

```python
@app.post(
    "/orders",
    response_model=OrderOut,
    status_code=201,
    tags=["orders"],
    summary="Create order",
    description="Creates an order in `pending` state. Returns the created resource.",
    response_description="The created order",
    deprecated=False,
    operation_id="createOrder",       # explicit; clients use this as the method name
    responses={
        409: {"description": "Conflict: idempotency key already used"},
    },
)
async def create_order(order: OrderIn):
    ...
```

Set `operation_id` explicitly for every route the moment you generate SDKs — FastAPI's auto-generated IDs include the path and are noisy.

## Examples

```python
class ItemIn(BaseModel):
    name: str
    price: float

    model_config = {
        "json_schema_extra": {
            "examples": [
                {"name": "Plumbus", "price": 19.99},
            ]
        }
    }
```

Or per-route:

```python
@app.post(
    "/items",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "examples": {
                        "minimal": {"value": {"name": "x", "price": 1}},
                        "full":    {"value": {"name": "y", "price": 9, "tags": ["a"]}},
                    }
                }
            }
        }
    },
)
```

Swagger UI renders the examples in its "Try it out" form. SDK generators pick them up as JSDoc / docstring examples.

## Custom OpenAPI hook

For tweaks the decorator API doesn't expose:

```python
from fastapi.openapi.utils import get_openapi

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    schema["info"]["x-logo"] = {"url": "https://example.com/logo.svg"}
    # mutate however you need
    app.openapi_schema = schema
    return schema

app.openapi = custom_openapi
```

Cache result to avoid regenerating on every `/openapi.json` request.

## Separate input vs output schemas

FastAPI 0.100+ generates **separate** schemas for input and output when a model has read-only computed fields or defaults that should only appear on output. Disable globally:

```python
app = FastAPI(separate_input_output_schemas=False)   # legacy combined schema
```

Default (`True`) is what you want for clean SDKs.

## OAuth2 / security in OpenAPI

`OAuth2PasswordBearer` registers an OAuth2 password-flow security scheme automatically. Swagger UI shows an "Authorize" button. To customize:

```python
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/token",
    scopes={"read": "Read", "write": "Write"},
)
```

For an API key in a header:

```python
from fastapi.security import APIKeyHeader
key_scheme = APIKeyHeader(name="X-API-Key")
```

Both end up in `components.securitySchemes` and routes that `Depends(...)` on them get a `security: [...]` reference automatically.

## Generating typed clients

Pick by target language:

| Generator | Language | Notes |
|---|---|---|
| `openapi-generator` (Java tool) | Many (TS, Python, Go, Rust, Java, ...) | Industry standard; lots of templates |
| `openapi-typescript` | TS (types only, no runtime) | Use with `openapi-fetch` for a tiny runtime |
| `openapi-typescript-codegen` (Heyapi) | TS (full client) | Friendly DX, smaller output |
| `Speakeasy` / `Fern` / `Stainless` | TS, Python, others (SaaS) | Production-grade SDKs |

Typical workflow:

```bash
# 1. Dump schema during CI
python -c "from app.main import app; import json; print(json.dumps(app.openapi()))" > openapi.json

# 2. Generate clients
openapi-generator-cli generate -i openapi.json -g typescript-fetch -o clients/ts
```

Pin the generator version — output drift between generator releases is a common reason for "the client suddenly stopped working".

## Versioning

Three common strategies:

1. **URL prefix** — `app.include_router(v1, prefix="/v1")`. Simplest.
2. **Header version** — `Accept: application/vnd.example.v2+json`. Cleaner URLs but harder to debug.
3. **Separate FastAPI apps mounted at sub-paths** — `app.mount("/v2", v2_app)`. Useful when v1 and v2 are radically different.

Either way, bump `app.version` so SDK generators emit a versioned package.

## Conditional schema (per environment)

```python
app = FastAPI(openapi_url=None if settings.environment == "production" else "/openapi.json")
```

Or gate the route behind `Depends(internal_only)`.

## Anti-patterns

- ❌ Letting auto-generated `operation_id` ship to clients — every rename of the path/function shifts the SDK method name.
- ❌ Returning a different schema than `response_model` declares — clients break silently.
- ❌ Skipping `tags` — Swagger UI groups everything under "default".
- ❌ Exposing `/openapi.json` on a production public URL when the API is internal — it documents every field and route.
