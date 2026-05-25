# Node.js 24 — Native Test Runner

> Node.js 24.x · TypeScript 6.0.x · Verified 2026-05-16

## Running tests

Node 24 ships a stable, built-in test runner. Zero config, no extra packages. Type stripping is on by default — no flag required to run `.ts` tests.

```sh
# Run all test files (Node 24 auto-strips .ts)
node --test

# Glob pattern
node --test "src/**/*.test.ts"

# Watch mode
node --test --watch "src/**/*.test.ts"

# With coverage (built-in)
node --test --experimental-test-coverage

# Limit file-level concurrency (CI with few cores)
node --test --test-concurrency=2 "src/**/*.test.ts"
```

> Defaults: see [recommended-defaults.md](recommended-defaults.md) `node:test` section.

## Test file structure

```ts
// src/users/user.service.test.ts
import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';

describe('UserService', () => {
  let service: UserService;

  before(() => {
    service = new UserService(/* deps */);
  });

  after(() => {
    mock.restoreAll();
  });

  it('returns user by id', async () => {
    const user = await service.findById(1);
    assert.equal(user.id, 1);
    assert.equal(user.name, 'Alice');
  });

  it('throws NotFoundError for missing user', async () => {
    await assert.rejects(
      () => service.findById(999),
      { name: 'NotFoundError' },
    );
  });
});
```

## Assertions — node:assert/strict

```ts
import assert from 'node:assert/strict';

// Equality
assert.equal(actual, expected);           // ==
assert.strictEqual(actual, expected);     // ===
assert.deepEqual(actual, expected);       // deep recursive
assert.deepStrictEqual(actual, expected); // deep strict

// Truthy / falsy
assert.ok(value);
assert.ok(!value); // or assert.equal(value, false)

// Errors
assert.throws(() => fn(), TypeError);
await assert.rejects(async () => fn(), { message: /not found/ });

// Not
assert.notEqual(a, b);
assert.notDeepStrictEqual(a, b);
```

## Mocking

```ts
import { mock } from 'node:test';

it('calls external API once', async () => {
  // Mock a function
  const fn = mock.fn(async (id: number) => ({ id, name: 'mock' }));

  const result = await fn(42);

  assert.equal(fn.mock.calls.length, 1);
  assert.deepEqual(fn.mock.calls[0].arguments, [42]);
  assert.deepEqual(result, { id: 42, name: 'mock' });
});

it('mocks module method', () => {
  // Mock method on an object
  const db = { query: async (sql: string) => [] };
  mock.method(db, 'query', async () => [{ id: 1 }]);

  // After test:
  mock.restoreAll(); // or db.query.mock.restore()
});

// Timer mocks
it('uses fake timers', () => {
  mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'] });

  let called = false;
  setTimeout(() => { called = true; }, 1000);

  mock.timers.tick(1000);
  assert.ok(called);

  mock.timers.reset();
});
```

## Test hooks

```ts
import { describe, it, before, beforeEach, after, afterEach } from 'node:test';

describe('with database', () => {
  before(async () => {
    await db.connect();
  });

  after(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await db.transaction.begin();
  });

  afterEach(async () => {
    await db.transaction.rollback(); // isolate each test
  });

  it('inserts a record', async () => {
    const id = await db.users.insert({ name: 'Test' });
    assert.ok(id > 0);
  });
});
```

## Subtests and test.todo / test.skip

```ts
import { test } from 'node:test';

test('parent test', async (t) => {
  await t.test('child 1', () => { /* ... */ });
  await t.test('child 2', () => { /* ... */ });
});

test.todo('not yet implemented');
test.skip('skipped for now', () => { /* ... */ });

// Conditional skip
test('only on linux', { skip: process.platform !== 'linux' }, () => { /* ... */ });
```

## Coverage

```sh
node --test --experimental-test-coverage \
  --test-coverage-exclude "**/*.test.ts" \
  "src/**/*.ts"
```

Outputs V8 coverage report to stdout. For HTML report, pipe to `c8`:

```sh
npx c8 node --test "src/**/*.test.ts"
```

## Comparison: native vs Vitest

| Feature | node:test (Node 24) | Vitest |
|---|---|---|
| Zero install | ✅ | ❌ |
| TypeScript | native strip (default) | via transform |
| Watch mode | ✅ `--watch` | ✅ |
| Coverage | ✅ V8 built-in | ✅ V8/Istanbul |
| Snapshot tests | ❌ | ✅ |
| UI mode | ❌ | ✅ |
| Mocking | ✅ `mock.*` | ✅ `vi.*` |
| Speed | Fast (native) | Very fast (Vite) |

Use `node:test` for libraries and backend services. Vitest for frontend-coupled code or when snapshot tests matter.
