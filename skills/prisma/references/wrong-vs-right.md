# Wrong vs Right — prisma

Five paste-runnable contrasts. High-stakes patterns where naïve usage compiles but breaks in production.

---

## 1. Unbounded `findMany` vs bounded `take`

**❌ Wrong — drags entire table when row count grows**
```ts
const users = await prisma.user.findMany({ where: { active: true } });
```

**✅ Right — bounded with default `take` + deterministic order**
```ts
const users = await prisma.user.findMany({
  where: { active: true },
  take: 50,                     // default page size — see recommended-defaults.md
  orderBy: { id: 'asc' },
});
```

**Why it matters**: A 100-row dev DB hides the problem. In prod with 1M rows this becomes a 30-second query that holds a pool slot — cascading into `P2024` for everyone else.

---

## 2. `include` (over-fetch) vs `select` (projection)

**❌ Wrong — `include: true` drags every column of every related row**
```ts
const post = await prisma.post.findUnique({
  where: { id },
  include: { author: true, comments: true },
});
// author.passwordHash, author.refreshToken, ... ship to caller
```

**✅ Right — `select` projects only what the response needs**
```ts
const post = await prisma.post.findUnique({
  where: { id },
  select: {
    id: true,
    title: true,
    author: { select: { id: true, name: true } },
    comments: {
      select: { id: true, body: true },
      take: 20,
      orderBy: { createdAt: 'desc' },
    },
  },
});
```

**Why it matters**: Leaks sensitive fields (password hashes, refresh tokens), bloats payload size, slows the JSON serializer, raises egress bills. The cost compounds with depth.

---

## 3. External HTTP inside `$transaction` vs network-outside

**❌ Wrong — Stripe call inside the tx holds a pool slot for network latency**
```ts
await prisma.$transaction(async (tx) => {
  const order = await tx.order.create({ data: input });
  // Stripe takes 200–2000 ms — slot occupied the whole time
  await fetch('https://api.stripe.com/v1/charges', { method: 'POST' });
  await tx.order.update({ where: { id: order.id }, data: { status: 'CHARGED' } });
});
```

**✅ Right — network outside, transaction tight**
```ts
const charge = await fetch('https://api.stripe.com/v1/charges', { method: 'POST' });
const stripeId = (await charge.json()).id;
await prisma.$transaction(async (tx) => {
  await tx.order.create({ data: { ...input, stripeId, status: 'CHARGED' } });
});
```

**Why it matters**: Pool of 10, 50 RPS, and 1 s Stripe latency = 50 concurrent slot holds → queue → `P2024: Timed out fetching a new connection`. The DB is fine; the pool is the bottleneck.

---

## 4. `$queryRawUnsafe` (injection) vs `$queryRaw` tagged template

**❌ Wrong — string interpolation = SQL injection**
```ts
const u = await prisma.$queryRawUnsafe(
  `SELECT * FROM "User" WHERE id = '${userId}'`,
);
// userId = "x' OR '1'='1" → SELECT all users
```

**✅ Right — tagged template, Prisma parameterizes**
```ts
const u = await prisma.$queryRaw`
  SELECT * FROM "User" WHERE id = ${userId}
`;
// Emitted as: SELECT * FROM "User" WHERE id = $1  (with $1 = userId)
```

**✅ Right — if you must pass a dynamic identifier (table/column name), allow-list it**
```ts
const ALLOWED_SORT = new Set(['name', 'email', 'createdAt']);
if (!ALLOWED_SORT.has(sortBy)) throw new Error('invalid sort');
await prisma.$queryRawUnsafe(`SELECT * FROM "User" ORDER BY "${sortBy}"`);
```

**Why it matters**: User input as raw SQL is an RCE-equivalent vuln. Tagged templates emit `$1, $2, ...` placeholders; injection is impossible. The unsafe variant only exists for cases where identifiers (NOT values) must be dynamic — always validate against an allow-list.

---

## 5. Per-import `new PrismaClient()` vs `globalThis` singleton (Next.js dev HMR)

**❌ Wrong — pool leak on every HMR cycle**
```ts
// lib/prisma.ts
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });
```

**✅ Right — singleton bound to `globalThis`**
```ts
// lib/prisma.ts
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function makeClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter, log: ['warn', 'error'] });
}

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

**Why it matters**: In Next.js dev, HMR re-evaluates `lib/prisma.ts` on every save. Without the singleton, dozens of `PrismaClient` instances pile up within minutes, each holding pool slots, until Postgres hits `max_connections`. In production this code path doesn't execute (no HMR), so the conditional is safe.

---

## See also

- All defaults referenced above: [recommended-defaults.md](recommended-defaults.md)
- Symptom-indexed fixes: [troubleshooting.md](troubleshooting.md)
- Transaction semantics deep-dive: [transactions.md](transactions.md)
