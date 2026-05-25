# Prisma — Schema Modeling

## Anatomy of `schema.prisma` (v7)

```prisma
// Generator — emits the typed client
generator client {
  provider     = "prisma-client"
  output       = "../generated/prisma"
  runtime      = "nodejs"             // 'nodejs' | 'bun' | 'deno' | 'workerd' | 'edge-light'
  moduleFormat = "esm"
}

// Datasource — NO url in v7
datasource db {
  provider = "postgresql"             // postgresql | mysql | sqlite | sqlserver | mongodb | cockroachdb
}
```

`datasource.url` is supplied at runtime via `prisma.config.ts` (see `migration.md`).

## Model basics

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  role      Role     @default(USER)
  posts     Post[]
  profile   Profile?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([createdAt])
  @@map("users")
}

enum Role { USER ADMIN }
```

## Field attributes

| Attribute | Purpose |
|---|---|
| `@id` | Primary key |
| `@unique` | Unique constraint |
| `@default(...)` | Default expression — `cuid()`, `uuid()`, `uuid(7)`, `now()`, `autoincrement()`, literal |
| `@updatedAt` | Auto-bumps on update |
| `@map("col")` | Column name override |
| `@db.Type(...)` | Native DB type — `@db.VarChar(120)`, `@db.Decimal(10,2)`, `@db.Uuid`, `@db.Timestamptz` |
| `@relation(...)` | Foreign-key relation |

## Block attributes

| Attribute | Purpose |
|---|---|
| `@@id([a, b])` | Composite primary key |
| `@@unique([a, b])` | Composite unique constraint |
| `@@index([a])` / `@@index([a, b])` | Non-unique index |
| `@@map("table")` | Table name override |
| `@@schema("ns")` | Postgres schema (with `multiSchema` preview feature) |
| `@@fulltext([title])` | MySQL/Mongo fulltext index |

## Relations

### 1-to-1

```prisma
model User {
  id      String   @id
  profile Profile?
}
model Profile {
  id     String @id @default(cuid())
  bio    String
  userId String @unique
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### 1-to-many

```prisma
model User {
  id    String @id
  posts Post[]
}
model Post {
  id       String @id @default(cuid())
  title    String
  authorId String
  author   User   @relation(fields: [authorId], references: [id], onDelete: Cascade)

  @@index([authorId])
}
```

### Many-to-many (implicit join)

```prisma
model Post {
  id   String @id @default(cuid())
  tags Tag[]
}
model Tag {
  id    String @id @default(cuid())
  name  String @unique
  posts Post[]
}
```

Prisma generates the join table automatically.

### Many-to-many (explicit join)

When you need extra fields on the join:

```prisma
model PostTag {
  postId String
  tagId  String
  addedAt DateTime @default(now())
  post   Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  tag    Tag  @relation(fields: [tagId],  references: [id], onDelete: Cascade)
  @@id([postId, tagId])
}
```

### Self-relations

```prisma
model Category {
  id       String     @id @default(cuid())
  name     String
  parentId String?
  parent   Category?  @relation("CategoryToCategory", fields: [parentId], references: [id], onDelete: SetNull)
  children Category[] @relation("CategoryToCategory")
}
```

## Referential actions

`onDelete` / `onUpdate`: `Cascade`, `Restrict`, `NoAction`, `SetNull`, `SetDefault`. Default depends on DB (Postgres: `NoAction`).

## Enums

```prisma
enum OrderStatus {
  PENDING
  PAID
  REFUNDED
}
```

Postgres maps to native enum. MySQL/SQL Server emulate with `CHECK`.

## Native types

| Prisma | Postgres |
|---|---|
| `String @db.Uuid` | `uuid` |
| `String @db.VarChar(120)` | `varchar(120)` |
| `String @db.Text` | `text` |
| `DateTime @db.Timestamptz(6)` | `timestamptz` |
| `Decimal @db.Decimal(10,2)` | `numeric(10,2)` |
| `Bytes @db.ByteA` | `bytea` |
| `Json @db.JsonB` | `jsonb` |

Use `Decimal` for money — never `Float`.

## Composite types (Mongo) / Embedded JSON

```prisma
type Address {
  street String
  city   String
}

model User {
  id      String  @id
  address Address?
}
```

(MongoDB target. For Postgres, model `Address` as its own table OR store as `Json`.)

## Preview features

```prisma
generator client {
  provider        = "prisma-client"
  previewFeatures = ["multiSchema", "fullTextSearchPostgres", "views"]
}
```

| Feature | Why |
|---|---|
| `multiSchema` | Multiple Postgres schemas |
| `views` | Map DB views to read-only models |
| `tracing` | OpenTelemetry tracing of queries |
| `metrics` | Prometheus metrics |
| `prismaSchemaFolder` | Split schema across files |

## Common modeling gotchas

- ❌ Forgetting `@@index([fkColumn])` on every foreign key — Postgres does NOT auto-index FKs (unlike MySQL InnoDB)
- ❌ Using `String` for money — use `Decimal @db.Decimal(p, s)`
- ❌ Using `Int` for IDs in a multi-region setup — use `cuid()` or `uuid(7)` (timestamp-ordered)
- ❌ Storing booleans as `Int` "for compactness" — Postgres `bool` is 1 byte
- ❌ Missing `onDelete` — orphan rows accumulate; pick `Cascade` or `SetNull` intentionally
