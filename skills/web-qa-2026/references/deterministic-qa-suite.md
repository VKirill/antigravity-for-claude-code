# Deterministic QA & Build Verification Suite (2026)

This specification defines the complete, automated QA toolchain used by autonomous agents and CI runners to verify interactive websites. Every tool is configured to return a non-zero exit code on failure, preventing buggy builds from reaching staging or production.

---

## 1. Automated Verification Toolchain

```
[Development Build]
       |
       v
+------------------+     +------------------+     +------------------+
|  1. ESLint A11y  |     |   2. Stylelint   |     | 3. HTML Validate |
+------------------+     +------------------+     +------------------+
       |                           |                           |
       +---------------------------+---------------------------+
                                   |
                                   v
+------------------+     +------------------+     +------------------+
|   4. pa11y-ci    |     |  5. Size-Limit   |     | 6. PurgeCSS (Un) |
+------------------+     +------------------+     +------------------+
       |                           |                           |
       +---------------------------+---------------------------+
                                   |
                                   v
+------------------+     +------------------+     +------------------+
|  7. Linkinator   |     |  8. Lighthouse   |     |  9. Playwright   |
+------------------+     +------------------+     +------------------+
                                                               |
                                   +---------------------------+
                                   |
                                   v
                    +------------------------------+
                    | 9a. Axe Accessibility        |
                    | 9b. Visual Regress (Masks)   |
                    | 9c. Interaction Checks       |
                    | 9d. INP & CLS Web Vitals     |
                    +------------------------------+
```

---

## 2. Configuration Matrix for CI Automation

### 1. Lighthouse CI (`@lhci/cli`)
* **Purpose**: Tests Performance, Accessibility, Best Practices, and SEO.
* **Install**:
  ```bash
  npm install -D @lhci/cli@0.15.1
  ```
* **Configuration** (`lighthouserc.json`):
  ```json
  {
    "ci": {
      "collect": {
        "staticDistDir": "./dist",
        "numberOfRuns": 3
      },
      "assert": {
        "assertions": {
          "categories:performance": ["error", {"minScore": 0.95}],
          "categories:accessibility": ["error", {"minScore": 1.0}],
          "categories:best-practices": ["error", {"minScore": 0.95}],
          "categories:seo": ["error", {"minScore": 0.95}]
        }
      }
    }
  }
  ```
* **Failure Trigger**: Score drops below standard minimum threshold of 0.95 (1.0 for accessibility).

### 2. Accessibility Linter (`eslint-plugin-jsx-a11y`)
* **Purpose**: Catches visual hierarchy and static accessibility issues during development.
* **Install**:
  ```bash
  npm install -D eslint@9.20.0 eslint-plugin-jsx-a11y@6.10.2 eslint-plugin-react@7.37.4
  ```
* **Configuration** (`eslint.config.mjs`):
  ```javascript
  import jsxA11y from 'eslint-plugin-jsx-a11y';
  import reactPlugin from 'eslint-plugin-react';

  export default [
    {
      files: ['**/*.{js,jsx,ts,tsx}'],
      plugins: {
        'jsx-a11y': jsxA11y,
        'react': reactPlugin
      },
      languageOptions: {
        parserOptions: {
          ecmaFeatures: { jsx: true }
        }
      },
      rules: {
        ...jsxA11y.flatConfigs.recommended.rules,
        'jsx-a11y/alt-text': 'error',
        'jsx-a11y/anchor-has-content': 'error',
        'jsx-a11y/no-noninteractive-element-interactions': 'error',
        'jsx-a11y/no-redundant-roles': 'error'
      }
    }
  ];
  ```
* **Failure Trigger**: JSX elements lack screen-reader labels or semantic descriptors.

### 3. Style & Design-Token Linter (`stylelint`)
* **Purpose**: Prevents hardcoded hex/RGB colors, layout units, or arbitrary font-sizes.
* **Install**:
  ```bash
  npm install -D stylelint@17.11.0 stylelint-config-standard@36.0.0 stylelint-declaration-strict-value@1.10.6
  ```
