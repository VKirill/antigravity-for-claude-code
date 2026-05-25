# Prisma — Client Queries

## Client setup (v7)

```ts
import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
});
```

Singleton in serverful Node — open once, reuse. Singleton in Next.js dev hot-reload:

```ts
declare global { var prisma: PrismaClient | undefined }
export const prisma = globalThis.prisma ?? new PrismaClient({ adapter });
if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;
```

## Read operations

```ts
// Single
const u = await prisma.user.findUnique({ where: { id } });
const u = await prisma.user.findFirst({ where: { email: { contains: '@x' } } });
const u = await prisma.user.findUniqueOrThrow({ where: { id } });   // throws on miss

// List
const us = await prisma.user.findMany({
  where: { role: 'ADMIN', AND: [{ createdAt: { gte: new Date('2026-01-01') } }] },
  orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
  take: 20,
  skip: 0,
  select: { id: true, email: true },
});

// Count
const n = await prisma.user.count({ where: { role: 'ADMIN' } });

// Aggregate
const stats = await prisma.order.aggregate({
  where: { status: 'PAID' },
  _sum: { amount: true },
  _avg: { amount: true },
  _count: true,
});

// Group by
const byStatus = await prisma.order.groupBy({
  by: ['status'],
  _count: true,
  _sum: { amount: true },
  having: { _count: { _gt: 10 } },
});
```

## Where operators

| Operator | Example |
|---|---|
| `equals` (default) | `{ email: 'x@y.z' }` |
| `not` | `{ email: { not: 'x@y.z' } }` |
| `in` / `notIn` | `{ id: { in: ['a', 'b'] } }` |
| `lt` / `lte` / `gt` / `gte` | `{ createdAt: { gte: date } }` |
| `contains` / `startsWith` / `endsWith` | `{ email: { contains: '@admin', mode: 'insensitive' } }` |
| `AND` / `OR` / `NOT` | `{ OR: [{ role: 'ADMIN' }, { email: { contains: '@admin' } }] }` |
| `every` / `some` / `none` (relation) | `{ posts: { some: { published: true } } }` |
| `is` / `isNot` (relation) | `{ author: { is: { role: 'ADMIN' } } }` |
| `isEmpty` / `has` / `hasSome` / `hasEvery` (arrays) | `{ tags: { has: 'foo' } }` |

## Pagination

```ts
// Offset (simple, slow on large tables)
const page = await prisma.post.findMany({ skip: 100, take: 20, orderBy: { id: 'asc' } });

// Cursor (keyset — recommended)
const page = await prisma.post.findMany({
  take: 20,
  cursor: lastId ? { id: lastId } : undefined,
  skip: lastId ? 1 : 0,        // skip the cursor itself
  orderBy: { id: 'asc' },
});
```

For keyset on a non-unique column, combine with a tiebreaker: `orderBy: [{ createdAt: 'desc' }, { id: 'asc' }]`.

## Write operations

```ts
// Create
const u = await prisma.user.create({ data: { email: 'a@b.c' } });

// Create with nested
const u = await prisma.user.create({
  data: {
    email: 'a@b.c',
    posts: { create: [{ title: 'Hi' }, { title: 'Hello' }] },
    profile: { create: { bio: 'hi' } },
  },
  include: { posts: true, profile: true },
});

// Many
await prisma.user.createMany({ data: [{ email: 'a@b.c' }, { email: 'c@d.e' }], skipDuplicates: true });

// Update
const u = await prisma.user.update({ where: { id }, data: { name: 'New' } });

// Update many
await prisma.user.updateMany({ where: { role: 'USER' }, data: { lastLoginAt: new Date() } });

// Upsert (atomic)
const u = await prisma.user.upsert({
  where: { email },
  create: { email, name },
  update: { name },
});

// Delete
await prisma.user.delete({ where: { id } });
await prisma.user.deleteMany({ where: { deletedAt: { lt: cutoff } } });
```

## Nested writes

```ts
// Connect existing record on create
await prisma.post.create({ data: { title: 'Hi', author: { connect: { id: userId } } } });

// Create OR connect (find-or-create)
await prisma.post.create({
  data: {
    title: 'Hi',
    tags: { connectOrCreate: [{ where: { name: 'tech' }, create: { name: 'tech' } }] },
  },
});

// Disconnect / set (replace) on update
await prisma.post.update({
  where: { id },
  data: { tags: { set: [{ name: 'tech' }] } },     // replaces all tags
});
```

## Raw SQL escape hatches

```ts
// Parameterized — SAFE (tagged template)
const rows = await prisma.$queryRaw<{ id: string; email: string }[]>`
  SELECT id, email FROM "User" WHERE created_at > ${cutoff}
`;

// Execute (no rows returned) — for DDL or bulk update
await prisma.$executeRaw`UPDATE "User" SET "lastLoginAt" = NOW() WHERE id = ${id}`;

// Unsafe — NEVER pass user input directly
await prisma.$queryRawUnsafe(`SELECT * FROM "${table}" WHERE id = '${id}'`);  // ❌ SQL injection
```

Use `Prisma.sql` for composable raw fragments:

```ts
import { Prisma } from './generated/prisma';
const orderClause = Prisma.sql`ORDER BY ${Prisma.raw(orderCol)} ${sortDir === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`}`;
await prisma.$queryRaw`SELECT * FROM "Post" ${orderClause} LIMIT ${limit}`;
```

`Prisma.raw()` is the **only** unsafe injection point; restrict its arg to a whitelist.

## Errors

```ts
import { Prisma } from './generated/prisma';

try {
  await prisma.user.create({ data: { email } });
} catch (err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {   // unique violation
      throw new AppError('email taken', 409, 'duplicate');
    }
    if (err.code === 'P2025') {   // record not found
      throw new AppError('not found', 404, 'not_found');
    }
  }
  throw err;
}
```

Common codes: `P2002` unique, `P2003` FK, `P2025` not found, `P2034` transaction conflict (retry).

## `$extends`

```ts
const xprisma = prisma.$extends({
  query: {
    user: {
      async findUnique({ args, query }) {
        // attach soft-delete filter
        args.where = { ...args.where, deletedAt: null };
        return query(args);
      },
    },
  },
  result: {
    user: {
      displayName: {
        needs: { email: true, name: true },
        compute: (u) => u.name ?? u.email.split('@')[0],
      },
    },
  },
  model: {
    user: {
      async findByEmailOrFail(email: string) {
        const u = await prisma.user.findUnique({ where: { email } });
        if (!u) throw new Error('not found');
        return u;
      },
    },
  },
});
```
