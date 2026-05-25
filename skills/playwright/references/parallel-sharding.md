# Parallel Execution and Sharding

Playwright has three levels of parallelism. Understanding them prevents accidental shared state and maximizes CI throughput.

## Parallelism Levels

### Level 1: Across files (default)

By default, each test file runs in its own worker process. Files run concurrently up to the `workers` limit. Tests within a file run sequentially.

```ts
// playwright.config.ts
export default defineConfig({
  workers: 4,            // explicit worker count
  // workers: '50%',     // percentage of CPU cores
  // workers: undefined, // default: half of logical CPUs
});
```

### Level 2: `fullyParallel` — across individual tests

Every individual test runs in its own worker, regardless of file grouping. Best for large suites where tests are fully independent.

```ts
export default defineConfig({
  fullyParallel: true,
  workers: 8,
});
```

In this mode, tests in the same file that share state (e.g., modifying the same database record) will race. Either make tests independent or use `test.describe.serial()` for dependent sequences.

### Level 3: `test.describe.parallel()` — within a file

Makes a describe block run its tests in parallel, while the outer file still uses a single worker:

```ts
test.describe.parallel('product variants', () => {
  test('red variant', async ({ page }) => { ... });
  test('blue variant', async ({ page }) => { ... });
  test('green variant', async ({ page }) => { ... });
  // these three run concurrently
});
```

## Serial Describes

When tests in a group must run in order (e.g., a multi-step flow where each test depends on the previous):

```ts
test.describe.serial('checkout flow', () => {
  test('add to cart', async ({ page }) => { ... });
  test('view cart', async ({ page }) => { ... });
  test('checkout', async ({ page }) => { ... });
  // runs sequentially; if one fails, the rest are skipped
});
```

`test.describe.serial()` forces the group to run on a single worker. If `fullyParallel: true` is set globally, `serial` overrides it for that group.

## Sharding — Splitting Across CI Machines

Sharding splits the test suite across multiple CI agents. Each agent runs a slice. Playwright distributes tests evenly by estimated duration (learned over runs via `last-failed` reporter).

### Running a shard

```bash
# Run shard 1 of 4
npx playwright test --shard=1/4

# Run shard 2 of 4
npx playwright test --shard=2/4
```

### GitHub Actions matrix sharding

```yaml
# .github/workflows/playwright.yml
jobs:
  test:
    name: Playwright Tests (${{ matrix.shardIndex }}/${{ matrix.shardTotal }})
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shardIndex: [1, 2, 3, 4]
        shardTotal: [4]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24' }
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}
        env:
          BASE_URL: ${{ vars.BASE_URL }}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-blob-${{ matrix.shardIndex }}
          path: blob-report/
          retention-days: 1

  merge-reports:
    needs: test
    if: always()
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24' }
      - run: npm ci
      - uses: actions/download-artifact@v4
        with:
          path: all-blob-reports
          pattern: playwright-blob-*
          merge-multiple: true
      - run: npx playwright merge-reports --reporter=html ./all-blob-reports
      - uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 14
```

### Config for blob reporter (required for merge)

```ts
// playwright.config.ts
export default defineConfig({
  reporter: process.env.CI
    ? [['blob'], ['line']]        // blob for merge, line for live output
    : [['html']],
});
```

## Worker Isolation

Each worker is a separate Node.js process with its own browser. Workers do NOT share:
- `page` objects
- `browser` instances
- In-memory state

Workers DO share (with `{ scope: 'worker' }` fixtures):
- Database connections (if you set them as worker-scoped fixtures)
- Auth tokens (via `storageState` — read from file, not shared memory)

### Worker index for parallel-safe test data

When tests need unique data (e.g., unique email per test to avoid DB conflicts):

```ts
test('register user', async ({ page }, testInfo) => {
  const email = `user-${testInfo.parallelIndex}@example.com`;
  // parallelIndex: 0...(workers-1), stable per worker
  await page.getByLabel('Email').fill(email);
});
```

Or use `testInfo.workerIndex` (unique per worker) for more isolation.

## `--only-changed` for Pre-merge Speed

Run only tests in files changed since the last git commit:

```bash
npx playwright test --only-changed=HEAD~1
```

Useful for pre-merge hooks. Not a substitute for full CI runs.

## Retry Configuration

```ts
export default defineConfig({
  retries: process.env.CI ? 2 : 0,   // retry flaky tests in CI
});
```

Per-test override:
```ts
test('flaky test', { retries: 3 }, async ({ page }) => { ... });
```

Retries run in the same worker but with a fresh page. Trace is captured on first retry when `trace: 'on-first-retry'` is set.

## Timeout Configuration

```ts
export default defineConfig({
  timeout: 30_000,                    // per-test timeout (default: 30s)
  expect: { timeout: 5_000 },         // per-assertion timeout (default: 5s)
  globalTimeout: 600_000,             // total suite timeout
});
```

Per-test override:
```ts
test('slow operation', async ({ page }) => {
  test.setTimeout(60_000);
  // ...
});
```

## Project Configuration for Cross-Browser

```ts
export default defineConfig({
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
  ],
});
```

In CI, you may want to run only Chromium for speed, with cross-browser as a nightly:

```ts
projects: process.env.CI
  ? [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
  : [
      { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
      { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
      { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
    ],
```
