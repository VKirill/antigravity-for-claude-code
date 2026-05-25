# Prisma 6 → 7 Migration

> Source: Context7 `/prisma/prisma` snapshots (May 2026, versions 7.4–7.6 stable).

## Headline changes

1. **`datasource.url` removed from `schema.prisma`** — moved to `prisma.config.ts`.
2. **Driver adapters are mandatory** — there is no fallback to a native binary engine.
3. **Generated client lives in your repo** — `output = "../generated/prisma"`, imported by path, NOT from `@prisma/client`.
4. **ESM by default** — `moduleFormat = "esm"`.
5. **`binaryTargets` removed** — no longer needed without the binary engine.

## Step 1 — Move datasource URL out of schema

Before (v6):

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

After (v7):

```prisma
datasource db {
  provider = "postgresql"
}
```

Create `prisma.config.ts` at repo root:

```ts
// Source: https://github.com/prisma/prisma (README, sandbox/basic-postgres)
// In v7 the package is `prisma/config` (NOT `@prisma/config`).
import { defineConfig, env } from 'prisma/config';
import 'dotenv/config';

type Env = { DATABASE_URL: string; SHADOW_DATABASE_URL?: string };

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env<Env>('DATABASE_URL'),
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
});
```

The CLI reads `prisma.config.ts` automatically.

## Step 2 — Pick a driver adapter

| DB | Adapter | Package |
|---|---|---|
| Postgres (self-host, RDS, Supabase) | `PrismaPg` | `@prisma/adapter-pg` |
| Neon serverless Postgres | `PrismaNeon` | `@prisma/adapter-neon` |
| Vercel Postgres | `PrismaPg` over the Vercel pg lib | `@prisma/adapter-pg` |
| Cloudflare D1 | `PrismaD1` | `@prisma/adapter-d1` |
| Turso / libSQL | `PrismaLibSQL` | `@prisma/adapter-libsql` |
| PlanetScale / MySQL | `PrismaPlanetScale` | `@prisma/adapter-planetscale` |
| MS SQL Server | `PrismaMssql` | `@prisma/adapter-mssql` |

```ts
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
```

## Step 3 — Configure the generator

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../generated/prisma"
  runtime      = "nodejs"           // or 'bun' | 'deno' | 'workerd' | 'edge-light'
  moduleFormat = "esm"              // or 'cjs'
}
```

Imports change:

```ts
// v6
import { PrismaClient } from '@prisma/client';

// v7
import { PrismaClient } from './generated/prisma/client';
```

Add `generated/` to `.gitignore` — regenerate in `postinstall`:

```json
{ "scripts": { "postinstall": "prisma generate" } }
```

## Step 4 — Update package.json

```json
{
  "dependencies": {
    "@prisma/client": "^7.6.0",
    "@prisma/adapter-pg": "^7.6.0",
    "pg": "^8.13.0"
  },
  "devDependencies": {
    "prisma": "^7.6.0"
  }
}
```

`defineConfig` / `env` are bundled with the `prisma` package (`prisma/config` subpath) — no separate `@prisma/config` install needed in v7.

```json
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

## Step 5 — Drop `binaryTargets`

```prisma
// v6
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl"]
}

// v7
generator client {
  provider = "prisma-client"
}
```

The engine is now plain TypeScript bundled with your code — no Rust binary, no platform-specific build artifact.

## Step 6 — Verify ESM compatibility

If your project is CJS, set `moduleFormat = "cjs"`. If ESM, use `"esm"`. Mixing — like importing the ESM client from a CJS consumer — will produce `[ERR_REQUIRE_ESM]`.

## Step 7 — Test the migration

```bash
prisma generate              # writes ./generated/prisma
prisma migrate dev           # picks up prisma.config.ts; uses shadow DB
node --experimental-strip-types -e "import('./src/db.ts').then(m => m.prisma.user.count().then(console.log))"
```

## Common errors

| Error | Fix |
|---|---|
| `datasource block must not contain url` | Remove `url = ...` from schema; move to `prisma.config.ts` |
| `Cannot find module '@prisma/client'` | Client is now at `output` path; update import |
| `No adapter set` | Pass `{ adapter: new PrismaPg(...) }` to `new PrismaClient()` |
| `ERR_REQUIRE_ESM when require('./generated/prisma/client')` | Generator `moduleFormat = "cjs"` or convert consumer to ESM |
| `prisma migrate dev` doesn't see `DATABASE_URL` | Add `import 'dotenv/config'` to `prisma.config.ts` |

## Why driver adapters

- Edge runtimes (Workers / Vercel Edge) can't run Rust binaries
- Native pool drivers (`pg`, `mysql2`) are battle-tested and tuned
- Better visibility — you can wrap the driver, log SQL, inject middleware
- No more "Prisma engine crashed" — the engine is just code in your bundle

## Backports / staying on v6

`6.19.x` is the LTS branch maintained for backports. If you can't migrate yet:

```json
{ "dependencies": { "prisma": "~6.19.0", "@prisma/client": "~6.19.0" } }
```

But the v7 migration is recommended — it's straightforward and unlocks edge runtimes + ~30% smaller bundles.

## Checklist

- [ ] Remove `url` from `datasource` block
- [ ] Create `prisma.config.ts`
- [ ] Install the driver adapter for your DB
- [ ] Update `generator client` block (provider name + output + runtime + moduleFormat)
- [ ] Update imports to the new `output` path
- [ ] Add `postinstall: prisma generate`
- [ ] Drop `binaryTargets`
- [ ] Run `prisma generate`
- [ ] Run `prisma migrate dev` and confirm shadow DB works
- [ ] Smoke-test the app
- [ ] Update CI: `prisma migrate deploy` step still works (no schema-level config change needed there)
