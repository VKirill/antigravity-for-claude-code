# Wrong vs Right — Django

Common anti-patterns paired with the corrected form. Each pair is short, surgical, and grounded in a specific Django mechanism.

---

## 1. N+1 queries via lazy iteration

**Wrong**

```python
def order_list(request):
    orders = Order.objects.all()              # no select_related
    return render(request, "orders.html", {"orders": orders})
```

```django
{% for order in orders %}
  {{ order.customer.email }}      {# +1 SELECT per row #}
  {% for item in order.items.all %}
    {{ item.product.name }}       {# +1 SELECT per row, again #}
  {% endfor %}
{% endfor %}
```

**Right**

```python
def order_list(request):
    orders = (
        Order.objects
        .select_related("customer")
        .prefetch_related("items__product")
        .order_by("-created_at")
    )
    return render(request, "orders.html", {"orders": orders})
```

`select_related` for FK / one-to-one → single JOIN. `prefetch_related` for reverse FK / M2M → one extra SELECT regardless of row count. Verify with `django-debug-toolbar` or `len(connection.queries)`.

---

## 2. `csrf_exempt` on a regular form view

**Wrong**

```python
@csrf_exempt
def update_profile(request):
    # "had a CSRF error in testing, exempted to make it work"
    if request.method == "POST":
        request.user.email = request.POST["email"]
        request.user.save()
        return redirect("profile")
```

This view now happily accepts cross-site POSTs from any malicious page.

**Right**

```python
def update_profile(request):
    if request.method == "POST":
        form = ProfileForm(request.POST, instance=request.user)
        if form.is_valid():
            form.save()
            return redirect("profile")
    else:
        form = ProfileForm(instance=request.user)
    return render(request, "profile.html", {"form": form})
```

```django
<form method="post">
  {% csrf_token %}
  {{ form.as_p }}
  <button type="submit">Save</button>
</form>
```

Reserve `@csrf_exempt` for webhook receivers that perform their own provider signature check, and document it in the view docstring.

---

## 3. Bare `except` in a view

**Wrong**

```python
def charge(request):
    try:
        result = payments.charge(request.POST["token"], 1000)
    except:
        return JsonResponse({"ok": False})   # silent failure; no logs, no trace
    return JsonResponse({"ok": True, "id": result.id})
```

Hides bugs (typos, attribute errors), masks `KeyboardInterrupt` / `SystemExit`, gives users a meaningless response.

**Right**

```python
import logging
from django.http import JsonResponse
from .payments import PaymentError, payments

logger = logging.getLogger(__name__)

def charge(request):
    try:
        result = payments.charge(request.POST["token"], 1000)
    except PaymentError as exc:
        logger.warning("payment failed", extra={"reason": exc.reason})
        return JsonResponse({"ok": False, "reason": exc.public_reason}, status=402)
    return JsonResponse({"ok": True, "id": result.id})
```

Catch the specific exception, log it, return a meaningful response. Let unexpected exceptions bubble up to the 500 handler so Sentry / logs see them.

---

## 4. Sync ORM inside `async def`

**Wrong**

```python
async def product_view(request, pk):
    product = Product.objects.get(pk=pk)         # SynchronousOnlyOperation
    return JsonResponse({"name": product.name})
```

**Right**

```python
async def product_view(request, pk):
    product = await Product.objects.aget(pk=pk)
    return JsonResponse({"name": product.name})
```

If the call has no async variant (e.g., transactions), wrap with `sync_to_async`:

```python
from asgiref.sync import sync_to_async
from django.db import transaction

@sync_to_async
def _do_transactional_work(payload):
    with transaction.atomic():
        ...

async def view(request):
    payload = json.loads(request.body)
    await _do_transactional_work(payload)
    return JsonResponse({"ok": True})
```

Never set `DJANGO_ALLOW_ASYNC_UNSAFE=true` to silence the error — it disables the safety check, not the race condition.

---

## 5. Missing `on_delete`

**Wrong**

```python
class Comment(models.Model):
    post = models.ForeignKey("Post")             # no on_delete — TypeError at migration time
    body = models.TextField()
```

Django 2.0+ requires `on_delete`. Even when the migration succeeds (older Django), defaulting silently is dangerous.

**Right**

