# Modern CSS features (2026 baseline)

All features below have universal browser support unless noted. Use them by default — they replace older patterns that LLMs still default to.

## Cascade Layers (`@layer`)

Solves: specificity wars, `!important` chains, "my utility doesn't override the component".

```css
@layer reset, tokens, base, layout, components, utilities;

@layer components {
  .button.button--primary[type="submit"] {
    background: var(--color-accent);   /* specificity = 0,3,1 */
  }
}

@layer utilities {
  .bg-transparent { background: transparent; }  /* specificity = 0,1,0 */
}
/* Utility wins — later layer beats earlier, regardless of specificity */
```

Support: all browsers since 2022. → [architecture.md](architecture.md)

## OKLCH color

Perceptually uniform. Same lightness → same brightness across hues. Makes contrast math reliable.

```css
:root {
  --color-bg: oklch(99% 0.003 250);
  --color-fg: oklch(18% 0.012 250);
  --color-accent: oklch(62% 0.22 285);
}
```

Replaces `hex` / `rgb()` / `hsl()`. Support: Safari 15.4+, Chrome 111+, FF 113+ (universal since 2023). → [tokens.md](tokens.md#color)

## Logical properties

Replace physical `left`/`right` with logical `inline-start`/`inline-end`. RTL/vertical layouts work without rewriting.

| Old | New |
|---|---|
| `width` | `inline-size` |
| `height` | `block-size` |
| `padding-left` / `-right` | `padding-inline-start` / `-end` (or `padding-inline` for both) |
| `padding-top` / `-bottom` | `padding-block-start` / `-end` (or `padding-block`) |
| `margin-left` / `-right` | `margin-inline-start` / `-end` |
| `border-left` | `border-inline-start` |
| `text-align: left` | `text-align: start` |

```css
.card {
  inline-size: min(100%, 32rem);
  padding-inline: var(--space-6);
  padding-block: var(--space-4);
  border-inline-start: 2px solid var(--color-accent);
}
```

Support: universal since 2022.

## Container queries (`@container`)

Component-level breakpoints. Card adapts to the container it's placed in, not the viewport.

```css
.grid-container {
  container-type: inline-size;
  container-name: cards;
}

.card { display: grid; grid-template-columns: 1fr; }

@container cards (min-width: 32rem) {
  .card { grid-template-columns: 8rem 1fr; }   /* horizontal layout */
}
@container cards (min-width: 48rem) {
  .card { grid-template-columns: 12rem 1fr 8rem; }
}
```

Use container queries for **components**. Use viewport `@media` only for **page-level layout** (sidebar collapse, top-level grid changes).

Support: universal since Feb 2023.

## `:has()` parent / state selector

Style a parent based on its descendants. Replaces JS-driven state classes for simple cases.

```css
/* Card that contains an alert gets a warning border */
.card:has(.alert--warning) {
  border-color: var(--color-warning);
}

/* Form field whose input is invalid */
.field:has(:invalid:not(:placeholder-shown)) .field__label {
  color: var(--color-danger);
}

/* Body when a modal is open (modal has a class set by JS or just rendered) */
body:has(.modal[open]) { overflow: hidden; }
```

Support: universal since late 2023.

## `:where()` and `:is()`

`:where()` has **zero specificity**, perfect for base styles that components should override without effort.

```css
/* base.css */
:where(h1, h2, h3) {
  margin-block: 0;
  text-wrap: balance;
}
:where(a) {
  color: var(--color-accent);
  text-underline-offset: 0.15em;
}

/* Component overrides — wins automatically because :where() = specificity 0 */
.heading--display {
  font-size: var(--fs-4xl);
}
```

`:is()` keeps highest specificity in the list — useful for shorter selectors without specificity tricks.

Support: universal since 2022.

## Text wrapping

Modern text-wrap algorithms — replace manual `<br>` hacks.

```css
:where(h1, h2, h3, h4) {
  text-wrap: balance;   /* even line lengths in headings */
}
:where(p) {
  text-wrap: pretty;    /* avoids orphans / improves readability */
}
```

`balance` — Chrome 114+, FF 121+, Safari 17.5+. `pretty` — Chrome 117+, Safari 17.5+, FF 121+.

## Dynamic viewport units

`vh` is broken on mobile (doesn't account for browser chrome). Use:

| Unit | Meaning |
|---|---|
| `dvh` | dynamic viewport height — recalculates as chrome shows/hides |
| `svh` | small viewport (chrome visible, conservative) |
| `lvh` | large viewport (chrome hidden) |
| `dvw` / `svw` / `lvw` | same for width |

```css
.app { block-size: 100dvh; }            /* fullscreen, adapts to keyboard / URL bar */
.modal { max-block-size: 90svh; }        /* never clipped behind chrome */
```

Support: Safari 15.4+, Chrome 108+, FF 101+ (universal since 2022).

## `color-scheme`

Tells the browser to render system controls (scrollbars, form widgets) in light or dark style.

```css
:root { color-scheme: light dark; }   /* user-preference driven */
[data-theme="dark"] { color-scheme: dark; }
```

Pair with HTML:
```html
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)">
```

## `accent-color`

Native styling of checkboxes, radios, range inputs — no custom JS-driven components.

```css
:root { accent-color: var(--color-accent); }
```

Support: universal since 2022.

## View Transitions API

Animate same-document state changes (sidebar collapse, tab switch, content swap) with browser-native crossfade.

```js
function toggleSidebar() {
  if (!document.startViewTransition) {
    // Fallback: direct toggle, CSS transition does the rest
    app.dataset.collapsed = app.dataset.collapsed === 'true' ? 'false' : 'true';
    return;
  }
  document.startViewTransition(() => {
    app.dataset.collapsed = app.dataset.collapsed === 'true' ? 'false' : 'true';
  });
}
```

Customize the transition:

```css
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: var(--duration-normal);
}

::view-transition-new(root) {
  animation-timing-function: var(--ease-out);
}
```

Support: Chrome 111+, Safari 18+. **Always feature-detect** — Firefox not yet.

## `@scope`

Component-scoped styles without preprocessor — like Vue's `<style scoped>` but native.

```css
@scope (.card) {
  :scope { padding: var(--space-4); }
  .heading { font-size: var(--fs-lg); }   /* only inside .card */
  .body    { color: var(--color-fg-muted); }
}
```

Support: Chrome 118+, Safari 17.4+, FF behind flag → use with caution; in 2026 still safer to stick with BEM unless your audience is Chromium-only. Track support and migrate when FF ships.

## Container style queries (newer)

Query container's CSS variable, not just size.

```css
@container style(--app-tint: marketing) {
  .card__badge { color: var(--tint-marketing-fg); }
}
```

Support: Chrome 111+, partial elsewhere. Niche — only reach for it when style-driven variants get unwieldy.

## Anchor positioning (very new)

Position a popover relative to its trigger without JS.

```css
.menu {
  position: absolute;
  position-anchor: --menu-anchor;
  top: anchor(bottom);
  left: anchor(left);
}
.menu-trigger { anchor-name: --menu-anchor; }
```

Support: Chrome 125+, others trailing. Don't rely yet — use Floating UI or popover API for portability.

## `popover` attribute + Popover API

Native modal / dropdown without a backdrop hack.

```html
<button popovertarget="menu">Open</button>
<div id="menu" popover>
  <a href="#">Item 1</a>
</div>
```

Support: Chrome 114+, Safari 17+, FF 125+. Use for tooltips, dropdowns, simple modals. For complex modals, still consider `<dialog>`.

## `<dialog>` element

Native modal — full a11y, escape key, focus trap.

```html
<dialog id="confirm-dialog">
  <form method="dialog">
    <h3>Delete client?</h3>
    <button value="cancel">Cancel</button>
    <button value="confirm" class="button button--danger">Delete</button>
  </form>
</dialog>
```

```js
document.getElementById('confirm-dialog').showModal();
```

CSS for backdrop:

```css
dialog::backdrop {
  background: oklch(0% 0 0 / 0.5);
  backdrop-filter: blur(4px);
}
```

Support: universal since 2022.

## Tokenized animations via grid

Animate from `max-height: 0` is fragile (need exact height). Modern trick — grid template rows from `0fr` to `1fr`:

```css
.expandable {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--duration-normal) var(--ease-out);
}
.expandable[data-open="true"] {
  grid-template-rows: 1fr;
}
.expandable__content {
  overflow: hidden;
}
```

Smooth, content-driven, no JS measurement. Support: universal (Chrome 117+, all majors).

## Quick capabilities summary

| Pattern | Replaces | Browser cutoff |
|---|---|---|
| `@layer` | `!important`, specificity wars | 2022 |
| OKLCH | hex/rgb/hsl | 2023 |
| Logical props | `width/left/top` | 2022 |
| Container queries | viewport `@media` for components | Feb 2023 |
| `:has()` | JS state classes | Late 2023 |
| `:where()` | specificity hacks for base | 2022 |
| `text-wrap: balance/pretty` | manual `<br>` | 2023-24 |
| `100dvh` | `100vh` (broken on mobile) | 2022 |
| `color-scheme` | none (was always missing) | 2022 |
| `accent-color` | custom-styled checkboxes | 2022 |
| View Transitions | hand-rolled crossfade | Chrome 111+, Safari 18 |
| Popover API | overlay+modal libs for simple cases | Chrome 114, Safari 17, FF 125 |
| `<dialog>` | modal library | 2022 |
| Grid `0fr → 1fr` animation | `max-height` hacks | Chrome 117+ |

If a browser support window doesn't match your audience — add a feature query:

```css
@supports (text-wrap: balance) {
  h1 { text-wrap: balance; }
}
```
