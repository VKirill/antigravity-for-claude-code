# CI Integration

## GitHub Actions — Complete Setup

### Single-machine (no sharding)

```yaml
# .github/workflows/playwright.yml
name: Playwright Tests
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps
        # --with-deps installs system libraries (libgtk, libgbm, etc.)
        # DO NOT use bare `playwright install` in CI — missing system deps

      - name: Run Playwright tests
        run: npx playwright test
        env:
          BASE_URL: ${{ vars.BASE_URL }}
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
          CI: true

      - uses: actions/upload-artifact@v4
        if: always()     # upload even on failure
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

### Sharded (4 machines)

```yaml
name: Playwright Tests (Sharded)
on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    name: Test (shard ${{ matrix.shardIndex }}/${{ matrix.shardTotal }})
    runs-on: ubuntu-latest
    timeout-minutes: 60
    strategy:
      fail-fast: false      # don't cancel other shards on one failure
      matrix:
        shardIndex: [1, 2, 3, 4]
        shardTotal: [4]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24', cache: 'npm' }
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}
        env:
          CI: true
          BASE_URL: ${{ vars.BASE_URL }}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: blob-report-${{ matrix.shardIndex }}
          path: blob-report/
          retention-days: 1

  merge-reports:
    needs: test
    runs-on: ubuntu-latest
    if: always()
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24', cache: 'npm' }
      - run: npm ci
      - uses: actions/download-artifact@v4
        with:
          path: all-blob-reports
          pattern: blob-report-*
          merge-multiple: true
      - run: npx playwright merge-reports --reporter html ./all-blob-reports
      - uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

Config for sharding (blob reporter required):
```ts
// playwright.config.ts
reporter: process.env.CI
  ? [['blob'], ['line']]
  : [['html'], ['list']],
```

## Caching Playwright Browsers

Browser binaries are large (~300MB each). Cache them between CI runs:

```yaml
- name: Get Playwright version
  run: echo "PLAYWRIGHT_VERSION=$(node -e "console.log(require('./package-lock.json').packages['node_modules/@playwright/test'].version)")" >> $GITHUB_ENV

- name: Cache Playwright browsers
  uses: actions/cache@v4
  id: playwright-cache
  with:
    path: ~/.cache/ms-playwright
    key: playwright-${{ env.PLAYWRIGHT_VERSION }}-${{ runner.os }}

- name: Install Playwright browsers
  if: steps.playwright-cache.outputs.cache-hit != 'true'
  run: npx playwright install --with-deps

- name: Install system dependencies only (if cache hit)
  if: steps.playwright-cache.outputs.cache-hit == 'true'
  run: npx playwright install-deps
```

## Key CI Config Options

```ts
// playwright.config.ts — CI-optimized settings
export default defineConfig({
  forbidOnly: !!process.env.CI,      // fail if test.only committed
  retries: process.env.CI ? 2 : 0,   // retry flaky tests
  workers: process.env.CI ? 1 : undefined,  // single worker for stability
  // Note: sharding provides parallelism; per-machine workers=1 avoids OOM

  use: {
    trace: 'on-first-retry',          // capture trace only on retry
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    baseURL: process.env.BASE_URL,
  },
});
```

## Docker for Consistent Visual Baselines

Visual regression tests produce different screenshots on different OSes. Use the official Playwright Docker image for consistent baselines:

```dockerfile
# Dockerfile.playwright (for local baseline generation)
FROM mcr.microsoft.com/playwright:v1.60.0-jammy
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npx", "playwright", "test"]
```

```bash
# Generate/update baselines in Docker (matches CI)
docker build -f Dockerfile.playwright -t pw-tests .
docker run --rm -v $(pwd)/test-snapshots:/app/test-snapshots pw-tests \
  npx playwright test --update-snapshots
```

GitHub Actions uses `ubuntu-latest` which matches the `jammy` (Ubuntu 22.04) Playwright image — baselines generated in Docker will match CI.

## Trace Viewer in CI

Traces are captured with `trace: 'on-first-retry'`. On failure, download the artifact and open locally:

```bash
npx playwright show-trace trace.zip
```

Or view in the online viewer: https://trace.playwright.dev (drag and drop the zip file).

## Pre-merge Checks

For fast PR feedback, run a subset before full CI:

```bash
# Only changed files (fast, for pre-commit hook)
npx playwright test --only-changed=HEAD

# Only critical smoke tests
npx playwright test --grep @smoke

# Single browser (Chromium only) for speed
npx playwright test --project=chromium
```

```ts
// Tag smoke tests
test('login works @smoke', async ({ page }) => { ... });
test('checkout works @smoke', async ({ page }) => { ... });
```

## Environment Variables Pattern

```ts
// playwright.config.ts — env validation at config load time
import { defineConfig } from '@playwright/test';

const baseURL = process.env.BASE_URL;
if (!baseURL && process.env.CI) {
  throw new Error('BASE_URL must be set in CI');
}

export default defineConfig({
  use: {
    baseURL: baseURL ?? 'http://localhost:3000',
  },
});
```

## `playwright.config.ts` for Web Server Auto-start

Start dev server before tests, stop after:

```ts
export default defineConfig({
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,  // reuse in dev, fresh in CI
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
```

Multiple servers (app + API):
```ts
webServer: [
  {
    command: 'npm run start:api',
    url: 'http://localhost:4000/health',
    reuseExistingServer: !process.env.CI,
  },
  {
    command: 'npm run start:app',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
],
```
