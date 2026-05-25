# Database adapters

Better Auth supports four official adapters. Pick one — do not mix.

| Adapter | Path | Best for |
|---|---|---|
| Built-in Kysely | (default — pass `Pool` / `Database` directly) | Vanilla Postgres / MySQL / SQLite without an ORM |
| Drizzle | `better-auth/adapters/drizzle` | Drizzle-based projects, edge runtimes |
| Prisma | `better-auth/adapters/prisma` | Prisma-based projects (see [prisma](../../prisma/SKILL.md) skill) |
| MongoDB | `better-auth/adapters/mongodb` | MongoDB-only stacks |

Secondary storage (for sessions / rate-limits): Redis via `@better-auth/redis-storage`.

## Prisma adapter

```ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";
// or: import { PrismaClient } from "@/generated/prisma/client"  (Prisma v7 custom output)

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql", // | "mysql" | "sqlite" | "mongodb"
  }),
});
```

**Workflow:**

```bash
# 1. Define betterAuth() config including all plugins
# 2. Generate Prisma models for the auth tables
npx @better-auth/cli generate
# → appends models (User, Session, Account, Verification, plus plugin tables) to schema.prisma

# 3. Create + apply the migration
npx prisma migrate dev --name better_auth_init

# 4. Regenerate the Prisma client
npx prisma generate
```

See the [prisma](../../prisma/SKILL.md) skill for Prisma v7 specifics (`prisma.config.ts`, driver adapters, ESM-only).

## Drizzle adapter

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db"; // your drizzle instance

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg", // | "mysql" | "sqlite"
    // schema: { user: users, session: sessions, ... }  // optional, for custom names
  }),
});
```

**Workflow:**

```bash
# 1. Generate the table definitions
npx @better-auth/cli generate
# → emits Drizzle schema (e.g., src/db/schema/auth.ts)

# 2. Push or migrate
npx drizzle-kit push    # dev
# or
npx drizzle-kit generate && npx drizzle-kit migrate  # prod
```

## Built-in Kysely

For projects without an ORM. Pass the raw connection — Better Auth wraps it with Kysely internally.

```ts
// PostgreSQL
import { betterAuth } from "better-auth";
import { Pool } from "pg";

export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
});
```

```ts
// SQLite (better-sqlite3)
import Database from "better-sqlite3";
export const auth = betterAuth({ database: new Database("./auth.db") });
```

```ts
// MySQL
import { createPool } from "mysql2/promise";
export const auth = betterAuth({
  database: createPool({ uri: process.env.DATABASE_URL }),
});
```

**Migrations:**

```bash
# Apply migrations directly via the CLI (Kysely path only)
npx @better-auth/cli migrate
```

Does not run on Workers — Kysely's Node drivers are not edge-compatible. Use Prisma/Drizzle adapter for edge.

## MongoDB adapter

```ts
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI!);
const db = client.db();

export const auth = betterAuth({
  database: mongodbAdapter(db),
});
```

No schema migrations needed — collections are created on first write. Indexes are created automatically.

## Redis as secondary storage

For session storage and rate-limit counters in a multi-instance deployment:

```ts
import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { Redis } from "ioredis";
import { redisStorage } from "@better-auth/redis-storage";

const redis = new Redis({ host: "localhost", port: 6379 });

export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  secondaryStorage: redisStorage({ client: redis, keyPrefix: "auth:" }),

  session: {
    storeSessionInDatabase: true,       // dual-write (Redis primary, DB fallback)
    preserveSessionInDatabase: false,   // delete from DB when deleted from Redis
  },
});
```

When `secondaryStorage` is set:
- Sessions live in Redis (low latency).
- DB row is optional (`storeSessionInDatabase`).
- Rate-limit counters use Redis automatically.

Pair with the [redis](../../redis/SKILL.md) skill for Redis tuning.

## Core schema (Kysely / Drizzle / Prisma)

After `generate`, you get at minimum:

| Table | Purpose |
|---|---|
| `user` | id, email, name, emailVerified, image, createdAt, updatedAt |
| `session` | id, userId, expiresAt, token, ipAddress, userAgent |
| `account` | id, userId, providerId, accountId, accessToken, refreshToken, idToken, password (hashed) |
| `verification` | id, identifier, value, expiresAt — pending verifications (email, OTP, magic-link tokens) |

Plugin tables (add when plugin is enabled):

| Plugin | Added tables / columns |
|---|---|
| `twoFactor()` | `twoFactor` (userId, secret, backupCodes) |
| `organization()` | `organization`, `member`, `invitation`, `team` (if teams enabled), plus `activeOrganizationId` on session |
| `passkey()` | `passkey` (id, userId, publicKey, counter, transports) |
| `apiKey()` | `apiKey` (id, userId, hashedKey, expiresAt) |
| `admin()` | adds `role`, `banned` columns to `user` |
| `username()` | adds `username` column to `user` |

After enabling any plugin, **re-run** `npx @better-auth/cli generate` and migrate.

## Custom field / table names

```ts
betterAuth({
  user: {
    modelName: "users",         // SQL table name
    fields: { email: "email_address" },
  },
  session: {
    modelName: "sessions",
    fields: { userId: "user_id" },
  },
});
```

Keep snake_case overrides consistent across ORM schema and Better Auth config — drift causes adapter lookups to silently fail.

## Adapter selection rules

- **Already using Prisma in the app** → Prisma adapter
- **Already using Drizzle** → Drizzle adapter
- **No ORM, single Postgres** → built-in Kysely with `Pool`
- **Edge (Workers, Vercel Edge)** → Prisma (with driver adapter) or Drizzle, NOT built-in Kysely
- **MongoDB primary** → MongoDB adapter

Never run two adapters against the same database — schema-tracking conflicts will lose data.
