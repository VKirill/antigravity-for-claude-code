# Visual Regression and Accessibility Snapshots

Playwright has two snapshot assertion types: pixel screenshots (`toHaveScreenshot`) and ARIA tree snapshots (`toMatchAriaSnapshot`). They serve different purposes and should be used together.

## `toHaveScreenshot` — Pixel Diffing

### Basic usage

```ts
// Capture full page
await expect(page).toHaveScreenshot('homepage.png');

// Capture a specific element
await expect(page.getByRole('dialog')).toHaveScreenshot('confirm-dialog.png');

// Full page (including below the fold)
await expect(page).toHaveScreenshot('full-page.png', { fullPage: true });
```

### First run — baseline creation

On the first run, there is no baseline. Playwright creates the snapshot file and the test passes. On subsequent runs, it compares against the saved baseline.

```bash
# Run tests — first run creates baselines
npx playwright test

# Update baselines (e.g., after intentional UI changes)
npx playwright test --update-snapshots
```

### Snapshot storage location

By default, snapshots are stored next to the test file:
```
tests/
  login.spec.ts
  login.spec.ts-snapshots/
    homepage-chromium-linux.png
    homepage-firefox-linux.png
    homepage-webkit-linux.png
```

Or configure a custom directory:
```ts
// playwright.config.ts
export default defineConfig({
  snapshotDir: './test-snapshots',
  snapshotPathTemplate: '{snapshotDir}/{testFilePath}/{arg}-{projectName}{ext}',
});
```

### Tolerance options

```ts
await expect(page).toHaveScreenshot('hero.png', {
  maxDiffPixels: 100,        // allow up to 100 changed pixels
  maxDiffPixelRatio: 0.01,   // allow up to 1% changed pixels
  threshold: 0.2,            // per-pixel color difference threshold (0-1)
  animations: 'disabled',    // disable CSS animations before capture
  mask: [page.locator('.timestamp')],  // mask dynamic elements
  maskColor: '#ff00ff',      // color to paint masked areas (magenta)
});
```

### Masking dynamic content

```ts
// Mask elements that change between runs (timestamps, ads, avatars)
await expect(page).toHaveScreenshot('dashboard.png', {
  mask: [
    page.getByTestId('last-updated'),
    page.getByTestId('user-avatar'),
    page.locator('.ad-unit'),
  ],
});
```

### Clip to a specific area

```ts
await expect(page).toHaveScreenshot('nav.png', {
  clip: { x: 0, y: 0, width: 1280, height: 80 },
});
```

### Style injection before screenshot

For reproducible screenshots, inject CSS to disable animations and transitions:

```ts
// playwright.config.ts
export default defineConfig({
  use: {
    // Inject global CSS for screenshot stability
    launchOptions: {
      args: ['--disable-smooth-scrolling'],
    },
  },
});
```

Or in test:
```ts
await page.addStyleTag({ content: `
  *, *::before, *::after {
    animation-duration: 0s !important;
    transition-duration: 0s !important;
  }
` });
await expect(page).toHaveScreenshot('stable.png');
```

## `toMatchAriaSnapshot` — Accessibility Tree Diffing

Tests the semantic structure rather than pixels. Robust to visual changes; catches accessibility regressions.

### Basic usage

```ts
// Capture ARIA tree snapshot
await expect(page.getByRole('navigation')).toMatchAriaSnapshot();
```

First run creates a `.aria.yml` snapshot file. Subsequent runs compare against it.

### Inline snapshot (no file)

```ts
await expect(page.getByRole('list')).toMatchAriaSnapshot(`
  - listitem: Item 1
  - listitem: Item 2
  - listitem: Item 3
`);
```

### Partial matching with wildcards

```ts
await expect(page.getByRole('dialog')).toMatchAriaSnapshot(`
  - dialog "Confirm deletion":
    - text: Are you sure you want to delete this item?
    - button "Delete"
    - button "Cancel"
`);
```

Wildcards in the snapshot:
```ts
await expect(page).toMatchAriaSnapshot(`
  - heading /Welcome, .+/    # regex for dynamic username
  - navigation
  - main
`);
```

### Update ARIA snapshots

```bash
npx playwright test --update-snapshots
```

## Comparison: When to Use Each

| Scenario | Tool |
|---|---|
| Catch visual regressions (layout, colors, spacing) | `toHaveScreenshot` |
| Catch accessibility regressions (roles, names, structure) | `toMatchAriaSnapshot` |
| Dynamic content (charts, animations) | `toHaveScreenshot` with masks |
| Cross-browser consistency | `toHaveScreenshot` per project |
| Screen reader behavior | `toMatchAriaSnapshot` |
| Component library snapshot testing | Both — visual + ARIA |
| CI with no display server | `toHaveScreenshot` requires headed or xvfb |

## CI Considerations

### Different OS = different baselines

Screenshots differ between Linux (CI) and macOS (local) due to font rendering. Solutions:

1. **Run snapshots only in CI** (recommended):
   ```ts
   test.skip(!process.env.CI, 'Visual tests only run in CI');
   ```

2. **Generate baselines in Docker** (matches CI exactly):
   ```bash
   docker run --rm -v $(pwd):/work -w /work mcr.microsoft.com/playwright:v1.60.0-jammy \
     npx playwright test --update-snapshots
   ```

3. **Per-platform baselines** (default behavior) — Playwright appends platform to snapshot name: `button-chromium-linux.png`.

### HTML report with diffs

On failure, the HTML report shows visual diffs. Upload artifacts in CI:

```yaml
- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: playwright-report
    path: playwright-report/
```

## `page.screenshot()` for Debugging (Not Assertions)

```ts
// Manual screenshot for debugging — not a regression assertion
await page.screenshot({ path: 'debug-screenshot.png' });
await page.screenshot({ path: 'full.png', fullPage: true });

// Element screenshot
await page.getByRole('dialog').screenshot({ path: 'dialog.png' });
```

## Anti-Patterns

| Anti-pattern | Problem | Fix |
|---|---|---|
| `toHaveScreenshot()` without a name argument | Name auto-generated from test title + index — fragile if test order changes | Always pass a name: `toHaveScreenshot('login-form.png')` |
| Screenshot of full page with ads/banners | Baseline breaks on every ad change | Mask dynamic regions |
| Running visual tests on multiple OSes without separate baselines | Font rendering differences = false failures | Use Docker for consistent baselines |
| Updating snapshots in CI automatically | Hides real regressions | Only update locally; treat snapshot changes as code review items |
| High `maxDiffPixelRatio` (e.g. 0.3 = 30%) | Masks significant visual changes | Keep at ≤0.02 (2%) for meaningful catches |
