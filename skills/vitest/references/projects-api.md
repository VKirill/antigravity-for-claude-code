# vitest — Projects API Reference

Multi-environment and monorepo configuration via `test.projects` (renamed from `test.workspace` in Vitest 4).

## What is the projects API?

Projects allows running multiple isolated Vitest configurations in a single `vitest` invocation. Use cases:
- Monorepo: each package has its own config, dependencies, environment
- Multi-environment: run node tests and browser tests in one command
- Separate concerns: unit tests (node) + component tests (jsdom) + integration tests (different timeout)

## Rename: workspace → projects (Vitest 3.2; v4 fully removes old key)

The rename **landed in Vitest 3.2**. In Vitest 4 the old `test.workspace` key was fully removed and is silently ignored — no warning, no error. If your monorepo config appears to be ignored after upgrading 3.x → 4, this is the first thing to check.

```ts
// v3 (broken in v4):
export default defineConfig({
  test: { workspace: ['packages/*/vitest.config.ts'] }
})

// v4 (correct):
export default defineConfig({
  test: { projects: ['packages/*/vitest.config.ts'] }
})
```

## Three ways to define projects

### 1. Glob pattern (monorepo)

```ts
// vitest.config.ts at repo root
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      'packages/*/vitest.config.ts',   // each package has its own config
      'apps/*/vitest.config.ts',
    ],
  },
})
```

Each matched `vitest.config.ts` is treated as an independent project. Tests are run concurrently across projects (but respect `--pool` within each project).

### 2. Inline config objects

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        // Unit tests in Node
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.unit.test.ts'],
        },
      },
      {
        // Component tests in jsdom
        plugins: [react()],
        test: {
          name: 'components',
          environment: 'jsdom',
          include: ['src/**/*.component.test.tsx'],
          setupFiles: ['./src/test/dom-setup.ts'],
        },
      },
      {
        // Integration tests with longer timeout
        test: {
          name: 'integration',
          environment: 'node',
          include: ['src/**/*.integration.test.ts'],
          testTimeout: 30_000,
          hookTimeout: 30_000,
          poolOptions: {
            forks: { singleFork: true },  // serial for DB tests
          },
        },
      },
    ],
  },
})
```

### 3. Mixed (globs + inline)

```ts
export default defineConfig({
  test: {
    projects: [
      'packages/*/vitest.config.ts',  // monorepo packages
      {
        // Additional integration project at root
        test: {
          name: 'e2e-integration',
          include: ['e2e-integration/**/*.test.ts'],
        },
      },
    ],
  },
})
```

## Project naming

Each project can have a `test.name`. Vitest shows the project name in output. Filter to a specific project:

```bash
vitest run --project unit
vitest run --project components integration
```

## Shared config inheritance

Projects do NOT inherit the root config automatically. To share config:

```ts
// vitest.shared.ts
import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

```ts
// packages/my-pkg/vitest.config.ts
import { mergeConfig } from 'vitest/config'
import shared from '../../vitest.shared'

export default mergeConfig(shared, {
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.tsx'],
  },
})
```

## Running specific projects

```bash
# Run all projects
vitest run

# Run single project by name
vitest run --project unit

# Run multiple projects
vitest run --project unit --project components

# Watch mode with project filter
vitest --project unit
```

## Coverage across projects

Coverage is merged from all projects by default. To collect coverage for a specific project only:

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          coverage: {
            enabled: true,
            include: ['src/**'],
          },
        },
      },
    ],
    // Root-level coverage aggregates across all projects
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
})
```

## Gotchas

- `test.workspace` key in v4 is silently ignored — always use `test.projects`
- Each project's `globalSetup` runs in isolation; `setupFiles` runs per file within the project
- Test filtering (`--testNamePattern`, `--reporter`) applies to all projects unless `--project` is specified
- Vitest UI shows projects as collapsible tree nodes — useful for large monorepos
- Browser mode projects require `@vitest/browser` plugin declared per project, not at root
