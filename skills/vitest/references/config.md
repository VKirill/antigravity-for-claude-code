# vitest — vitest.config.ts Reference

Full configuration surface for Vitest 4. Cross-reference with [templates/vitest.config.ts](../templates/vitest.config.ts) for a ready-to-use preset.

## Config file resolution

Vitest reads config in this order:
1. `vitest.config.ts` / `vitest.config.js` — dedicated config (recommended)
2. `vite.config.ts` with `test:` key — when Vite and Vitest share a config

Dedicated `vitest.config.ts` wins over `vite.config.ts` when both exist. Use dedicated config for projects where test config diverges significantly from build config.

```ts
// vitest.config.ts — minimal pattern
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // all options go here
  },
})
```

To extend an existing `vite.config.ts`:
```ts
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
  },
}))
```

## test.environment

| Value | Use case | Package |
|---|---|---|
| `'node'` (default) | Backend, CLI, pure TS logic | built-in |
| `'jsdom'` | React/Vue components, DOM APIs | `jsdom` |
| `'happy-dom'` | Faster DOM alternative, good compat | `happy-dom` |
| `'edge-runtime'` | Cloudflare Workers / Next.js edge | `@edge-runtime/vm` |

Override per-file with a docblock comment:
```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
```

## test.globals

```ts
test: {
  globals: true,  // inject describe, it, expect, vi into global scope
}
```

When `globals: true`, no imports needed in test files. Add to `tsconfig.json` for type support:
```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

## test.setupFiles vs test.globalSetup

| Option | Runs | When to use |
|---|---|---|
| `setupFiles` | Before each test **file** | Per-file env setup, reset mocks, set env vars |
| `globalSetup` | Once per **worker** before any test | DB connection, server spin-up, one-time fixtures |

```ts
test: {
  setupFiles: ['./src/test/setup.ts'],
  globalSetup: ['./src/test/global-setup.ts'],
}
```

`globalSetup` exports `setup()` / `teardown()` functions (not `beforeAll`/`afterAll`):
```ts
// global-setup.ts
export async function setup() {
  // runs once — start DB, create schema
}
export async function teardown() {
  // runs once — close connections
}
```

## Pool configuration (v4 — flattened)

Pool controls how test files are parallelized.

```ts
test: {
  pool: 'forks',    // 'forks' | 'threads' | 'vmForks' | 'vmThreads'
  poolOptions: {
    forks: {
      singleFork: false,       // run all files in one fork (disables parallelism)
      isolate: true,           // fresh module registry per file (default: true)
    },
    threads: {
      singleThread: false,
      isolate: true,
      useAtomics: false,       // experimental perf; requires SharedArrayBuffer
    },
    vmForks: {
      memoryLimit: '512MB',    // per-fork memory cap
    },
  },
}
```

Pool comparison:

| Pool | Isolation | Speed | Use when |
|---|---|---|---|
| `forks` (default) | Process-level | Medium | General — safe default |
| `threads` | Thread-level | Fast | No native addons, no `process.exit` |
| `vmForks` | VM context per file | Slow | Maximum isolation (security tests) |
| `vmThreads` | VM + threads | Medium-fast | Snapshot-accurate isolation + perf |

**v3 → v4 migration**: remove top-level `forks: {}` and `threads: {}` from test config; move to `poolOptions.forks.*` and `poolOptions.threads.*`.

## test.include / exclude

```ts
test: {
  include: ['**/*.{test,spec}.{ts,tsx,js,jsx}'],  // default
  exclude: [
    '**/node_modules/**',
    '**/dist/**',
    '**/e2e/**',    // exclude Playwright E2E
  ],
}
```

## test.testTimeout / hookTimeout

```ts
test: {
  testTimeout: 5000,    // ms per test (default: 5000)
  hookTimeout: 10000,   // ms for beforeEach/afterEach/etc (default: 10000)
}
```

## test.retry / test.repeats

```ts
test: {
  retry: 2,      // retry flaky tests up to N times before marking failed
  repeats: 0,    // run each test N additional times (for stability testing)
}
```

## Reporters

```ts
test: {
  reporters: ['verbose'],   // 'default' | 'verbose' | 'dot' | 'json' | 'junit' | 'html'
  // Multiple reporters:
  reporters: [
    'verbose',
    ['json', { outputFile: './test-results.json' }],
  ],
}
```

CI recommendation: `['dot', ['junit', { outputFile: './junit.xml' }]]`

## watch mode config

Watch is the default when running `vitest` without `run`. Tune:
```ts
test: {
  forceRerunTriggers: [
    '**/vitest.config.*',
    '**/vite.config.*',
    '**/package.json',
  ],
}
```

## typecheck (optional)

Run TypeScript type checking alongside tests:
```ts
test: {
  typecheck: {
    enabled: true,
    tsconfig: './tsconfig.test.json',
    include: ['**/*.{test,spec}-d.{ts,tsx}'],
  },
}
```

Note: typecheck is separate from test execution — it doesn't affect test pass/fail, only type errors.

## Full example

See [templates/vitest.config.ts](../templates/vitest.config.ts) for a production preset with comments.
