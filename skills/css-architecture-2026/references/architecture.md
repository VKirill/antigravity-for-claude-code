# Architecture

ITCSS-style layering wrapped in modern `@layer` cascade. The goal: utilities always beat components, components never need `!important`, refactors don't break specificity.

## File layout

```
css/
  index.css              # Entry: @layer order + @import per file
  tokens.css             # CSS custom properties (single source of truth)
  base.css               # Reset + element defaults via :where()
  utilities.css          # Atomic helpers (.sr-only, .stack, .cluster, .visually-hidden)
  layout/
    app.css              # Root grid (sidebar | topbar | main)
    sidebar.css
    topbar.css
  components/
    button.css           # One file = one BEM block
    card.css
    form.css
    select.css
    badge.css
    alert.css
    table.css
    nav.css
    feedback.css
  themes/
    app-tints.css        # [data-app-tint] mapping
    brand-variants.css   # optional
  pages/
    brandbook.css        # page-specific (rare; prefer components)
```

## Entry point: index.css

The only file linked from HTML. Bundlers (Vite/PostCSS/esbuild) inline the `@import` chain in production.

```css
/* Layer order — utilities last, so they always win */
@layer reset, tokens, base, layout, components, utilities;

@import "tokens.css"                  layer(tokens);
@import "base.css"                    layer(base);

@import "layout/app.css"              layer(layout);
@import "layout/sidebar.css"          layer(layout);
@import "layout/topbar.css"           layer(layout);

@import "themes/app-tints.css"        layer(layout);

@import "components/button.css"       layer(components);
@import "components/card.css"         layer(components);
@import "components/form.css"         layer(components);
/* ...other components alphabetical... */

@import "utilities.css"               layer(utilities);
```

### Layer rules

- Layers declared earlier in the `@layer reset, tokens, base, ...` line have LOWER priority
- `utilities` is last → ALWAYS wins over components (no `!important` needed for `.hidden` to hide a `.button`)
- `reset` is declared but may be empty if your reset lives inside `base.css` — then drop `reset` from the list to keep the declaration honest

### Anti-pattern: relying on file load order

❌ `<link rel="stylesheet" href="button.css"><link rel="stylesheet" href="utilities.css">` (no `@layer`) — utilities win only by source order, fragile across refactors.

✅ `@layer` declared explicitly — wins by layer, not by order.

## BEM rules

### Block

The component root. **One file = one block.**

```css
.button { /* root */ }
```

### Element

Internal part. Always namespaced under the block.

```css
.button__icon { }   /* ✅ */
.icon { }           /* ❌ leaks to other components */
```

### Modifier

Variants and states. **Two dashes**, not single.

```css
.button--primary { }
.button--sm { }
.button--loading { }
```

### Selector rules

- ✅ Max depth: one level — block + state pseudo (`:hover`, `:focus-visible`, `:disabled`, `[aria-*]`)
- ❌ No tag selectors inside components — `.card p { ... }` is wrong; use `.card__body p` or just `.card__paragraph`
- ❌ No descendant chaining — `.sidebar .nav .item a` is wrong; flatten to BEM
- ❌ No CSS nesting (`&`) inside components — keeps the AST shallow, simplifies migration

```css
/* ✅ Right */
.button { background: var(--btn-bg); }
.button:hover { background: var(--btn-bg-hover); }
.button:focus-visible { outline: 2px solid var(--color-accent); }
.button--primary { --btn-bg: var(--color-accent); }
.button__icon { inline-size: var(--space-4); }

/* ❌ Wrong */
.button {
  background: var(--btn-bg);
  &:hover { background: var(--btn-bg-hover); }   /* don't nest */
  .icon { width: 16px; }                          /* don't descendant + tag */
}
```

### Why BEM survives migration

When the project moves to React/Vue:

```jsx
// React component maps 1:1 to BEM
<button className={`button button--${variant} button--${size}`}>
  <span className="button__icon">{icon}</span>
  {children}
</button>
```

```vue
<!-- Vue equivalent -->
<button :class="['button', `button--${variant}`, `button--${size}`]">
  <span class="button__icon"><component :is="icon" /></span>
  <slot />
</button>
```

If you'd written `.btn .icon`, this wouldn't translate — the `.icon` would have to live in some other component, leading to global leak.

## Data-attribute theming

For app/brand variants, **never** inline `style="--var: ..."` in HTML. Use `data-*` and map in CSS.

```html
<!-- ✅ Right -->
<article class="card card--app" data-app-tint="marketing">
<article class="card card--app" data-app-tint="writer">

<!-- ❌ Wrong -->
<article class="card card--app" style="--card-bg: var(--tint-marketing-bg); --card-fg: var(--tint-marketing-fg);">
```

```css
/* themes/app-tints.css */
[data-app-tint="marketing"] {
  --card-bg:   var(--tint-marketing-bg);
  --card-fg:   var(--tint-marketing-fg);
  --card-glow: var(--tint-marketing-glow);
}
[data-app-tint="writer"]  { /* ... */ }
[data-app-tint="factory"] { /* ... */ }
```

Why: when migrating to React you can write `<Card appTint="marketing">` and the attribute mapping is server-rendered without inline style objects.

## Bundling

`@import` chains are convenient for dev but trigger **request waterfall** in production: browser loads `index.css`, parses, sees `@import`, loads next, parses, sees next... blocking First Contentful Paint by 200-500ms on slow connections.

Production must bundle:

| Bundler | How |
|---|---|
| Vite | Out of the box — `import "./index.css"` from JS entry; Vite inlines all imports + minifies |
| PostCSS | Use `postcss-import` plugin |
| esbuild | `--bundle --loader:.css=css` |
| Webpack | `css-loader` + `mini-css-extract-plugin` |

Dev: leave `@import` chain — browser caches files individually for fast HMR. Prod: bundled `app.min.css` is the only stylesheet shipped.

## Decision tree: when each layer applies

```
What kind of CSS am I writing?
│
├─ Reset / normalize browser defaults?
│  → `reset` layer (or fold into `base.css` and drop `reset` from @layer)
│
├─ A CSS variable / token?
│  → tokens.css → `tokens` layer
│
├─ Default styling of an HTML element (body, h1, a, code)?
│  → base.css → `base` layer. Use `:where()` to keep specificity 0.
│
├─ Page-level structure (grid for app, header, footer)?
│  → layout/* → `layout` layer
│
├─ A reusable component (button, card, form)?
│  → components/<block>.css → `components` layer
│
├─ Theme variant (brand colors, app tint)?
│  → themes/* → `layout` layer (themes need to win over base but lose to components)
│
└─ An atomic utility (.sr-only, .hidden, .stack)?
   → utilities.css → `utilities` layer
```

## Anti-patterns reference

| Pattern | Why bad | Replace with |
|---|---|---|
| Tag selectors inside components | Leak across blocks; fragile after migration | BEM elements |
| Nested selectors `.a .b` deeper than 1 level | Specificity wars | Flat BEM |
| `!important` to override component from utility | Layers already do this | `@layer` order |
| `style="..."` for theming | Doesn't reach utilities, hard to override | `data-*` attributes |
| Hardcoded `oklch(...)` / `#xxx` in components | Multi-source-of-truth, painful to rebrand | Tokens |
| 18 `<link>` tags in HTML | Request waterfall | One `index.css` entry, bundled |
| `@import` in production | Same waterfall, blocking FCP | Bundle inline via Vite/PostCSS |
| CSS nesting `& { ... }` | Adds depth that React/Vue refactor breaks | Flat selectors |
