# Tailwind 4 — CSS-First Configuration

## The core shift

Tailwind 4 has no `tailwind.config.js`. The CSS file is the single source of truth:

```css
/* src/globals.css — the entire Tailwind setup */
@import "tailwindcss";

@theme {
  /* your custom tokens here */
}

@layer base, components, utilities;
```

The Vite plugin or PostCSS plugin reads this file, detects `@import "tailwindcss"`, and processes it. Content detection is automatic — no `content: ['./src/**']` array.

---

## Installation paths

### Path A — Vite plugin (Vite, Next.js 15+, Nuxt 4, Astro 6)

```bash
npm install tailwindcss @tailwindcss/vite
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
});
```

```css
/* src/globals.css */
@import "tailwindcss";
```

The Vite plugin is the recommended path for all Vite-based stacks. It uses Vite's own scanning for tree-shaking, which is faster and more accurate than the PostCSS path.

### Path B — PostCSS plugin (legacy toolchains, CRA, webpack-based)

```bash
npm install tailwindcss @tailwindcss/postcss
```

```js
// postcss.config.mjs
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

```css
/* src/globals.css */
@import "tailwindcss";
```

No `tailwind.config.js` required. PostCSS handles scanning on its own.

### Path C — CLI (standalone, no bundler)

```bash
npm install tailwindcss
npx @tailwindcss/cli -i src/globals.css -o dist/output.css --watch
```

---

## @import "tailwindcss" — what it expands to

In v4, `@import "tailwindcss"` is a shorthand for:

```css
@import "tailwindcss/preflight";   /* normalizes browser defaults */
@import "tailwindcss/theme";       /* default design tokens */
@import "tailwindcss/utilities";   /* JIT utility classes */
```

If you only need specific layers:

```css
@import "tailwindcss/preflight";
@import "tailwindcss/utilities";
/* skip theme layer if you define all tokens yourself */
```

---

## Class prefix

For projects that need a namespace to avoid collisions:

```css
@import "tailwindcss" prefix(tw);
```

Now all utilities are prefixed: `tw-flex`, `tw-text-red-500`, `tw-dark:bg-gray-900`.

Custom `@theme` tokens are not prefixed — only generated utilities are.

---

## Source control (@source directive)

By default, Tailwind 4 scans everything it can reach from your CSS entry. Override scanning:

```css
@import "tailwindcss";

/* Explicitly add paths (additive) */
@source "../../packages/ui/src";
@source "./legacy-templates/*.html";

/* Exclude paths */
@source not "./dist";
@source not "./node_modules";
```

For monorepos where the CSS entry lives in `packages/app`, add `@source` for sibling packages that use Tailwind classes.

---

## Safe-listing classes

If a class is built dynamically (e.g., from a database-driven theme) and won't be scanned:

```css
@source inline("text-red-500 bg-blue-100 border-green-600");
```

Or use a glob:

```css
@source inline("text-{red,blue,green}-{100,200,500,900}");
```

---

## Layer ordering

Tailwind 4 defines three layers: `base`, `components`, `utilities`. Your custom styles should declare which layer they belong to:

```css
@import "tailwindcss";

@layer base {
  :root { font-family: system-ui; }
  h1 { @apply text-2xl font-bold; }
}

@layer components {
  .card { @apply rounded-lg border bg-white p-4 shadow-sm; }
}

@layer utilities {
  /* @utility is the preferred API — see variants.md */
}
```

Custom utilities written with `@utility` are automatically placed in the utilities layer with the correct specificity.

---

## @apply

Still works in v4:

```css
.btn-primary {
  @apply px-4 py-2 rounded-md bg-brand-500 text-white hover:bg-brand-600;
}
```

Prefer `@utility` for new code — `@apply` is better for component-scoped extraction.

---

## Gotchas

- `@tailwind base/components/utilities` directives are **removed in v4** — use `@import "tailwindcss"` only
- `tailwind.config.js` is **ignored** by the v4 engine — do not create it
- The `content:` config option is **not read** — use `@source` for overrides
- `autoprefixer` is **no longer needed** — v4 handles vendor prefixes internally
- `postcss-import` is **not needed** when using the PostCSS plugin — it handles `@import` resolution itself
