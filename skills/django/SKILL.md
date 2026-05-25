---
name: django
description: "Django — batteries-included Python web framework. Models + ORM, admin, forms, auth, templates, async views, ASGI deployment. Use when: django, django 6, Model, QuerySet, manage.py, settings.py, makemigrations, migrate, runserver, django admin, ModelForm, ModelAdmin, generic views, async view, async ORM (aget/afilter/asave), drf, django rest framework, django ninja, CONN_MAX_AGE, select_related, prefetch_related, AUTH_USER_MODEL, csrf, ASGI, gunicorn UvicornWorker, whitenoise, collectstatic, ALLOWED_HOSTS, CSRF_TRUSTED_ORIGINS, AsyncPaginator, template partials, background tasks framework. SKIP: FastAPI async-first APIs (→fastapi), Flask micro (→flask cascade), Node frameworks (→fastify/hono), pure SQLAlchemy ORM (→sqlalchemy cascade), DRF deep customization in isolation (→djangorestframework cascade)."
stacks:
  - django
  - python
  - backend
tags:
  - django
  - python
  - web
  - batteries-included
  - orm
  - admin
  - mvc
packages:
  - django
  - djangorestframework
  - django-ninja
  - gunicorn
  - uvicorn
  - whitenoise
  - channels
  - psycopg
  - redis
manifests:
  - manage.py
  - settings.py
  - pyproject.toml
  - requirements.txt
