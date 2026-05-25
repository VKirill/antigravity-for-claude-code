# Playwright — Reference Index

Quick decision map: identify your topic, open the right file. Don't read everything.

## Decision Map

| I need to… | Open |
|---|---|
| Pick the right locator (`getByRole` vs `getByTestId`?) | [locators.md](locators.md) |
| Write a fixture or set up auth with `storageState` | [fixtures-and-auth.md](fixtures-and-auth.md) |
| Speed up CI, shard tests, configure parallelism | [parallel-sharding.md](parallel-sharding.md) |
| Mock an API, replay a HAR file, intercept requests | [network-mocking.md](network-mocking.md) |
| Screenshot diffing, accessibility snapshots | [visual-regression.md](visual-regression.md) |
| GitHub Actions CI setup, Docker, trace upload | [ci-integration.md](ci-integration.md) |
| Verify this skill routes correctly (eval prompts) | [eval-cases.md](eval-cases.md) |

## Locator Selection Flowchart

```
User-visible text? → getByRole (with name option)
              │
              ├─ Form input? → getByLabel
              ├─ Placeholder text? → getByPlaceholder
              ├─ Image? → getByAltText
              ├─ Tooltip/icon? → getByTitle
              ├─ Known test id? → getByTestId
              └─ Fallback: getByText (exact or regex)

Avoid: CSS selectors, XPath, :nth-child, class-based selectors
```

## Quick Lookup: Assertion Cheat Sheet

| What you're testing | Assertion |
|---|---|
| Element visible | `expect(locator).toBeVisible()` |
| Element hidden | `expect(locator).toBeHidden()` |
| Text content | `expect(locator).toHaveText('exact')` or `toContainText('partial')` |
| Input value | `expect(locator).toHaveValue('value')` |
| Attribute | `expect(locator).toHaveAttribute('attr', 'value')` |
| CSS class | `expect(locator).toHaveClass(/class-name/)` |
| Count | `expect(locator).toHaveCount(3)` |
| URL | `expect(page).toHaveURL('/path')` or `/regex/` |
| Title | `expect(page).toHaveTitle('Page Title')` |
| Screenshot | `expect(page).toHaveScreenshot('name.png')` |
| ARIA tree | `expect(locator).toMatchAriaSnapshot()` |
| Soft (non-failing) | `expect.soft(locator).toBeVisible()` |

## Quick Lookup: Config Essentials

```ts
// playwright.config.ts — minimum viable production config
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
});
```

## Common Anti-Patterns

| Anti-pattern | Fix |
|---|---|
| `await page.waitForTimeout(2000)` | Use `await expect(locator).toBeVisible()` |
| `page.locator('.btn-primary')` | `page.getByRole('button', { name: 'Submit' })` |
| Login in `beforeEach` | Auth fixture with `storageState` |
| `test.only` committed | Add `--forbid-only` to CI command |
| Missing `baseURL` in config | Set `use.baseURL` — never hardcode URLs in tests |
| Snapshot names with numbers | Always name: `toHaveScreenshot('login-form.png')` |
