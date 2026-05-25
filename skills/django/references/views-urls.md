# Views & URLs

## URLconf basics

```python
# config/urls.py
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("shop.urls")),
    path("", include("frontend.urls")),
]
```

```python
# shop/urls.py
from django.urls import path
from . import views

app_name = "shop"          # enables namespacing → reverse("shop:product_detail", …)

urlpatterns = [
    path("products/", views.product_list, name="product_list"),
    path("products/<int:pk>/", views.product_detail, name="product_detail"),
    path("products/<slug:slug>/edit/", views.product_edit, name="product_edit"),
]
```

## Path converters

Built-in:

| Converter | Matches | Python type |
|---|---|---|
| `str` | non-empty, no `/` | `str` (default if no converter given) |
| `int` | 0+ integers | `int` |
| `slug` | ASCII letters, digits, hyphen, underscore | `str` |
| `uuid` | UUID format | `uuid.UUID` |
| `path` | non-empty including `/` | `str` |

Custom converter:

```python
class YearConverter:
    regex = r"\d{4}"
    def to_python(self, value): return int(value)
    def to_url(self, value): return f"{value:04d}"

from django.urls import register_converter
register_converter(YearConverter, "year")

path("archive/<year:year>/", views.archive)
```

`re_path` is the regex escape hatch — prefer `path` + converters.

## `include()` and namespacing

```python
path("api/v1/", include("shop.urls", namespace="api_v1_shop"))
# reverse: reverse("api_v1_shop:product_list")
```

With `app_name = "shop"` defined in the included module, the namespace is inferred. Always namespace — it survives refactoring and prevents collision when the same view is wired into multiple paths.

## `reverse()` and `{% url %}`

```python
from django.urls import reverse, reverse_lazy
from django.shortcuts import redirect

def create_product(request):
    ...
    return redirect("shop:product_detail", pk=product.pk)

# In CBV's success_url, prefer reverse_lazy — it defers resolution until URLconf loads
class ProductCreateView(CreateView):
    success_url = reverse_lazy("shop:product_list")
```

```django
<a href="{% url 'shop:product_detail' pk=product.pk %}">{{ product.name }}</a>
```

Never hardcode paths. They will diverge from the URLconf and break silently.

## Function-based views (FBV)

```python
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_http_methods

@login_required
@require_http_methods(["GET", "POST"])
def product_edit(request, pk: int):
    product = get_object_or_404(Product, pk=pk, owner=request.user)
    if request.method == "POST":
        form = ProductForm(request.POST, instance=product)
        if form.is_valid():
            form.save()
            return redirect("shop:product_detail", pk=product.pk)
    else:
        form = ProductForm(instance=product)
    return render(request, "shop/product_edit.html", {"form": form, "product": product})
```

FBVs are explicit and easy to read. Use for small/medium views. Decorators stack outside-in (top-most runs first).

## Class-based views (CBV)

```python
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.urls import reverse_lazy

class ProductList(ListView):
    model = Product
    template_name = "shop/product_list.html"
    context_object_name = "products"
    paginate_by = 20

    def get_queryset(self):
        return Product.objects.published().order_by("-created_at")

class ProductDetail(DetailView):
    model = Product
    template_name = "shop/product_detail.html"

class ProductCreate(LoginRequiredMixin, CreateView):
    model = Product
    form_class = ProductForm
    success_url = reverse_lazy("shop:product_list")
```

CBVs shine when you need a small override on a standard pattern (list/detail/create/update/delete). Don't fight them — when overrides become complex, drop back to an FBV.

## Generic view summary

| CBV | Purpose | Methods |
|---|---|---|
| `View` | Bare base; dispatch by method name (`get`, `post`, …) | any |
| `TemplateView` | Render a template with context | GET |
| `RedirectView` | 301/302 redirect | any |
| `ListView` | Paginated list of objects | GET |
| `DetailView` | Single-object page | GET |
| `FormView` | Form-driven workflow | GET/POST |
| `CreateView` | Render form + save new object | GET/POST |
| `UpdateView` | Render form + save changes | GET/POST |
| `DeleteView` | Confirmation + delete | GET/POST |

## Composition: mixins

```python
class StaffOrAuthorMixin(UserPassesTestMixin):
    def test_func(self) -> bool:
        obj = self.get_object()
        return self.request.user.is_staff or obj.author == self.request.user

class PostUpdate(LoginRequiredMixin, StaffOrAuthorMixin, UpdateView):
    model = Post
    form_class = PostForm
```

MRO matters — auth/permission mixins go **before** the generic view class.

## Returning JSON

For a one-off JSON endpoint without DRF/Ninja:

```python
from django.http import JsonResponse

def stats(request):
    return JsonResponse({"orders": Order.objects.count(), "users": User.objects.count()})
```

For anything more than 1–2 endpoints, use DRF or Django Ninja — see [drf-and-ninja.md](drf-and-ninja.md).

## Status codes and shortcuts

```python
from django.shortcuts import get_object_or_404, get_list_or_404, render, redirect
from django.http import HttpResponse, HttpResponseBadRequest, HttpResponseForbidden

obj = get_object_or_404(Product, pk=pk)              # 404 if missing
items = get_list_or_404(Product, status="published") # 404 if empty queryset

return HttpResponseBadRequest("invalid")             # 400
return HttpResponseForbidden()                       # 403
return HttpResponse(status=204)                      # 204 no content
```

## Error pages

Django picks templates `404.html`, `500.html`, `403.html`, `400.html` from any app's `templates/` directory **only when `DEBUG=False`**. Test them by temporarily forcing `DEBUG=False` locally — `runserver --insecure` lets you keep static files served.

```python
# custom handlers (in root urls.py)
handler404 = "shop.views.custom_404"
handler500 = "shop.views.custom_500"
```

## CSRF

Django CSRF protection is enforced by `CsrfViewMiddleware` on all non-safe methods (`POST`, `PUT`, `PATCH`, `DELETE`). For HTML forms, include `{% csrf_token %}` inside `<form>`. For AJAX from same origin, read `csrftoken` cookie and send `X-CSRFToken` header.

Exempt only verified webhook endpoints:

```python
from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
def payment_webhook(request):
    # 1) verify provider signature
    # 2) only then trust the body
    ...
```

Never `csrf_exempt` an ordinary form view — see [wrong-vs-right.md](wrong-vs-right.md).