```python
class Comment(models.Model):
    post = models.ForeignKey("Post", on_delete=models.CASCADE)
    body = models.TextField()
```

Pick `CASCADE` / `PROTECT` / `SET_NULL` / `RESTRICT` deliberately — every choice has consequences. See [models-and-orm.md](models-and-orm.md).

---

## 6. `SECRET_KEY` checked into source

**Wrong**

```python
# settings.py committed to git
SECRET_KEY = "django-insecure-9!fa$#a@b%c..."
```

Even when prefixed `django-insecure-`, it's still the session signing key. Anyone with the repo can forge session cookies and password reset tokens.

**Right**

```python
# settings/prod.py
import os
SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]    # fail fast if missing
```

Generate a fresh key per environment:

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

Store in env (systemd `EnvironmentFile=`, Docker secrets, PM2 ecosystem). Rotate via `SECRET_KEY_FALLBACKS` — see [deployment.md](deployment.md).

---

## 7. Returning ORM instance from a JSON API

**Wrong**

```python
def api_user(request, pk):
    user = User.objects.get(pk=pk)
    return JsonResponse({
        "id": user.id, "email": user.email,
        "password": user.password,                # hash leak
        "is_superuser": user.is_superuser,        # privilege metadata leak
    })
```

Easy to accidentally include sensitive fields. Drifts as the model grows.

**Right** — use a serializer/schema:

```python
# DRF
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name"]

# Or Django Ninja
class UserOut(ModelSchema):
    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name"]
```

Explicit allowlist of fields. The serializer/schema is the contract.

---

## 8. Enqueuing background work without `transaction.on_commit`

**Wrong**

```python
def create_order(request):
    with transaction.atomic():
        order = Order.objects.create(...)
        send_receipt.delay(order.pk)       # fires immediately; worker may run before COMMIT
        # ... later code raises → atomic rolls back → worker can't find order
```

**Right**

```python
def create_order(request):
    with transaction.atomic():
        order = Order.objects.create(...)
        transaction.on_commit(lambda: send_receipt.delay(order.pk))
```

`on_commit` queues the callback to fire only after the outer transaction successfully commits. Same pattern for `django.tasks` (`task.enqueue`), emails, webhooks.

---

## 9. Read-modify-write counter race

**Wrong**

```python
def increment_views(post_id: int) -> None:
    post = Post.objects.get(pk=post_id)
    post.views += 1                              # read in Python
    post.save(update_fields=["views"])           # write — lost updates under concurrency
```

**Right**

```python
from django.db.models import F

def increment_views(post_id: int) -> None:
    Post.objects.filter(pk=post_id).update(views=F("views") + 1)
```

The increment happens inside the UPDATE statement — atomic in the DB.

---

## 10. Hardcoded URLs in templates

**Wrong**

```django
<a href="/products/{{ product.pk }}/">{{ product.name }}</a>
```

URLconf refactors silently break links. No reverse-routing.

**Right**

```django
<a href="{% url 'shop:product_detail' pk=product.pk %}">{{ product.name }}</a>
```

Plus `name="product_detail"` on the URL pattern and `app_name = "shop"` in the URLconf. See [views-urls.md](views-urls.md).

---

## 11. `DEBUG=True` in production

**Wrong**

```python
# settings.py shared across envs
DEBUG = True
```

Django then shows full SQL, settings snapshot, stack traces, and request data to any visitor who hits an error.

**Right**

```python
# settings/prod.py
DEBUG = False
ALLOWED_HOSTS = os.environ["DJANGO_ALLOWED_HOSTS"].split(",")
```

And run the deploy check:

```bash
python manage.py check --deploy
```

Address every warning before going live.

---

## 12. Letting workers race to apply migrations

**Wrong**

```python
# Gunicorn / Uvicorn `on_starting` hook in N processes
def on_starting(server):
    call_command("migrate", "--noinput")
```

N workers, N concurrent migration attempts. Postgres advisory locks usually save you, but the log noise hides real errors and other DBs may not.

**Right**

Apply migrations in a single one-shot step before starting any web process:

```bash
python manage.py migrate --check         # exit non-zero if pending
python manage.py migrate --noinput
systemctl reload myshop                  # then graceful reload workers
```

In Kubernetes: init container or pre-deploy job. See [deployment.md](deployment.md).