* **Configuration** (`.stylelintrc.json`):
  ```json
  {
    "extends": ["stylelint-config-standard"],
    "plugins": ["stylelint-declaration-strict-value"],
    "rules": {
      "scale-unlimited/declaration-strict-value": [
        ["/color/", "font-size", "line-height"],
        {
          "ignoreValues": ["inherit", "transparent", "currentColor", "0", "initial"],
          "message": "Raw values for \"${value}\" are banned. Use design system variables (e.g. var(--brand-violet))."
        }
      ]
    }
  }
  ```
* **Failure Trigger**: Styling configuration declares direct hex/RGB parameters instead of tokens.

### 4. HTML Validator (`html-validate`)
* **Purpose**: Off-line parser checks for DOM anomalies and structural validation.
* **Install**:
  ```bash
  npm install -D html-validate@11.0.0
  ```
* **Configuration** (`.htmlvalidate.json`):
  ```json
  {
    "extends": ["html-validate:recommended"],
    "rules": {
      "attr-spacing": "error",
      "element-required-attributes": "error",
      "id-adjoining-disabled": "error",
      "void-style": ["error", { "style": "omit" }]
    }
  }
  ```
* **Failure Trigger**: Incorrectly nested nodes, missing close-tags, or invalid element hierarchies.

### 5. Automated Accessibility Auditor (`pa11y-ci`)
* **Purpose**: Quick multi-page headless check against compliance levels.
* **Install**:
  ```bash
  npm install -D pa11y-ci@4.1.0
  ```
* **Configuration** (`.pa11yci.json`):
  ```json
  {
    "defaults": {
      "standard": "WCAG2AAA",
      "level": "error",
      "timeout": 10000,
      "threshold": 0
    },
    "urls": [
      "http://localhost:3000",
      "http://localhost:3000/features"
    ]
  }
  ```
* **Failure Trigger**: Standard WCAG AAA error matches (contrast limits, label omission).

### 6. Code Bundle Limits (`size-limit`)
* **Purpose**: Guards build size and warns when visual dependencies bloat bundles.
* **Install**:
  ```bash
  npm install -D size-limit@11.1.2 @size-limit/file@11.1.2
  ```
* **Configuration** (`.size-limit.json`):
  ```json
  [
    {
      "path": "dist/assets/*.js",
      "limit": "50 KB"
    },
    {
      "path": "dist/assets/*.css",
      "limit": "20 KB"
    }
  ]
  ```
* **Failure Trigger**: Generated production bundles exceed set size bounds.

### 7. Unused CSS Checker (`purgecss` programmatic implementation)
* **Purpose**: Detects dead CSS left in final assemblies.
* **Install**:
  ```bash
  npm install -D purgecss@7.0.2
  ```
* **Configuration** (`purgecss.config.js`):
  ```javascript
  module.exports = {
    content: ['dist/**/*.html', 'dist/**/*.js'],
    css: ['dist/assets/*.css'],
    rejected: true
  };
  ```
* **Verification Script** (`verify-unused-css.mjs`):
  ```javascript
  import { PurgeCSS } from 'purgecss';
  import fs from 'fs';

  const purgeResult = await new PurgeCSS().purge({
    content: ['dist/**/*.html', 'dist/**/*.js'],
    css: ['dist/assets/*.css'],
    rejected: true
  });

  let rejectedBytes = 0;
  purgeResult.forEach(item => {
    if (item.rejected) {
      rejectedBytes += Buffer.byteLength(item.rejected.join(''), 'utf8');
    }
  });

  console.log(`[PurgeCSS] Found ${rejectedBytes} bytes of unused selectors.`);
  if (rejectedBytes > 2000) { // Fail if unused CSS exceeds 2KB
    console.error(`[Error] Unused CSS threshold exceeded.`);
    process.exit(1);
  }
  process.exit(0);
  ```

### 8. Link Checker (`linkinator`)
* **Purpose**: Iterates through built content to catch dead links and broken asset paths.
* **Install**:
  ```bash
  npm install -D linkinator@7.6.1
  ```
* **Execution**:
  ```bash
  npx linkinator ./dist --recurse --skip "^mailto:"
  ```
