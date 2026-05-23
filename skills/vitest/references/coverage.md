# vitest — Coverage Reference

Configuring v8 and Istanbul coverage providers, thresholds, and CI setup.

## Two providers

```bash
npm install -D @vitest/coverage-v8        # fast, uses V8's built-in coverage
npm install -D @vitest/coverage-istanbul  # accurate, uses Babel instrumentation
```

| Provider | Speed | Branch accuracy | Environments |
|---|---|---|---|
| `v8` | Fast (no instrumentation) | Less accurate (native V8 branch data) | Node, Browser |
| `istanbul` | Slower (transforms source) | Accurate (statement, branch, function, line) | All |

Default recommendation: start with `v8`. Switch to `istanbul` if branch coverage accuracy is blocking test quality gates.

## Basic configuration

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',                       // or 'istanbul'
      reporter: ['text', 'html', 'lcov'],   // output formats
      include: ['src/**/*.{ts,tsx}'],       // files to instrument
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/test/**',
        'src/**/*.d.ts',
        'src/main.ts',                      // app entry point
      ],
      reportsDirectory: './coverage',       // default
    },
  },
})
```

## Running coverage

```bash
# Single pass (CI)
vitest run --coverage

# Watch mode (development) — avoid in CI
vitest --coverage

# Specific provider
vitest run --coverage --coverage.provider=istanbul
```

## Reporters

| Reporter | Output | Use |
|---|---|---|
| `text` | Terminal table | Default dev output |
| `text-summary` | Summary line only | CI log noise reduction |
| `html` | `coverage/index.html` | Local exploration |
| `lcov` | `coverage/lcov.info` | GitHub/GitLab coverage annotations |
| `json` | `coverage/coverage-final.json` | Custom tooling |
| `json-summary` | `coverage/coverage-summary.json` | Threshold CI check |
| `cobertura` | XML format | Some CI platforms |

```ts
coverage: {
  reporter: ['text', 'lcov', 'html'],  // multiple reporters in one run
}
```

## Thresholds

Thresholds enforce minimum coverage percentages. CI fails if below:

```ts
coverage: {
  provider: 'v8',
  thresholds: {
    statements: 80,
    branches: 70,
    functions: 80,
    lines: 80,
  },
}
```

### Per-file thresholds (v4 — overhauled)

Vitest 4 fixed per-file threshold reporting. Now correctly fails when any individual file is below threshold:

```ts
coverage: {
  thresholds: {
    perFile: true,       // enforce minimums per file, not just globally
    statements: 80,
    branches: 60,
    functions: 80,
    lines: 80,
  },
}
```

### Threshold with allowable failures

```ts
coverage: {
  thresholds: {
    statements: 80,
    branches: 70,
    functions: 80,
    lines: 80,
    // 100% thresholds for critical modules:
    'src/auth/**': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
  },
}
```

## Exclude patterns

```ts
coverage: {
  exclude: [
    // Defaults (always excluded):
    'coverage/**',
    'dist/**',
    '**/node_modules/**',
    '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
    '**/.{eslint,mocha,prettier}rc.{js,cjs,yml}',
    // Add project-specific:
    'src/test/**',
    'src/**/__mocks__/**',
    'src/**/index.ts',    // barrel files (re-exports only)
    'src/generated/**',   // generated code
  ],
}
```

## Istanbul source map handling

With `istanbul` provider, source maps are processed automatically. If you see coverage attributed to wrong lines:

```ts
coverage: {
  provider: 'istanbul',
  sourcemap: true,      // default: true
}
```

## CI integration

Recommended CI setup:

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: process.env.CI
        ? ['text-summary', 'lcov', 'json-summary']  // CI: minimal output + upload
        : ['text', 'html'],                          // Local: full HTML report
      thresholds: {
        statements: 75,
        branches: 65,
        functions: 75,
        lines: 75,
      },
    },
  },
})
```

GitHub Actions example:
```yaml
- name: Run tests with coverage
  run: vitest run --coverage

- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    files: ./coverage/lcov.info
    fail_ci_if_error: true
```

## Checking uncovered files

By default, Vitest only reports coverage for files that were imported by at least one test. To report all files in `src/`:

```ts
coverage: {
  all: true,                     // include files never imported by tests
  include: ['src/**/*.{ts,tsx}'],
}
```

This is important: without `all: true`, a module with 0 tests shows 0% rather than being absent from the report.
