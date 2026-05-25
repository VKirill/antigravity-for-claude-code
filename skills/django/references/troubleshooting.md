# Troubleshooting — Django

Symptom-indexed. Find your symptom, follow the diagnosis steps, apply the fix.

---

## N+1 query — page loads dozens / hundreds of identical queries

**Symptoms**
- Page is slow but each query is fast
- `django-debug-toolbar` shows the same SQL with different parameter values, once per row
- `django.db.backends` at DEBUG shows many `SELECT` statements per request

**Diagnose**

```python
# Install django-debug-toolbar in dev — INSTALLED_APPS + MIDDLEWARE + INTERNAL_IPS
# It shows query count and duplicates per request.

# Or, ad hoc:
from django.db import connection, reset_queries
reset_queries()
# ... call view code ...
print(len(connection.queries), "queries")
```

`django-silk` is the production-safe alternative.

**Common causes**
- Iterating a queryset that accesses FK / one-to-one without `select_related`
- Iterating that accesses reverse FK / M2M without `prefetch_related`
- Using `.only()` and then touching a deferred column inside the loop
- Admin changelist with custom `list_display` that calls related fields

**Fix**

```python
# WRONG
for order in Order.objects.all():
    print(order.customer.email)         # one extra SELECT per row

# RIGHT — FK
for order in Order.objects.select_related("customer"):
    print(order.customer.email)

# RIGHT — reverse FK
for order in Order.objects.prefetch_related("items"):
    for item in order.items.all():
        print(item.product_id)
```

Admin: set `list_select_related = ("customer",)` and `list_prefetch_related = ("items",)`.

---

## `OperationalError: server closed the connection unexpectedly` after idle

**Symptoms**
- First request after some idle time fails with `OperationalError` or `InterfaceError`
- Subsequent requests succeed
- Common behind PgBouncer or after Postgres restart

**Diagnose**

```python
# Check CONN_MAX_AGE — if > 0, Django reuses connections.
# Without CONN_HEALTH_CHECKS, a stale connection isn't probed before use.
```

**Common causes**
- `CONN_MAX_AGE = None` (forever) with `CONN_HEALTH_CHECKS = False`
- Postgres or PgBouncer killed idle connections (`idle_in_transaction_session_timeout`, PgBouncer `server_idle_timeout`)
- Network hiccup between app and DB

**Fix**

```python
DATABASES["default"]["CONN_MAX_AGE"] = 60          # or None
DATABASES["default"]["CONN_HEALTH_CHECKS"] = True  # probes before reuse
```

If behind PgBouncer in transaction-pooling mode: set `CONN_MAX_AGE = 0` — Django can't manage persistent connections through that pool.

---

## `CSRF verification failed — CSRF token missing or incorrect`

**Symptoms**
- POST returns 403 with the CSRF page
- Browser DevTools shows the form submitting but `csrftoken` cookie is missing or mismatched

**Diagnose**

```bash
# Check the request:
# - Same-origin? CSRF_TRUSTED_ORIGINS must include scheme + host for cross-subdomain
# - Cookie set? SESSION_COOKIE_SECURE requires HTTPS in dev too
# - Header included? AJAX must send X-CSRFToken
```

**Common causes**
- Missing `{% csrf_token %}` in the HTML form
- AJAX call missing `X-CSRFToken` header
- `CSRF_TRUSTED_ORIGINS` not set for a different scheme/host
- `SECURE_PROXY_SSL_HEADER` mismatch — Django thinks request is HTTP, cookie was set Secure
- Some middleware running before `CsrfViewMiddleware` is consuming the body

**Fix**

```python
# settings/prod.py
CSRF_TRUSTED_ORIGINS = ["https://app.example.com", "https://www.example.com"]
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
```

Never blanket-`@csrf_exempt` to "make it work". Only exempt verified webhook endpoints that perform their own signature check.

---

## `DisallowedHost: Invalid HTTP_HOST header`

