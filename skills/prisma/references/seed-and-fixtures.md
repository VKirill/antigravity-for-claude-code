# Prisma — Seeding & Fixtures

## Seed script location

```
prisma/
  schema.prisma
  seed.ts
```

## Configuring in v7 — `prisma.config.ts`

```ts
// In Prisma 7 the package is `prisma/config` (NOT `@prisma/config`).
import { defineConfig, env } from 'prisma/config';
import 'dotenv/config';

type Env = { DATABASE_URL: string };

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: { url: env<Env>('DATABASE_URL') },
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
});
```

`prisma db seed` and `prisma migrate reset` will both run this command.

## Legacy v6-style fallback (still supported)

`package.json`:

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

## Idempotent seed (use `upsert`)

```ts
// prisma/seed.ts
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    create: { email: 'admin@example.com', name: 'Admin', role: 'ADMIN' },
    update: {},
  });

  await prisma.tag.createMany({
    skipDuplicates: true,
    data: [{ name: 'tech' }, { name: 'business' }, { name: 'design' }],
  });

  for (let i = 0; i < 5; i++) {
    await prisma.post.upsert({
      where: { slug: `seed-post-${i}` },
      create: {
        title: `Seed post ${i}`,
        slug: `seed-post-${i}`,
        body: 'lorem ipsum',
        authorId: admin.id,
      },
      update: {},
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
```

## Faker for realistic data

```ts
import { faker } from '@faker-js/faker';

const users = await Promise.all(
  Array.from({ length: 100 }, () => prisma.user.create({
    data: { email: faker.internet.email(), name: faker.person.fullName() },
  }))
);
```

Use `faker.seed(123)` for reproducible seeds across runs.

## Environment-aware seeds

```ts
async function main() {
  await seedBaseRoles();

  if (process.env.NODE_ENV !== 'production') {
    await seedDemoData();
  }
}
```

Never seed test users / demo passwords into prod.

## Test fixtures vs seeds

- **Seed** — long-lived data (roles, settings, lookup tables) that every fresh DB needs
- **Fixture** — per-test data; create in `beforeEach`/`beforeAll`, tear down after

```ts
// test fixture
beforeEach(async () => {
  await prisma.$transaction([
    prisma.post.deleteMany(),
    prisma.user.deleteMany(),
  ]);
  user = await prisma.user.create({ data: { email: 'test@x.com' } });
});
```

## Truncate vs delete

```ts
// fastest, resets identity columns:
await prisma.$executeRawUnsafe('TRUNCATE TABLE "Post", "User" RESTART IDENTITY CASCADE');

// safer, respects FK CASCADE:
await prisma.$transaction([prisma.post.deleteMany(), prisma.user.deleteMany()]);
```

## Snapshotting / restoring

For golden-state E2E tests, dump after seed:

```bash
pg_dump --data-only --no-owner mydb > seed-snapshot.sql
```

Restore between test runs to skip re-running the seed script.

## Performance for large seeds

```ts
// ❌ N round-trips
for (const row of rows) await prisma.thing.create({ data: row });

// ✅ One round-trip per batch
await prisma.thing.createMany({ data: rows, skipDuplicates: true });

// ✅ For very large datasets, COPY FROM via raw SQL
await prisma.$executeRawUnsafe(`COPY "Thing" (col1, col2) FROM STDIN WITH (FORMAT csv)`);
```

`createMany` skips middleware (`$extends.query`) — keep that in mind for soft-delete extensions.

## Anti-patterns

- ❌ Non-idempotent seed — second `prisma migrate reset` errors on duplicate inserts
- ❌ Hardcoded IDs that conflict across environments
- ❌ Seeding from JSON files without validating the shape (use Zod)
- ❌ Running seed inside a long transaction — risks `maxWait` exceeded
- ❌ Forgetting `prisma.$disconnect()` — leaks pool on exit
