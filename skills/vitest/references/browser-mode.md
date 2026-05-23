# vitest — Browser Mode Reference

Running Vitest tests inside a real browser with `@vitest/browser`.

## What browser mode is (and isn't)

Browser mode runs your Vitest unit tests inside a real browser (Chromium, Firefox, or WebKit). It is NOT Playwright E2E testing:

| | Vitest browser mode | Playwright E2E |
|---|---|---|
| Test semantics | `describe/it/expect` (unit) | `test/expect` (E2E) |
| Navigation | No full-page navigation | Full page navigation |
| Setup cost | Low — same `vitest.config.ts` | Separate `playwright.config.ts` |
| Purpose | Component/DOM unit tests | User flows, cross-page behavior |
| Mocking | `vi.mock` works normally | Route/network mocking only |
| Use for | DOM APIs, Web Components, browser globals | Login flows, shopping carts, form submissions |

## Install

```bash
npm install -D @vitest/browser

# Pick a browser provider:
npm install -D playwright          # Playwright provider (recommended)
# OR
npm install -D webdriverio         # WebdriverIO provider
```

Playwright must be installed separately, but does NOT need a separate config file. Vitest manages browser launch.

## Configure

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: 'playwright',   // 'playwright' | 'webdriverio'
      name: 'chromium',         // 'chromium' | 'firefox' | 'webkit'
      headless: true,           // false for debugging
    },
    // Optionally scope browser tests to specific files:
    include: ['src/**/*.browser.test.ts'],
  },
})
```

## Importing from vitest/browser

Test files that use browser-specific APIs import from `vitest/browser`, not `@vitest/browser`:

```ts
import { page, userEvent } from '@vitest/browser/context'
import { describe, it, expect } from 'vitest'

describe('Button component', () => {
  it('calls onClick when clicked', async () => {
    document.body.innerHTML = '<button id="btn">Click me</button>'
    const button = document.getElementById('btn')!

    const clickSpy = vi.fn()
    button.addEventListener('click', clickSpy)

    await userEvent.click(button)
    expect(clickSpy).toHaveBeenCalledOnce()
  })
})
```

## page fixture

The `page` object from `@vitest/browser/context` provides interaction utilities:

```ts
import { page } from '@vitest/browser/context'

// Get elements
const el = page.getByRole('button', { name: 'Submit' })
const input = page.getByPlaceholder('Email address')
const text = page.getByText('Welcome back')
const testId = page.getByTestId('submit-btn')

// Interact
await userEvent.click(el)
await userEvent.type(input, 'user@example.com')
await userEvent.keyboard('{Enter}')

// Take screenshot (for visual debugging)
await page.screenshot({ path: 'test-output/button.png' })
```

Note: `page` queries are Vitest-specific wrappers, not the Playwright `page` object. They use `@testing-library`-style selectors internally.

## Browser-specific globals

In browser mode, all browser globals are real (`document`, `window`, `navigator`, `location`, `fetch`, `localStorage`, `IndexedDB`, etc.). No jsdom approximations.

```ts
it('uses real localStorage', () => {
  localStorage.setItem('token', 'abc123')
  const token = localStorage.getItem('token')
  expect(token).toBe('abc123')
  localStorage.clear()
})
```

## Multiple browsers via projects

Run tests in multiple browsers in one `vitest run`:

```ts
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'chromium',
          browser: { enabled: true, provider: 'playwright', name: 'chromium' },
        },
      },
      {
        test: {
          name: 'firefox',
          browser: { enabled: true, provider: 'playwright', name: 'firefox' },
        },
      },
    ],
  },
})
```

## Mixing browser and node tests

Use `projects` to run both in one invocation:

```ts
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.unit.test.ts'],
        },
      },
      {
        test: {
          name: 'browser',
          browser: {
            enabled: true,
            provider: 'playwright',
            name: 'chromium',
          },
          include: ['src/**/*.browser.test.ts'],
        },
      },
    ],
  },
})
```

## Debugging

```ts
// vitest.config.ts — disable headless for visual debugging
test: {
  browser: {
    headless: false,  // opens browser window
    slowMo: 500,      // adds 500ms delay between actions
  },
}
```

Run with `--reporter=verbose` to see individual test names as they run in the browser.

## Limitations

- `vi.mock` with dynamic imports works but has subtle timing differences vs node mode
- `globalSetup` still runs in Node, not in the browser — DB setup still happens on the Node side
- Hot module replacement works but browser restart is slower than node restart
- CSS and layout-dependent assertions require screenshots or explicit style checks — no layout engine queries
- Parallelism is limited to browser instances; each browser instance has overhead
