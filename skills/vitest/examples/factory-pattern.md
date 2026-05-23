# Factory Pattern for Test Data

Typed data factories with overrides. No magic strings, no scattered `{ id: '1', name: 'test' }` literals.

## Problem

Tests scattered with ad-hoc objects:
```ts
// Fragile — if User schema changes, update 40 test files
const user = { id: '1', name: 'Alice', role: 'admin', email: 'alice@example.com', createdAt: new Date() }
```

## Solution: typed factory with defaults and overrides

```ts
// src/test/factories/user.factory.ts
import type { User } from '../../domain/user'

let _seq = 0
function seq() { return ++_seq }

export function createUser(overrides: Partial<User> = {}): User {
  const id = String(seq())
  return {
    id,
    name: `User ${id}`,
    email: `user-${id}@example.com`,
    role: 'member',
    active: true,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }
}

export function createAdminUser(overrides: Partial<User> = {}): User {
  return createUser({ role: 'admin', ...overrides })
}

export function createUserList(
  count: number,
  overrides: Partial<User> = {}
): User[] {
  return Array.from({ length: count }, () => createUser(overrides))
}
```

## Usage in tests

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createUser, createAdminUser, createUserList } from '../factories/user.factory'
import { UserService } from './user-service'

describe('UserService', () => {
  it('returns user by id', async () => {
    const user = createUser({ id: 'known-id' })
    // ... set up mock or DB with user
    const result = await UserService.findById('known-id')
    expect(result).toMatchObject({ id: 'known-id' })
  })

  it('filters active users', () => {
    const users = [
      createUser({ active: true }),
      createUser({ active: false }),
      createUser({ active: true }),
    ]
    const active = users.filter(u => u.active)
    expect(active).toHaveLength(2)
  })

  it('admin can delete any user', async () => {
    const admin = createAdminUser()
    const target = createUser()
    const result = canDelete(admin, target)
    expect(result).toBe(true)
  })

  it('generates list without conflicts', () => {
    const users = createUserList(5)
    const ids = users.map(u => u.id)
    expect(new Set(ids).size).toBe(5)  // all unique IDs
  })
})
```

## Nested factories

For domain objects with relationships:

```ts
// src/test/factories/order.factory.ts
import type { Order, OrderItem } from '../../domain/order'
import { createUser } from './user.factory'

let _seq = 0
function seq() { return ++_seq }

export function createOrderItem(overrides: Partial<OrderItem> = {}): OrderItem {
  const id = String(seq())
  return {
    id,
    productId: `product-${id}`,
    productName: `Product ${id}`,
    quantity: 1,
    unitPrice: 9.99,
    ...overrides,
  }
}

export function createOrder(overrides: Partial<Order> = {}): Order {
  const id = String(seq())
  return {
    id,
    userId: createUser().id,          // creates a minimal user
    items: [createOrderItem()],       // default: one item
    total: 9.99,
    status: 'pending',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }
}

// Override nested relationships:
// createOrder({ items: [createOrderItem({ quantity: 3 }), createOrderItem()] })
```

## Factory for request/response DTOs

When testing HTTP handlers, factories for input DTOs prevent copy-paste:

```ts
// src/test/factories/dto.factory.ts
import type { CreateUserDto } from '../../api/user/dto'

export function createUserDto(overrides: Partial<CreateUserDto> = {}): CreateUserDto {
  return {
    name: 'Test User',
    email: `test-${Date.now()}@example.com`,
    password: 'SecurePass123!',
    role: 'member',
    ...overrides,
  }
}
```

## Sequence reset between tests

The `seq()` counter above is module-level. To reset between test files, add to `test-setup.ts`:

```ts
// src/test/setup.ts
import { beforeEach } from 'vitest'

beforeEach(() => {
  // If factories use a module-level counter, reset via a helper:
  // resetFactorySequences()
  // OR: use random IDs (crypto.randomUUID()) instead of sequential
})
```

Alternative: use `crypto.randomUUID()` for IDs to avoid sequence state entirely:

```ts
export function createUser(overrides: Partial<User> = {}): User {
  return {
    id: crypto.randomUUID(),
    // ...
    ...overrides,
  }
}
```

Trade-off: random IDs make test output less deterministic; sequential IDs are easier to read in failure output.

## Zod-powered factories (optional)

If you use Zod schemas for domain types, derive factories from them:

```ts
import { z } from 'zod'

export const UserSchema = z.object({
  id: z.string(),
  email: z.email(),
  role: z.enum(['admin', 'member']),
  active: z.boolean(),
})

export type User = z.infer<typeof UserSchema>

// Factory uses the type, schema validates in tests
export function createUser(overrides: Partial<User> = {}): User {
  return UserSchema.parse({
    id: crypto.randomUUID(),
    email: `user@example.com`,
    role: 'member',
    active: true,
    ...overrides,
  })
}
```

`UserSchema.parse` validates factory output — any schema change that breaks the factory is caught at test startup, not mid-suite.