* **Failure Trigger**: Returns non-zero status if target links return 404 or connection failures.

---

## 3. Playwright E2E Integration Suite

Install Playwright core runner:
```bash
npm install -D @playwright/test@1.50.0 @axe-core/playwright@4.11.3
```

Create config `playwright.config.ts`:
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ],
});
```

Create verification spec `tests/qa-verification.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('E2E Verification Engine', () => {

  // 9a. Axe-Core Accessibility
  test('Accessibility Axe scan', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  // 9b. Visual Regression with dynamic masking
  test('Visual layout regression validation', async ({ page }) => {
    await page.goto('/');
    // We mask animations or counters that would fail deterministic matches
    await expect(page).toHaveScreenshot('homepage-base.png', {
      mask: [page.locator('.live-ticker'), page.locator('.time-display')],
      maxDiffPixelRatio: 0.01 // strict tolerance of 1%
    });
  });

  // 9c. Interaction check
  test('Navigation menu interactivity toggle', async ({ page }) => {
    await page.goto('/');
    const trigger = page.locator('#menu-trigger');
    await trigger.click();
    
    const navPanel = page.locator('#menu-panel');
    await expect(navPanel).toBeVisible();
    await expect(navPanel).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  });

  // 9d. Core Web Vitals CLS/INP tracking
  test('Monitor layout shifting and interaction latency', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      (window as any).clsAccumulator = 0;
      (window as any).inpMaxLatency = 0;

      // Observe Layout Shifts
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            (window as any).clsAccumulator += (entry as any).value;
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });

      // Observe Interaction Delay
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.duration > (window as any).inpMaxLatency) {
            (window as any).inpMaxLatency = entry.duration;
          }
        }
      }).observe({ type: 'event', durationThreshold: 16, buffered: true });
    });

    // Simulate standard user behavior
    await page.mouse.wheel(0, 1500);
    await page.waitForTimeout(200);
    await page.mouse.wheel(0, -1500);
    await page.waitForTimeout(200);

    const interactiveNode = page.locator('#menu-trigger');
    if (await interactiveNode.count() > 0) {
      await interactiveNode.click();
      await page.waitForTimeout(200);
    }

    const metrics = await page.evaluate(() => ({
      cls: (window as any).clsAccumulator,
      inp: (window as any).inpMaxLatency
    }));

    console.log(`[Metrics Result] CLS: ${metrics.cls}, INP: ${metrics.inp}ms`);
    
    expect(metrics.cls).toBeLessThan(0.1);  // Strict CLS target
    expect(metrics.inp).toBeLessThan(200);  // Strict INP target
  });
});
```

---

## 4. Unified Verification Script

Add these scripts directly to your project's `package.json` to execute local or CI pipelines:

```json
{
  "scripts": {
    "lint:js": "eslint .",
    "lint:css": "stylelint \"src/**/*.css\"",
    "lint:html": "html-validate \"dist/**/*.html\"",
    "lint:tokens": "node verify-tokens.mjs",
    "test:links": "linkinator ./dist --recurse --skip \"^mailto:\"",
    "test:size": "size-limit",
    "test:unused-css": "node verify-unused-css.mjs",
    "test:e2e": "playwright test",
    "test:pa11y": "pa11y-ci",
    "test:lighthouse": "lhci autoplay",
    "verify": "npm run lint:js && npm run lint:css && npm run lint:tokens && npm run lint:html && npm run test:unused-css && npm run test:size && npm run test:links && npm run test:pa11y && npm run test:lighthouse && npm run test:e2e"
  }
}
```

---

## 5. Sample CI Pipeline Configuration (GitHub Actions)

Create this workflow under `.github/workflows/ci.yml`:

```yaml
name: CI Verification Suite

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  verify-build:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout Repository
      uses: actions/checkout@v4

    - name: Set up Node.js
      uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: 'npm'

    - name: Install Dependencies
      run: npm ci

    - name: Install Playwright Chromium & Webkit
      run: npx playwright install --with-deps chromium webkit

    - name: Run Build
      run: npm run build

    - name: Execute Full Verification Pipeline
      run: npm run verify
```
