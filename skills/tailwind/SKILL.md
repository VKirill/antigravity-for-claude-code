---
name: tailwind
description: "Tailwind CSS 4.3 — CSS-first config via @theme, oklch colors, container queries, @utility/@variant, has-*/not-*/starting: variants, 3D transforms, dark mode. Use when: tailwind, tailwindcss, tailwind 4, @theme, @utility, @variant, oklch, container queries, dark mode, prose, tailwind-merge, cn() helper, postcss config. SKIP: Tailwind 3 config.js (→@theme in CSS), CSS-in-JS (styled-components)."
stacks:
  - tailwind
packages:
  - tailwindcss
  - @tailwindcss/vite
  - @tailwindcss/postcss
  - @tailwindcss/typography
  - tailwind-merge
  - clsx
tags:
  - css
  - tailwind
  - styling
  - frontend
  - design-system
  - oklch
  - container-queries
source: vechkasov-global-skills
risk: medium-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- Tailwind CSS: `4.3.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded automatically when its description matches the active task. Read only the section you need, then follow the link to the relevant reference file for full detail.

## Use this skill when

- Configuring Tailwind CSS 4 via the CSS-first `@theme` directive (no more `tailwind.config.js`)
- Setting up the Vite plugin (`@tailwindcss/vite`) or PostCSS plugin (`@tailwindcss/postcss`)
- Defining custom design tokens: colors, fonts, spacing, radius, shadows with `@theme`
- Working with oklch color space for brand palettes (brand-50 through brand-900)
- Building container-query layouts with `@container` and `@container/{name}`
- Writing custom utilities with `@utility` or custom variants with `@variant`
- Using modern pseudo-class variants: `has-*`, `not-*`, `group-has-*`, `starting:`
- Implementing CSS-driven dark mode (`:root` / `.dark` class / `@media prefers-color-scheme`)
- Using 3D transform utilities (`rotate-x-*`, `rotate-y-*`, `perspective-*`, `transform-style-3d`)
- Setting up `tailwind-merge` + `clsx` as the `cn()` helper pattern
- Integrating with shadcn/ui component library (uses Tailwind 4 as base)
- Migrating from Tailwind 3 to Tailwind 4 (config.js → CSS-first)
- Adding `@tailwindcss/typography` prose plugin for rich text rendering

## Do not use this skill when

- Task is Tailwind v3 config.js migration questions only — answer inline, but remind user v4 is CSS-first
- Task is CSS-in-JS (styled-components, Emotion, vanilla-extract) — different paradigm entirely
- Task is writing component logic in React/Vue (style props only, use the appropriate framework skill)
- Task is UnoCSS, Panda CSS, or Windi CSS — different engines, different trade-offs
- Task is pure CSS Grid/Flexbox theory without Tailwind usage — use general CSS reference instead

## Purpose

Tailwind CSS 4 is a full rewrite of the framework. The most important change: **there is no `tailwind.config.js` anymore**. Everything — custom tokens, plugins, variants — lives in a single CSS file via `@theme`, `@utility`, and `@variant` directives. The Vite plugin replaces the PostCSS pipeline for most projects. JIT is the only mode (no more AOT/PurgeCSS distinction).

Tailwind 4 also ships first-class support for container queries (no plugin required), oklch color space for perceptually uniform palettes, 3D transform utilities, `has-*`/`not-*`/`starting:` variants from the CSS working draft, and a dramatically improved dark mode story driven entirely by CSS cascade rather than config.

This skill covers the full Tailwind 4 workflow: initial setup, CSS-first design token authoring, modern variant patterns, migration from v3, and integration with the React + shadcn/ui ecosystem.

## Capabilities

Each line below points to the canonical reference. The reference owns code, edge cases, and gotchas.

- **CSS-first config** — `@import "tailwindcss";` + `@theme { --color-*, --font-*, --spacing-* }`. NO `tailwind.config.js` in v4. Override defaults via `@theme default {}`. → [references/config-css-first.md](references/config-css-first.md)
- **Design tokens** — oklch lightness/chroma/hue scale (50–950); custom brand palettes in oklch for perceptual uniformity; semantic aliases (`--color-background`, `--color-foreground`) for dark mode. → [references/theme-and-tokens.md](references/theme-and-tokens.md)
- **Modern variants** — `has-[]:`, `not-[]:`, `starting:` (`@starting-style`), `group-has-[]:`, `peer-has-[]:`, `in-[]:`. Stacking reads right-to-left. → [references/variants.md](references/variants.md)
- **Container queries** — native in v4 (no plugin). `@container` parent + `@sm:`/`@lg:` children; named via `@container/name`; units `@cqw`/`@cqh`; size `@[200px]:`. → [references/container-queries.md](references/container-queries.md)
- **React + shadcn integration** — `@tailwindcss/vite` plugin (no PostCSS); `cn()` = `twMerge(clsx(inputs))`; shadcn reads `@theme` vars from `globals.css`. → [references/integration-with-react.md](references/integration-with-react.md)
- **Migration v3 → v4** — `config.js` → `@theme`; `content: []` → auto-detect; `darkMode: 'class'` → `@custom-variant dark (&:where(.dark, .dark *))`; `theme.extend` → just declare tokens; `plugins` → `@utility` + `@custom-variant`. → [references/migration-3-to-4.md](references/migration-3-to-4.md)
- **@utility / @custom-variant** — replace `plugin()` API. `@utility scrollbar-hide { ... }` for custom utilities; `@custom-variant dark (&:where(.dark, .dark *));` to register a prefix. → [references/variants.md](references/variants.md)
- **3D transforms** — built-in: `rotate-x-{deg}`, `rotate-y-{deg}`, `translate-z-{n}`, `perspective-{n}`, `transform-style-3d`, `backface-hidden`/`backface-visible`.

## Behavioral Traits

- Writes `@theme` in the root CSS file — never reaches for `tailwind.config.js` in Tailwind 4 projects
- Uses oklch for all custom color tokens — never hex/rgb in `@theme` (perceptual uniformity)
- Applies the `cn()` helper for any conditional class logic — never string interpolation
- Chooses the Vite plugin for Vite/Next/Nuxt projects, PostCSS plugin only for legacy pipelines
- Uses semantic token names (`--color-background`, `--color-muted`) not raw scale values in components
- Reaches for container queries (`@container`) before viewport queries for component-level responsiveness
- Validates dark mode via CSS only — no JS class toggling unless the user explicitly wants manual control
- Trims `tailwind-merge` to project-specific classGroups when bundle size matters
- Always reads existing `globals.css` / `app.css` before adding tokens to avoid duplicating or overriding

## Important Constraints

- NEVER create `tailwind.config.js` for a Tailwind 4 project — it is not read by the v4 engine
- NEVER use hex or rgb inside `@theme` color tokens — use oklch for perceptual consistency
- NEVER add `@tailwindcss/container-queries` plugin — container queries are native in v4
- NEVER use `purge:` config option — v4 JIT handles tree-shaking automatically
- ALWAYS set `@import "tailwindcss"` as the first line of the entry CSS — not `@tailwind base/components/utilities`
- ALWAYS use `tailwind-merge` when composing classes conditionally — naive string concat creates conflicts
- ALWAYS check if shadcn/ui `globals.css` is already present before generating a new one — never overwrite it
- ALWAYS use the `@container` parent marker before using container query responsive prefixes on children

## Related Skills

**90%-filter applied** — only mainstream 2026 choices listed.

✓ marks **active** skills; the rest are **cascade markers**.

### Build tooling
- ✓ `vite` — Vite 6 (primary Tailwind 4 integration target; `@tailwindcss/vite`)

### Component libraries
- ✓ `shadcn` — shadcn/ui (most common Tailwind 4 component system for React)

### Frameworks (use Tailwind as styling layer)
- ✓ `react` — React 19 (primary consumer of Tailwind utility classes)
- ✓ `nextjs` — Next.js 16 (App Router + Tailwind 4 standard pairing)
- ✓ `vue` — Vue 3.5
- ✓ `nuxt` — Nuxt 4
- ✓ `astro` — Astro 6 (Tailwind 4 plugin officially supported)

### Validation (form + token validation)
- ✓ `zod` — Zod 4 (form + env validation in projects that use Tailwind for forms)

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Index + decision map for all reference files | [references/REFERENCE.md](references/REFERENCE.md) |
| CSS-first config: @import, @theme, Vite plugin, PostCSS, prefixes | [references/config-css-first.md](references/config-css-first.md) |
| Design tokens: oklch color scale, typography, spacing, dark mode aliases | [references/theme-and-tokens.md](references/theme-and-tokens.md) |
| Variants: has-*, not-*, starting:, @utility, @variant, stacking | [references/variants.md](references/variants.md) |
| Container queries: @container, named containers, style queries, units | [references/container-queries.md](references/container-queries.md) |
| React integration: cn() helper, clsx+tailwind-merge, shadcn/ui setup | [references/integration-with-react.md](references/integration-with-react.md) |
| Migration from Tailwind 3 to 4: breaking changes, upgrade path | [references/migration-3-to-4.md](references/migration-3-to-4.md) |
| Routing tests (positive/negative eval cases) | [references/eval-cases.md](references/eval-cases.md) |

### Templates

| Template | File |
|---|---|
| Full globals.css with @theme tokens (oklch brand palette, fonts, custom utilities) | [templates/globals.css](templates/globals.css) |
| Legacy PostCSS config for non-Vite pipelines | [templates/postcss.config.mjs](templates/postcss.config.mjs) |

### Examples

| Scenario | File |
|---|---|
| CSS-driven dark mode: system preference + manual toggle | [examples/dark-mode-setup.md](examples/dark-mode-setup.md) |
| Component pattern: cn() helper + conditional classes + tailwind-merge | [examples/component-with-cn.md](examples/component-with-cn.md) |

**How to use**: navigate to the specific file for the topic you need. Don't read all files — look up only what's relevant to the current task.
