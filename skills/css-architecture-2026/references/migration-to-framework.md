# Migrating vanilla CSS to React / Vue / Astro / Nuxt

The vanilla CSS architecture in this skill is designed for **eventual** migration to a framework. Plan the migration from day one — flat BEM + isolated components make it painless.

## What transfers as-is

| Asset | New home |
|---|---|
| `tokens.css` | Global stylesheet imported once at app root |
| `base.css` | Same |
| `utilities.css` | Same |
| `themes/*.css` (data-attribute themes) | Same |
| BEM class names | Become component props 1:1 |

These four files load once at the app root and never get touched again per component.

## What reshapes

| Vanilla | Framework |
|---|---|
| `components/button.css` standalone | Co-located with component: `Button.tsx` + `Button.module.css` |
| `layout/sidebar.css` standalone | `<Sidebar>` component with its own scoped styles |
| BEM classes string in HTML | Mapped from component props |
| Inline `<script>` for interactivity | Moved into component logic (hooks / composables) |
| `kitchen-sink.html` | Storybook (or Histoire / Ladle) |

## Pre-migration checklist

Before starting migration, verify the vanilla project:

- [ ] No hardcoded colors in components — everything goes through `tokens.css`
- [ ] No nested selectors deeper than one level
- [ ] No tag selectors inside component files (no `.card p { ... }`)
- [ ] BEM naming is consistent (`block__element--modifier`)
- [ ] `@layer` order declared in entry CSS
- [ ] No inline `style="..."` for theming — uses `data-*` attributes
- [ ] All `@import` chains will be bundled by the new framework's tooling

If any fails — fix in vanilla first. Migrating broken CSS to a framework just spreads the broken state across more files.

## React (CSS Modules approach)

### Folder per component

```
src/components/Button/
  Button.tsx
  Button.module.css     # ex-components/button.css, slightly reshaped
  Button.stories.tsx    # ex kitchen-sink slice
  index.ts
```

### Class names in JSX

```tsx
// Button.tsx
import styles from './Button.module.css';

type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
};

export function Button({ variant = 'primary', size = 'md', loading, children }: ButtonProps) {
  const classes = [
    styles.button,
    styles[`button--${variant}`],
    styles[`button--${size}`],
    loading && styles['button--loading'],
  ].filter(Boolean).join(' ');

  return <button className={classes}>{children}</button>;
}
```

### CSS Module file

`button.css` → `Button.module.css`. Content nearly identical. CSS Modules scope class names automatically — `styles.button` becomes `_Button_button__abc123` at build time, preventing global leaks.

```css
/* Button.module.css */
.button {
  display: inline-grid;
  place-items: center;
  padding-inline: var(--space-4);
  padding-block: var(--space-2);
  border-radius: var(--radius-md);
  font-size: var(--fs-base);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out);
}
.button:hover { background: var(--color-fg-hover); }
.button:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
.button--primary { background: var(--color-accent); color: var(--color-accent-fg); }
.button--primary:hover { background: var(--color-accent-hover); }
/* ...other variants/sizes... */
```

Tokens (`var(--space-4)`, `var(--color-accent)`) still resolve — they come from the global `tokens.css` imported at the app root.

### Helper: `clsx`

For complex conditional classes, use `clsx` or `classnames`:

```tsx
import clsx from 'clsx';

<button className={clsx(
  styles.button,
  styles[`button--${variant}`],
  loading && styles['button--loading'],
  disabled && styles['button--disabled'],
)}>
```

## Vue (SFC `<style scoped>`)

### Component file

```vue
<!-- Button.vue -->
<script setup lang="ts">
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';
const props = defineProps<{ variant?: Variant; size?: Size; loading?: boolean }>();
</script>

<template>
  <button
    :class="[
      'button',
      `button--${props.variant ?? 'primary'}`,
      `button--${props.size ?? 'md'}`,
      props.loading && 'button--loading',
    ]"
  >
    <slot />
  </button>
</template>

<style scoped>
.button {
  display: inline-grid;
  place-items: center;
  padding-inline: var(--space-4);
  padding-block: var(--space-2);
  /* ... */
}
.button--primary {
  background: var(--color-accent);
  color: var(--color-accent-fg);
}
/* ... */
</style>
```

