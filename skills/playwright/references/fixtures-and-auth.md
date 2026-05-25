# Playwright Fixtures and Authentication

Fixtures are the dependency injection system in `@playwright/test`. They replace `beforeEach`/`afterEach` boilerplate with typed, composable, automatically-torn-down resources.

## Built-in Fixtures

| Fixture | Scope | Description |
|---|---|---|
| `page` | test | Fresh page per test |
| `browser` | worker | Shared browser process per worker |
| `browserContext` | test | Fresh context (cookies, storage) per test |
| `context` | test | Same as `browserContext` |
| `request` | test | APIRequestContext for HTTP calls without browser |
| `playwright` | worker | Playwright instance |

## Custom Fixtures with `test.extend`

```ts
// fixtures.ts
import { test as base, expect } from '@playwright/test';

type MyFixtures = {
  adminPage: Page;
  todoApp: TodoPage;
};

export const test = base.extend<MyFixtures>({
  // Page fixture that navigates to admin
  adminPage: async ({ page }, use) => {
    await page.goto('/admin');
    await use(page);
    // teardown: runs after the test, even if it fails
    await page.close();
  },

  // Page Object fixture
  todoApp: async ({ page }, use) => {
    const app = new TodoPage(page);
    await app.goto();
    await use(app);
  },
});

export { expect };
```

```ts
// my.spec.ts
import { test, expect } from './fixtures';

test('admin can delete users', async ({ adminPage }) => {
  // adminPage is already navigated to /admin
  await adminPage.getByRole('button', { name: 'Delete user' }).click();
  await expect(adminPage.getByText('User deleted')).toBeVisible();
});
```

## Fixture Scopes

```ts
export const test = base.extend<{}, WorkerFixtures>({
  // Default scope: 'test' — fresh per test
  userToken: async ({}, use) => {
    const token = await generateToken();
    await use(token);
    await revokeToken(token);
  },

  // Worker scope — shared across all tests in a worker
  dbConnection: [async ({}, use) => {
    const db = await Database.connect();
    await use(db);
    await db.close();
  }, { scope: 'worker' }],
});
```

## Authentication with `storageState` — The Standard Pattern

### Why storageState

Log in once per worker (or once for the whole suite), save cookies/localStorage to a JSON file, load that file in subsequent tests. No per-test login = fast + no auth flakiness.

### Step 1: Create `auth.setup.ts`

```ts
// tests/auth.setup.ts
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.TEST_USER_EMAIL!);
  await page.getByLabel('Password').fill(process.env.TEST_USER_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Wait for login to complete
  await page.waitForURL('/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  // Save storage state (cookies + localStorage)
  await page.context().storageState({ path: authFile });
});
```

### Step 2: Configure `playwright.config.ts`

```ts
import { defineConfig } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, 'playwright/.auth/user.json');

export default defineConfig({
  projects: [
    // Run auth setup before any authenticated tests
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        storageState: authFile,
        ...devices['Desktop Chrome'],
      },
      dependencies: ['setup'],    // setup project runs first
    },
  ],
});
```

### Step 3: Add to `.gitignore`

```
playwright/.auth/
```

Session files contain tokens — never commit them.

### Step 4: Tests use auth automatically

```ts
// No login code needed — page already has auth cookies
test('dashboard is accessible', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});
```

## Multi-Role Authentication

When your app has multiple user roles (admin, editor, viewer), create one auth file per role:

```ts
// tests/auth.admin.setup.ts
const adminAuthFile = 'playwright/.auth/admin.json';

setup('authenticate as admin', async ({ page }) => {
  await loginAs(page, process.env.ADMIN_EMAIL!, process.env.ADMIN_PASSWORD!);
  await page.context().storageState({ path: adminAuthFile });
});
```

```ts
// playwright.config.ts
projects: [
  { name: 'setup:admin', testMatch: /auth\.admin\.setup\.ts/ },
  { name: 'setup:user',  testMatch: /auth\.user\.setup\.ts/ },
  {
    name: 'admin-tests',
    use: { storageState: 'playwright/.auth/admin.json' },
    dependencies: ['setup:admin'],
    testMatch: /admin\/.+\.spec\.ts/,
  },
  {
    name: 'user-tests',
    use: { storageState: 'playwright/.auth/user.json' },
    dependencies: ['setup:user'],
    testMatch: /user\/.+\.spec\.ts/,
  },
]
```

## Authenticated `request` Fixture

For API testing without a browser UI:

```ts
export const test = base.extend<{ apiContext: APIRequestContext }>({
  apiContext: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({
      baseURL: process.env.API_URL,
      extraHTTPHeaders: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
      },
    });
    await use(context);
    await context.dispose();
  },
});

test('GET /users returns list', async ({ apiContext }) => {
  const response = await apiContext.get('/users');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body).toHaveProperty('users');
});
```

## Page Object as Fixture

Combining Page Object Model with fixtures — keeps test bodies clean:

```ts
// pages/LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.page.getByLabel('Email').fill(email);
    await this.page.getByLabel('Password').fill(password);
    await this.page.getByRole('button', { name: 'Sign in' }).click();
    await this.page.waitForURL('/dashboard');
  }
}

// fixtures.ts
export const test = base.extend<{ loginPage: LoginPage }>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
});
```

## `test.use()` for Per-File Config

Override fixtures for a specific describe block or file without a full fixture extension:

```ts
test.describe('Mobile viewport', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('login page on mobile', async ({ page }) => {
    await page.goto('/login');
    // page has 375x812 viewport
  });
});

// Or per-file (outside describe)
test.use({ storageState: 'playwright/.auth/admin.json' });
```

## Environment Variables for Auth

Never hardcode credentials in tests:

```ts
// In test setup / env validation at top of auth.setup.ts
const email = process.env.TEST_USER_EMAIL;
const password = process.env.TEST_USER_PASSWORD;
if (!email || !password) {
  throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD must be set');
}
```

Load from `.env.test` using dotenv or Playwright's built-in env support:
```ts
// playwright.config.ts
import { config } from 'dotenv';
config({ path: '.env.test' });
```
