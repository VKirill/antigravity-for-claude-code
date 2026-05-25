# Eval cases — routing tests

Positive prompts should cause Claude to load this skill. Negative prompts should NOT.

## Positive — these should load `sqlalchemy`

1. "I get `MissingGreenlet` when accessing `order.items` after `await session.commit()` — what's wrong?"
2. "How do I set up Alembic autogenerate with naming conventions?"
3. "Convert this legacy `session.query(User).filter(...)` to 2.0-style `select()`"
4. "How do I do an upsert in SQLAlchemy with Postgres?"
5. "Should I use `joinedload` or `selectinload` for a one-to-many collection?"
6. "Set up `AsyncSession` as a FastAPI dependency"
7. "Why is `expire_on_commit=False` recommended for async sessionmaker?"
8. "How do I model a many-to-many relationship in SQLAlchemy 2.0 with `Mapped[T]`?"
9. "My SQLAlchemy pool is exhausted — `QueuePool limit ... reached`"
10. "Write an Alembic env.py for async migrations with asyncpg"
11. "How do I store a JSONB column with SQLAlchemy in Postgres?"
12. "How do I write a test that rolls back the transaction after each test?"
13. "What's the difference between `session.scalar()`, `session.scalars().one()`, and `session.execute().scalar_one()`?"
14. "I'm getting `DetachedInstanceError` from a FastAPI route — how to fix?"

## Negative — these should NOT load this skill

1. "How do I write a Django QuerySet to filter active users?" → `django`
2. "How do I configure Prisma migrations?" → `prisma`
3. "Postgres won't accept connections — what do I check?" → `postgresql` (DBA layer)
4. "How do I write a Pydantic model with a discriminated union?" → `pydantic`
5. "FastAPI dependency injection without database" → `fastapi`
6. "How do I write a pytest fixture in general?" → `pytest`
7. "How do I run a Redis SET with TTL from Python?" → `redis`
8. "Tortoise ORM async model definition" → general assistant (Tortoise is niche)
9. "What's the syntax for a Drizzle schema?" → `prisma`/cascade (TS-side)

## Boundary — load this skill but also consider co-loading

1. "FastAPI + async SQLAlchemy session pattern" — `sqlalchemy` (primary) + `fastapi` (consumer)
2. "Alembic autogenerate keeps regenerating my Postgres `ENUM`" — `sqlalchemy` (Alembic gotchas) + `postgresql` (ENUM ALTER semantics)
3. "Convert a Django model to a SQLAlchemy 2.0 model" — `sqlalchemy` (target) + general migration advice
4. "Pydantic model from SQLAlchemy row" — `sqlalchemy` (source) + `pydantic` (target shape)
