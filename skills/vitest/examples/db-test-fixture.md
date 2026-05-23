# DB Isolation Per Test

Two patterns for running integration tests against a real database without test pollution.

## Pattern A: Transaction rollback per test

Each test runs inside a transaction that is rolled back at the end. Fast and reliable for read/write tests. Works with PostgreSQL, MySQL, SQLite.

### Setup (Prisma + PostgreSQL)

```ts
// src/test/db-fixture.ts
import { beforeEach, afterEach } from 'vitest'
import { PrismaClient } from '@prisma/client'

let prisma: PrismaClient

export function useTestDb(): { db: () => PrismaClient } {
  beforeEach(async () => {
    prisma = new PrismaClient()
    // Begin transaction — all writes visible only within this tx
    await prisma.$executeRaw`BEGIN`
  })

  afterEach(async () => {
    // Rollback — undoes all writes from the test
    await prisma.$executeRaw`ROLLBACK`
    await prisma.$disconnect()
  })

  return {
    db: () => prisma,
  }
}
```

```ts
// src/users/user-service.test.ts
import { describe, it, expect } from 'vitest'
import { useTestDb } from '../test/db-fixture'
import { UserService } from './user-service'
import { createUserDto } from '../test/factories/dto.factory'

describe('UserService — DB integration', () => {
  const { db } = useTestDb()

  it('creates and retrieves a user', async () => {
    const service = new UserService(db())
    const dto = createUserDto({ email: 'alice@example.com' })

    const created = await service.create(dto)
    const found = await service.findById(created.id)

    expect(found?.email).toBe('alice@example.com')
    // Transaction rolls back after test — DB is clean for next test
  })

  it('returns null for missing user', async () => {
    const service = new UserService(db())
    const result = await service.findById('nonexistent-id')
    expect(result).toBeNull()
  })
})
```

### Limitation

Transaction rollback doesn't work when the code under test uses `COMMIT` internally (e.g., triggers, stored procedures, or code that explicitly commits). Use Pattern B in that case.

## Pattern B: Schema-per-test isolation

Each test gets its own PostgreSQL schema (namespace). Slower but supports commits, triggers, and DDL.

### Setup

```ts
// src/test/schema-fixture.ts
import { beforeEach, afterEach } from 'vitest'
import { Pool } from 'pg'
import { randomUUID } from 'node:crypto'

const basePool = new Pool({ connectionString: process.env['DATABASE_URL'] })

export function useIsolatedSchema() {
  let schemaName: string
  let pool: Pool

  beforeEach(async () => {
    schemaName = `test_${randomUUID().replace(/-/g, '_')}`
    pool = new Pool({ connectionString: process.env['DATABASE_URL'] })

    // Create isolated schema
    await pool.query(`CREATE SCHEMA "${schemaName}"`)
    await pool.query(`SET search_path TO "${schemaName}"`)

    // Run migrations in this schema
    await runMigrations(pool)
  })

  afterEach(async () => {
    // Drop the entire schema — no cleanup needed per table
    await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
    await pool.end()
  })

  return { getPool: () => pool }
}

async function runMigrations(pool: Pool): Promise<void> {
  // Run your migration files against the schema
  // Example with raw SQL files:
  // const sql = await readFile('./migrations/001_init.sql', 'utf-8')
  // await pool.query(sql)

  // Example with Prisma migrate:
  // await execSync(`DATABASE_URL=... prisma migrate deploy`)
}
```

```ts
// src/users/user-repo.test.ts
import { describe, it, expect } from 'vitest'
import { useIsolatedSchema } from '../test/schema-fixture'
import { UserRepository } from './user-repository'
import { createUser } from '../test/factories/user.factory'

describe('UserRepository — isolated schema', () => {
  const { getPool } = useIsolatedSchema()

  it('inserts and queries correctly', async () => {
    const repo = new UserRepository(getPool())
    const user = createUser({ email: 'test@example.com' })

    await repo.insert(user)
    const rows = await repo.findAll()

    expect(rows).toHaveLength(1)
    expect(rows[0]?.email).toBe('test@example.com')
  })
})
```

## Pattern C: SQLite in-memory (for lightweight tests)

When the real DB is PostgreSQL but you want fast unit-level DB tests without a running server:

```ts
// src/test/sqlite-fixture.ts
import Database from 'better-sqlite3'
import { beforeEach, afterEach } from 'vitest'

export function useSQLiteDb() {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')  // fresh in-memory DB per test
    // Run schema creation
    db.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'member'
      )
    `)
  })

  afterEach(() => {
    db.close()
  })

  return { db: () => db }
}
```

## vitest.config.ts settings for DB tests

Integration tests that hit a real DB need longer timeouts and serial execution:

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.unit.test.ts'],
          testTimeout: 5_000,
        },
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          include: ['src/**/*.integration.test.ts'],
          testTimeout: 30_000,
          hookTimeout: 30_000,
          pool: 'forks',
          poolOptions: {
            forks: {
              singleFork: true,    // run serially — DB tests often share state
              isolate: true,
            },
          },
        },
      },
    ],
  },
})
```

Run only integration tests:
```bash
vitest run --project integration
```

## globalSetup for shared DB connection

If multiple test files need the same DB server (not schema), use `globalSetup`:

```ts
// src/test/global-setup.ts
import { Pool } from 'pg'

let pool: Pool

export async function setup() {
  pool = new Pool({ connectionString: process.env['DATABASE_URL'] })
  // Verify connection
  await pool.query('SELECT 1')
  console.log('DB connection established for test run')
}

export async function teardown() {
  await pool?.end()
  console.log('DB connection closed')
}
```

```ts
// vitest.config.ts
test: {
  globalSetup: ['./src/test/global-setup.ts'],
}
```
