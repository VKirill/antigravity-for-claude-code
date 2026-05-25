# Migrations

Django's schema migrations are first-class. They track model changes as ordered, hashed files under `<app>/migrations/`.

## Daily commands

```bash
python manage.py makemigrations              # detect model changes, write migration files
python manage.py makemigrations shop         # only one app
python manage.py makemigrations --dry-run    # preview without writing
python manage.py makemigrations --empty shop # blank migration for data ops
python manage.py migrate                     # apply unapplied migrations
python manage.py migrate shop 0007           # roll forward/back to a specific number
python manage.py migrate shop zero           # unapply all migrations of an app
python manage.py showmigrations              # graph state — [X] applied, [ ] pending
python manage.py sqlmigrate shop 0007        # print SQL that would run
python manage.py squashmigrations shop 0001 0050  # collapse early history
```

Always commit migration files. Never edit a migration that has been applied to a shared environment — make a new one.

## Anatomy of a migration

```python
# shop/migrations/0007_add_archive_flag.py
from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ("shop", "0006_initial_indexes"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="archived",
            field=models.BooleanField(default=False),
        ),
        migrations.AddIndex(
            model_name="product",
            index=models.Index(fields=["status", "archived"], name="prod_status_arch_idx"),
        ),
    ]
```

`dependencies` is the DAG. `operations` is replayed in order during `migrate`.

## Data migrations with `RunPython`

```python
from django.db import migrations

def forwards(apps, schema_editor):
    Product = apps.get_model("shop", "Product")   # historical model — always use apps.get_model
    Product.objects.filter(status="legacy").update(status="archived")

def reverse(apps, schema_editor):
    Product = apps.get_model("shop", "Product")
    Product.objects.filter(status="archived").update(status="legacy")

class Migration(migrations.Migration):
    dependencies = [("shop", "0007_add_archive_flag")]
    operations = [migrations.RunPython(forwards, reverse)]
```

Rules:
- Always `apps.get_model("app", "Model")` inside a migration — never `from shop.models import Product`. The model class at the time of writing the migration may not match the schema at the time of running it.
- Provide a `reverse` function (or `migrations.RunPython.noop`) — otherwise the migration can't be unapplied.
- Keep data migrations idempotent if possible — re-running on a partial-failure recovery should be safe.

## `--fake` and `--fake-initial`

`--fake` marks a migration as applied **without running the SQL**. Use only in narrow recovery scenarios:
- Existing DB already has the schema (rare manual case)
- A migration was applied out-of-band and you need Django's tracker to catch up

Never run `--fake` to "make migrations pass" because they're failing. Diagnose and fix the cause.

`--fake-initial`: applies the first migration of each app as fake if its tables already exist — useful when adopting Django on top of an existing schema. Run once, then never again.

## `squashmigrations`

Once an app has many migration files (>50), running `migrate` from zero gets slow. Squash:

```bash
python manage.py squashmigrations shop 0001 0050
```

This generates a single replacement migration. Keep the old files around for at least one full deploy cycle; remove them only when every environment is past the squash point.

## Multi-db routing

```python
# settings/base.py
DATABASES = {
    "default": {...},
    "analytics": {...},
}
DATABASE_ROUTERS = ["config.routers.AppRouter"]
```

```python
# config/routers.py
class AppRouter:
    def db_for_read(self, model, **hints):
        if model._meta.app_label == "analytics":
            return "analytics"
        return "default"

    def db_for_write(self, model, **hints):
        return self.db_for_read(model, **hints)

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if app_label == "analytics":
            return db == "analytics"
        return db == "default"
```

Migrate per-database: `python manage.py migrate --database=analytics`.

## Schema migration safety in production

Long-running schema changes block writes. Mitigation patterns:

| Risky op | Safer pattern |
|---|---|
| `ADD COLUMN NOT NULL DEFAULT …` on a huge table | 1) add nullable column, 2) backfill in batches, 3) flip to `NOT NULL` |
| `ALTER COLUMN` changing type | Add new column → copy → switch reads → drop old |
| `CREATE INDEX` on hot tables | Use Postgres `CONCURRENTLY` — wrap in `RunSQL` with `atomic=False` |
| Renames | Often impossible without downtime; consider dual-write |
| Dropping a column referenced by old workers | Two-phase: stop reads → deploy → drop |

For Postgres `CREATE INDEX CONCURRENTLY`:

```python
from django.db import migrations

class Migration(migrations.Migration):
    atomic = False        # required — CREATE INDEX CONCURRENTLY can't run in a transaction
    dependencies = [...]
    operations = [
        migrations.RunSQL(
            sql="CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_x ON shop_product (status);",
            reverse_sql="DROP INDEX IF EXISTS idx_x;",
        ),
    ]
```

## Avoiding deploy races

Run `migrate` **once**, in a single deploy step, **before** restarting application processes. Pattern for systemd / Docker:

```bash
# In a one-shot pre-deploy unit / init container
python manage.py migrate --check    # exits non-zero if there are pending migrations
python manage.py migrate --noinput
```

Never let N worker processes race to apply migrations on boot. Postgres has advisory locks that prevent concurrent identical migrations, but other DBs do not — and races still cause observability noise.

## Inspecting plan & dependencies

```bash
python manage.py showmigrations --plan
python manage.py sqlmigrate shop 0007 | less
```

`--plan` linearizes the DAG so you can see the exact order Django will apply. Useful for debugging "why is X migration being unapplied first?".

## Common pitfalls

- Editing a migration that has been applied — generates conflicting state across environments
- Adding a `RunPython` without a `reverse` — blocks rollback
- Importing the live model inside `RunPython` instead of `apps.get_model` — silently breaks on future schema
- Forgetting `atomic = False` for `CREATE INDEX CONCURRENTLY` — Postgres errors immediately
- `--fake`-ing a migration to silence failures — guarantees future drift
- Renaming a model without `RenameModel` op — Django sees it as drop+create and loses data
