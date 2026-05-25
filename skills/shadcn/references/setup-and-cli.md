# shadcn/ui — Setup & CLI

## Installation: new project

```bash
# Next.js (most common)
npx create-next-app@latest my-app --typescript --tailwind --app
cd my-app
npx shadcn@latest init

# Vite + React
npm create vite@latest my-app -- --template react-ts
cd my-app && npm install
npx shadcn@latest init
```

`npx shadcn@latest init` asks:
1. Which style? → `New York` (SaaS default) or `Default`
2. Which color? → `Zinc`, `Slate`, `Stone`, `Gray`, `Neutral`
3. Use CSS variables? → `yes` (always)

After init it writes:
- `components.json` — skill configuration
- Updates `globals.css` — CSS variable theme
- Installs peer deps: `tailwind-merge`, `clsx`, `class-variance-authority`, `lucide-react`
- Writes `lib/utils.ts` with `cn()`

## Adding components

```bash
# Single component
npx shadcn add button

# Multiple at once
npx shadcn add button dialog form select table

# All components (large download)
npx shadcn add --all

# Overwrite existing component
npx shadcn add button --overwrite

# From custom registry
npx shadcn add https://my-registry.com/r/button
```

Each command writes source files to `components/ui/` (configurable). Radix UI packages are added to `package.json` automatically.

## components.json — field reference

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "zinc",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

### Field details

**`style`** — `"default"` or `"new-york"`:
- `new-york`: tighter padding, smaller border-radius, more refined — use for SaaS, dashboard apps
- `default`: more spacious, softer — use for content apps, marketing pages

**`baseColor`** — drives the neutral palette for grays/borders/backgrounds. Options: `slate`, `zinc`, `stone`, `gray`, `neutral`. Does not affect accent/brand colors (those come from `--primary`). Pick once at init — changing requires regenerating all components.

**`cssVariables`** — always `true`. When `false`, colors are inlined as Tailwind class names and dark mode requires separate class variants everywhere. With `true`, one CSS variable change themes the entire app.

**`rsc`** — adds `"use client"` to components that use React state/events. Required for Next.js App Router. Set `false` for Vite/CRA.

**`prefix`** — adds a prefix to all Tailwind class names in components (e.g., `"tw-"`). Use when integrating shadcn into an existing app with CSS conflicts.

**`iconLibrary`** — `"lucide"` (default) or `"radix"`. Sets which icon set `npx shadcn add` imports in generated components.

## Path aliases setup

shadcn expects `@/` path alias. Configure in TypeScript:

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

For Vite, add to `vite.config.ts`:
```ts
import path from "path"
import { defineConfig } from "vite"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
```

## Updating components

shadcn does NOT auto-update. To see what changed upstream:

```bash
npx shadcn diff           # show all outdated components
npx shadcn diff button    # show diff for button only
```

The diff shows what the upstream version looks like vs your current file. You decide whether to apply changes (manually edit or re-add with `--overwrite`). Since you own the code, updates are opt-in.

## Verifying installation

After `npx shadcn init`:

```bash
# Should exist
ls components/ui/          # empty initially
cat lib/utils.ts           # should have cn()
cat globals.css            # should have :root { --background: ... }

# Add a component and test
npx shadcn add button
cat components/ui/button.tsx   # should have cva() variants
```

## Project structure after full setup

```
my-app/
├── app/
│   ├── globals.css          ← CSS variables (theming)
│   └── layout.tsx
├── components/
│   └── ui/                  ← shadcn components live here
│       ├── button.tsx
│       ├── dialog.tsx
│       └── ...
├── lib/
│   └── utils.ts             ← cn() helper
├── components.json          ← shadcn config
└── tailwind.config.ts
```

## Tailwind v4 specifics

shadcn supports Tailwind v4. Key differences from v3 setup:

- No `tailwind.config.js` for color tokens — colors injected via `@theme inline` in CSS
- `components.json` `tailwind.config` can be omitted if using pure CSS config
- `globals.css` uses `@import "tailwindcss"` at top (not `@tailwind base/components/utilities`)

See [theming.md](theming.md) for the full Tailwind v4 CSS variable setup.

## Non-Next.js setups

**Remix**: set `rsc: false`, path alias via `tsconfig.json`, add `cn()` to `app/lib/utils.ts`

**Astro**: works with React integration. Use `npx shadcn@latest init` after adding `@astrojs/react`. Set `rsc: false`.

**Tanstack Start / Router**: similar to Vite setup. `rsc: false`, standard path alias.