**Symptoms**
- 400 in logs with `DisallowedHost`
- Real users see "Bad Request" page (or Django's generic 400)
- Often appears after a deploy or hostname change

**Common causes**
- `ALLOWED_HOSTS` missing the public hostname
- New CDN / preview-deploy hostname not in the list
- Bots probing with random `Host` headers — harmless, but noisy

**Fix**

```python
ALLOWED_HOSTS = ["myshop.example.com", "www.myshop.example.com"]
```

For preview deploys, add wildcards: `["*.preview.example.com"]`. Don't set `["*"]` in production — it disables the protection.

---

## Race condition on concurrent writes (lost update)

**Symptoms**
- Two requests modify the same row "at the same time"; one update is lost
- Order totals, inventory counts, counters silently wrong

**Diagnose**

Reproduce with two shells running the conflicting code concurrently. Add `print(connection.queries)` to confirm the missing `FOR UPDATE`.

**Common causes**
- Read-modify-write in Python without locking
- `Model.save()` instead of `update()` for atomic increments

**Fix — `select_for_update` inside `atomic`**

```python
from django.db import transaction

@transaction.atomic
def decrement_stock(product_id: int, qty: int) -> None:
    p = Product.objects.select_for_update().get(pk=product_id)
    if p.stock < qty:
        raise OutOfStock()
    p.stock -= qty
    p.save(update_fields=["stock"])
```

**Or — `F` expression (no lock needed)**

```python
from django.db.models import F

Product.objects.filter(pk=product_id, stock__gte=qty).update(stock=F("stock") - qty)
```

`F("stock") - qty` runs atomically inside the UPDATE; no read-modify-write in Python.

---

## `--fake` migration drift — schema doesn't match models

**Symptoms**
- `python manage.py migrate --check` passes locally, fails in another env
- Column mentioned by a model doesn't exist in the DB
- `OperationalError: column "x" does not exist`

**Common causes**
- Someone ran `migrate --fake` to silence a failure; the SQL never actually ran
- Manual schema edits in the DB that Django doesn't know about
- A squash migration applied while old migrations were already marked

**Fix**

```bash
# Diagnose what Django thinks vs what's there
python manage.py showmigrations
python manage.py sqlmigrate shop 0007        # inspect the SQL that was supposed to run
```

If drift is small, write a corrective migration with `RunSQL` to bring schema in line. If drift is large, take downtime, snapshot the DB, and reset to a known good migration baseline. Never `--fake` again to "fix" it.

---

## Async view raises `SynchronousOnlyOperation`

**Symptoms**
- `django.core.exceptions.SynchronousOnlyOperation: You cannot call this from an async context`
- Stack trace points to a sync ORM call inside `async def`

**Common causes**
- Calling `Model.objects.get(...)` instead of `aget(...)` inside an `async def` view
- Iterating a sync queryset in async code
- Using `transaction.atomic()` in async without wrapping via `sync_to_async`

**Fix**

```python
# WRONG
async def view(request, pk):
    product = Product.objects.get(pk=pk)
    return JsonResponse({"name": product.name})

# RIGHT
async def view(request, pk):
    product = await Product.objects.aget(pk=pk)
    return JsonResponse({"name": product.name})

# Transactions still need sync_to_async
from asgiref.sync import sync_to_async

@sync_to_async
def _do_work(...):
    with transaction.atomic():
        ...

async def view(request):
    await _do_work(...)
```

Never set `DJANGO_ALLOW_ASYNC_UNSAFE=true` to silence this — it disables the safety check and lets you write data races.

---

## Static files 404 in production

**Symptoms**
- `collectstatic` ran fine in dev
- Production loads pages but CSS / JS return 404
- Browser DevTools shows `/static/app.css` → 404

**Common causes**
- `collectstatic --noinput` not run in deploy pipeline
- Whitenoise middleware not in `MIDDLEWARE` (or in the wrong position)
- Reverse proxy not configured to serve `/static/` from `STATIC_ROOT`
- `STATIC_ROOT` points to a directory the web user can't read

**Fix**

Check the deploy order in [deployment.md](deployment.md). Run `collectstatic --noinput --dry-run` to confirm it sees the files.

Verify Whitenoise is right after `SecurityMiddleware`:

```python
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    ...
]
```

Or, if the reverse proxy serves statics, confirm its `location /static/` block points at `STATIC_ROOT`.

---

## `IntegrityError: NOT NULL constraint failed` after model change

**Symptoms**
- `migrate` succeeds on dev (where the table was new) but fails on prod (where rows exist)
- New non-nullable column added in one go

**Common causes**
- `ADD COLUMN NOT NULL` without a default, on a table with existing rows
- Multi-step migration not split

**Fix**

Use the three-step pattern:

1. Migration A: add column nullable
2. Data migration (`RunPython`): backfill existing rows
3. Migration B: flip the column to `NOT NULL`

See [migrations.md](migrations.md) for the safety patterns.

---

## Long-running migration locks production table

**Symptoms**
- `CREATE INDEX` or `ALTER COLUMN` runs for minutes
- Requests pile up; queries time out
- Postgres `pg_stat_activity` shows the migration holding an `AccessExclusiveLock`

**Fix**

For Postgres index creation, use `CONCURRENTLY` via `RunSQL` (`atomic=False`). For column type changes, prefer the add-new-column / dual-write / cut-over pattern. See migration safety in [migrations.md](migrations.md).

If a long migration is already running and blocking writes, the only safe escape is to cancel it (and roll back), then redesign as a multi-step plan.

---

## Memory leak / worker bloat

**Symptoms**
- Gunicorn worker RSS grows over hours/days
- OOM kill or visible slowness after long uptime
- `pmap` shows process steadily larger

**Common causes**
- Caching large objects in module-level globals
- Long-lived querysets held in module state (rare)
- `DEBUG=True` in production — Django keeps every SQL query in memory
- `django-debug-toolbar` enabled in production

**Fix**

- `DEBUG=False` in production (always)
- Use `--max-requests 1000 --max-requests-jitter 100` to recycle workers
- Avoid module-level mutable caches; use Django's cache framework

---

## CSRF works in browser but fails for `fetch()` from same SPA

**Symptoms**
- Curl/Postman calls succeed
- Browser `fetch('/api/...', {method:'POST'})` returns 403

**Fix**

Read the `csrftoken` cookie and forward it:

```js
function getCookie(name) {
  return document.cookie.split('; ').find(c => c.startsWith(name + '='))?.split('=')[1];
}

await fetch('/api/products/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRFToken': getCookie('csrftoken'),
  },
  credentials: 'same-origin',
  body: JSON.stringify(payload),
});
```

For cross-origin SPA + API, use token-based auth (DRF `TokenAuthentication` / JWT) and exempt only those endpoints from CSRF — see [drf-and-ninja.md](drf-and-ninja.md).
