# FastAPI — wrong vs right

Code pairs for the highest-impact mistakes. Preventive, not reactive (for reactive symptom-fixing see [troubleshooting.md](troubleshooting.md)).

---

## 1. Blocking I/O inside `async def`

This is the **#1 FastAPI production incident**. A single blocking call inside an `async def` route freezes the entire worker for the duration of that call — *every concurrent request on that worker waits*.

### Wrong

```python
import requests
import time
import psycopg2

@app.get("/orders/{order_id}")
async def get_order(order_id: int):
    # All three calls block the event loop
    user = requests.get(f"http://users/api/{order_id}").json()       # sync HTTP
    conn = psycopg2.connect(DB_URL)                                  # sync DB
    cur = conn.cursor(); cur.execute("SELECT * FROM orders WHERE id=%s", (order_id,))
    time.sleep(0.1)                                                  # sync sleep
    return {"order_id": order_id, "user": user, "row": cur.fetchone()}
```

### Right

```python
import asyncio
import httpx

@app.get("/orders/{order_id}", response_model=OrderOut)
async def get_order(
    order_id: int,
    http: Annotated[httpx.AsyncClient, Depends(get_http)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    user_resp = await http.get(f"http://users/api/{order_id}")
    user = user_resp.json()
    order = await db.get(Order, order_id)
    await asyncio.sleep(0.1)
    return OrderOut(order_id=order_id, user=user, row=order)
```

If you absolutely must call sync code (third-party library with no async API):

```python
result = await asyncio.to_thread(blocking_fn, *args)
```

`to_thread` runs the call in a thread pool so the event loop stays free.

**Detection**: `grep -nE 'async def' | xargs grep -lE 'requests\.|psycopg2\.|time\.sleep|open\('` flags suspects.

---

## 2. Leaking a DB session (no `try/finally` around `yield`)

### Wrong

```python
async def get_db():
    session = AsyncSession(bind=engine)
    yield session
    # If the endpoint raised, `session` is never closed — pool leak.
```

### Right

```python
async def get_db(request: Request) -> AsyncIterator[AsyncSession]:
    async with request.app.state.sessionmaker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

`async with sessionmaker()` ensures `close()` even when the endpoint raises. The explicit `try/except` controls commit/rollback semantics.

**Detection**: `grep -nE 'yield session' references/databases.md` should find this exact pattern; anything else is suspicious.

---

## 3. Returning ORM model with no `response_model`

### Wrong

```python
@app.get("/users/{user_id}")
async def get_user(user_id: int, db: Annotated[AsyncSession, Depends(get_db)]):
    return await db.get(User, user_id)
```

Risks:
- Leaks every column on the ORM row (including `password_hash`, `internal_notes`, deleted_at, ...).
- OpenAPI schema is empty / wrong — clients don't know the shape.
- Pydantic isn't filtering the response.

### Right

```python
class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr
    full_name: str

@app.get("/users/{user_id}", response_model=UserOut)
async def get_user(user_id: int, db: Annotated[AsyncSession, Depends(get_db)]) -> UserOut:
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404)
    return user   # FastAPI converts via UserOut.model_validate(user)
```

---

## 4. Trusting unvalidated body via `await request.json()`

### Wrong

```python
@app.post("/items/")
async def create_item(request: Request):
    body = await request.json()
    name = body["name"]       # KeyError → 500
    price = body["price"]     # type unknown
    ...
```

Bypasses Pydantic validation, OpenAPI schema, 422 errors.

### Right

```python
class ItemIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    price: float = Field(gt=0)

@app.post("/items/", response_model=ItemOut, status_code=201)
async def create_item(item: ItemIn):
    ...
```

FastAPI validates, generates the 422 response, and documents the schema.

---

## 5. Auth logic outside `Depends`

### Wrong

```python
@app.get("/admin/users")
async def list_admin_users(request: Request):
    token = request.headers.get("authorization", "").removeprefix("Bearer ")
    if not token:
        raise HTTPException(401)
    payload = jwt.decode(token, SECRET, algorithms=["HS256"])
    if "admin" not in payload.get("roles", []):
        raise HTTPException(403)
    # logic
```

Every route reimplements the check → drift, copy-paste bugs, untested branches. Some routes forget the role check entirely.

### Right

```python
async def require_admin(user: Annotated[User, Depends(get_current_user)]) -> User:
    if "admin" not in user.roles:
        raise HTTPException(status_code=403, detail="Admin only")
    return user

router = APIRouter(prefix="/admin", dependencies=[Depends(require_admin)])

@router.get("/users", response_model=list[UserOut])
async def list_admin_users(db: Annotated[AsyncSession, Depends(get_db)]):
    ...
```

One place owns the check. Tests cover it once. Adding a route to `/admin` automatically inherits the guard.

---

## 6. `allow_origins=["*"]` with `allow_credentials=True`

### Wrong

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,   # browsers SILENTLY drop the response
)
```

This combination is forbidden by the CORS spec. The browser pretends it didn't see the response.

### Right

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,      # explicit list from config
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)
```

If you legitimately have no credentials, set `allow_credentials=False` and `*` becomes safe — but it's a smell.

---

## 7. Hashing passwords with SHA-256 / unsalted

### Wrong

```python
import hashlib
hashed = hashlib.sha256(password.encode()).hexdigest()
```

Rainbow tables crack this in milliseconds.

### Right

```python
from passlib.context import CryptContext
pwd_ctx = CryptContext(schemes=["argon2"], deprecated="auto")
hashed = pwd_ctx.hash(password)
ok = pwd_ctx.verify(password, hashed)
```

Argon2id (or bcrypt) with appropriate cost parameters → see [recommended-defaults.md](recommended-defaults.md).

---

## 8. Using `@app.on_event("startup"/"shutdown")` in new code

### Wrong

```python
@app.on_event("startup")
async def startup():
    app.state.engine = create_async_engine(URL)

@app.on_event("shutdown")
async def shutdown():
    await app.state.engine.dispose()
```

Deprecated; doesn't share locals between hooks; brittle ordering.

### Right

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.engine = create_async_engine(URL)
    try:
        yield
    finally:
        await app.state.engine.dispose()

app = FastAPI(lifespan=lifespan)
```

---

## 9. Mutable module-level singletons instead of `Depends`

### Wrong

```python
# globals.py
settings = Settings()
db_engine = create_async_engine(settings.database_url)

# router.py
@router.get("/items/")
async def list_items():
    async with AsyncSession(bind=db_engine) as session:
        ...
```

Untestable (can't override engine in tests), couples modules, breaks lifespan ordering.

### Right

```python
@app.get("/items/", response_model=list[ItemOut])
async def list_items(db: Annotated[AsyncSession, Depends(get_db)]):
    ...
```

Now `app.dependency_overrides[get_db]` works in tests.

---

## 10. `BackgroundTasks` for work that must not be lost

### Wrong

```python
@app.post("/charge")
async def charge(payload: ChargeIn, tasks: BackgroundTasks):
    tasks.add_task(submit_to_payment_processor, payload)   # not durable
    return {"status": "accepted"}
```

If the worker crashes before the task runs, the charge is lost.

### Right

Push to a real queue (BullMQ via a worker, Celery, Dramatiq, RQ) with retries + dead-letter:

```python
@app.post("/charge")
async def charge(payload: ChargeIn, queue: Annotated[Queue, Depends(get_queue)]):
    await queue.enqueue("submit_to_payment_processor", payload.model_dump())
    return {"status": "accepted"}
```

`BackgroundTasks` is for *best-effort* side effects (cache warmup, fire-and-forget metrics). Anything that must survive a crash → queue.
