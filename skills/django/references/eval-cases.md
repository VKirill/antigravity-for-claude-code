# Eval cases — Django skill routing

Verify that the `django` skill is loaded for the right prompts and **not** loaded for adjacent-but-different prompts.

## Positive — should route to `django`

| Prompt | Why |
|---|---|
| "set up a new Django 6 project with a settings package" | new project + Django explicitly |
| "fix this N+1 in a Django ORM queryset" | ORM + N+1 — classic Django |
| "add an async view that calls `Product.objects.aget`" | async ORM mention |
| "we need an admin page for the `Order` model" | ModelAdmin domain |
| "swap our login flow to a custom `AbstractBaseUser`" | `AUTH_USER_MODEL` topic |
| "rewrite this form as a `ModelForm` with `clean_email`" | Forms + ModelForm |
| "deploy Django behind Gunicorn + UvicornWorker on Angie" | ASGI deploy |
| "write a `RunPython` migration to backfill a column" | migrations / RunPython |
| "should we use DRF or Django Ninja for this REST API?" | drf-and-ninja decision |
| "the page is slow because the admin changelist hits the DB 200 times" | N+1 in admin |
| "configure `CONN_MAX_AGE` and `CSRF_TRUSTED_ORIGINS` for prod" | recommended defaults |
| "convert this `@app.on_event` to Django's `django.tasks`" | tasks framework |
| "set up Whitenoise and `collectstatic`" | static files / deploy |
| "we get `SynchronousOnlyOperation` from a Channels consumer" | async views |
| "set `AUTH_USER_MODEL` to a custom user before first migrate" | auth |

## Negative — should NOT route to `django`

| Prompt | Why → correct skill |
|---|---|
| "build a FastAPI endpoint with Pydantic" | → `fastapi` |
| "Flask blueprint for a tiny webhook" | → `flask` cascade |
| "Fastify plugin with a Zod-typed body" | → `fastify` |
| "Hono route on Cloudflare Workers" | → `hono` |
| "raw SQLAlchemy 2.0 async session without Django" | → `sqlalchemy` |
| "Pydantic discriminated union for an LLM tool call" | → `pydantic` |
| "PostgreSQL `CREATE INDEX CONCURRENTLY` syntax" | → `postgresql` (Django covers the *migration wrapper*; raw SQL is Postgres) |
| "configure pytest fixtures for a CLI tool, no Django" | → `pytest` |
| "Redis `XREADGROUP` consumer group setup" | → `redis` |

## Ambiguity calls

| Prompt | Routing |
|---|---|
| "DRF serializer with nested writable fields" | `django` — DRF is in Django Ninja's neighborhood; this skill covers the integration point. Deep DRF arcana belongs to a future `djangorestframework` cascade skill. |
| "Django Channels consumer for a chat room" | `django` for integration + ASGI deploy; deep Channels behavior is a future `channels` cascade |
| "Celery beat schedule for a daily Django command" | `django` for `transaction.on_commit` + Django ↔ Celery wiring; tuning workers belongs to a future `celery` cascade |
| "Vue frontend calling a Django REST endpoint" | both `django` (server) and `vue` (client); load both, prefer the one that matches the file you're editing |

## How to use these

When auditing this skill, paste the positive prompts into a session and confirm `django` is invoked. Paste the negatives and confirm the **other** skill takes over. If routing drifts, tighten the description triggers and re-run.