source: vechkasov-global-skills
risk: high-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- Django: `6.x`
- Python: `3.14.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded automatically when its description matches the active task. Read only the section you need, then open the relevant reference file.

## Use this skill when

- Building or migrating a Django project — `django-admin startproject`, app layout, settings module/package, `manage.py`
- Authoring models — `Model`, field types, `Meta` options, `choices=`, `related_name`, `on_delete` strategies, custom managers
- Working with the ORM — `filter/exclude/annotate/aggregate`, `F`/`Q` objects, `select_related` vs `prefetch_related`, `.only()/.defer()`
- Running migrations — `makemigrations`, `migrate`, `--fake`, `squashmigrations`, `RunPython` data migrations, multi-db, downgrade strategy
- Wiring URLs and views — function-based vs class-based, generic CBVs, `path`/`re_path` converters, `include()`, namespacing
- Building forms — `Form`, `ModelForm`, `clean_*` methods, formsets, file uploads, validators, error messages
- Rendering templates — DTL inheritance with `extends`/`block`, custom tags/filters, context processors, autoescape, Django 6 template partials
- Customizing auth — `AUTH_USER_MODEL`, `AbstractBaseUser`, permissions, `login_required`/`permission_required`, `LoginRequiredMixin`, sessions
- Customizing the admin — `ModelAdmin`, `list_display`, `readonly_fields`, inlines, custom actions, `autocomplete_fields`
- Exposing APIs — Django REST Framework (`Serializer`, `ViewSet`, `Router`, pagination) or Django Ninja (FastAPI-style)
- Writing async views — `async def` views, async ORM (`aget`/`afilter`/`asave`/`acreate`/`abulk_create`), `sync_to_async`, ASGI deployment
- Caching & sessions — Redis/Memcached backends, low-level cache API, template fragment cache, per-view cache, session backends
- Running background work — `django.tasks` framework (Django 6), Celery integration pattern, signals, `transaction.on_commit`
- Deploying — Gunicorn (WSGI) or Gunicorn + UvicornWorker / standalone Uvicorn (ASGI), Whitenoise for static, behind Angie/Nginx, `DEBUG=False` hardening

## Do not use this skill when

- Task is a FastAPI async-first REST/streaming API — use `fastapi`
- Task is Flask micro-framework — use `flask` (cascade)
- Task is a Node.js HTTP framework — use `fastify`, `hono`, or `nodejs`
- Task is pure SQLAlchemy ORM modeling outside Django — use `sqlalchemy` (cascade)
- Task is DRF serializer/viewset deep customization beyond Django's plumbing — use `djangorestframework` (cascade)
- Task is pytest authoring without HTTP/Django context — use `pytest`
- Task is Channels WebSockets / consumers in depth — use `channels` (cascade); this skill covers only the integration point
- Task is Celery worker configuration in depth — use `celery` (cascade); this skill covers only the Django integration pattern

## Purpose

Django is the dominant batteries-included Python web framework — an opinionated stack covering ORM, migrations, admin, auth, forms, templates, async views, caching, and an ASGI-capable HTTP layer. It's the default choice for content-heavy, transactional, or admin-driven web apps where development velocity and consistency matter more than micro-framework flexibility.

This skill covers the full server lifecycle: project layout and environment-aware settings, model design and ORM query patterns, migration safety, URL routing, function-based and class-based views, forms and form validation, the Django Template Language (and Django 6 template partials), authentication and permissions, admin customization, REST API options (DRF vs Django Ninja), async views with the async ORM and ASGI deployment, caching/sessions, background tasks (the new `django.tasks` framework and Celery integration), and production deployment behind Angie/Nginx with Gunicorn or UvicornWorker.

What this skill does NOT cover: Python language internals (see `python`), pytest test design (see `pytest`), PostgreSQL operational concerns (see `postgresql`), Redis operational concerns (see `redis`), Celery worker tuning (see `celery` cascade), Channels consumers in depth (see `channels` cascade), DRF serializer arcana (see `djangorestframework` cascade).

## Capabilities

Each line points to the canonical reference. The reference owns code, edge cases, and gotchas — do not duplicate them here.

- **Setup & project structure** — `django-admin startproject`, app layout, `settings.py` vs settings package, `BASE_DIR`, `INSTALLED_APPS`, `MIDDLEWARE` ordering, environment-based settings. → [setup.md](references/setup.md)
- **Models & ORM** — `Model`, field types, `Meta` options, `choices=`, `related_name`, `on_delete`, custom managers, querysets (`filter`/`exclude`/`annotate`/`aggregate`), `F`/`Q` objects, `select_related` vs `prefetch_related`, `.only()`/`.defer()`. → [models-and-orm.md](references/models-and-orm.md)
- **Migrations** — `makemigrations`, `migrate`, `--fake`, `squashmigrations`, `RunPython` data migrations, dependency graph, multi-db routers, downgrade strategy, schema migration safety. → [migrations.md](references/migrations.md)
- **Views & URLs** — FBV vs CBV, generic views, URLconf patterns, `path`/`re_path` converters, `include()`, app namespacing, reverse lookups. → [views-urls.md](references/views-urls.md)
- **Forms & validators** — `Form`, `ModelForm`, `clean_*`/`clean()` methods, formsets, file uploads, validators, error messages, inline-related forms. → [forms-and-validators.md](references/forms-and-validators.md)
- **Templates** — DTL inheritance, custom tags/filters, context processors, autoescape rules, Django 6 `{% partialdef %}`/`{% partial %}` partials, Jinja2 backend alternative. → [templates.md](references/templates.md)
- **Auth & permissions** — `AUTH_USER_MODEL`, custom user via `AbstractBaseUser`/`AbstractUser`, permission framework, `login_required`/`permission_required`, `LoginRequiredMixin`/`PermissionRequiredMixin`, session backends. → [auth-and-permissions.md](references/auth-and-permissions.md)
- **Admin** — `ModelAdmin`, `list_display`/`list_filter`/`search_fields`, `readonly_fields`, inlines, custom actions, `autocomplete_fields`, `formfield_overrides`, admin hardening. → [admin.md](references/admin.md)
- **DRF & Django Ninja** — DRF basics (`Serializer`, `ViewSet`, `Router`, pagination, auth) vs Django Ninja (FastAPI-style, type-hint-driven) — when to pick which. → [drf-and-ninja.md](references/drf-and-ninja.md)
- **Async views & ASGI** — `async def` views, async ORM (`aget`/`afilter`/`asave`/`acreate`/`abulk_create`), `sync_to_async`/`async_to_sync`, ASGI deployment, sync-middleware penalty, Channels for WebSockets. → [async-views.md](references/async-views.md)
- **Caching & sessions** — cache backends (Redis/Memcached/locmem/db), low-level `cache.get/set`, template fragment cache, `cache_page`, session backends. → [caching-and-sessions.md](references/caching-and-sessions.md)
- **Celery & background tasks** — Django 6 `django.tasks` framework, Celery integration pattern, signals, `transaction.on_commit`, idempotency guidance. → [celery-and-tasks.md](references/celery-and-tasks.md)
- **Deployment** — Gunicorn (WSGI) vs Gunicorn + UvicornWorker / standalone Uvicorn (ASGI), Whitenoise for static, `collectstatic`, media uploads, behind Angie/Nginx, `DEBUG=False` checklist, `SECRET_KEY` rotation. → [deployment.md](references/deployment.md)
- **Recommended defaults** — `CONN_MAX_AGE`, `DATABASES` `OPTIONS`, `SECURE_SSL_REDIRECT`, HSTS, `CSRF_TRUSTED_ORIGINS`, `SESSION_COOKIE_SECURE/HTTPONLY`, `DEBUG=False`, naming conventions. → [recommended-defaults.md](references/recommended-defaults.md)
- **Troubleshooting** — N+1 detection, `OperationalError` on connection drop, `csrf_exempt` abuse, race conditions via `select_for_update`, `ALLOWED_HOSTS` misconfig, fake-migrate hazards, async sync-call errors. → [troubleshooting.md](references/troubleshooting.md)
- **Wrong vs Right** — N+1 with naive iteration, `csrf_exempt`, bare `except` in views, sync ORM in async view, missing `on_delete`, `SECRET_KEY` in code. → [wrong-vs-right.md](references/wrong-vs-right.md)
- **Eval cases** — routing tests, positive/negative prompts. → [eval-cases.md](references/eval-cases.md)

## Behavioral Traits

- Reads project `settings.py` (or settings package) before edits — environment, installed apps, middleware order, database, auth user model
- Splits settings by environment (`base.py` + `dev.py`/`prod.py`) once a project has more than one deploy target; uses env vars (12-factor) for secrets
- Writes `select_related` for FK / one-to-one and `prefetch_related` for reverse / many-to-many — never iterates a queryset that lazy-loads relations
- Uses `.only()` / `.defer()` only after profiling — defers are a footgun without measurement
- Always specifies `on_delete=` explicitly on every `ForeignKey` / `OneToOneField` — never relies on a default
- Names every URL pattern (`name=`) and resolves via `reverse()` / `{% url %}` — never hardcodes paths in templates or redirects
- Prefers `ModelForm` over raw `Form` when the form maps 1:1 to a model — gets validation and `save()` for free
- Subclasses `AbstractBaseUser` (or `AbstractUser`) for any new project and sets `AUTH_USER_MODEL` in the first migration — never adds users mid-project
- Decorates views with `login_required` / `permission_required` or uses CBV mixins — never inlines permission checks
- Uses `transaction.atomic()` to wrap multi-write handlers and `transaction.on_commit()` to schedule side effects (emails, tasks) after commit
- Writes `async def` views only when the request actually does concurrent I/O — sync views remain the default and are not slower
- Calls async ORM methods (`aget`, `afilter`, `asave`, etc.) inside async views — never wraps sync ORM in `sync_to_async` unless the API lacks an async variant
- Pins versioned config in [recommended-defaults.md](references/recommended-defaults.md) — no inline magic numbers in SKILL.md
- Runs `python manage.py check --deploy` before any production deploy

## Important Constraints

- NEVER set `DEBUG=True` in production — leaks SQL, secrets, and stack traces to any visitor
- NEVER commit `SECRET_KEY` to source control — read from env via `os.environ` or `django-environ`
- NEVER apply `@csrf_exempt` to a regular form-handling view — use it only for verified webhook endpoints that perform their own signature validation
- NEVER call sync ORM (`Model.objects.get(...)`) from inside an `async def` view — raises `SynchronousOnlyOperation`; use the `a`-prefixed variant
- NEVER omit `on_delete=` on a `ForeignKey` — it has no safe default
- NEVER pass user input directly into `raw()` / `extra()` / `RawSQL` — always parameterize
- NEVER deploy with the SQLite default — always configure PostgreSQL (or MySQL) for production
- NEVER iterate `Model.objects.all()` to perform per-row queries — that is the canonical N+1 pattern (see [wrong-vs-right.md](references/wrong-vs-right.md))
- NEVER wrap a sync function in `sync_to_async` and then call ORM inside it without setting `thread_sensitive=True` for transaction safety
- NEVER mix `transaction.atomic()` with manual savepoints unless you understand the rollback semantics
- NEVER hardcode URLs in templates — use `{% url 'app:name' %}` so reverse-routing survives refactors
- ALWAYS run `migrate` in a separate step before restarting application processes — never let multiple workers race to apply migrations
- ALWAYS run `python manage.py check --deploy` and `collectstatic --noinput` in the deploy pipeline
- ALWAYS set explicit `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS` in production
- ALWAYS hash passwords through Django's built-in `set_password()` — never write a custom hash function
- ALWAYS configure `CONN_MAX_AGE` (persistent connections) when behind a connection-pooler-less setup; numeric value lives in [recommended-defaults.md](references/recommended-defaults.md)

## Related Skills

**90%-filter applied** — mainstream 2026 stack pairings with Django in production.

### Language & runtime
- ✓ `python` — Python 3.14 baseline (Django 6 supports 3.12 / 3.13 / 3.14)

### Alternative web frameworks
- ✓ `fastapi` — async-first peer for typed REST/streaming APIs
- `flask` — micro-framework alternative [cascade marker]

### Validation / schemas
- ✓ `pydantic` — used inside Django Ninja for request/response models

### Persistence
- ✓ `postgresql` — Postgres 18 (Django's recommended primary DB)
- ✓ `redis` — Redis 8 (cache, session store, Celery broker)
- ✓ `sqlalchemy` — SQLAlchemy 2.0 alternative ORM if you go non-Django

### Background work
- `celery` — task queue, classical Django pairing [cascade marker]

### Testing
- ✓ `pytest` — `pytest-django` plugin, fixtures, transactional test cases
- ✓ `playwright` — E2E against a live Django server

### Frontend consumers (when Django serves an API)
- ✓ `nextjs`, ✓ `nuxt`, ✓ `react`, ✓ `vue`

### Deploy & ops
- ✓ `linux-sysadmin` — Ubuntu 24.04 / Angie / systemd / PM2 supervision

### Code discipline
- ✓ `karpathy-guidelines` — simplicity, surgical changes
- ✓ `skill-evaluation` — meta

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Index — decision map, reading order, conventions | [references/REFERENCE.md](references/REFERENCE.md) |
| Setup — `startproject`, app layout, settings module vs package, `BASE_DIR`, `INSTALLED_APPS`, middleware order, env-based settings | [references/setup.md](references/setup.md) |
| Models & ORM — fields, `Meta`, `on_delete`, managers, querysets, `F`/`Q`, `select_related`/`prefetch_related`, `.only()`/`.defer()` | [references/models-and-orm.md](references/models-and-orm.md) |
| Migrations — `makemigrations`, `migrate`, `--fake`, `squashmigrations`, `RunPython`, multi-db, schema safety | [references/migrations.md](references/migrations.md) |
| Views & URLs — FBV vs CBV, generic views, `path`/`re_path`, `include()`, namespacing, `reverse()` | [references/views-urls.md](references/views-urls.md) |
| Forms & validators — `Form`, `ModelForm`, `clean_*`, formsets, file uploads, related forms | [references/forms-and-validators.md](references/forms-and-validators.md) |
| Templates — DTL, `extends`/`block`, custom tags/filters, context processors, partials, Jinja2 backend | [references/templates.md](references/templates.md) |
| Auth & permissions — `AUTH_USER_MODEL`, custom user, permission framework, decorators/mixins, sessions | [references/auth-and-permissions.md](references/auth-and-permissions.md) |
| Admin — `ModelAdmin`, list/detail customization, inlines, actions, autocomplete, hardening | [references/admin.md](references/admin.md) |
| DRF & Django Ninja — when to use which, basic patterns | [references/drf-and-ninja.md](references/drf-and-ninja.md) |
| Async views & ASGI — `async def`, async ORM, `sync_to_async`, ASGI deploy, Channels integration | [references/async-views.md](references/async-views.md) |
| Caching & sessions — cache backends, low-level API, fragment cache, session backends | [references/caching-and-sessions.md](references/caching-and-sessions.md) |
| Celery & tasks — `django.tasks` (Django 6), Celery integration, signals, `transaction.on_commit` | [references/celery-and-tasks.md](references/celery-and-tasks.md) |
| Deployment — Gunicorn vs UvicornWorker, Whitenoise, `collectstatic`, reverse proxy, `DEBUG=False` checklist | [references/deployment.md](references/deployment.md) |
| **Recommended defaults** — `CONN_MAX_AGE`, `OPTIONS`, HSTS, `CSRF_TRUSTED_ORIGINS`, cookie flags | [references/recommended-defaults.md](references/recommended-defaults.md) |
| **Troubleshooting** — N+1, `OperationalError`, `csrf_exempt` abuse, race conditions, `ALLOWED_HOSTS`, fake-migrate, async sync-call | [references/troubleshooting.md](references/troubleshooting.md) |
| **Wrong vs Right** — N+1, `csrf_exempt`, bare except, sync ORM in async view, missing `on_delete`, `SECRET_KEY` in code | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases | [references/eval-cases.md](references/eval-cases.md) |

**How to use**: open the specific topic file. New project → `setup.md` + `models-and-orm.md` + `views-urls.md`. Adding auth → `auth-and-permissions.md` + `admin.md`. Building an API → `drf-and-ninja.md`. Going async → `async-views.md`. Production hardening → `recommended-defaults.md` + `deployment.md` + `troubleshooting.md`.
