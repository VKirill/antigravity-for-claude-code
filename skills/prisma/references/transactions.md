# Prisma — Transactions

## Interactive transactions (recommended)

```ts
const created = await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({ data: { email } });
  await tx.audit.create({ data: { userId: user.id, action: 'create' } });
  return user;
});
```

`tx` is a `PrismaClient`-like object scoped to the transaction. Anything thrown rolls back. Anything returned commits.

## Options

```ts
await prisma.$transaction(async (tx) => { /* ... */ }, {
  maxWait: 5_000,                 // ms — how long to wait to acquire a slot
  timeout: 30_000,                 // ms — how long the txn can run
  isolationLevel: 'Serializable',  // 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable'
});
```

Default isolation level is the DB default (Postgres: `ReadCommitted`).

## When to use which isolation level

| Need | Level |
|---|---|
| Speed, idempotent reads | `ReadCommitted` (default) |
| Reading multiple rows that must be consistent (e.g., balance + ledger sum) | `RepeatableRead` |
| Multi-row updates that mustn't interleave | `Serializable` |

`Serializable` triggers retries; handle `P2034` ("Transaction failed due to a write conflict or a deadlock"):

```ts
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034' && i < attempts - 1) {
        await new Promise(r => setTimeout(r, 50 * (i + 1)));   // backoff
        continue;
      }
      throw err;
    }
  }
  throw new Error('unreachable');
}
```

## Batched transactions

Use when you have a fixed list of operations and don't need to branch on intermediate results:

```ts
const [user, post] = await prisma.$transaction([
  prisma.user.create({ data: { email } }),
  prisma.post.create({ data: { title: 'Hi', authorId: 'tbd' } }),  // can't use user.id here
]);
```

This is one round-trip; either all queries commit or all roll back. **You cannot read intermediate results** — use interactive transactions for that.

## Locking rows

Prisma doesn't have a native `SELECT FOR UPDATE` API. Use raw SQL inside a transaction:

```ts
await prisma.$transaction(async (tx) => {
  const [{ balance }] = await tx.$queryRaw<{ balance: number }[]>`
    SELECT balance FROM "Account" WHERE id = ${id} FOR UPDATE
  `;
  if (balance < amount) throw new Error('insufficient');
  await tx.account.update({ where: { id }, data: { balance: { decrement: amount } } });
});
```

`FOR UPDATE` locks the row until the transaction commits.

## Optimistic locking (no DB locks)

```prisma
model Order {
  id      String @id
  status  String
  version Int    @default(0)
}
```

```ts
const updated = await prisma.order.update({
  where: { id, version: currentVersion },     // include version in WHERE
  data: { status: 'PAID', version: { increment: 1 } },
});
// if updated.count === 0 → someone else changed it; retry or fail
```

Prisma's `update` throws `P2025` if no row matches — catch and treat as conflict.

## Idempotency keys (HTTP layer)

```ts
async function chargeWithIdempotency(key: string, action: () => Promise<Order>) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.idempotencyKey.findUnique({ where: { key } });
    if (existing) return JSON.parse(existing.response);
    const result = await action();
    await tx.idempotencyKey.create({ data: { key, response: JSON.stringify(result) } });
    return result;
  });
}
```

## Anti-patterns

- ❌ Long-running transactions (>30s default) — connections sit idle in the pool
- ❌ External HTTP calls inside a transaction — keeps the txn open across network latency
- ❌ Using batched `$transaction([...])` then trying to use the result of step 1 in step 2 — impossible; use interactive
- ❌ Catching all errors in the outer `try` and not letting Prisma roll back — `throw` inside the callback to rollback
- ❌ Forgetting `for update` when reading-then-writing — race condition
- ❌ Putting `bcrypt.hash` (CPU-bound) inside a transaction — blocks event loop; hash outside, then commit
