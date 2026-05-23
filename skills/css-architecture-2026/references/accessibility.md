# Accessibility baseline (WCAG 2.2 AA)

Every project ships with this baseline. No "we'll add a11y later" — adding it later is 10× more work than baking it in.

## The minimum eight

1. **Skip-link** as first focusable element
2. **`:focus-visible`** styles on everything keyboard-navigable
3. **`@media (prefers-reduced-motion: reduce)`** disables motion for users who asked
4. **`@media (prefers-color-scheme: dark)`** auto-activates dark theme
5. **Color contrast** ≥ 4.5:1 body text, ≥ 3:1 large/UI
6. **Hit area** ≥ 24×24 CSS px (WCAG 2.2 SC 2.5.8 Target Size Minimum)
7. **Keyboard shortcuts** check `e.target` before `preventDefault`
8. **Semantic HTML** — landmarks (`<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`)

## Skip-link

First focusable element on the page. Hidden until focused.

```html
<body>
  <a href="#main-content" class="skip-link">Skip to content</a>
  <nav>...</nav>
  <main id="main-content" tabindex="-1">...</main>
</body>
```

```css
/* base.css */
.skip-link {
  position: fixed;
  inset-block-start: var(--space-2);
  inset-inline-start: var(--space-2);
  z-index: var(--z-tooltip);
  padding: var(--space-2) var(--space-4);
  background: var(--color-surface);
  color: var(--color-fg);
  border: 2px solid var(--color-accent);
  border-radius: var(--radius-md);
  text-decoration: none;
  transform: translateY(-200%);
  transition: transform var(--duration-fast) var(--ease-out);
}
.skip-link:focus-visible {
  transform: translateY(0);
  outline: none;
}
```

Why critical: keyboard users (and screen-reader users) shouldn't have to tab through the entire nav to reach content on every page load.

## `:focus-visible`

Style focus when keyboard is used, not when mouse clicks. Modern alternative to `:focus` which fires on mouse click too (annoying ring around buttons after click).

```css
/* base.css — universal default */
:where(a, button, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* Components can refine but should keep the principle */
.button:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

### NEVER

```css
*:focus { outline: none; }                /* ❌ kills keyboard nav entirely */
.button:focus { outline: none; }          /* ❌ same */
button { outline: none; }                  /* ❌ same */
```

If you must remove outline (e.g. for aesthetic reasons), replace with equivalent:

```css
.button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-accent);
}
```

## Reduced motion

Users who set "Reduce motion" in OS preferences see fewer animations. Respect it.

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Or via tokens (cleaner):

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-fast:   0ms;
    --duration-normal: 0ms;
    --duration-slow:   0ms;
  }
}
```

Token approach works **only** if every animated property reads from the token. Audit with grep:

```bash
grep -rE 'transition:.*[0-9]+ms' css/ | grep -v 'tokens.css'
# Expect: empty
```

## Color scheme

Auto-activate dark theme for users who prefer it system-wide:

```css
:root { color-scheme: light dark; }

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --color-bg:  oklch(13% 0.012 250);
    --color-fg:  oklch(95% 0.008 250);
    /* ...rest of dark tokens... */
  }
}

[data-theme="dark"] {
  color-scheme: dark;
  --color-bg:  oklch(13% 0.012 250);
  --color-fg:  oklch(95% 0.008 250);
}
```

`:not([data-theme="light"])` lets a user override their system preference with a UI toggle.

Pair with `<head>` meta:

```html
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)">
```

## Color contrast

WCAG 2.2 AA thresholds:

| Text | Min contrast | Tools |
|---|---|---|
| Normal body (< 18px or < 14px bold) | 4.5:1 | Chrome DevTools picker, axe DevTools |
| Large (≥ 18px or ≥ 14px bold) | 3:1 | same |
| UI / icons / borders | 3:1 | same |

OKLCH simplifies the math: hold hue + chroma constant, derive contrast from lightness delta.

Example: `oklch(20% 0.01 250)` on `oklch(99% 0.01 250)` ≈ contrast ratio 16:1 (AAA). `oklch(50% 0.01 250)` on `oklch(99% 0.01 250)` ≈ 4.6:1 (AA pass for normal text but borderline — use 45% or lower for safety).

Run automated check in CI:

```bash
npx pa11y http://localhost:3000
# or
npx lighthouse http://localhost:3000 --only-categories=accessibility
```

## Hit area (WCAG 2.2 SC 2.5.8)

Interactive elements must be ≥ 24×24 CSS px. Easy to break with tiny icon buttons.

