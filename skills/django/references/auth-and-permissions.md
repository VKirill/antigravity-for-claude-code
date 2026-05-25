# Auth & permissions

## `AUTH_USER_MODEL` — set before the first migration

Django allows exactly one user model per project, fixed by `AUTH_USER_MODEL`. **Change it before running `migrate` the first time** — swapping it later requires a heroic migration.

```python
# settings/base.py
AUTH_USER_MODEL = "shop.User"
```

```python
# shop/models.py
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    # AbstractUser already has username, email, first_name, last_name, is_staff, is_active, …
    phone = models.CharField(max_length=20, blank=True)
    timezone = models.CharField(max_length=64, default="UTC")
```

Use `AbstractUser` when you want Django's default fields plus your own. Use `AbstractBaseUser` + `PermissionsMixin` when you need to redesign the fields (e.g., email as the identifier, no username).

## `AbstractBaseUser` — email-as-identifier example

```python
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin

class UserManager(BaseUserManager):
    def create_user(self, email: str, password: str, **extra) -> "User":
        if not email:
            raise ValueError("Email required")
        user = self.model(email=self.normalize_email(email), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email: str, password: str, **extra) -> "User":
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra)

class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []   # `email` already in USERNAME_FIELD

    def __str__(self) -> str:
        return self.email
```

`PermissionsMixin` adds the `groups` / `user_permissions` columns, `has_perm()`, `has_module_perms()`. Don't omit it unless you're writing a totally custom permission system.

## Referencing the user model

Inside model code, **never** import `User` directly:

```python
from django.conf import settings

class Post(models.Model):
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
```

Inside view / business code, use:

```python
from django.contrib.auth import get_user_model
User = get_user_model()
```

## Password hashing

Django handles password hashing via `PASSWORD_HASHERS` (default uses PBKDF2 with a high iteration count, raised to 1,200,000 in Django 6). Never roll your own.

```python
user.set_password("plaintext")     # hashes and stores
user.check_password("plaintext")   # constant-time compare
user.save()
```

`createsuperuser`, `authenticate()`, and the admin login form all use these correctly. The hasher upgrades automatically on next login if you raise the iteration count.

## `authenticate` and `login`

```python
from django.contrib.auth import authenticate, login, logout

def login_view(request):
    if request.method == "POST":
        user = authenticate(request, username=request.POST["email"], password=request.POST["password"])
        if user is not None:
            login(request, user)            # writes session, rotates session key
            return redirect("home")
    return render(request, "auth/login.html")

def logout_view(request):
    logout(request)
    return redirect("home")
```

`authenticate` returns `None` for any failure (wrong password, inactive user, no such user) — never leak which case to the client.

## Permission framework

Django ships per-model `add`, `change`, `delete`, `view` permissions automatically. Check them:

```python
if request.user.has_perm("shop.change_product"):
    ...

# In templates
{% if perms.shop.change_product %}…{% endif %}
```

Define custom permissions on the model:

```python
class Product(models.Model):
    ...
    class Meta:
        permissions = [
            ("publish_product", "Can publish product"),
            ("archive_product", "Can archive product"),
        ]
```

Check with `request.user.has_perm("shop.publish_product")`.

Group users via `Group` (in admin or programmatically) and assign permissions to groups, not directly to users — easier to audit.

## View-level guards

### Decorators (FBV)

```python
from django.contrib.auth.decorators import login_required, permission_required, user_passes_test

@login_required(login_url="/accounts/login/")
def my_view(request): ...

@permission_required("shop.publish_product", raise_exception=True)
def publish(request, pk): ...

@user_passes_test(lambda u: u.is_staff)
def staff_only(request): ...
```

`raise_exception=True` produces 403 instead of redirecting to login — appropriate for already-authenticated users.

### Mixins (CBV)

```python
from django.contrib.auth.mixins import LoginRequiredMixin, PermissionRequiredMixin, UserPassesTestMixin

class ProductEdit(LoginRequiredMixin, PermissionRequiredMixin, UpdateView):
    model = Product
    fields = ["name", "price_cents"]
    permission_required = "shop.change_product"

class StaffOnlyView(UserPassesTestMixin, ListView):
    def test_func(self) -> bool:
        return self.request.user.is_staff
```

Auth/permission mixins **must precede** the generic view in the MRO.

## Sessions

`SessionMiddleware` writes a session cookie holding a session key. Backends control where the session data lives:

| Backend | Setting | Use |
|---|---|---|
| Database (default) | `django.contrib.sessions.backends.db` | dev, small apps |
| Cached DB | `cached_db` | DB authoritative, cache fast path |
| Redis cache | `cache` + `CACHES["default"]` pointing at Redis | high throughput |
| Signed cookies | `signed_cookies` | tiny session payload, no server state |
| File | `file` | rare; needs writable filesystem |

Common settings:

```python
SESSION_ENGINE = "django.contrib.sessions.backends.cache"
SESSION_CACHE_ALIAS = "default"
SESSION_COOKIE_SECURE = True          # HTTPS-only
SESSION_COOKIE_HTTPONLY = True        # block JS access
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_EXPIRE_AT_BROWSER_CLOSE = False
SESSION_COOKIE_AGE = 60 * 60 * 24 * 14   # numeric value canonical in recommended-defaults.md
```

## `request.user` for anonymous users

`AuthenticationMiddleware` sets `request.user` to either the authenticated `User` or an `AnonymousUser`. Always check `request.user.is_authenticated` rather than `request.user is not None`.

## Built-in auth views

`django.contrib.auth.urls` ships ready-made views for login/logout/password-reset:

```python
# config/urls.py
path("accounts/", include("django.contrib.auth.urls")),
```

Override only the templates (`registration/login.html`, etc.) unless you have a strong reason to replace the views.

## Webhook / API auth (no sessions)

For non-browser clients, use DRF's `TokenAuthentication` / JWT (with `django-rest-framework-simplejwt`) or Django Ninja's `HttpBearer` auth class. See [drf-and-ninja.md](drf-and-ninja.md). Never rely on Django session cookies for API clients that don't speak the CSRF protocol.
