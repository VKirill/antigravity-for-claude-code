# Models & ORM

## Model basics

```python
from django.db import models
from django.conf import settings

class Product(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        ARCHIVED = "archived", "Archived"

    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    price_cents = models.PositiveIntegerField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-created_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(price_cents__gte=0),
                name="product_price_nonneg",
            ),
        ]

    def __str__(self) -> str:
        return self.name
```

Notes:
- `TextChoices` / `IntegerChoices` are preferred over raw tuples — they give you `.label`, `.choices`, and type-safe access.
- `Meta.ordering` is a default; queries can override with `.order_by()`.
- `Meta.indexes` and `Meta.constraints` are managed by migrations — don't add raw SQL indexes.

## Field reference (most common)

| Field | Use |
|---|---|
| `CharField(max_length=…)` | short strings; `max_length` required |
| `TextField` | unlimited text |
| `SlugField` | URL-safe short string |
| `EmailField`, `URLField` | validators included |
| `IntegerField`, `BigIntegerField`, `PositiveIntegerField` | integers |
| `DecimalField(max_digits, decimal_places)` | money / exact arithmetic |
| `FloatField` | avoid for money |
| `BooleanField` | true/false |
| `DateField`, `DateTimeField`, `TimeField` | time; pair with `USE_TZ = True` |
| `JSONField` | JSON column (native on Postgres / SQLite / MySQL 8) |
| `FileField`, `ImageField` | uploaded files; need `MEDIA_ROOT` |
| `UUIDField(default=uuid.uuid4)` | UUID primary key |
| `ForeignKey(Other, on_delete=…)` | many-to-one |
| `OneToOneField(Other, on_delete=…)` | one-to-one |
| `ManyToManyField(Other)` | many-to-many; auto-creates a through table |

## `on_delete` — always explicit

`ForeignKey` and `OneToOneField` require `on_delete`. Pick deliberately:

| Strategy | When |
|---|---|
| `CASCADE` | child has no meaning without parent (`Comment` → `Post`) |
| `PROTECT` | parent must not be deleted while children exist (`Order` → `Customer`) |
| `SET_NULL` | keep the child but null the link; requires `null=True` |
| `SET_DEFAULT` | requires a `default=` on the field |
| `SET(callable_or_value)` | dynamic fallback |
| `RESTRICT` | like PROTECT but allows deletion if another cascade targets it |
| `DO_NOTHING` | DB-level FK constraint handles it (rare — usually wrong) |

## `related_name` and `related_query_name`

```python
class Order(models.Model):
    customer = models.ForeignKey(
        "Customer",
        on_delete=models.PROTECT,
        related_name="orders",          # customer.orders.all()
        related_query_name="order",     # Customer.objects.filter(order__total__gt=…)
    )
```

Set `related_name="+"` to disable the reverse accessor entirely.

## Custom managers and querysets

```python
class ProductQuerySet(models.QuerySet):
    def published(self):
        return self.filter(status=Product.Status.PUBLISHED)

    def for_owner(self, user):
        return self.filter(owner=user)

class Product(models.Model):
    # ...
    objects = ProductQuerySet.as_manager()
```

Now `Product.objects.published().for_owner(user)` chains cleanly. Add domain methods on the manager, not on the model.

## QuerySet API — the methods you use daily

```python
# Read
Product.objects.all()
Product.objects.filter(status="published")
Product.objects.exclude(price_cents=0)
Product.objects.get(pk=42)                # raises DoesNotExist / MultipleObjectsReturned
Product.objects.first(); Product.objects.last()
Product.objects.exists()
Product.objects.count()
Product.objects.in_bulk([1, 2, 3])

# Slicing — translates to LIMIT/OFFSET; never index lazily
products = Product.objects.all()[:50]

# Write
Product.objects.create(name="X", price_cents=1000)
Product.objects.bulk_create([...], batch_size=500)
Product.objects.filter(pk=1).update(name="Y")
Product.objects.bulk_update([...], fields=["name"], batch_size=500)
Product.objects.filter(status="draft").delete()
```

## `F` and `Q`

```python
from django.db.models import F, Q

# Atomic increment (no race) — use F instead of read-modify-write
Product.objects.filter(pk=1).update(views=F("views") + 1)

# Compound conditions
Product.objects.filter(Q(status="published") | Q(featured=True))
Product.objects.filter(Q(price_cents__lt=1000) & ~Q(status="archived"))
```

`F` references the column value at SQL time; safe under concurrency. Read-modify-write in Python is not.

## `annotate` and `aggregate`

```python
from django.db.models import Count, Sum, Avg

# Per-row annotation
Customer.objects.annotate(order_count=Count("orders"))

# Whole-queryset reduction
Order.objects.aggregate(total=Sum("amount_cents"))   # {"total": 12345}
```

## `select_related` vs `prefetch_related`

`select_related` issues a SQL `JOIN` and fills FK / one-to-one in one query.
`prefetch_related` issues a second query and joins in Python — required for reverse FK and M2M.

```python
# Single query (one JOIN)
orders = Order.objects.select_related("customer", "customer__address")

# Two queries (orders + items joined client-side)
orders = Order.objects.prefetch_related("items", "items__product")
```

Rule of thumb:
- `ForeignKey` / `OneToOneField` access → `select_related`
- Reverse FK / `ManyToManyField` access → `prefetch_related`

Combine freely:
```python
Order.objects.select_related("customer").prefetch_related("items__product")
```

## `.only()` and `.defer()`

```python
# Load only specific columns; access to others triggers extra queries
Product.objects.only("id", "name")

# Load everything except these; the deferred ones are lazy
Product.objects.defer("description", "metadata")
```

Use **after profiling**. They optimize bandwidth, but accidental access to deferred fields fires per-row queries — the worst kind of N+1.

## Transactions

```python
from django.db import transaction

@transaction.atomic
def transfer(from_id: int, to_id: int, amount: int) -> None:
    from_acc = Account.objects.select_for_update().get(pk=from_id)
    to_acc = Account.objects.select_for_update().get(pk=to_id)
    from_acc.balance -= amount
    to_acc.balance += amount
    from_acc.save(update_fields=["balance"])
    to_acc.save(update_fields=["balance"])
```

`select_for_update()` issues `SELECT ... FOR UPDATE` — prevents lost updates. Must run inside `transaction.atomic()`.

## `transaction.on_commit`

Schedule a side effect (email, Celery task, webhook) to fire **only if** the transaction commits:

```python
def create_order(...):
    with transaction.atomic():
        order = Order.objects.create(...)
        transaction.on_commit(lambda: send_confirmation_email.delay(order.pk))
```

Without `on_commit`, you'll email customers about orders that rolled back.

## QuerySet evaluation rules

QuerySets are lazy. They hit the DB only on:
- iteration (`for x in qs`, list comprehension)
- slicing with a step (`qs[::2]`)
- `len()`, `bool()`, `list()`, `repr()`
- terminal methods (`.get()`, `.first()`, `.count()`, `.exists()`)

This is why `qs = Product.objects.filter(...)` doesn't query — but `if qs:` does. Use `qs.exists()` instead of `bool(qs)` when you don't need the rows.

## Async ORM (Django 5+, mature in 6)

See [async-views.md](async-views.md). All standard methods have `a`-prefixed variants: `aget`, `afilter`, `afirst`, `acreate`, `abulk_create`, `aupdate`, `adelete`, plus `async for` iteration. Transactions still require `sync_to_async` wrapping.
