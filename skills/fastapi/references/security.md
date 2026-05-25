# FastAPI — security

This is the highest-risk reference. Get the defaults wrong and you ship auth bypasses. Pair with [troubleshooting.md](troubleshooting.md) and [wrong-vs-right.md](wrong-vs-right.md).

## Password hashing

Use `argon2-cffi` (preferred) or `passlib[bcrypt]`. Both expose a `CryptContext`-style API; both are battle-tested. Never SHA-256/MD5 a password.

```python
# Argon2id (preferred)
from passlib.context import CryptContext

pwd_ctx = CryptContext(schemes=["argon2"], deprecated="auto")
hashed = pwd_ctx.hash(plaintext)
ok = pwd_ctx.verify(plaintext, hashed)
```

```python
# bcrypt (still fine; faster verification, slower hashing under load)
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
```

Parameter tuning (rounds, memory cost) → see [recommended-defaults.md](recommended-defaults.md).

## `OAuth2PasswordBearer` — bearer-token extraction

```python
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/token",        # endpoint where the client exchanges credentials for a token
    scopes={"read": "Read access", "write": "Write access"},  # optional
    auto_error=True,               # raise 401 if header missing (default)
)
```

`oauth2_scheme` is a `Depends`-compatible callable. Use it as `Annotated[str, Depends(oauth2_scheme)]`.

## `OAuth2PasswordRequestForm` — login endpoint

```python
from fastapi.security import OAuth2PasswordRequestForm

@app.post("/auth/token")
async def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    user = await authenticate(db, form.username, form.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = issue_jwt({"sub": str(user.id), "scopes": form.scopes})
    return {"access_token": token, "token_type": "bearer"}
```

`form.username` / `form.password` come from `application/x-www-form-urlencoded` per the OAuth2 spec; `python-multipart` must be installed.

## JWT issuance and validation

Pick **one** JWT library:

| Library | Pros | Cons |
|---|---|---|
| `python-jose[cryptography]` | The historical FastAPI default; rich algorithm coverage | Less active maintenance |
| `PyJWT` | Active, simpler API, widely audited | Slightly fewer algorithm shortcuts |

Both are correct. New projects in 2026 — `PyJWT` is the safer default.

```python
import jwt  # PyJWT
from datetime import datetime, timedelta, timezone

def issue_jwt(claims: dict, *, secret: str, alg: str = "HS256", expires_in: timedelta) -> str:
    payload = {
        **claims,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + expires_in,
    }
    return jwt.encode(payload, secret, algorithm=alg)

def decode_jwt(token: str, *, secret: str, alg: str = "HS256") -> dict:
    return jwt.decode(token, secret, algorithms=[alg])   # algorithms MUST be a list
```

`python-jose` equivalent:

```python
from jose import jwt, JWTError

jwt.encode(payload, secret, algorithm="HS256")
jwt.decode(token, secret, algorithms=["HS256"])
```

Defaults (expiry, allowed algs) → [recommended-defaults.md](recommended-defaults.md).

## Current-user dependency

```python
async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> User:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=401,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")
    return user
```

Every protected endpoint uses `Annotated[User, Depends(get_current_user)]`. Never re-implement the check inline (see [wrong-vs-right.md](wrong-vs-right.md)).

## `SecurityScopes` — fine-grained authorization

```python
from fastapi.security import SecurityScopes
from fastapi import Security

async def get_current_user(
    security_scopes: SecurityScopes,
    token: Annotated[str, Depends(oauth2_scheme)],
):
    payload = jwt.decode(...)
    token_scopes = payload.get("scopes", [])
    for required in security_scopes.scopes:
        if required not in token_scopes:
            raise HTTPException(
                status_code=403,
                detail="Not enough permissions",
                headers={"WWW-Authenticate": f'Bearer scope="{" ".join(security_scopes.scopes)}"'},
            )
    return await load_user(payload["sub"])

@app.get("/items/")
async def list_items(
    user: Annotated[User, Security(get_current_user, scopes=["read"])],
):
    ...
```

Use `Security(...)` not `Depends(...)` to attach scopes — Security is a subclass that participates in OpenAPI scope documentation.

## OpenAPI security scheme

`OAuth2PasswordBearer` registers a security scheme automatically. Swagger UI gets an "Authorize" button; clients generated from the OpenAPI schema get a typed `Authorization: Bearer <token>` parameter.

To add a non-OAuth scheme (e.g., API key in header):

```python
from fastapi.security import APIKeyHeader

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=True)

async def require_api_key(key: Annotated[str, Depends(api_key_header)]) -> None:
    if key != settings.api_key:
        raise HTTPException(status_code=401)
```

## CORS

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,     # explicit list — never ["*"] with credentials
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
    max_age=600,
)
```

`allow_origins=["*"]` with `allow_credentials=True` is **silently dropped by browsers**. The right answer is an explicit origin allowlist sourced from settings.

## `TrustedHostMiddleware` — Host-header guard

```python
from fastapi.middleware.trustedhost import TrustedHostMiddleware

app.add_middleware(TrustedHostMiddleware, allowed_hosts=["api.example.com", "*.example.com"])
```

Protects against Host-header spoofing when generating absolute URLs.

## HTTPS redirect

```python
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
app.add_middleware(HTTPSRedirectMiddleware)
```

Only when terminating TLS in-process; if a reverse proxy already redirects, this is redundant.

## Rate limiting — `slowapi`

FastAPI ships no built-in rate limiter. `slowapi` (Starlette-compatible) is the de facto choice; `fastapi-limiter` (Redis + Lua) is the alternative for distributed setups.

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.get("/items/")
@limiter.limit("60/minute")
async def list_items(request: Request):    # `request` is required by slowapi
    ...
```

Behind a reverse proxy, replace `get_remote_address` with a function that reads `X-Forwarded-For` — but only after configuring `ProxyHeadersMiddleware` (Uvicorn `--forwarded-allow-ips`). See [deployment.md](deployment.md).

## CSRF

For pure JSON APIs consumed via `Authorization: Bearer` from native clients or SPAs that store the token in memory, CSRF is **not** a concern. For cookie-based sessions, use `starlette-csrf` or a SameSite=Strict cookie + double-submit token pattern.

## Don't roll your own crypto

- ❌ HMAC-SHA256 of `username + password` as a "session token"
- ❌ Reversible encoding of user IDs ("token = base64(user_id)")
- ❌ Comparing tokens with `==` (timing attack — use `hmac.compare_digest`)
- ❌ Storing JWT secret in source control (use `pydantic-settings` + `.env`)
