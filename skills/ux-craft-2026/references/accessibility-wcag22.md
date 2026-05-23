# Accessibility: WCAG 2.2 Standards & Implementation Guide
*Authoritative Reference for Autonomous Design Orchestrators — May 2026*

This reference document establishes the accessibility standards, implementation patterns, and automated CI quality gates for the autonomous design orchestrator. For related layouts and conversion heuristics, cross-reference [ia_page_blueprint_kb.md](ia_page_blueprint_kb.md) and [ux-conversion-patterns.md](ux-conversion-patterns.md).

---

## 1. WCAG 2.2 Success Criteria & Pass Requirements (Новые критерии WCAG 2.2)
The World Wide Web Consortium (W3C) officially published the WCAG 2.2 standard. Autonomous design orchestrators must enforce the following success criteria:

### 1.1. 2.5.8 Target Size (Minimum) (Level AA)
*   **Exact Pass Requirement**: Any interactive target (e.g., buttons, input fields, links, checkboxes) must have a dimension of at least **24x24 CSS pixels**, OR the target must have a spacing of at least **24 CSS pixels** separating it from any adjacent target.
*   **Exceptions**: 
    - *Inline*: The link is inside a text block (e.g., inside a paragraph of copy).
    - *User Agent*: The browser controls the size (e.g., native unstyled checkboxes).
    - *Essential*: The target size is legally or technically constrained (e.g., pins on a geographic map).

### 1.2. 2.4.11 Focus Not Obscured (Minimum) (Level AA)
*   **Exact Pass Requirement**: When an interactive component receives keyboard focus, the component must not be entirely obscured by other author-created content (such as sticky headers, sticky footers, or overlay cookie banners). At least a portion of the focused element's border/area must remain visible in the viewport.

### 1.3. 2.5.7 Dragging Movements (Level AA)
*   **Exact Pass Requirement**: Any user interface action that requires a dragging gesture (e.g., sliders, drag-and-drop lists, maps) must also be fully operable using a single-pointer tap or click alternative.
*   **Code Example**: A drag-and-drop file uploader must provide a standard file browser dialog option (`<input type="file">`) accessible via a standard click event.

### 1.4. 3.2.6 Consistent Help (Level A)
*   **Exact Pass Requirement**: Help and support options (such as contact forms, email addresses, phone numbers, or automated support chats) must be positioned in the same relative location on every page of a multi-page site.
*   **Visual Strategy**: Keep support widgets docked to the bottom right screen viewport quadrant (`position: fixed; bottom: 24px; right: 24px;`).

### 1.5. 3.3.7 Accessible Authentication (Minimum) (Level AA)
*   **Exact Pass Requirement**: The authentication flow must not require users to perform cognitive function tests (such as memorizing a complex password, solving math equations, or deciphering CAPTCHAs) *unless* the site provides:
    - An alternative mechanism (e.g., WebAuthn/Biometrics, Magic Link emails, OAuth logins).
    - Support for standard browser autocomplete and copy-paste inputs.

### 1.6. 3.3.9 Redundant Entry (Level A)
*   **Exact Pass Requirement**: Any information previously entered by the user in a session that is required again in a subsequent step must be either auto-populated or available for selection (e.g., a checkbox to "Use shipping address as billing address").

---

## 2. Semantic HTML & Landmark Topology (Семантическая структура макета)
Modern accessibility hinges on semantic layouts that construct a clear outline for assistive technologies:

| Landmark Element | Implicit ARIA Role | Quantity Limit | Usage Guidelines |
| :--- | :--- | :--- | :--- |
| `<header>` | `role="banner"` | 1 per page | Houses global brand logos, search fields, and site navigation. |
| `<nav>` | `role="navigation"` | Multiple allowed | Wraps collection links. If using multiple, add `aria-label` tags (e.g., `aria-label="Primary Navigation"`). |
| `<main>` | `role="main"` | **Strictly 1** | Houses the core content block. Exclude global nav and footer bars. |
| `<aside>` | `role="complementary"` | Multiple allowed | Hosts secondary sidebars, related posts, or dashboard controls. |
| `<footer>` | `role="contentinfo"` | 1 per page | Contains copyright info, terms, contact pages, and compliance logos. |
| `<section>` | `role="region"` | Multiple allowed | Only recognized as a landmark if explicitly labeled using `aria-labelledby` or `aria-label`. |

---

## 3. Focus Management (Управление фокусом клавиатуры)
Users navigating via keyboard must have visual clarity and logical interaction flow:

### 3.1. Keyboard Focus Outline (`:focus-visible`)
Do not hide focus outlines using `outline: none` or `outline: 0`. Style outlines explicitly for keyboard focus events:
```css
/* Style outlines only when navigated via keyboard */
*:focus-visible {
  outline: 3px solid #2563eb; /* Brand Blue */
  outline-offset: 3px;
}
```

