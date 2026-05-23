---
name: css-architecture-2026
description: "CSS architecture for vanilla HTML/CSS pre-framework — ITCSS-style tokens, BEM, OKLCH, @layer cascade layers, logical properties, container queries, View Transitions API, dvh/svh, prefers-color-scheme, WCAG 2.2 a11y. Use when: vanilla HTML+CSS, design system, tokens.css, BEM, kitchen-sink, brandbook, верстка, design tokens, dark mode, dashboard layout, CRM admin. SKIP: Tailwind (→tailwind), shadcn (→shadcn), framework scoped styles (→react/vue/nuxt), CSS-in-JS, styled-components."
tags: [css, html, design-system, tokens, bem, a11y, vanilla, frontend]
---

## Usage

Loaded automatically when the user works with vanilla HTML/CSS — pre-framework projects, brandbooks, kitchen-sink demos, dashboards, landings without a UI library. For Tailwind use the `tailwind` skill; for shadcn use `shadcn`; for framework-scoped styles use the relevant framework skill.

## Purpose

Most LLM-generated CSS skips the architecture and dives straight into hex colors, hand-written `style="..."`, single-file HTML+CSS, `100vh`, and `gray-700` token names. This skill encodes the patterns that separate a "works" frontend from a 2026 production-grade one: cascade layers, perceptual color (OKLCH), single-source-of-truth tokens, BEM with flat selectors, container queries instead of viewport-only media, View Transitions, full a11y baseline, and a clean migration path to React/Vue when the time comes. The user pays the cost of these patterns once, in the foundation, and never pays it again when the project grows.

## Use this skill when

- Building vanilla HTML/CSS — CRM admin, dashboard, landing, brandbook, kitchen-sink, before a framework choice
- Authoring a design system / tokens file from scratch
- Refactoring a project that has hardcoded colors / hex everywhere / inline styles / global !important
- Migrating CSS architecture (e.g. flat → ITCSS, hex → OKLCH, viewport queries → container queries)
- Designing the `@layer` order, deciding what goes in `reset/tokens/base/layout/components/utilities`
- Writing accessibility baseline (skip-link, focus-visible, prefers-reduced-motion, prefers-color-scheme)
- Preparing CSS for eventual migration into React / Vue / Astro / Nuxt
- Reviewing AI-generated CSS for 2026 best practices

## Do not use this skill when

- The project already uses Tailwind utility-first → use `tailwind`
- The project uses shadcn/ui Radix components → use `shadcn`
- Styles are framework-scoped (Vue SFC `<style scoped>`, React CSS Modules, Astro `<style>`) → use the framework skill
- CSS-in-JS (styled-components, Emotion, vanilla-extract) is the chosen approach — different paradigm
- The user wants design *ideas* (palettes, fonts, layouts) rather than code → use `ui-ux-pro-max` or `lazyweb:*` skills

## Capabilities

### Architecture: ITCSS + Cascade Layers

The default file layout for non-trivial projects. Layers ensure utilities always win and components never need `!important`:

```
css/
  index.css                    # entry: @layer order + @import per file
  tokens.css                   # CSS custom properties (single source of truth)
  base.css                     # reset + element defaults via :where()
  utilities.css                # atomic helpers (.sr-only, .stack, .cluster)
  layout/                      # page-level structure (app, sidebar, topbar)
  components/                  # reusable BEM blocks (button, card, form, ...)
  themes/                      # data-attribute themes (app-tints, brand variants)
```

Entry-point pattern (`index.css`):

```css
@layer reset, tokens, base, layout, components, utilities;

@import "tokens.css"               layer(tokens);
@import "base.css"                 layer(base);
@import "layout/app.css"           layer(layout);
@import "components/button.css"    layer(components);
@import "utilities.css"            layer(utilities);
```

Order: `reset → tokens → base → layout → components → utilities`. Specificity inside a layer is normal; specificity *across* layers is overridden by layer order. Utilities last → always win.

→ Deep dive: [references/architecture.md](references/architecture.md)

### Design tokens (single source of truth)

All visual values live in `tokens.css` as CSS custom properties. No hardcoded color/size in components — ever. Token naming is **semantic**, not literal:

