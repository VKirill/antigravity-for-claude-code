# Prisma — Relations, includes, and the N+1 trap

## `include` vs `select`

- `include` — adds the relation to the default `*` projection. Returns ALL scalar fields of both sides.
- `select` — projects EXACTLY what you ask for. The two are mutually exclusive at the same level.

```ts
// include — heavy, all fields
await prisma.user.findMany({ include: { posts: true } });

// select — only what you need
await prisma.user.findMany({
  select: { id: true, email: true, posts: { select: { id: true, title: true } } },
});
```

For any hot read path, **prefer `select`**. `include` is fine for low-volume admin pages.

## Nested filters

```ts
// users that have ANY published post
await prisma.user.findMany({ where: { posts: { some: { published: true } } } });

// users with NO posts
await prisma.user.findMany({ where: { posts: { none: {} } } });

// users where EVERY post is published (or they have no posts — beware!)
await prisma.user.findMany({ where: { posts: { every: { published: true } } } });

// post belongs to admin
await prisma.post.findMany({ where: { author: { is: { role: 'ADMIN' } } } });
```

## Filtering inside `include`

```ts
const users = await prisma.user.findMany({
  include: {
    posts: {
      where: { published: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, title: true },
    },
    _count: { select: { posts: true } },
  },
});
// users[0]._count.posts === total posts count (ignores the where above — _count is on the relation)
```

## `_count` field

```ts
await prisma.user.findMany({
  select: {
    id: true,
    _count: { select: { posts: { where: { published: true } } } },
  },
});
```

Counts a filtered subset of the relation. Useful for pagination metadata.

## The N+1 trap

```ts
// ❌ N+1 — one query per user
const users = await prisma.user.findMany();
for (const u of users) {
  const posts = await prisma.post.findMany({ where: { authorId: u.id } });
}

// ✅ One query
const users = await prisma.user.findMany({ include: { posts: true } });

// ✅ Or two queries with WHERE IN
const users = await prisma.user.findMany();
const posts = await prisma.post.findMany({ where: { authorId: { in: users.map(u => u.id) } } });
```

`include` translates to a single SQL with `JOIN` (or batched IN, depending on cardinality).

## Many-to-many — implicit vs explicit

Implicit (join table is generated):

```prisma
model Post { id String @id; tags Tag[] }
model Tag  { id String @id; posts Post[] }
```

Query: `prisma.post.findMany({ include: { tags: true } })`.

Explicit (need extra join fields):

```prisma
model PostTag {
  postId String
  tagId  String
  addedAt DateTime @default(now())
  post Post @relation(fields: [postId], references: [id])
  tag  Tag  @relation(fields: [tagId],  references: [id])
  @@id([postId, tagId])
}
```

Query: `prisma.post.findMany({ include: { tags: { include: { tag: true } } } })` — note the extra nesting.

## Self-relations

```prisma
model Comment {
  id      String    @id @default(cuid())
  body    String
  parentId String?
  parent   Comment?  @relation("CommentToComment", fields: [parentId], references: [id])
  replies  Comment[] @relation("CommentToComment")
}
```

Query a tree (limited depth — Prisma can't do recursive `WITH RECURSIVE`):

```ts
await prisma.comment.findMany({
  where: { parentId: null },
  include: { replies: { include: { replies: true } } },   // 3 levels max
});
```

For arbitrary depth, drop to `$queryRaw` with `WITH RECURSIVE`.

## Composite unique lookup

```prisma
model Membership {
  userId String
  orgId  String
  role   String
  @@unique([userId, orgId])
}
```

Lookup uses the compound key name:

```ts
await prisma.membership.findUnique({
  where: { userId_orgId: { userId, orgId } },
});
```

## `relationLoadStrategy`

Prisma can either **JOIN** (single SQL) or **query in two passes** (separate `SELECT`s). Default heuristics work, but you can override:

```ts
await prisma.user.findMany({
  relationLoadStrategy: 'join',   // 'query' for two-pass
  include: { posts: true },
});
```

`join` wins for narrow relations; `query` wins when the parent row is heavy and you'd duplicate it many times in the join result.

## Performance triage

If a Prisma query is slow:

1. Enable `log: ['query']` and inspect the emitted SQL.
2. Run it directly in `psql` with `EXPLAIN ANALYZE`.
3. Look for `Seq Scan` on filtered columns → add `@@index`.
4. Replace `include` with `select` if you don't need all columns.
5. If a 1-to-many include returns thousands of children per parent, paginate the include.
