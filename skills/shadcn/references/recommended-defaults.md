# shadcn — Recommended Defaults

Canonical `components.json` and registry config. Override only with a reason.

## `components.json` baseline

```jsonc
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",          // "default" or "new-york"; new-york reads as more modern
  "rsc": true,                  // adds `"use client"` to interactive components
  "tsx": true,                  // .tsx output (always true in 2026)
  "tailwind": {
    "config": "",               // Tailwind v4 — leave empty, use globals.css @theme
    "css": "app/globals.css",   // path to global stylesheet
    "baseColor": "zinc",        // zinc | slate | stone | gray | neutral
    "cssVariables": true,       // theme via CSS vars (preferred)
    "prefix": ""                // class prefix; leave empty unless multi-app
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"       // lucide-react is the default
}
```

## Style preset choice

| Preset | Visual | Best for |
|---|---|---|
| `default` | softer rounding, friendly | content sites, blogs, marketing |
| `new-york` | tighter rounding, denser | SaaS, dashboards, admin panels |

Pick at init — changing later requires re-adding components.

## `baseColor` choice

| Base color | Neutrals lean | Best for |
|---|---|---|
| `zinc` | cool gray | technical/dashboard products |
| `slate` | slightly cool | balanced, default-feeling |
| `stone` | warm gray | content/editorial sites |
| `gray` | pure gray | brand-neutral, max contrast |
| `neutral` | true neutral | minimal/monochrome aesthetics |

Pick at init — affects CSS variable values in `globals.css`.

## Registry config (custom registry distribution)

```jsonc
// registry.json (your custom registry root)
{
  "$schema": "https://ui.shadcn.com/schema/registry.json",
  "name": "my-design-system",
  "homepage": "https://design.example.com",
  "items": [
    {
      "name": "fancy-button",
      "type": "registry:ui",
      "files": [
        { "path": "ui/fancy-button.tsx", "type": "registry:ui" }
      ],
      "registryDependencies": ["button"],  // pulls upstream shadcn button
      "dependencies": ["class-variance-authority"],
      "cssVars": { "light": { "fancy": "..." }, "dark": { "fancy": "..." } }
    }
  ]
}
```

Add component from your registry: `npx shadcn add https://design.example.com/r/fancy-button.json`

## Dark mode strategy

Use `class` strategy — `<html class="dark">`. Switch via `next-themes` in Next.js or a small `useDarkMode` hook elsewhere.

```css
/* globals.css */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    /* ... */
  }
  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    /* ... */
  }
}
```

NEVER use the `media` strategy — users want manual control via toggle.

## When to override defaults

| Default | Override when |
|---|---|
| `rsc: true` | running in Vite SPA — set `false` |
| `cssVariables: true` | almost never — flip to `false` only for static-only theming |
| `iconLibrary: lucide` | if migrating from Heroicons / Phosphor — set respective value |
| `style: new-york` | content-forward sites prefer `default` |

## Tuning ranges

| Knob | Default | Note |
|---|---|---|
| `baseColor` | `zinc` | one-time choice; affects 30+ CSS vars |
| `style` | `new-york` | one-time choice; affects spacing/radius |
| `iconLibrary` | `lucide` | swap requires re-adding components that use icons |

## See also

- [setup-and-cli.md](setup-and-cli.md) — full CLI and config reference
- [theming.md](theming.md) — CSS variable details, dark mode
- [custom-registry.md](custom-registry.md) — registry manifest format
