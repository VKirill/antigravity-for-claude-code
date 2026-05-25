# Admin

The Django admin is an opinionated CRUD interface generated from your models. It's free, fast, and dangerous — anyone with a staff account can edit every registered model.

## Register a model

```python
# shop/admin.py
from django.contrib import admin
from .models import Product, Category

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "price_cents", "status", "created_at")
    list_filter = ("status", "category", "created_at")
    search_fields = ("name", "slug")
    ordering = ("-created_at",)
    list_per_page = 50
    list_select_related = ("category",)         # avoid N+1 in changelist
    autocomplete_fields = ("category",)
    readonly_fields = ("created_at", "updated_at")
    prepopulated_fields = {"slug": ("name",)}
    fieldsets = (
        ("Basics", {"fields": ("name", "slug", "category")}),
        ("Pricing", {"fields": ("price_cents",)}),
        ("Status", {"fields": ("status", "created_at", "updated_at")}),
    )

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    search_fields = ("name",)   # required when this model is autocomplete_fields target
```

`autocomplete_fields` makes FK widgets searchable — a must for any model with hundreds of rows. The target model's `ModelAdmin` must define `search_fields`, otherwise the widget 404s.

## List page customization

| Attribute | Effect |
|---|---|
| `list_display` | Columns shown |
| `list_display_links` | Which columns link to the change page |
| `list_filter` | Sidebar filters |
| `search_fields` | Top search box (uses icontains by default) |
| `date_hierarchy` | Drill-down by date |
| `list_per_page` | Pagination size |
| `list_select_related` | `SELECT` joins to avoid N+1 in `list_display` |
| `list_prefetch_related` | M2M / reverse FK preloads |
| `actions` | Bulk operations |

## Custom columns and methods

```python
@admin.display(description="Price (USD)", ordering="price_cents")
def price_display(self, obj: Product) -> str:
    return f"${obj.price_cents / 100:.2f}"

class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "price_display", "status")
    price_display = price_display
```

`@admin.display(ordering=...)` lets you sort by an underlying column for a derived display.

## Inline editing

Edit related objects on the parent's change page:

```python
class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    autocomplete_fields = ("product",)
    fields = ("product", "quantity", "unit_price_cents")

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    inlines = [OrderItemInline]
    list_display = ("id", "customer", "total_display", "created_at")
```

`TabularInline` renders rows; `StackedInline` renders blocks. `extra=0` avoids confusing empty rows.

## Custom actions

```python
@admin.action(description="Mark selected products as published")
def publish_selected(modeladmin, request, queryset):
    updated = queryset.update(status=Product.Status.PUBLISHED)
    modeladmin.message_user(request, f"{updated} products published.")

class ProductAdmin(admin.ModelAdmin):
    actions = [publish_selected]
```

Actions receive the selected queryset. Don't iterate it row-by-row — use bulk `update()` / `delete()`.

## `readonly_fields` and computed fields

```python
class ProductAdmin(admin.ModelAdmin):
    readonly_fields = ("created_at", "updated_at", "preview_image")

    @admin.display(description="Preview")
    def preview_image(self, obj):
        if obj.image:
            return format_html('<img src="{}" style="height:60px">', obj.image.url)
        return "—"
```

## `formfield_overrides`

Apply a widget to all instances of a field type:

```python
from django.db import models
from django.forms import Textarea

class ProductAdmin(admin.ModelAdmin):
    formfield_overrides = {
        models.TextField: {"widget": Textarea(attrs={"rows": 4, "cols": 80})},
    }
```

## Per-request filtering

Hide rows a user shouldn't see:

```python
class ProductAdmin(admin.ModelAdmin):
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(owner=request.user)

    def has_change_permission(self, request, obj=None) -> bool:
        if obj is None:
            return super().has_change_permission(request)
        return obj.owner_id == request.user.id or request.user.is_superuser
```

Override `has_view_permission` / `has_add_permission` / `has_delete_permission` similarly.

## `AdminSite` and multiple admins

For tenant isolation, register custom `AdminSite` instances:

```python
class StaffAdmin(admin.AdminSite):
    site_header = "Staff Tools"

staff_admin = StaffAdmin(name="staff_admin")
staff_admin.register(Product, ProductAdmin)

# config/urls.py
path("staff/", staff_admin.urls)
```

## Security hardening

The admin is a privileged surface. In production:

- Set a custom URL path (`/internal-admin/` instead of the default `/admin/`) — small but real defense against drive-by scanners
- Limit access by IP at the reverse proxy (Angie/Nginx) if the admin is staff-only
- Always serve over HTTPS (`SECURE_SSL_REDIRECT = True`, `SECURE_HSTS_*`)
- Set `SESSION_COOKIE_SECURE = True`, `CSRF_COOKIE_SECURE = True`
- Require 2FA via `django-otp` + `django-two-factor-auth` for staff
- Audit `is_staff` membership — every `is_staff=True` user can log into the admin
- Be careful with `actions` that mass-update — they bypass `save()` and signals; document this

## Performance gotchas

- Missing `list_select_related` / `list_prefetch_related` causes N+1 in the changelist
- `search_fields` with many `icontains` lookups across joins is slow at scale — consider adding DB indexes or Postgres full-text search
- Inline formsets with many rows are slow to render — paginate by switching to a separate change page

## When to outgrow the admin

The admin is great for internal ops, not for end-user tools. Signs to build a custom UI:
- Non-staff users need access
- Workflow is more than "edit one row"
- Permission rules don't fit the per-model permission model
- You're writing 300+ lines of admin overrides

Then build the screens with regular views / DRF / Django Ninja and keep the admin for backstage use only.
