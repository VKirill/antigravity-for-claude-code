# Login Fixture with storageState

Complete walkthrough: auth setup project, fixture extension, and multi-role support.

## Scenario

An app with two roles — `user` (regular) and `admin` (elevated permissions). E2E tests need both roles. Login runs once per role per worker, not once per test.

## File Structure

```
tests/
├── auth/
│   ├── auth.user.setup.ts      # login as regular user
│   └── auth.admin.setup.ts     # login as admin
├── fixtures.ts                 # extended test with typed fixtures
├── admin/
│   └── users.spec.ts           # admin-only tests
└── user/
    └── profile.spec.ts         # regular user tests
playwright/
└── .auth/
    ├── user.json               # session token (gitignored)
    └── admin.json              # session token (gitignored)
```

## Step 1: Auth Setup Files

```ts
// tests/auth/auth.user.setup.ts
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const userAuthFile = path.join(__dirname, '../../playwright/.auth/user.json');

setup('authenticate as user', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  if (!email || !password) throw new Error('TEST_USER_EMAIL / TEST_USER_PASSWORD not set');

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('/dashboard');
  await page.context().storageState({ path: userAuthFile });
});
```

```ts
// tests/auth/auth.admin.setup.ts
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const adminAuthFile = path.join(__dirname, '../../playwright/.auth/admin.json');

setup('authenticate as admin', async ({ page }) => {
  const email = process.env.TEST_ADMIN_EMAIL;
  const password = process.env.TEST_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD not set');

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('/admin/dashboard');
  await page.context().storageState({ path: adminAuthFile });
});
```

## Step 2: playwright.config.ts Projects

```ts
import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const userAuthFile = path.join(__dirname, 'playwright/.auth/user.json');
const adminAuthFile = path.join(__dirname, 'playwright/.auth/admin.json');

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,

  projects: [
    // Setup projects (run first)
    { name: 'setup:user',  testMatch: /auth\.user\.setup\.ts/ },
    { name: 'setup:admin', testMatch: /auth\.admin\.setup\.ts/ },

    // User tests — authenticated as regular user
    {
      name: 'user-chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: userAuthFile,
      },
      testMatch: /user\/.+\.spec\.ts/,
      dependencies: ['setup:user'],
    },

    // Admin tests — authenticated as admin
    {
      name: 'admin-chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: adminAuthFile,
      },
      testMatch: /admin\/.+\.spec\.ts/,
      dependencies: ['setup:admin'],
    },
  ],
});
```

## Step 3: Typed Fixture Extension

For tests that need both roles (e.g., admin creates a resource, user views it):

```ts
// tests/fixtures.ts
import { test as base, Page } from '@playwright/test';
import path from 'path';

type MyFixtures = {
  adminPage: Page;
};

export const test = base.extend<MyFixtures>({
  // A second page logged in as admin, available in any test
  adminPage: async ({ browser }, use) => {
    const adminContext = await browser.newContext({
      storageState: path.join(__dirname, '../playwright/.auth/admin.json'),
    });
    const adminPage = await adminContext.newPage();
    await use(adminPage);
    await adminContext.close();
  },
});

export { expect } from '@playwright/test';
```

```ts
// tests/user/shared-resource.spec.ts
import { test, expect } from '../fixtures';

test('user can view resource created by admin', async ({ page, adminPage }) => {
  // Admin creates the resource
  await adminPage.goto('/admin/resources/new');
  await adminPage.getByLabel('Name').fill('Test Resource');
  await adminPage.getByRole('button', { name: 'Create' }).click();
  await expect(adminPage.getByText('Resource created')).toBeVisible();

  // User views it
  await page.goto('/resources');
  await expect(page.getByText('Test Resource')).toBeVisible();
});
```

## Step 4: .gitignore

```
# Playwright auth state (contains session tokens)
playwright/.auth/
```

## Step 5: .env.test (local development)

```
TEST_USER_EMAIL=user@example.com
TEST_USER_PASSWORD=testpassword123
TEST_ADMIN_EMAIL=admin@example.com
TEST_ADMIN_PASSWORD=adminpassword123
BASE_URL=http://localhost:3000
```

Load in config:
```ts
// playwright.config.ts
import { config } from 'dotenv';
config({ path: '.env.test' });
```

## Verification

Run setup projects in isolation to verify auth works:

```bash
# Run only setup
npx playwright test --project=setup:user --project=setup:admin

# Then verify a test that needs auth
npx playwright test tests/user/profile.spec.ts --project=user-chromium
```

## Rollback

If storageState becomes invalid (session expired, token rotated):
```bash
# Delete auth files and re-run setup
rm -rf playwright/.auth/
npx playwright test --project=setup:user --project=setup:admin
```