### 3.2. Skip Navigation Links
Enable keyboard users to bypass global navigation headers and jump directly to the main content block:
```html
<a href="#main-content" class="skip-link">Skip to Main Content</a>

<main id="main-content" tabindex="-1">
  <!-- Content here -->
</main>
```
```css
/* Keep skip link offscreen until focused */
.skip-link {
  position: absolute;
  top: -100px;
  left: 24px;
  background: #2563eb;
  color: #ffffff;
  padding: 12px 24px;
  z-index: 9999;
  transition: top 200ms ease;
}

.skip-link:focus {
  top: 24px;
}
```

### 3.3. Focus Trapping (Ловушка фокуса)
Modal dialogs, slide-out menus, and overlays must restrict keyboard navigation within their containers when active:
```javascript
// Simple programmatic focus trap listener
function initFocusTrap(modalElement) {
  const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const firstFocusable = modalElement.querySelector(focusableSelectors);
  const focusableContent = modalElement.querySelectorAll(focusableSelectors);
  const lastFocusable = focusableContent[focusableContent.length - 1];

  modalElement.addEventListener('keydown', function(e) {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) { // Shift + Tab: loop back to last item
      if (document.activeElement === firstFocusable) {
        lastFocusable.focus();
        e.preventDefault();
      }
    } else { // Tab: loop to first item
      if (document.activeElement === lastFocusable) {
        firstFocusable.focus();
        e.preventDefault();
      }
    }
  });
  
  firstFocusable.focus();
}
```

### 3.4. Roving Tabindex (Блуждающий tabindex)
Use roving tabindex inside composite widgets (like custom tabs, menu lists, or accordion headers):
*   Only the active/focused item has `tabindex="0"`.
*   All other sibling items have `tabindex="-1"`.
*   When a user presses an arrow key, update the target sibling to `tabindex="0"`, focus it, and reset the predecessor to `tabindex="-1"`.

---

## 4. ARIA Implementation Patterns (Правильное использование ARIA)
Follow the primary directive from the W3C Web Accessibility Initiative: **"No ARIA is better than Bad ARIA."** Always use native semantic elements over custom ARIA-tagged blocks.

### Custom Accordion Pattern
When custom components are unavoidable, execute standard semantic structures:
```html
<!-- Native Alternative Preferred: <details> and <summary> -->
<div class="accordion-item">
  <h3>
    <button 
      id="accordion-trigger-1" 
      aria-expanded="false" 
      aria-controls="accordion-panel-1"
      class="accordion-button">
      What is your SLA guarantee?
    </button>
  </h3>
  <div 
    id="accordion-panel-1" 
    role="region" 
    aria-labelledby="accordion-trigger-1" 
    hidden
    class="accordion-panel">
    <p>Our service guarantees a 99.9% application uptime.</p>
  </div>
</div>
```

---

## 5. Forms Accessibility (Доступность форм ввода)
*   **Explicit Associations**: Form fields must have programmatically linked `<label>` text:
    ```html
    <!-- Method A: Link via 'for' attribute -->
    <label for="user-email">Email Address</label>
    <input type="email" id="user-email">

    <!-- Method B: Nesting input directly -->
    <label>
      <span>First Name</span>
      <input type="text">
    </label>
    ```
*   **Browser Autocomplete Attributes**: Autocomplete values help users with cognitive challenges fill out forms quickly. Enforce accurate autocomplete mappings:
    - First Name: `autocomplete="given-name"`
    - Last Name: `autocomplete="family-name"`
    - Email: `autocomplete="email"`
    - Current Password: `autocomplete="current-password"`
    - New Password: `autocomplete="new-password"`

---

## 6. Color Contrast: WCAG vs. APCA (Контрастность интерфейсов)
Designers must understand both current relative contrast calculations and the next-generation perceptual model.

### 6.1. Relative Contrast (WCAG 2.x)
Calculates contrast based on relative luminance ratios. Enforce WCAG 2.2 Level AA thresholds:
*   **Text Contrast**:
    - Normal text (< 18pt / 24px, or bold < 14pt / 18.66px): Minimum **4.5:1** contrast.
    - Large text (≥ 18pt or bold ≥ 14pt): Minimum **3.0:1** contrast.
*   **Non-Text Elements (Icons, borders, UI controls)**: Minimum **3.0:1** contrast.

### 6.2. Accessible Perceptual Contrast Algorithm (APCA / WCAG 3.0 Draft)
APCA measures contrast perceptually based on spatial frequency, font size, weight, text polarity (light on dark vs. dark on light), and context. Rather than simple ratios, APCA outputs a **Lightness Contrast (Lc)** value from `-108` to `106`.

