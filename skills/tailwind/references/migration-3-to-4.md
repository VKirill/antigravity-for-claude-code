# Tailwind 4 — Migration from v3

## Automated upgrade

Tailwind ships an upgrade tool that handles most mechanical changes:

```bash
npx @tailwindcss/upgrade@latest
```

This tool:
- Moves config from `tailwind.config.js` to CSS `@theme` tokens
- Updates `@tailwind base/components/utilities` → `@import "tailwindcss"`
- Updates PostCSS config
- Handles most renamed utilities

Run the tool first, then fix any remaining manual items from this guide.

---

## Breaking changes at a glance

| Category | v3 | v4 |
|---|---|---|
| Config file | `tailwind.config.js` | `@theme` in CSS (no config file) |
| Entry CSS | `@tailwind base;` etc. | `@import "tailwindcss";` |
| Content scanning | `content: ['./src/**']` | Automatic |
| Theme extend | `theme.extend.colors.brand: {}` | `@theme { --color-brand-500: ... }` |
| Dark mode config | `darkMode: 'class'` | `@custom-variant dark (&:where(.dark, .dark *))` |
| Custom plugins | `plugin(({ addUtilities })` | `@utility` + `@variant` |
| Prefix | `prefix: 'tw-'` | `@import "tailwindcss" prefix(tw)` |
| Container queries | `@tailwindcss/container-queries` plugin | Built-in |
| Typography plugin | `@tailwindcss/typography` in config | `@plugin "@tailwindcss/typography"` |
| Forms plugin | `@tailwindcss/forms` in config | `@plugin "@tailwindcss/forms"` |

---

## Step-by-step manual migration

### 1. Install new packages

```bash
# Remove v3
npm uninstall tailwindcss postcss autoprefixer

# Install v4
npm install tailwindcss @tailwindcss/vite
# Or for PostCSS:
npm install tailwindcss @tailwindcss/postcss
```

### 2. Update CSS entry point

```css
/* Before (v3) */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* After (v4) */
@import "tailwindcss";
```

### 3. Replace tailwind.config.js

```js
// v3 tailwind.config.js — DELETE this file
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          500: '#3b82f6',
          900: '#1e3a8a',
        }
      },
      fontFamily: {
        display: ['Cal Sans', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        card: '0.75rem',
      }
    }
  },
  plugins: [
    require('@tailwindcss/typography'),
  ]
};
```

```css
/* v4 globals.css — replaces the entire config */
@import "tailwindcss";
@plugin "@tailwindcss/typography";

@theme {
  --color-brand-50:  oklch(97% 0.02 220);
  --color-brand-500: oklch(55% 0.22 220);
  --color-brand-900: oklch(22% 0.10 220);

  --font-display: "Cal Sans", "Inter", sans-serif;

  --radius-card: 0.75rem;
}

@custom-variant dark (&:where(.dark, .dark *));
```

### 4. Update PostCSS config

```js
// v3 postcss.config.js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}

// v4 postcss.config.mjs
export default {
  plugins: {
    "@tailwindcss/postcss": {},
    // autoprefixer removed — v4 handles it internally
  },
};
```

Or switch to Vite plugin (preferred, see config-css-first.md).

---

## Renamed utilities in v4

Most utilities are unchanged. Notable renames:

| v3 | v4 |
|---|---|
| `shadow-sm` | `shadow-xs` |
| `shadow` | `shadow-sm` |
| `shadow-md` | `shadow-md` (unchanged) |
| `ring-3` | `ring-[3px]` (arbitrary) |
| `blur` | `blur-sm` |
| `drop-shadow` | `drop-shadow-sm` |
| `grow` | `grow` (unchanged) |
| `flex-grow` | `grow` (deprecated alias) |
| `overflow-ellipsis` | `text-ellipsis` |
| `decoration-clone` | `box-decoration-clone` |
| `decoration-slice` | `box-decoration-slice` |

---

## Dark mode migration

```css
/* v3 — was config option */
// tailwind.config.js: darkMode: 'class'

/* v4 — declare as @custom-variant in CSS */
@custom-variant dark (&:where(.dark, .dark *));
```

If you used `darkMode: 'media'` (system preference):
```css
/* v4 — system preference is the default for @media-based dark */
/* No @variant needed — use @media (prefers-color-scheme: dark) directly */
@layer base {
  @media (prefers-color-scheme: dark) {
    :root {
      --color-background: oklch(10% 0 0);
      --color-foreground: oklch(98% 0 0);
    }
  }
}
```

---

## Plugin migration

```js
// v3 plugin
const plugin = require('tailwindcss/plugin');
module.exports = {
  plugins: [
    plugin(({ addUtilities, addVariant }) => {
      addUtilities({
        '.scrollbar-hide': {
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }
      });
      addVariant('hocus', ['&:hover', '&:focus']);
    })
  ]
};
```

```css
/* v4 — in your CSS file */
@utility scrollbar-hide {
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

@variant hocus (&:hover, &:focus);
```

---

## Upgrade gotchas

- **`@apply` with custom classes**: still works, but custom utilities must be defined with `@utility` before being used in `@apply`
- **JIT-only**: v4 has no `mode: 'jit'` toggle — it's always JIT. Remove any `mode: 'jit'` from old config
- **`safelist`**: use `@source inline(...)` instead of `safelist: [...]`
- **`separator`**: the `:` separator is hardcoded in v4 — custom separators are not supported
- **`corePlugins.preflight: false`**: use `@import "tailwindcss/utilities"` (skip preflight import)
- **`important: true`**: not directly supported; use `@layer utilities { @utility ... { !important } }`
- **Removed: `flex-grow`, `flex-shrink`**: use `grow`, `shrink` (were deprecated aliases in v3)
