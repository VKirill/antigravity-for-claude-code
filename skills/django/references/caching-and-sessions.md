# Caching & sessions

## Cache backends

Django ships with a unified cache API across multiple backends:

```python
# settings/base.py
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": "redis://127.0.0.1:6379/1",
    },
}
```

| Backend | `BACKEND` | When |
|---|---|---|
| Redis (recommended) | `django.core.cache.backends.redis.RedisCache` | Production; shared across processes |
| Memcached | `django.core.cache.backends.memcached.PyMemcacheCache` | Production alternative, no persistence |
| Database | `django.core.cache.backends.db.DatabaseCache` | When Redis isn't an option |
| Local memory | `django.core.cache.backends.locmem.LocMemCache` | Dev only; per-process, not shared |
| File | `django.core.cache.backends.filebased.FileBasedCache` | Niche |
| Dummy | `django.core.cache.backends.dummy.DummyCache` | Tests / disable cache |

For Redis, install `redis>=5` and use `LOCATION` of the form `redis://[user:pass@]host:port/db`. Multiple cache aliases let you point fragments and sessions at different DBs or instances.

## Low-level cache API

```python
from django.core.cache import cache

cache.set("featured_product_ids", [1, 7, 42], timeout=60 * 5)
ids = cache.get("featured_product_ids")            # None on miss
ids = cache.get("featured_product_ids", default=[])

# Atomic add — only sets if missing
cache.add("lock:job-42", "owner", timeout=30)

# Atomic increment
cache.incr("hits:home")                            # raises if key missing
cache.set("hits:home", 0); cache.incr("hits:home")

# Batch
cache.set_many({"a": 1, "b": 2}, timeout=60)
values = cache.get_many(["a", "b", "c"])

cache.delete("featured_product_ids")
cache.delete_many(["a", "b"])
cache.clear()                                      # be careful — flushes the whole alias
```

`timeout` semantics:
- `None` → cache forever (until eviction or explicit delete)
- `0` → don't cache (no-op set)
- positive int → seconds

## Cache patterns

### Cache-aside (read-through)

```python
def get_featured_products():
    cached = cache.get("featured_products")
    if cached is not None:
        return cached
    products = list(Product.objects.published().filter(featured=True))
    cache.set("featured_products", products, timeout=60 * 10)
    return products
```

Issues to think about:
- **Stampede**: when the key expires, every concurrent request rebuilds. Mitigate with `cache.add` of a sentinel lock, or by warming the cache from a periodic task.
- **Stale invalidation**: when the underlying data changes, delete the key in a `post_save` signal or in the write view itself.

### `get_or_set`

```python
products = cache.get_or_set(
    "featured_products",
    default=lambda: list(Product.objects.published().filter(featured=True)),
    timeout=60 * 10,
)
```

Single-call cache-aside. The `default` callable runs only on miss.

### Versioned keys

```python
cache.set("user_profile", data, timeout=3600, version=2)
cache.get("user_profile", version=2)
```

`version` is appended to the actual cache key. Bumping the version effectively invalidates old data without touching every key.

## Per-view cache

```python
from django.views.decorators.cache import cache_page, never_cache

@cache_page(60 * 15)
def landing(request):
    ...

@never_cache
def dashboard(request):
    ...
```

`cache_page` caches the **response** based on URL + query string + selected headers. Don't apply it to views that depend on `request.user` or any per-session state without `vary_on_cookie` / `vary_on_headers`.

## Template fragment cache

```django
{% load cache %}

{% cache 300 sidebar request.user.id %}
  {# expensive sidebar markup #}
{% endcache %}
```

Arguments: timeout (seconds), fragment name, vary keys (any number). Use `{% cache %}` for stable widgets — navigation, sidebar, footer — that depend on a small set of inputs.

## Cache key versioning across deploys

Django keys are prefixed with `KEY_PREFIX` if set:

```python
CACHES = {"default": {..., "KEY_PREFIX": "v3"}}
```

Bumping `KEY_PREFIX` in a deploy isolates the new code's cache from the old — prevents stale `pickle` payloads when classes change.

## Sessions

`SessionMiddleware` writes a session cookie keyed to a session ID. The data store is pluggable:

```python
SESSION_ENGINE = "django.contrib.sessions.backends.cache"
SESSION_CACHE_ALIAS = "default"
```

| Engine | Module | Use |
|---|---|---|
| Database (default) | `django.contrib.sessions.backends.db` | Authoritative, slow |
| Cache | `django.contrib.sessions.backends.cache` | Fastest; lost on cache flush |
| Cached DB | `django.contrib.sessions.backends.cached_db` | DB authoritative, cache fast path — best of both |
| File | `django.contrib.sessions.backends.file` | Single-host only |
| Signed cookies | `django.contrib.sessions.backends.signed_cookies` | Stateless; all data lives in the cookie |

For multi-process / multi-host deploys, use `cache` or `cached_db` with a shared Redis. Never use `file` or `locmem`.

## Session cookie hardening

```python
SESSION_COOKIE_SECURE = True            # HTTPS-only
SESSION_COOKIE_HTTPONLY = True          # block JS access
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_EXPIRE_AT_BROWSER_CLOSE = False
SESSION_SAVE_EVERY_REQUEST = False      # only save on changes — reduces write load
```

Numeric values (cookie age, etc.) live in [recommended-defaults.md](recommended-defaults.md).

## Session API

```python
# In a view
request.session["cart_id"] = 42
cart_id = request.session.get("cart_id")
del request.session["cart_id"]

request.session.set_expiry(60 * 60)      # 1h from now (per-session override)
request.session.flush()                  # logout: deletes session row + rotates key
request.session.cycle_key()              # rotate ID without losing data — use after privilege change
```

`request.session.modified = True` forces a save when you mutate a nested object (Django can't detect deep changes automatically).

## Rate limiting with cache

Cheap per-IP throttling without a third-party package:

```python
from django.core.cache import cache
from django.http import HttpResponseTooManyRequests

def throttled(request):
    key = f"throttle:{request.META['REMOTE_ADDR']}"
    count = cache.get(key, 0)
    if count >= 100:
        return HttpResponseTooManyRequests("rate limited")
    cache.set(key, count + 1, timeout=60)
    ...
```

Good for coarse throttling. For real abuse protection, use the reverse proxy (`limit_req_zone` in Angie/Nginx) or DRF's throttle classes.

## Common pitfalls

- Caching ORM model instances directly — works, but breaks if the model class changes shape; prefer caching serialized data
- Forgetting to `vary_on_cookie` on `cache_page` for user-aware views — leaks one user's view to another
- Setting `timeout=0` thinking it means "forever" — it means "don't cache"
- Using `LocMemCache` in multi-process production — each worker has its own cache; results look random
- Storing very large payloads in sessions — `signed_cookies` blows past the 4 KB cookie limit; even server-side, sessions are read on every request