- ✅ `--color-fg-hover`, `--color-border-hover`, `--space-4`, `--fs-base`, `--radius-card`
- ❌ `--gray-700`, `--blue-500`, `--space-16px`, `--font-14`

Colors use OKLCH (perceptually uniform, supported everywhere since 2023):

```css
--color-bg: oklch(99% 0.003 250);
--color-fg: oklch(18% 0.012 250);
--color-accent: oklch(62% 0.22 285);
```

Theming via `[data-theme="dark"]` on `:root` and/or `@media (prefers-color-scheme: dark)`. Brand/app variants via `[data-app-tint="marketing"]` on the element.

→ Deep dive: [references/tokens.md](references/tokens.md)

### BEM with flat selectors

Naming convention that survives migration to component frameworks unchanged:

- `.block` — the component root
- `.block__element` — internal part (always nested under block)
- `.block--modifier` — variant (e.g. `--primary`, `--sm`)

Rules:
- One file = one block = one BEM root
- No tag selectors inside components (no `.card a { ... }`)
- No nesting deeper than one level (state pseudos like `:hover`, `:focus-visible` excepted)
- No global overrides from inside a component file

When the project migrates to React/Vue, BEM class names map 1:1 to component props (`variant="primary"` → `.button--primary`).

→ Deep dive: [references/architecture.md](references/architecture.md#bem-rules)

### Modern CSS features (must-use in 2026)

Features below have universal browser support and replace older patterns:

| Feature | Replaces | Browser since |
|---|---|---|
| `oklch()` | `hex`, `rgb()`, `hsl()` | 2023 (all majors) |
| `@layer` cascade layers | `!important`, BEM-only specificity wars | 2022 |
| Logical properties (`inline-size`, `padding-inline`) | `width`, `padding-left/right` | 2022 |
| Container queries (`@container`) | viewport `@media` for component-level | 2023 |
| `:has()` | JS-based state classes | 2023 |
| `:where()` / `:is()` | specificity hacks | 2022 |
| `text-wrap: balance` / `pretty` | manual `<br>` in headings | 2023-24 |
| `100dvh` / `100svh` | `100vh` (broken on mobile) | 2022 |
| `color-scheme` | `<meta name="theme-color">` only | 2022 |
| View Transitions API (`document.startViewTransition`) | CSS `transition` for state swaps | Chrome 111+, Safari 18 |
| `accent-color` | custom checkbox/radio styling | 2022 |

→ Deep dive: [references/modern-features-2026.md](references/modern-features-2026.md)

### Accessibility baseline (WCAG 2.2 AA)

Non-negotiable on every project:

- Skip-link as first focusable element (`<a href="#main" class="skip-link">Skip to content</a>`)
- `:focus-visible` styles on everything keyboard-navigable (NEVER `outline: none` without replacement)
- `@media (prefers-reduced-motion: reduce)` zeroes animation durations
- `@media (prefers-color-scheme: dark)` activates dark theme automatically
- Color contrast ≥ 4.5:1 for normal text, ≥ 3:1 for large/UI (use OKLCH lightness math)
- All interactive elements have hover + focus + active + disabled states
- Keyboard shortcuts check `e.target.matches('input, textarea, [contenteditable]')` before `preventDefault`

→ Deep dive: [references/accessibility.md](references/accessibility.md)

### Migration to framework

Vanilla CSS architecture is a stepping stone to React / Vue / Astro / Nuxt. What transfers vs. what re-shapes:

| Layer | Transfer | Reshapes |
|---|---|---|
| `tokens.css` | ✅ as-is (or → Tailwind config / theme provider) | — |
| `base.css` | ✅ as global stylesheet | — |
| `utilities.css` | ✅ as global stylesheet | — |
| `layout/*` | Reshapes | → layout components (`<Sidebar>`, `<Topbar>`) |
| `components/*` | Reshapes | → co-located with component file (`Button.tsx` + `Button.module.css`) |
| `themes/*` (data-attributes) | ✅ as-is | — |

Plan the migration when writing the original CSS — flat BEM selectors and no nesting make this painless.

→ Deep dive: [references/migration-to-framework.md](references/migration-to-framework.md)

### Kitchen-sink pattern

A `kitchen-sink.html` page that renders every component in every state for visual QA. Built once, used forever. After framework migration it becomes a Storybook page.

→ Deep dive: [references/kitchen-sink.md](references/kitchen-sink.md)

## Behavioral Traits

- Treats `tokens.css` as the single source of truth — flags any hardcoded color/size in components
- Always declares `@layer` order at the top of the entry CSS — never relies on file load order alone
- Uses OKLCH for new colors; converts hex to OKLCH when refactoring (mentions perceptual lightness)
- Writes one BEM block per file; refuses to write nested selectors deeper than one level
- Defaults to `dvh`/`svh` instead of `vh`; flags `100vh` on the project
- Adds `:focus-visible` styles whenever it adds `:hover`
- Adds `@media (prefers-reduced-motion: reduce)` block in every animation file
- Adds `@media (prefers-color-scheme: dark)` whenever `[data-theme="dark"]` exists
- Prefers container queries over viewport media queries for component-level breakpoints
- Calls out `@import` waterfall and recommends bundling (Vite/PostCSS) before production
- Never inlines `style="--var: ..."` for theming — uses `data-*` attributes + CSS selector mapping
- Plans for migration: flat selectors, isolated components, no global overrides from inside `components/`

## Important Constraints

- NEVER write hex/rgb color values outside `tokens.css` — they MUST be tokenized
- NEVER use selector nesting deeper than one level (state pseudos excepted)
- NEVER use tag selectors inside component files (`.card p { ... }` is wrong)
- NEVER use `100vh` for fullscreen layouts — use `100dvh` (or `100svh` for keyboard avoidance)
- NEVER use `!important` outside utility classes (and even there only when truly necessary — layers usually fix it)
- NEVER attach `outline: none` without an equivalent `:focus-visible` replacement
- NEVER ship `@import` chains as the production CSS — bundle through Vite/PostCSS
- ALWAYS declare `@layer` order before any `@import`
- ALWAYS check `e.target.matches('input, textarea, [contenteditable]')` before `preventDefault` in keyboard shortcuts
- ALWAYS pair `[data-theme="dark"]` with `@media (prefers-color-scheme: dark)` fallback

## Related Skills

### Frontmost layer (paired skills)
- ✓ `tailwind` — utility-first alternative; use when project commits to Tailwind upfront
- ✓ `shadcn` — Radix + Tailwind component library
- ✓ `ui-ux-pro-max` — design intelligence (palettes, typography, UX patterns) — for design ideas, not CSS code
- ✓ `react-hook-form` — form library; pair with form component patterns from this skill

### Frameworks (the migration target)
- ✓ `react` — component composition + CSS Modules / co-located styles
- ✓ `vue` — SFC with `<style scoped>`
- ✓ `astro` — content-first; `<style>` tags + global stylesheets
- ✓ `nextjs` — App Router + CSS Modules or Tailwind
- ✓ `nuxt` — Vue meta-framework with auto-imported global styles

### Tooling for visual / a11y QA
- ✓ `playwright` — visual regression snapshots
- (chrome-devtools MCP) — `take_screenshot`, `lighthouse_audit` for live page audit

## API Reference

| Topic | File |
|---|---|
| Index of references — when to open which | [references/REFERENCE.md](references/REFERENCE.md) |
| ITCSS layering, @layer order, BEM rules, file organization | [references/architecture.md](references/architecture.md) |
| Token naming, OKLCH primer, scales (color/space/typography/radius), no-hardcode rule | [references/tokens.md](references/tokens.md) |
| Modern CSS features with browser support — container queries, View Transitions, :has, logical properties, dvh | [references/modern-features-2026.md](references/modern-features-2026.md) |
| WCAG 2.2 baseline — skip-link, focus-visible, prefers-reduced-motion, keyboard shortcuts safety | [references/accessibility.md](references/accessibility.md) |
| Vanilla → React / Vue / Astro / Nuxt — what transfers, what reshapes | [references/migration-to-framework.md](references/migration-to-framework.md) |
| Kitchen-sink demo page — every component in every state for visual QA | [references/kitchen-sink.md](references/kitchen-sink.md) |

## Examples

| Scenario | File |
|---|---|
| Brandbook authoring prompt (tested, two-stage: proposals → implementation) | [examples/brandbook-prompt.md](examples/brandbook-prompt.md) |