`scoped` adds a unique data attribute to selectors, achieving the same isolation as React's CSS Modules.

## Astro

Astro is the lightest migration target — `.astro` files have a `<style>` block that gets scoped per component.

```astro
---
// Button.astro
interface Props {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}
const { variant = 'primary', size = 'md' } = Astro.props;
---

<button class:list={['button', `button--${variant}`, `button--${size}`]}>
  <slot />
</button>

<style>
  .button {
    display: inline-grid;
    place-items: center;
    /* ... */
  }
</style>
```

Astro's `class:list` directive handles conditional class joining cleanly.

Global tokens — `src/styles/global.css` imported in the layout:

```astro
---
// Layout.astro
import '../styles/global.css';  // imports tokens.css, base.css, utilities.css
---
```

## Nuxt 4

Same as Vue, but global styles go through Nuxt's config:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  css: ['~/assets/css/tokens.css', '~/assets/css/base.css', '~/assets/css/utilities.css'],
});
```

Components in `app/components/` get SFC scoped styles.

## Next.js (App Router)

CSS Modules supported out of the box.

```tsx
// app/_components/Button/Button.tsx
import styles from './Button.module.css';
// (same pattern as React above)
```

Global tokens in `app/globals.css` imported in `app/layout.tsx`.

## Migration order

Do not migrate everything at once. Recommended sequence:

1. **Tokens** — copy `tokens.css` to the framework's global styles slot. Verify dark mode still works.
2. **Base + utilities** — same.
3. **Layout components first** — `<App>`, `<Sidebar>`, `<Topbar>`. These are structural; if they break, the page breaks.
4. **One leaf component** — pick `<Button>` (simplest). Migrate, verify, ship.
5. **Iterate** — one component per session. Pause to verify visual parity after each.

For each leaf:
- Copy CSS to `Component.module.css` (React) / `<style scoped>` (Vue/Astro)
- Map BEM modifiers to props
- Move per-state logic to JS (hover/focus still in CSS; click handlers, ARIA toggles to JS)
- Add Storybook entry (becomes the new kitchen-sink slice)

## What to delete after migration

- `kitchen-sink.html` — replaced by Storybook
- `index.html` (vanilla) — framework owns the entry point
- `layout/*.css` — moved into layout components
- `components/*.css` — moved into component folders
- Inline `<script>` — moved into component logic

Keep:

- `tokens.css`, `base.css`, `utilities.css`, `themes/*.css` as global stylesheets

## Common pitfalls

| Pitfall | Fix |
|---|---|
| Tokens not resolving in `Component.module.css` | Verify global stylesheet imports `tokens.css` |
| `:focus-visible` ring is gone after migration | CSS Modules don't scope `:focus-visible` itself; check the rule selects `.button:focus-visible` not `*:focus-visible` |
| Dark mode breaks | Verify `[data-theme="dark"]` selector is on `<html>` or `<body>`, accessible to scoped modules |
| BEM modifier class is `button--primary` but JS produces `buttonPrimary` | CSS Modules camelCase config — keep BEM exactly, use bracket syntax: `styles['button--primary']` |
| Component looks different after migration | Specificity changed via scoping; check the cascade layer is still `components`, not unscoped |

## When to use Tailwind instead

If your project will start in a framework (React/Vue/Nuxt) and never have a vanilla phase — Tailwind is usually faster than this vanilla architecture. Use the `tailwind` skill.

This skill (vanilla CSS) shines when:
- You don't know which framework yet
- You're building a brandbook / kitchen-sink as a design artifact
- The project lives as static HTML for a while (landing, brochure, brandbook)
- The team prefers CSS-first over utility-first

When you commit to a framework + Tailwind — migration is still useful for tokens, but components rewrite to Tailwind utilities.