| Target Lc Threshold | Font Size & Weight | Best Fit Element |
| :--- | :--- | :--- |
| **Lc ≥ 90** | Smallest body text (12px – 14px), font weight 300/400. | Body copy, fine-print legal structures. |
| **Lc ≥ 75** | Standard body text (16px), font weight 400. | Primary paragraphs, blog text blocks. |
| **Lc ≥ 60** | Medium headlines (≥ 18px), font weight 600+. | Subheaders, bold tags, product prices. |
| **Lc ≥ 45** | Large display headers (≥ 24px / clamp). | Main page headings, logo marks. |
| **Lc ≥ 30** | Decorative elements, disabled controls, borders. | Input borders, placeholder text. |

*APCA rule of thumb: Light text on a dark background requires roughly Lc 5 to 10 more contrast than dark text on light backgrounds to account for optical glare.*

---

## 7. Screen Reader Testing Checklist (Проверка с помощью скринридеров)
Test your pages manually using NVDA (Windows), VoiceOver (macOS/iOS), or TalkBack (Android):
*   [ ] **Keyboard-only Navigation**: Can you navigate the entire layout using only `Tab`, `Shift+Tab`, `Space`, `Enter`, and Arrow keys?
*   [ ] **Announcements Verification**: Do screen readers read text links descriptively? (Avoid generic "Click here" or "Read more" links; write descriptive text like "Read more about our security features").
*   [ ] **Icon Alternative Text**: Are all vector/icon graphics decorated with `aria-hidden="true"` (if decorative) or provided with descriptive text tags?
*   [ ] **Dynamic Notifications**: Do dynamic alerts (e.g. "Add to cart successful") use `role="status"` or `aria-live="polite"` to alert users without interrupting focus?

---

## 8. Deterministic CI Quality Gates (Автоматизированные тесты в CI)
To prevent accessibility regressions, developers must enforce the following validation configurations:

### 8.1. ESLint Configuration (`eslint-plugin-jsx-a11y@6.10.2`)
Install the linter package:
```bash
npm install --save-dev eslint-plugin-jsx-a11y@6.10.2
```

Add configuration to your `.eslintrc.json`:
```json
{
  "extends": [
    "eslint:recommended",
    "plugin:jsx-a11y/recommended"
  ],
  "plugins": [
    "jsx-a11y"
  ],
  "rules": {
    "jsx-a11y/alt-text": "error",
    "jsx-a11y/aria-props": "error",
    "jsx-a11y/aria-proptypes": "error",
    "jsx-a11y/aria-unsupported-elements": "error",
    "jsx-a11y/role-has-required-aria-props": "error",
    "jsx-a11y/role-supports-aria-props": "error"
  }
}
```

### 8.2. Automated Accessibility Integration (`@axe-core/playwright@4.11.3`)
Install the testing packages:
```bash
npm install --save-dev @playwright/test @axe-core/playwright@4.11.3
```

Create an automated test file `tests/a11y.spec.js`:
```javascript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Compliance Suite', () => {
  test('Page must contain zero WCAG 2.2 AA violations on load', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    
    // Inject and execute Axe-Core engine
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();

    // Verify zero accessibility violations
    expect(results.violations).toEqual([]);
  });
});
```

### 8.3. Lightweight CI testing (`pa11y-ci@4.1.0`)
Install the runner:
```bash
npm install --save-dev pa11y-ci@4.1.0
```

Create [.pa11yci.json]() config:
```json
{
  "defaults": {
    "standard": "WCAG2AA",
    "timeout": 30000,
    "concurrency": 2,
    "runners": [
      "htmlcs"
    ],
    "chromeLaunchConfig": {
      "args": ["--no-sandbox", "--disable-setuid-sandbox"]
    }
  },
  "urls": [
    "http://localhost:3000/",
    "http://localhost:3000/pricing",
    "http://localhost:3000/contact"
  ]
}
```

Run test suite in deployment scripts:
```bash
npx pa11y-ci
```

---

## 9. Accessibility Antipatterns (Антипаттерны доступности)
*Avoid these bad practices in interface programming:*

*   **Antipattern 1: Decorative elements with generic roles** — Applying `role="presentation"` or `aria-hidden="true"` to structural controls, which stops screen readers from reading critical UI controls.
*   **Antipattern 2: Non-semantic buttons** — Creating buttons with `div` or `a` tags without adding keypress mappings (Enter/Space triggers) or tab index focus configurations. Use native `<button>` instead.
*   **Antipattern 3: Placeholder labels** — Using HTML input placeholders (`placeholder="Enter Name"`) as labels. Placeholders disappear when text is typed, violating memory recall rules.
*   **Antipattern 4: Keyboard Trap Overlay** — Creating modals or dropdown containers that lock focus inside them but provide no ESC keyboard key listener, leaving users with no way to close the window.
*   **Antipattern 5: Color-Only Messages** — Communicating dynamic success or error messages solely with green or red border coloring. Always provide text descriptions and symbols alongside colored borders.
