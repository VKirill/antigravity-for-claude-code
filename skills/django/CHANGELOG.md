# Changelog — django skill

All notable changes to this skill. SemVer at the skill level.

## v1.0.0 — initial release

Pattern 2 skill for Django 6, the batteries-included Python web framework.

**Highlights covered for Django 6:**
- New built-in `django.tasks` framework — enqueue background tasks without Celery for simple use cases
- Template partials (`{% partialdef %}` / `{% partial %}`) for fragment reuse and HTMX-style partial responses
- `DEFAULT_AUTO_FIELD` defaults to `BigAutoField` — no longer needs to be set explicitly
- `AsyncPaginator` for paginating async querysets
- `StringAgg` aggregate available across all DB backends (previously Postgres-only)
- PBKDF2 default iterations raised to 1,200,000
- Python 3.12 / 3.13 / 3.14 support; 3.10 / 3.11 dropped
- Built-in CSP middleware and `SECURE_CSP` setting

**Reference layout (Pattern 2):**

- `references/REFERENCE.md` — decision map and reading order
- `references/setup.md` — project layout, settings package, env-based settings
- `references/models-and-orm.md` — `Model`, fields, `on_delete`, querysets, `F`/`Q`, `select_related` / `prefetch_related`
- `references/migrations.md` — `makemigrations`, `RunPython`, `--fake`, multi-db, schema safety in production
- `references/views-urls.md` — FBV vs CBV, generic views, `path` converters, `include()`, namespacing
- `references/forms-and-validators.md` — `Form`, `ModelForm`, `clean_*`, formsets, file uploads
- `references/templates.md` — DTL, custom tags/filters, context processors, Django 6 partials, Jinja2 backend
- `references/auth-and-permissions.md` — `AUTH_USER_MODEL`, custom user, permissions, sessions
- `references/admin.md` — `ModelAdmin`, inlines, custom actions, autocomplete, hardening
- `references/drf-and-ninja.md` — REST framework choice between DRF and Django Ninja
- `references/async-views.md` — `async def`, async ORM (`aget`/`afilter`/...), `sync_to_async`, ASGI deploy, Channels integration
- `references/caching-and-sessions.md` — cache backends, low-level API, fragment cache, session backends
- `references/celery-and-tasks.md` — Django 6 `django.tasks`, Celery pattern, `transaction.on_commit`, idempotency
- `references/deployment.md` — Gunicorn (WSGI) vs Gunicorn + UvicornWorker / Uvicorn (ASGI), Whitenoise, reverse proxy, `DEBUG=False` checklist
- `references/recommended-defaults.md` — `CONN_MAX_AGE`, HSTS, cookies, CSRF, Gunicorn, Celery defaults
- `references/troubleshooting.md` — symptom-indexed: N+1, OperationalError, CSRF, race conditions, async sync-call, migration drift
- `references/wrong-vs-right.md` — 12 anti-pattern pairs with corrected form
- `references/eval-cases.md` — routing tests

**Risk level:** `high-stakes` — web framework powering production HTTP, auth, and the admin surface.
