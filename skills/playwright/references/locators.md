# Playwright Locators

Locators are the core building block. They're lazy (no DOM query until action/assertion) and auto-retry on every call. This document covers the full locator API, selection strategy, chaining, and anti-patterns.

## Locator Priority Order

Always prefer locators in this order. Higher = more resilient to refactoring:

1. **`getByRole(role, options)`** — ARIA role + accessible name. Covers buttons, links, headings, inputs, dialogs, etc.
2. **`getByLabel(text)`** — label text linked to a form input (via `for`/`aria-labelledby`/`aria-label`)
3. **`getByPlaceholder(text)`** — input `placeholder` attribute
4. **`getByText(text)`** — visible text (element must be visible)
5. **`getByAltText(text)`** — `alt` attribute (images, area elements)
6. **`getByTitle(text)`** — `title` attribute (tooltips, SVG titles)
7. **`getByTestId('id')`** — `data-testid` attribute (configure per team: `testIdAttribute: 'data-cy'`)
8. **`locator('css')`** — last resort only; document why

## `getByRole` — Most Important Locator

```ts
// Button
page.getByRole('button', { name: 'Submit' })
page.getByRole('button', { name: /submit/i })         // regex, case-insensitive

// Link
page.getByRole('link', { name: 'Sign in' })

// Heading
page.getByRole('heading', { name: 'Dashboard', level: 1 })

// Input (type text, email, password — role is 'textbox')
page.getByRole('textbox', { name: 'Email' })

// Checkbox
page.getByRole('checkbox', { name: 'Remember me' })

// Combobox / select
page.getByRole('combobox', { name: 'Country' })

// Dialog
page.getByRole('dialog', { name: 'Confirm deletion' })
  .getByRole('button', { name: 'Delete' })

// Tab
page.getByRole('tab', { name: 'Settings' })

// Row in a table
page.getByRole('row', { name: /John Doe/ })
```

**`name` option** matches the element's accessible name — computed from `aria-label`, `aria-labelledby`, `title`, or text content.

**Common ARIA roles**: `alert`, `alertdialog`, `button`, `cell`, `checkbox`, `columnheader`, `combobox`, `dialog`, `grid`, `gridcell`, `heading`, `img`, `link`, `listbox`, `listitem`, `menuitem`, `navigation`, `option`, `radiogroup`, `row`, `rowheader`, `searchbox`, `separator`, `slider`, `spinbutton`, `status`, `switch`, `tab`, `tablist`, `tabpanel`, `textbox`, `timer`, `toolbar`, `tooltip`, `tree`, `treeitem`

## `getByLabel` — Form Inputs

```ts
page.getByLabel('Email address')       // matches <label>Email address</label>
page.getByLabel(/password/i)           // regex match
```

Links: `for="id"` → `<input id="id">`, `aria-labelledby`, `aria-label`, nested label.

## `getByText` — Visible Text

```ts
page.getByText('Welcome back!')        // exact match by default
page.getByText('Welcome', { exact: false })  // partial match
page.getByText(/error/i)               // regex
```

Use for non-interactive content (paragraphs, spans, table cells). For buttons/links, prefer `getByRole`.

## Chaining and Scoping

Scope a locator to a parent to avoid ambiguity:

```ts
// Within a specific section
const sidebar = page.getByRole('navigation', { name: 'Sidebar' });
sidebar.getByRole('link', { name: 'Settings' })

// Within a list item
const items = page.getByRole('listitem');
await items.filter({ hasText: 'Item 2' }).getByRole('button', { name: 'Delete' }).click();

// nth element
page.getByRole('listitem').nth(0)
page.getByRole('listitem').first()
page.getByRole('listitem').last()
```

## `locator.filter()`

Narrow a locator by content or child locator — stays in the Playwright API (no CSS hacks):

```ts
// Has text
page.getByRole('listitem').filter({ hasText: 'Product A' })

// Has a child matching another locator
page.getByRole('listitem').filter({
  has: page.getByRole('button', { name: 'Edit' })
})

// Negation
page.getByRole('listitem').filter({ hasNot: page.getByText('Archived') })
```

## Multiple Matches

When a locator matches multiple elements, most actions throw. Use these to handle lists:

```ts
const count = await page.getByRole('listitem').count();
const texts = await page.getByRole('listitem').allTextContents();
const innerTexts = await page.getByRole('listitem').allInnerTexts();

// Iterate
for (const item of await page.getByRole('listitem').all()) {
  console.log(await item.textContent());
}
```

## Locator Actions

```ts
await locator.click()
await locator.click({ button: 'right' })
await locator.dblclick()
await locator.fill('text')                    // replaces current value
await locator.type('text')                    // types character by character
await locator.clear()
await locator.check()                         // checkbox/radio
await locator.uncheck()
await locator.selectOption('value')           // <select>
await locator.selectOption({ label: 'Label' })
await locator.hover()
await locator.focus()
await locator.press('Enter')
await locator.pressSequentially('text', { delay: 50 })
await locator.dragTo(target)
await locator.scrollIntoViewIfNeeded()
const text = await locator.textContent()
const inner = await locator.innerHTML()
const val = await locator.inputValue()
const attr = await locator.getAttribute('href')
const box = await locator.boundingBox()
```

## Soft Assertions

Soft assertions don't stop the test on failure — useful when you want to collect multiple failures:

```ts
test('form validation messages', async ({ page }) => {
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect.soft(page.getByText('Name is required')).toBeVisible();
  await expect.soft(page.getByText('Email is required')).toBeVisible();
  await expect.soft(page.getByText('Password is required')).toBeVisible();
  // test continues even if some assertions fail
});
```

## Waiting — Never Use `waitForTimeout`

Playwright auto-waits. When you need explicit waiting:

```ts
// Wait for element state
await expect(locator).toBeVisible()           // waits up to default timeout
await expect(locator).toBeEnabled()
await expect(locator).toBeHidden()

// Wait for navigation
await page.waitForURL('/dashboard')
await Promise.all([
  page.waitForURL('/success'),
  page.getByRole('button', { name: 'Submit' }).click(),
]);

// Wait for network
await page.waitForResponse('**/api/data')
await page.waitForRequest('**/api/submit')

// Wait for load state
await page.waitForLoadState('networkidle')    // use sparingly — can be slow
await page.waitForLoadState('domcontentloaded')
```

## Frame Locators

```ts
const frame = page.frameLocator('#my-iframe');
await frame.getByRole('button', { name: 'Accept' }).click();
```

## Anti-Patterns

| Anti-pattern | Problem | Fix |
|---|---|---|
| `page.locator('.submit-btn')` | CSS class may change | `getByRole('button', { name: 'Submit' })` |
| `page.locator('//input[@type="email"]')` | XPath, brittle | `getByRole('textbox', { name: 'Email' })` |
| `page.locator('button').nth(2)` | Index-based, fragile | `getByRole('button', { name: 'Specific button' })` |
| `await page.waitForTimeout(1000)` | Causes flakiness | `await expect(locator).toBeVisible()` |
| `page.locator('[data-testid="btn"]')` | Works but verbose | `getByTestId('btn')` |
| Using `textContent()` for assertions | Snapshot, not retry | `expect(locator).toHaveText(...)` — retries until true |
