# Django — reference index

Slim navigator over the per-domain reference files. Open the file you need; do not preload all.

## Decision map

| You're working on… | Open |
|---|---|
| New project, layout, settings | [setup.md](setup.md) |
| Designing a model, query optimization | [models-and-orm.md](models-and-orm.md) |
| Schema change, data migration | [migrations.md](migrations.md) |
| URL routing, view dispatch | [views-urls.md](views-urls.md) |
| Form validation, ModelForm | [forms-and-validators.md](forms-and-validators.md) |
| Template, custom tag, partial | [templates.md](templates.md) |
| Login, permissions, custom user | [auth-and-permissions.md](auth-and-permissions.md) |
| Admin customization | [admin.md](admin.md) |
| REST API (DRF or Ninja) | [drf-and-ninja.md](drf-and-ninja.md) |
| Async view or async ORM call | [async-views.md](async-views.md) |
| Cache, session backend | [caching-and-sessions.md](caching-and-sessions.md) |
| Background jobs, Celery, signals | [celery-and-tasks.md](celery-and-tasks.md) |
| Production deploy, Gunicorn vs Uvicorn | [deployment.md](deployment.md) |
| Numeric knobs, hardening flags | [recommended-defaults.md](recommended-defaults.md) |
| Bug / symptom diagnosis | [troubleshooting.md](troubleshooting.md) |
| Spot a Django anti-pattern | [wrong-vs-right.md](wrong-vs-right.md) |
| Verify skill routing | [eval-cases.md](eval-cases.md) |

## Reading order for a new project

1. `setup.md` — project layout and environment-aware settings
2. `models-and-orm.md` — data model design
3. `migrations.md` — keep schema reproducible
4. `views-urls.md` — wire up request handling
5. `forms-and-validators.md` + `templates.md` if rendering HTML, **or** `drf-and-ninja.md` if exposing an API
6. `auth-and-permissions.md` + `admin.md` once you have users
7. `caching-and-sessions.md` + `celery-and-tasks.md` for performance / background work
8. `recommended-defaults.md` + `deployment.md` before going live
9. `troubleshooting.md` when something breaks

## Conventions used in references

- `python manage.py <cmd>` examples assume the project's `manage.py` is in CWD
- Settings examples assume a `settings/` package with `base.py`, `dev.py`, `prod.py` — the split is introduced in `setup.md`
- Model examples use a hypothetical `shop` app with `Order`, `Product`, `Customer`
- "User" means the user model returned by `django.contrib.auth.get_user_model()` — never `django.contrib.auth.models.User` directly
- ORM examples use a Postgres backend unless otherwise noted
