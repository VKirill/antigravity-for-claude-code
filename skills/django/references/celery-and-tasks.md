# Celery & background tasks

Django 6 ships a built-in `django.tasks` framework for simple enqueueing. Celery remains the established choice for complex workflows. Both rely on the same correctness rules: **idempotent task bodies**, **fire-after-commit scheduling**, **explicit retry semantics**.

## `django.tasks` (Django 6)

Lightweight in-tree queue API. Django handles enqueueing; external workers (or the in-process worker for dev) execute tasks.

```python
# shop/tasks.py
from django.tasks import task
from django.core.mail import send_mail

@task
def email_users(emails: list[str], subject: str, body: str) -> int:
    return send_mail(subject, body, None, emails)
```

Enqueue from a view:

```python
def signup(request):
    # ... create user ...
    email_users.enqueue(
        emails=[user.email],
        subject="Welcome",
        body="Welcome to MyShop.",
    )
    return redirect("home")
```

Configure a backend in `settings.py` (`TASKS = {...}`); pick the immediate backend for tests and a durable backend (Redis/DB) for prod. Run a worker process to actually execute enqueued tasks.

When `django.tasks` is enough: simple async sending of emails, webhooks, image processing, notification fan-out. When you outgrow it: complex retries, chained workflows, scheduled cron — reach for Celery.

## Celery integration pattern

```python
# config/celery.py
import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.prod")

app = Celery("myproject")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
```

```python
# config/__init__.py
from .celery import app as celery_app
__all__ = ["celery_app"]
```

```python
# settings/base.py
CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://127.0.0.1:6379/0")
CELERY_RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", "redis://127.0.0.1:6379/1")
CELERY_TASK_ACKS_LATE = True           # ack only after success — survives worker crash
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_TASK_TIME_LIMIT = 60 * 5        # hard kill
CELERY_TASK_SOFT_TIME_LIMIT = 60 * 4   # SoftTimeLimitExceeded — cleanup chance
CELERY_TASK_DEFAULT_QUEUE = "default"
CELERY_WORKER_PREFETCH_MULTIPLIER = 1  # fair scheduling for long tasks
```

Define tasks anywhere in apps:

```python
# shop/tasks.py
from celery import shared_task
from django.core.mail import send_mail

@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def email_users(self, emails, subject, body):
    try:
        return send_mail(subject, body, None, emails)
    except Exception as exc:
        raise self.retry(exc=exc)
```

`autodiscover_tasks()` scans every `INSTALLED_APPS` for `tasks.py`.

Run a worker: `celery -A config worker --loglevel=info --concurrency=4`.
Run beat for periodic tasks: `celery -A config beat --loglevel=info`.

## `transaction.on_commit` — fire after commit, not before

Both `django.tasks` and Celery have the same hazard: if you enqueue a task inside a transaction that later rolls back, the worker still processes the task — and finds the data doesn't exist.

Always wrap enqueuing in `transaction.on_commit`:

```python
from django.db import transaction

def create_order(request):
    with transaction.atomic():
        order = Order.objects.create(...)
        # WRONG — task fires even if the outer transaction rolls back
        # email_users.enqueue(emails=[user.email], subject="Order", body="Thanks!")

        # RIGHT — task fires only after a successful COMMIT
        transaction.on_commit(
            lambda: email_users.enqueue(
                emails=[user.email], subject="Order", body="Thanks!"
            )
        )
    return redirect("orders")
```

For Celery: `transaction.on_commit(lambda: email_users.delay(...))`.

Outside an `atomic()` block, `on_commit` runs immediately — safe to use unconditionally.

## Idempotency

Workers may retry. Make every task safe to run twice:

- Pass IDs, not objects. The DB is the source of truth.
- Guard side effects with a uniqueness key (DB constraint, cache lock, idempotency token).
- For external API calls (payments, emails), use the provider's idempotency keys.

```python
@shared_task
def send_receipt(order_id: int):
    order = Order.objects.get(pk=order_id)
    if order.receipt_sent_at:
        return                          # idempotent short-circuit
    # provider's idempotency key prevents double-charge / double-send
    send_email(order, idempotency_key=f"receipt-{order_id}")
    order.receipt_sent_at = timezone.now()
    order.save(update_fields=["receipt_sent_at"])
```

## Signals — be careful

`post_save` and friends are tempting for "fire an email after save". They're hard to debug:
- They fire **inside** the transaction; the row may not be committed yet
- They fire for `bulk_create` only if `send_signals=True`
- They fire from anywhere — admin actions, management commands, fixtures — which makes test setup noisy

Better pattern: handle the side effect in the view / service layer with `transaction.on_commit`. Reserve signals for cross-cutting concerns (audit log, full-text reindex) where every save genuinely should trigger.

```python
# Audit log — signal is appropriate
from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender=Product)
def log_product_change(sender, instance, created, **kwargs):
    AuditLog.objects.create(
        model="Product", object_id=instance.pk,
        action="create" if created else "update",
    )
```

Register signal handlers in `apps.py`'s `ready()`:

```python
class ShopConfig(AppConfig):
    name = "shop"
    def ready(self):
        from . import signals  # noqa: F401
```

## Retry strategy

Set retries explicitly. Exponential backoff for flaky external calls; small fixed delay for transient DB errors:

```python
@shared_task(
    bind=True,
    autoretry_for=(httpx.HTTPError,),
    retry_backoff=True,            # exponential
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=5,
)
def fetch_external(self, url):
    return httpx.get(url).json()
```

Don't retry on programmer errors (`TypeError`, `ValidationError`) — they'll just retry forever. Filter via `autoretry_for=` or explicit `try/except`.

## Dead-letter / error visibility

Celery doesn't ship a dead-letter queue by default. Common patterns:
- Subscribe to the `task_failure` signal and log/alert
- Use a result backend (Redis / Postgres) so failed task records remain inspectable
- Wire Sentry — `sentry-sdk[django]` captures both web errors and Celery task failures

For `django.tasks`, check the configured backend's docs for failure-handling semantics.

## Common pitfalls

- Enqueuing inside `atomic()` without `on_commit` — task runs, data gone
- Passing model instances as task arguments — pickled state goes stale; pass IDs
- Long-running tasks blocking workers — split into chunks, raise concurrency, or use a separate queue
- Mixing CPU-bound and I/O-bound on the same worker pool — saturates one or the other
- Forgetting `acks_late=True` for tasks that must not be lost on worker crash
- Re-enqueuing inside the task body without bounds — runaway loop
- Using signals for things that should fail loudly — silent suppressions hide bugs
