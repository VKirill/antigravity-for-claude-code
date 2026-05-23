# vitest — Mocking Reference

Full API surface for `vi.mock`, `vi.fn`, `vi.spyOn`, and module mocking patterns.

## vi.mock — module mocking

Replaces an entire module before test execution. Vitest automatically hoists `vi.mock()` calls to the top of the file — no manual jest-hoist workarounds needed.

```ts
import { describe, it, expect, vi } from 'vitest'
import { sendEmail } from './email-service'  // will be mocked

vi.mock('./email-service')  // auto-hoisted; replaces entire module with auto-mocks

it('calls sendEmail with correct args', () => {
  sendEmail('user@example.com', 'Hello')
  expect(sendEmail).toHaveBeenCalledWith('user@example.com', 'Hello')
})
```

**Auto-mock behavior**: without a factory, all exports become `vi.fn()` returning `undefined`. Functions are mocked; primitives are kept as-is; classes are mocked with all methods as `vi.fn()`.

### Factory function (recommended)

Use a factory for control over return values and partial mocks:

```ts
vi.mock('./user-service', () => ({
  getUser: vi.fn().mockResolvedValue({ id: '1', name: 'Alice' }),
  deleteUser: vi.fn().mockResolvedValue(true),
}))
```

Factory receives no arguments. For partial mocks (keep some real exports), use `vi.importActual`:

```ts
vi.mock('./utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils')>()
  return {
    ...actual,           // keep everything real
    formatDate: vi.fn(), // override only this
  }
})
```

### Mocking default exports

```ts
vi.mock('./config', () => ({
  default: {
    apiUrl: 'http://localhost:3000',
    timeout: 5000,
  },
}))
```

### Mocking node_modules

Same syntax — use the package name as path:

```ts
vi.mock('axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { users: [] } }),
    post: vi.fn().mockResolvedValue({ data: { id: 'new-id' } }),
  },
}))
```

### Mocking ES modules with side effects

ESM modules with constructor side effects need `vi.doMock` (not hoisted):

```ts
it('should handle startup side effects', async () => {
  vi.doMock('./db', () => ({ connect: vi.fn() }))
  const { connect } = await import('./db')
  // ...
  vi.resetModules()  // cleanup for next test
})
```

## vi.fn — standalone mock functions

```ts
const mockFn = vi.fn()                                    // basic mock
const mockFn = vi.fn((x: number) => x * 2)              // with implementation
const mockFn = vi.fn().mockReturnValue(42)               // always returns 42
const mockFn = vi.fn().mockReturnValueOnce(1)            // returns 1 first call, undefined after
  .mockReturnValueOnce(2)                                 // returns 2 second call
const mockFn = vi.fn().mockResolvedValue({ ok: true })   // async: always resolves
const mockFn = vi.fn().mockRejectedValue(new Error('fail')) // async: always rejects
const mockFn = vi.fn()
  .mockResolvedValueOnce({ status: 200 })
  .mockResolvedValueOnce({ status: 404 })                // different per call
```

### Inspecting calls

```ts
mockFn('hello', 42)
mockFn('world')

mockFn.mock.calls         // [['hello', 42], ['world']]
mockFn.mock.calls[0]      // ['hello', 42]
mockFn.mock.results       // [{ type: 'return', value: ... }, ...]
mockFn.mock.instances     // `this` for each call
mockFn.mock.lastCall      // ['world']

expect(mockFn).toHaveBeenCalled()
expect(mockFn).toHaveBeenCalledTimes(2)
expect(mockFn).toHaveBeenCalledWith('hello', 42)
expect(mockFn).toHaveBeenLastCalledWith('world')
expect(mockFn).toHaveBeenNthCalledWith(1, 'hello', 42)
```

### Resetting and restoring

```ts
mockFn.mockReset()   // clears calls, results, instances; removes implementation
mockFn.mockClear()   // clears calls/results but keeps implementation
mockFn.mockRestore() // only works on vi.spyOn — restores original
```

Global reset (recommended in afterEach):
```ts
afterEach(() => {
  vi.clearAllMocks()    // clears call history on all mocks
  // or
  vi.resetAllMocks()    // clears + removes implementations
  // or
  vi.restoreAllMocks()  // clears + restores spies to originals
})
```

## vi.spyOn — wrapping existing methods

Spies wrap an existing object method, letting you observe calls without fully replacing behavior.

```ts
import { vi, it, expect } from 'vitest'
import * as fs from 'node:fs'

it('reads config file', () => {
  const readFileSpy = vi.spyOn(fs, 'readFileSync')
    .mockReturnValue('{"key": "value"}')

  const result = readConfig()

  expect(readFileSpy).toHaveBeenCalledWith('/etc/app/config.json', 'utf-8')
  expect(result).toEqual({ key: 'value' })
})

afterEach(() => {
  vi.restoreAllMocks()  // restores readFileSync to original
})
```

Spy without overriding (observe real behavior):
```ts
const consoleSpy = vi.spyOn(console, 'error')
// calls real console.error AND records calls
doSomething()
expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('ERROR'))
```

Spy on class instance method:
```ts
const service = new UserService()
const spy = vi.spyOn(service, 'findById').mockResolvedValue({ id: '1' })
```

## vi.importActual — escape hatch for partial mocks

Inside a `vi.mock` factory, import the real module:

```ts
vi.mock('./math', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./math')>()
  return {
    ...mod,
    add: vi.fn((a, b) => a + b + 1),  // buggy version for testing error handling
  }
})
```

Outside a factory (inside a test):
```ts
const { add } = await vi.importActual<typeof import('./math')>('./math')
```

## Hoisting rules

`vi.mock()` is always hoisted to the top of the file, before any imports. This means:

- Variables defined before `vi.mock()` in source are NOT available inside the factory — they haven't been initialized yet
- To use a variable inside a factory, define it with `vi.hoisted()`:

```ts
const mockUser = vi.hoisted(() => ({ id: '1', name: 'Test' }))

vi.mock('./user-repo', () => ({
  findUser: vi.fn().mockResolvedValue(mockUser),
}))
```

- Alternatively, set up the mock return value inside the test itself:

```ts
vi.mock('./user-repo')  // auto-mock at top level

import { findUser } from './user-repo'

it('returns user', async () => {
  vi.mocked(findUser).mockResolvedValue({ id: '1', name: 'Test' })
  const result = await getProfile('1')
  expect(result.name).toBe('Test')
})
```

## vi.mocked — typed wrapper

`vi.mocked(fn)` casts a mocked function to `MockedFunction<typeof fn>` for TypeScript inference:

```ts
import { findUser } from './user-repo'
vi.mock('./user-repo')

vi.mocked(findUser).mockResolvedValue({ id: '1' })
// Now TypeScript knows the return type
```

## v4: spy isolation change

In Vitest 4, spy state does NOT persist across test files. Each test file gets a fresh module registry. Tests that relied on a spy being called in file A and inspected in file B will break — this was a v3 bug.

Fix: check spy state only in the same test file where it was set up.
