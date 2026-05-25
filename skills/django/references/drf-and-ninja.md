# DRF & Django Ninja

Two mature options for building REST APIs on top of Django:

| Lib | Style | When |
|---|---|---|
| **Django REST Framework (DRF)** | Class-based, serializer-driven, framework-included pagination, throttling, browsable API | You want the established ecosystem, generic viewsets, permissions classes, third-party DRF packages |
| **Django Ninja** | FastAPI-style, type-hint-driven, Pydantic-based, async-first | You want type-safe request/response models, OpenAPI 3 auto-docs, async endpoints with the Django ORM |

Both are first-class. Pick one per project; don't mix them in the same app.

## Django REST Framework — minimal example

```python
# shop/serializers.py
from rest_framework import serializers
from .models import Product

class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ["id", "name", "slug", "price_cents", "status", "created_at"]
        read_only_fields = ["id", "created_at"]
```

```python
# shop/api.py
from rest_framework import viewsets, permissions
from rest_framework.pagination import PageNumberPagination
from .models import Product
from .serializers import ProductSerializer

class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.select_related("category")
    serializer_class = ProductSerializer
    pagination_class = StandardPagination
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filterset_fields = ["status", "category"]
    search_fields = ["name", "slug"]
    ordering_fields = ["created_at", "price_cents"]
```

```python
# shop/urls.py
from rest_framework.routers import DefaultRouter
from .api import ProductViewSet

router = DefaultRouter()
router.register(r"products", ProductViewSet, basename="product")

urlpatterns = router.urls
```

```python
# config/urls.py
path("api/v1/", include("shop.urls")),
```

You now have `GET/POST /api/v1/products/`, `GET/PUT/PATCH/DELETE /api/v1/products/<id>/`, filtering, search, ordering, pagination.

## DRF settings

```python
# settings/base.py
INSTALLED_APPS += ["rest_framework"]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],   # drop browsable in prod
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.UserRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {"user": "1000/hour", "anon": "100/hour"},
}
```

## DRF — custom action on a viewset

```python
from rest_framework.decorators import action
from rest_framework.response import Response

class ProductViewSet(viewsets.ModelViewSet):
    ...
    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAdminUser])
    def publish(self, request, pk=None):
        product = self.get_object()
        product.status = Product.Status.PUBLISHED
        product.save(update_fields=["status"])
        return Response({"status": product.status})
```

Generates `POST /api/v1/products/<id>/publish/`.

## DRF — serializer validation

```python
class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = [...]

    def validate_price_cents(self, value):
        if value < 0:
            raise serializers.ValidationError("Price must be non-negative.")
        return value

    def validate(self, attrs):
        if attrs.get("status") == "published" and not attrs.get("name"):
            raise serializers.ValidationError("Cannot publish without a name.")
        return attrs
```

## Django Ninja — minimal example

```python
# shop/api.py
from ninja import NinjaAPI, ModelSchema, Schema
from ninja.pagination import paginate
from typing import List
from .models import Product

api = NinjaAPI(title="Shop API", version="1.0.0")

class ProductOut(ModelSchema):
    class Meta:
        model = Product
        fields = ["id", "name", "slug", "price_cents", "status", "created_at"]

class ProductIn(Schema):
    name: str
    slug: str
    price_cents: int
    status: str = "draft"

@api.get("/products", response=List[ProductOut])
@paginate
def list_products(request, status: str | None = None):
    qs = Product.objects.all()
    if status:
        qs = qs.filter(status=status)
    return qs

@api.get("/products/{product_id}", response=ProductOut)
def get_product(request, product_id: int):
    return get_object_or_404(Product, pk=product_id)

@api.post("/products", response={201: ProductOut})
def create_product(request, payload: ProductIn):
    product = Product.objects.create(**payload.dict())
    return 201, product
```

```python
# config/urls.py
from shop.api import api as shop_api

urlpatterns += [
    path("api/v1/", shop_api.urls),
]
```

`/api/v1/docs` serves Swagger UI automatically. `ModelSchema` reads model fields; `Schema` is a regular Pydantic model.

## Django Ninja — async views

Ninja supports async endpoints natively:

```python
@api.get("/products/{product_id}/async", response=ProductOut)
async def aget_product(request, product_id: int):
    return await Product.objects.aget(pk=product_id)
```

See [async-views.md](async-views.md) for ORM + ASGI deployment specifics.

## Auth in Ninja

```python
from ninja.security import HttpBearer

class JWTAuth(HttpBearer):
    def authenticate(self, request, token: str):
        # decode + verify token
        return request.user if token == "valid" else None

api = NinjaAPI(auth=JWTAuth())
```

Or per-endpoint: `@api.get("/me", auth=JWTAuth())`.

## When to pick which

Pick **DRF** when:
- You need browsable API for ops/internal users
- You want established libraries (`django-filter`, `drf-spectacular`, `djangorestframework-simplejwt`)
- Your team already knows DRF idioms (mixin chains, serializer fields)
- You're building a large API where viewset conventions earn their weight

Pick **Django Ninja** when:
- You want FastAPI-style type-hint-driven endpoints
- You're going async-heavy
- Pydantic-based validation is the team's lingua franca
- You want minimal boilerplate and automatic OpenAPI 3 docs without extra deps

Avoid both when:
- You only need 1–3 JSON endpoints — a plain `JsonResponse` view is fine
- You're rendering server-side HTML — Django views + templates are simpler

## Anti-patterns (both libs)

- Returning ORM model instances directly without a serializer/schema — leaks fields, breaks docs
- Skipping pagination on list endpoints — first big customer ships you a `LIMIT 10000` query
- Wide-open CORS (`Access-Control-Allow-Origin: *`) with credentials — browsers silently drop
- Putting auth checks inside view methods instead of permission/auth classes — duplicated, error-prone
- Mixing DRF and Ninja in the same app — confusing for new contributors
