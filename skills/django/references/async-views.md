# Async views & ASGI

Django supports async views, async middleware, async ORM, and async signals. The ORM async surface has matured: every standard queryset method has an `a`-prefixed variant, and `async for` iteration is supported on every QuerySet.

## When to go async

Use `async def` views **only** when the request actually performs concurrent I/O — multiple outbound HTTP calls, long-polling, streaming, slow upstream services. Sync Django is not slower than async for typical CRUD; the cost of async is added complexity, sync-middleware penalties, and a different deployment story.

Pattern: keep most views sync, add `async def` for the specific endpoints that benefit.

## `async def` views

```python
import asyncio
import httpx

async def my_view(request):
    async with httpx.AsyncClient() as client:
        # concurrent upstream calls
        weather, events = await asyncio.gather(
            client.get("https://api.weather.example/now"),
            client.get("https://api.events.example/today"),
        )
    return JsonResponse({"weather": weather.json(), "events": events.json()})
```

Class-based views: declare the HTTP method handler as `async def`, **not** `as_view()` or `__init__`:

```python
from django.views import View

class MyView(View):
    async def get(self, request):
        ...
        return HttpResponse(...)

    async def post(self, request):
        ...
```

## Async ORM

Every queryset method has an async variant:

```python
# Read
product = await Product.objects.aget(pk=1)              # raises DoesNotExist
first = await Product.objects.filter(status="published").afirst()
last  = await Product.objects.alast()
n     = await Product.objects.acount()
exists = await Product.objects.filter(pk=1).aexists()

# Write
product = await Product.objects.acreate(name="X", price_cents=1000)
await Product.objects.abulk_create([...])
await Product.objects.filter(pk=1).aupdate(name="Y")
await Product.objects.abulk_update([...], fields=["name"])
await Product.objects.filter(status="draft").adelete()

# Model method
product.name = "New"
await product.asave(update_fields=["name"])

# Iteration
async for p in Product.objects.filter(status="published"):
    print(p.name)
```

Pagination has an `AsyncPaginator` (Django 6) to match.

## Transactions in async

Transactions are **not yet** safe to use inside `async def` views — wrap them via `sync_to_async`:

```python
from asgiref.sync import sync_to_async
from django.db import transaction

@sync_to_async
def _do_transfer(from_id: int, to_id: int, amount: int) -> None:
    with transaction.atomic():
        from_acc = Account.objects.select_for_update().get(pk=from_id)
        to_acc = Account.objects.select_for_update().get(pk=to_id)
        from_acc.balance -= amount
        to_acc.balance += amount
        from_acc.save(update_fields=["balance"])
        to_acc.save(update_fields=["balance"])

async def transfer_view(request, from_id: int, to_id: int):
    payload = json.loads(request.body)
    await _do_transfer(from_id, to_id, payload["amount"])
    return JsonResponse({"ok": True})
```

`thread_sensitive=True` (the default) keeps the wrapped sync code in the same thread as other thread-sensitive callables — preserves transaction context. Set `thread_sensitive=False` only for code that's truly independent.

## `SynchronousOnlyOperation`

Calling a sync ORM method from an async context raises `SynchronousOnlyOperation`:

```python
# WRONG — sync queryset eval inside an async view
async def view(request):
    products = Product.objects.all()
    return JsonResponse({"count": len(products)})   # raises

# RIGHT — use async variant
async def view(request):
    n = await Product.objects.acount()
    return JsonResponse({"count": n})

# RIGHT — for sync-only APIs, wrap once
from asgiref.sync import sync_to_async

@sync_to_async
def render_legacy(request, context):
    return render(request, "legacy.html", context)

async def view(request):
    return await render_legacy(request, {"x": 1})
```

In dev, this error fires immediately. In rare cases the check is bypassed by `DJANGO_ALLOW_ASYNC_UNSAFE=true` — never set this in production.

## `sync_to_async` and `async_to_sync`

From `asgiref.sync`:

| Function | Direction | Use |
|---|---|---|
| `sync_to_async(fn)` | call sync from async | wrapping legacy sync code in an async view |
| `async_to_sync(fn)` | call async from sync | calling an async function from a management command or sync view |

```python
from asgiref.sync import sync_to_async, async_to_sync

# Decorator form
@sync_to_async
def some_sync_work(x: int) -> int:
    return x * 2

async def view(request):
    n = await some_sync_work(21)

# Inline
result = await sync_to_async(slow_func, thread_sensitive=True)(arg)

# Async called from sync
def sync_caller():
    return async_to_sync(my_async_func)(arg)
```

## ASGI deployment

Sync deployment uses WSGI (`gunicorn config.wsgi`). Async views run under WSGI **but** each request spins up its own event loop and pays a penalty — fine for occasional async, bad as the default.

Real async deployment uses ASGI. Two recipes:

### Standalone Uvicorn

```bash
uvicorn config.asgi:application --host 0.0.0.0 --port 8000 --workers 4
```

Best for pure async workloads. `--workers N` spawns N independent OS processes.

### Gunicorn + UvicornWorker

```bash
gunicorn config.asgi:application \
  --worker-class uvicorn.workers.UvicornWorker \
  --workers 4 \
  --bind 0.0.0.0:8000 \
  --timeout 60 \
  --graceful-timeout 30 \
  --access-logfile - --error-logfile -
```

Best when you want Gunicorn's mature process management (master/worker, graceful reloads, signal handling) with ASGI workers. This is the canonical production setup.

Behind a reverse proxy (Angie/Nginx), proxy to the upstream Gunicorn socket and let the proxy handle TLS / compression / static files. See [deployment.md](deployment.md).

## Sync middleware penalty

If **any** middleware in `MIDDLEWARE` is sync-only, Django adapts the async stack for that middleware — every request through that pipeline pays the cost. Audit `MIDDLEWARE` once you go ASGI; replace third-party sync middleware with async-compatible alternatives, or roll your own. Enable debug logging to spot adapted middleware:

```
django.request DEBUG: Asynchronous handler adapted for middleware ...
```

## Channels (WebSockets, long-running connections)

Django itself doesn't ship WebSocket support. Use [Django Channels](https://channels.readthedocs.io/) — a separate package that builds on ASGI:

```python
# config/asgi.py — Channels integration
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.prod")
django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": URLRouter(websocket_urlpatterns),
})
```

This skill covers only the integration point. For consumer design, channel layers, group broadcasts, presence — see the `channels` cascade skill or the Channels docs.

## Common pitfalls

- Calling sync ORM in `async def` view — `SynchronousOnlyOperation`
- Using `transaction.atomic()` directly in async — wrap with `sync_to_async`
- Running async views under WSGI in production — degrades to one-off event loops
- Forgetting that one sync middleware penalizes the whole async pipeline
- Mixing thread-sensitive and non-thread-sensitive `sync_to_async` calls inside the same DB transaction
- Setting `DJANGO_ALLOW_ASYNC_UNSAFE=true` to "shut up the error" — guarantees data races
