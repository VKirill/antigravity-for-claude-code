# Setup — project layout, settings, environment

## Bootstrapping

```bash
# Install (pin via pyproject / requirements; version block owns numbers)
uv add django psycopg[binary] python-dotenv
# or: pip install django psycopg[binary] python-dotenv

# Scaffold
django-admin startproject config .
python manage.py startapp shop
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

The `.` in `startproject config .` puts `manage.py` in the current directory and the project Python package in `config/` — recommended layout.

## Directory layout

```
myproject/
├── manage.py
├── pyproject.toml
├── config/                  # the project package
│   ├── __init__.py
│   ├── asgi.py              # ASGI entrypoint (use for async / Channels)
│   ├── wsgi.py              # WSGI entrypoint (sync deploy)
│   ├── urls.py              # root URLconf
│   └── settings/
│       ├── __init__.py
│       ├── base.py          # shared defaults
│       ├── dev.py           # local dev overrides
│       └── prod.py          # production overrides
├── shop/                    # an app
│   ├── apps.py
│   ├── admin.py
│   ├── models.py
│   ├── migrations/
│   ├── urls.py
│   ├── views.py
│   ├── forms.py
│   ├── templates/shop/
│   └── tests/
└── templates/               # project-wide templates (optional)
```

Use a settings **package** (`config/settings/*.py`) instead of a single `settings.py` as soon as you have more than one deploy target. The split keeps prod secrets out of the dev path.

## `manage.py` and the settings module

`manage.py` reads `DJANGO_SETTINGS_MODULE`. Default it to the dev module so the local shell works without setup:

```python
# manage.py (generated; edit the default)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
```

In production, set `DJANGO_SETTINGS_MODULE=config.settings.prod` in the systemd unit / Docker env / PM2 ecosystem file.

## `settings/base.py` — shared defaults

```python
from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]   # no default — fail fast
DEBUG = False                                  # overridden in dev.py
ALLOWED_HOSTS: list[str] = []                  # set in prod.py / dev.py

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # project apps
    "shop.apps.ShopConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",       # if using whitenoise
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ["POSTGRES_DB"],
        "USER": os.environ["POSTGRES_USER"],
        "PASSWORD": os.environ["POSTGRES_PASSWORD"],
        "HOST": os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),
        # see recommended-defaults.md for CONN_MAX_AGE, OPTIONS
    }
}

AUTH_USER_MODEL = "shop.User"   # set this BEFORE first migration
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# DEFAULT_AUTO_FIELD now defaults to BigAutoField in Django 6 — no need to set it.
```

## `settings/dev.py` and `prod.py`

```python
# dev.py
from .base import *  # noqa: F401,F403

DEBUG = True
ALLOWED_HOSTS = ["*"]
INTERNAL_IPS = ["127.0.0.1"]
# optional: django-debug-toolbar in INSTALLED_APPS for N+1 detection
```

```python
# prod.py
from .base import *  # noqa: F401,F403
import os

DEBUG = False
ALLOWED_HOSTS = os.environ["DJANGO_ALLOWED_HOSTS"].split(",")
CSRF_TRUSTED_ORIGINS = os.environ["DJANGO_CSRF_TRUSTED_ORIGINS"].split(",")

# Hardening flags — values live in recommended-defaults.md
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
```

## Middleware ordering

Order matters. Canonical order from outside-in:

1. `SecurityMiddleware` — sets HTTPS / HSTS headers first
2. Whitenoise (if used) — serves static files before session/CSRF
3. `SessionMiddleware`
4. `CommonMiddleware`
5. `CsrfViewMiddleware` — must come **after** Session but **before** auth/views
6. `AuthenticationMiddleware` — needs Session
7. `MessageMiddleware`
8. `XFrameOptionsMiddleware`

Custom middleware that needs `request.user` must come **after** `AuthenticationMiddleware`. Custom middleware that sets headers should come early in the response path (i.e., late in the list, since middleware runs outside-in for request, inside-out for response).

## `BASE_DIR` and paths

Use `Path` operations, never string concatenation:

```python
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        # ...
    }
]
```

## Secrets via env

Two common options:
- Stdlib + `python-dotenv`: load `.env` once at the top of `dev.py`
- `django-environ`: read typed env values

Either way: never commit `.env`. Add it to `.gitignore`. Production reads from the host env (systemd unit, Docker env, PM2 ecosystem file).

## Verify the setup

```bash
python manage.py check                  # config sanity
python manage.py check --deploy         # production-only checks
python manage.py migrate                # apply migrations
python manage.py showmigrations         # confirm graph state
python manage.py runserver              # local dev
```

Run `check --deploy` in CI before any production push — it surfaces `DEBUG=True`, missing `ALLOWED_HOSTS`, weak `SECRET_KEY`, missing HTTPS flags.
