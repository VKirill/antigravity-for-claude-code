# tailwind — Reference Index

Tailwind CSS 4.3 knowledge base. Use this as a routing map — open only the file you need.

## Decision map

| Situation | Open this file |
|---|---|
| Setting up Tailwind 4 from scratch in a Vite/Next/Nuxt project | [config-css-first.md](config-css-first.md) |
| Defining custom colors, fonts, spacing, or dark mode tokens | [theme-and-tokens.md](theme-and-tokens.md) |
| Using `has-*`, `not-*`, `starting:`, `@utility`, `@variant` | [variants.md](variants.md) |
| Building a component that responds to its container size | [container-queries.md](container-queries.md) |
| Wiring up `cn()`, shadcn/ui, or React component class composition | [integration-with-react.md](integration-with-react.md) |
| Upgrading an existing Tailwind 3 project to Tailwind 4 | [migration-3-to-4.md](migration-3-to-4.md) |
| Testing whether this skill routes correctly | [eval-cases.md](eval-cases.md) |

## Quick-lookup: most common patterns

### Setup (Vite)
```bash
npm install tailwindcss @tailwindcss/vite
```
```ts
// vite.config.ts
import tailwindcss from "@tailwindcss/vite";
export default { plugins: [tailwindcss()] };
```
```css
/* src/globals.css */
@import "tailwindcss";
```

### Setup (PostCSS — legacy)
```bash
npm install tailwindcss @tailwindcss/postcss
```
```js
// postcss.config.mjs
export default { plugins: { "@tailwindcss/postcss": {} } };
```

### Custom token (theme)
```css
@theme {
  --color-brand-500: oklch(60% 0.20 250);
  --font-display: "Inter", sans-serif;
}
/* → generates: text-brand-500, bg-brand-500, font-display */
```

### cn() helper
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
```

### Dark mode (CSS-only)
```css
@custom-variant dark (&:where(.dark, .dark *));   /* class strategy */
/* or use @media (prefers-color-scheme: dark) */
```

### Container query
```html
<div class="@container">
  <div class="@sm:grid-cols-2 @lg:grid-cols-4">…</div>
</div>
```

## What's new in Tailwind 4 vs 3

| Change | v3 | v4 |
|---|---|---|
| Configuration | `tailwind.config.js` | `@theme` in CSS |
| Plugin setup | `plugin(fn)` in config | `@utility` + `@variant` in CSS |
| Content scanning | `content: ['./src/**']` | Automatic (Vite plugin) |
| Dark mode | `darkMode: 'class'` config | `@custom-variant dark` or `@media` |
| Container queries | `@tailwindcss/container-queries` plugin | Built in |
| Entry point | `@tailwind base/components/utilities` | `@import "tailwindcss"` |
| Color space | sRGB hex | oklch |