```css
/* ❌ Wrong */
.icon-button {
  inline-size: 16px;
  block-size: 16px;
}

/* ✅ Right — visual size 16px, hit area 24px+ */
.icon-button {
  display: inline-grid;
  place-items: center;
  inline-size: 24px;
  block-size: 24px;
  padding: 4px;        /* hit area = inline-size, content = 16px */
}

/* Or use padding to expand hit area */
.icon-link {
  padding: var(--space-2);
}
```

## Keyboard shortcuts safety

If you implement Cmd/Ctrl+B, Cmd/Ctrl+K, etc., always check the focus target — otherwise user typing in a form gets shortcut hijacked.

```js
window.addEventListener('keydown', (e) => {
  // Don't hijack when user is typing
  const inField = e.target.matches('input, textarea, [contenteditable]');

  if (!inField && (e.metaKey || e.ctrlKey) && e.key === 'b') {
    e.preventDefault();
    toggleSidebar();
  }

  // Cmd/Ctrl+K — search — should work EVERYWHERE
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    openSearchModal();
  }
});
```

Distinction:
- **Document-level shortcuts** (sidebar toggle, theme switch) — block when in input
- **Search shortcut** (Cmd/Ctrl+K) — should work even in inputs (it's the primary nav)
- **Browser-defaults** (Cmd/Ctrl+B for bold in contenteditable, Cmd/Ctrl+Z undo) — never hijack

## Semantic HTML landmarks

Screen readers navigate by landmarks. Use them.

```html
<body>
  <a href="#main" class="skip-link">Skip to content</a>

  <header class="topbar">
    <a href="/" class="logo" aria-label="Home">...</a>
    <nav aria-label="Primary"> ... </nav>
  </header>

  <aside class="sidebar" aria-label="Sections">
    <nav aria-label="Sections nav"> ... </nav>
  </aside>

  <main id="main" tabindex="-1">
    <section aria-labelledby="dashboard-heading">
      <h1 id="dashboard-heading">Dashboard</h1>
      ...
    </section>
  </main>

  <footer> ... </footer>
</body>
```

Rules:
- Exactly **one** `<main>` per page
- Multiple `<nav>` are fine if each has unique `aria-label`
- Avoid `<div>` for clickable cards — use `<a>` or `<button>` (or wrap a `<div>` with one)
- Headings (`<h1>` → `<h6>`) must follow hierarchy — don't skip from `h1` to `h3`

## ARIA — the four rules

1. **No ARIA is better than wrong ARIA.** A native `<button>` already announces "button". `<div role="button">` is worse.
2. **Use ARIA only where HTML semantics are insufficient** (e.g., complex widgets — comboboxes, tabs, accordions).
3. **`aria-label`** for icon-only buttons:
   ```html
   <button aria-label="Close" class="button--icon">
     <svg>...</svg>
   </button>
   ```
4. **`aria-current`** for active nav:
   ```html
   <a href="/dashboard" aria-current="page">Dashboard</a>
   ```
   ```css
   .nav-item[aria-current="page"] { color: var(--color-accent); }
   ```

## Form a11y

- Every `<input>` must have a `<label>` (or `aria-label` for icon-only search)
- Group radios with `<fieldset>` + `<legend>`
- Error messages tied via `aria-describedby`:
  ```html
  <label for="email">Email</label>
  <input id="email" type="email" aria-describedby="email-error" aria-invalid="true">
  <p id="email-error" class="field__error">Email is required</p>
  ```
- `:required` + `:invalid` show state without JS:
  ```css
  .field:has(:invalid:not(:placeholder-shown)) .field__label {
    color: var(--color-danger);
  }
  ```

## Audit checklist

Run before any PR involving UI:

- [ ] Skip-link present and visible on `:focus-visible`
- [ ] All interactive elements have `:focus-visible` styles
- [ ] No `outline: none` without replacement
- [ ] `@media (prefers-reduced-motion: reduce)` zeros durations
- [ ] `@media (prefers-color-scheme: dark)` activates dark theme
- [ ] Color contrast ≥ 4.5:1 verified (DevTools picker on text + bg)
- [ ] All icon buttons have `aria-label`
- [ ] Active nav links have `aria-current="page"`
- [ ] Form inputs have labels, errors have `aria-describedby`
- [ ] Hit areas ≥ 24×24 CSS px (Chrome DevTools → Accessibility → check sizes)
- [ ] One `<main>` per page; landmarks have `aria-label` when duplicated
- [ ] Keyboard shortcuts gated by `e.target.matches('input, textarea, [contenteditable]')`
- [ ] `lighthouse --only-categories=accessibility` ≥ 95
