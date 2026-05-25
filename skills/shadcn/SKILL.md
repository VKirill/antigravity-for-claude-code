---
name: shadcn
description: "shadcn/ui — copy-paste React components built on Radix UI primitives + Tailwind. Use when: shadcn, shadcn-ui, shadcn/ui, npx shadcn add, components.json, registry, theming, Radix UI, accessible components, button, dialog, dropdown, form, input, select, sheet, tabs, toast, sonner, cn helper, tailwind-merge, dark mode, CSS variables for theming. SKIP: Material UI / Mantine / Chakra (different paradigm), pure Radix without shadcn (→radix-ui if active)."
stacks:
  - frontend
  - react
packages:
  - shadcn
  - class-variance-authority
  - tailwind-merge
  - clsx
  - "@radix-ui/react-dialog"
  - "@radix-ui/react-select"
  - "@radix-ui/react-tabs"
  - "@radix-ui/react-dropdown-menu"
  - "@radix-ui/react-slot"
  - lucide-react
  - react-hook-form
  - zod
tags:
  - shadcn
  - radix-ui
  - tailwind
  - react
  - components
  - design-system
  - accessibility
  - theming
source: generated(shadcn-v1.0.0)
risk: medium-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- shadcn/ui: `CLI: `shadcn@4.7.x` (latest tag at github.com/shadcn-ui/ui); components: rolling — copied into project on `npx shadcn add`, no runtime dep`
- React: `19.x`
- Tailwind CSS: `4.3.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded automatically when its description matches the active task. Read only the section you need, then follow the link to the relevant reference file for full detail.

## Use this skill when

- Adding shadcn/ui to a new or existing React project (`npx shadcn init`, `npx shadcn add <component>`)
- Configuring `components.json` — style, base color, CSS variables, path aliases
- Theming with CSS variables (`--background`, `--foreground`, `--primary`, dark mode via `.dark` class)
- Using or customizing any shadcn component: Button, Dialog, Select, Form, DataTable, Combobox, Sheet, Sonner
- Building forms with React Hook Form + Zod wired to shadcn `<Form>` primitives
- Creating a custom registry or publishing your own component registry
- Understanding Radix UI primitives underneath shadcn components (focus management, ARIA, keyboard nav)
- Extending components with `cva` (class-variance-authority) variants
- Building a design system or component library on top of shadcn
- Debugging Tailwind v4 CSS variable conflicts or dark mode issues

## Do not use this skill when

- The task is Material UI, Mantine, Chakra UI, Ant Design, or NextUI — those use npm-installed, styled components (different paradigm, different skill)
- The task is pure Radix UI primitives without shadcn layer — use `radix-ui` skill if active
- The task is Headless UI (Vue ecosystem) — use `vue` skill
- The task is DaisyUI — separate CSS-class-based approach, not shadcn
- The task is Tailwind CSS utility classes only, with no component library — use `tailwind` skill
- The task is React Native styling — shadcn/ui is web-only (DOM)

## Purpose

shadcn/ui is not an npm package — it is a **copy-paste component collection** where `npx shadcn add button` writes the component source code directly into your project. You own the code; upgrades are opt-in edits, not package bumps. This model means components are fully customizable without fighting a library's internal APIs.

Each component is built on a **Radix UI primitive** (unstyled, accessible, WAI-ARIA compliant) plus **Tailwind CSS** utility classes as the visual layer, with CSS variables for theming. The `cn()` helper (tailwind-merge + clsx) handles class composition without specificity conflicts. This skill covers the full workflow: install, configure, use, theme, extend, and compose into a design system.

## Capabilities

### Install & CLI Workflow

`npx shadcn@latest init` generates `components.json` and writes `globals.css` with the CSS variable theme. After init, every component is added individually: `npx shadcn add button dialog form table`. Each run writes the component file to the configured `components/ui/` path. No npm version — only the `shadcn` CLI is a dev dependency.

`npx shadcn diff` shows upstream component changes since you last added/updated. `npx shadcn add --all` installs every component. Components can be added from custom registries: `npx shadcn add <registry-url>/button`.

> Full reference: [references/setup-and-cli.md](references/setup-and-cli.md)

### components.json Configuration

`components.json` controls every path and style decision. Key fields:

| Field | Options | Effect |
|---|---|---|
| `style` | `default`, `new-york` | Visual style preset (border-radius, shadows) |
| `baseColor` | `slate`, `zinc`, `stone`, `gray`, `neutral` | CSS variable base palette |
| `cssVariables` | `true` (recommended) | Theme via CSS vars; `false` → Tailwind utilities inline |
| `rsc` | `true`/`false` | Adds `"use client"` to components that need it |
| `tsx` | `true`/`false` | `.tsx` vs `.jsx` output |
| `tailwind.config` | file path | Tailwind config to merge into |
| `aliases.components` | `@/components` | Where `npx shadcn add` writes component files |
| `aliases.utils` | `@/lib/utils` | Where the `cn()` utility lives |

> Full reference: [references/setup-and-cli.md](references/setup-and-cli.md)

### Theming with CSS Variables

shadcn themes are entirely CSS variable–based. The `:root` block defines light mode; `.dark` defines dark mode. Variables use HSL channel notation without the `hsl()` wrapper so Tailwind can apply opacity modifiers (`bg-primary/50`).

Core variable pairs: `--background`/`--foreground`, `--primary`/`--primary-foreground`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--card`, `--popover`, `--sidebar-*`. Each semantic pair has a text-contrast companion (`--X-foreground`).

Dark mode uses the `class` strategy — add `class="dark"` to `<html>`. Tailwind v4 uses `@layer base` and `@theme inline` for variable injection.

> Full CSS variable reference + dark mode setup: [references/theming.md](references/theming.md)

### Component Composition with `cva`

`class-variance-authority` (cva) is the standard way to build variants. The `Button` component ships with `variant` (`default`, `destructive`, `outline`, `secondary`, `ghost`, `link`) and `size` (`default`, `sm`, `lg`, `icon`) props defined via `cva`. Extending: add variants to the `cva()` call in the component file — you own it.

`cn()` is `twMerge(clsx(...))` — it merges Tailwind classes safely (last wins, deduplication) and conditionally applies classes. Always use `cn()` when composing component classes; never raw string concatenation.

`Slot` (from `@radix-ui/react-slot`) implements `asChild` — it forwards props to the child element instead of rendering a wrapper. Buttons with `asChild` can render as `<a>` links or `<Link>` router components.

> Full reference: [references/popular-components.md](references/popular-components.md)

### Form Integration (React Hook Form + Zod)

shadcn ships a `<Form>` component that wraps React Hook Form with proper `id`/`aria-describedby`/`aria-invalid` wiring. Pattern: `useForm` → `<Form>` → `<FormField>` → `<FormItem>` → `<FormLabel>` + `<FormControl>` + `<FormMessage>`. The `<FormControl>` slot injects `id` and ARIA props automatically — never set them manually.

Zod schema drives `zodResolver` for validation. Error messages surface via `<FormMessage>` without extra wiring.

> Complete form patterns + end-to-end example: [references/form-integration.md](references/form-integration.md) | [examples/form-with-rhf-zod.md](examples/form-with-rhf-zod.md)

### Accessibility Patterns from Radix

Every shadcn component inherits Radix UI's accessibility guarantees: keyboard navigation (Arrow keys, Home/End, Escape), focus trapping in modals/dialogs, ARIA roles/states/properties, and WAI-ARIA design pattern compliance. `Dialog` traps focus and restores on close. `Select` follows the Listbox pattern. `Tabs` follows the tab panel pattern with `roving tabindex`.

Do not add redundant `role`, `aria-label`, or `tabIndex` to shadcn components — Radix already handles them. Add ARIA only to custom content inside the component (e.g., label for an icon-only button).

> Patterns + gotchas: [references/accessibility.md](references/accessibility.md)

### Custom Registries

A registry is a JSON endpoint (or file) that describes components and their dependencies. Publish your own: create a `registry.json` manifest at a URL, then `npx shadcn add <url>/component-name`. Used for design system distribution across projects without npm publishing.

Registry manifest format: `{ name, type, files[], dependencies[], registryDependencies[], cssVars }`. shadcn CLI resolves `registryDependencies` (other registry components) and `dependencies` (npm packages) automatically on install.

> Full registry spec + hosting patterns: [references/custom-registry.md](references/custom-registry.md)

## Behavioral Traits

- Never suggests `npm install` for adding components — always `npx shadcn add <component>`
- Uses `cn()` for every class composition; never raw template literals or string concatenation
- Preserves the Radix primitive layer — does not replace Radix with a custom implementation
- Picks `new-york` style for SaaS/dashboard apps; `default` for content-forward or simpler UIs
- Configures dark mode via `class` strategy on `<html>`, not `media` strategy
- Wires React Hook Form forms through the `<Form>` / `<FormField>` / `<FormControl>` stack — never bare `register()` inputs paired with shadcn UI components
- Uses `asChild` on Button for link-as-button patterns (router `<Link>`, `<a href>`)
- Extends components by editing their source file; never wraps a wrapper around a shadcn component just to add a prop
- Checks `npx shadcn diff` before updating components to understand upstream changes
- Keeps `globals.css` CSS variables as the single source of theme truth; never hardcodes colors in component files

## Important Constraints

- NEVER `npm install @shadcn/ui` — there is no such package; the library is code-generation only
- NEVER add `role`, `aria-expanded`, `aria-haspopup` manually to Radix-backed components — they own their ARIA
- NEVER use Tailwind's `!important` modifier to override shadcn styles — edit the component source instead
- NEVER put theme colors in `tailwind.config.js` inline as hex values when `cssVariables: true` — all colors must go through CSS variable references
- ALWAYS run `npx shadcn add` after changing `components.json` style or baseColor — existing components need regeneration
- ALWAYS import from the component's own file (`@/components/ui/button`), not from a barrel re-export unless you created one
- ALWAYS use `<FormControl>` slot wrapper inside `<FormField>` — omitting it breaks ARIA wiring
- When using Tailwind v4: use `@theme inline` for CSS variable injection, not `extend.colors` in a JS config

## Related Skills

**90%-filter applied** — each entry is the dominant choice for its category in 2026 React projects.

### Component foundation
- ✓ `react` — React 19 (the runtime this library runs on)
- ✓ `typescript` — TS 5.9 (all shadcn components are TypeScript-first)
- ✓ `tailwind` — Tailwind CSS 4.3 (the styling engine)

### Meta-frameworks (most common shadcn hosts)
- ✓ `nextjs` — Next.js 16 (most popular shadcn host; RSC + shadcn patterns)

### Forms & validation
- ✓ `react-hook-form` — React Hook Form 8 (shadcn Form component wraps this directly)
- ✓ `zod` — Zod 4 (standard resolver for RHF forms in shadcn projects)

### Testing
- ✓ `vitest` — Vitest 4 (unit testing for shadcn-using apps)
- ✓ `playwright` — Playwright 1.60 (E2E for UI flows)

## API Reference

### Reference files (Pattern 2)

Load only what's relevant for the current task:

| Topic | File |
|---|---|
| Index + decision map, component cheat-sheet, quick patterns | [references/REFERENCE.md](references/REFERENCE.md) |
| `npx shadcn init`, `components.json` fields, CLI commands, project setup | [references/setup-and-cli.md](references/setup-and-cli.md) |
| CSS variables, dark mode, base colors, Tailwind v4 theme injection | [references/theming.md](references/theming.md) |
| React Hook Form + Zod + shadcn Form primitives, field patterns | [references/form-integration.md](references/form-integration.md) |
| Custom registry spec, manifest format, hosting, multi-project distribution | [references/custom-registry.md](references/custom-registry.md) |
| Radix accessibility guarantees, keyboard nav, ARIA rules, what NOT to override | [references/accessibility.md](references/accessibility.md) |
| Button, Dialog, Select, Sheet, Tabs, Toast/Sonner, DataTable, Combobox | [references/popular-components.md](references/popular-components.md) |
| **Recommended defaults** — `components.json` baseline, style/baseColor choice, registry config | [references/recommended-defaults.md](references/recommended-defaults.md) |
| Eval cases (human-readable, v3 format) | [references/eval-cases.md](references/eval-cases.md) |

### Upstream canonical reference (verbatim mirror of github.com/shadcn-ui/ui/tree/main/skills/shadcn — DO NOT EDIT)

These files come from shadcn-ui maintainers and are the **authoritative** source for CLI behaviour, theming model, MCP server, and component composition rules. Our sibling references above (e.g., `theming.md`) extend or contextualize these for our workflows but don't override.

| Topic | File |
|---|---|
| Sync workflow + intentionally-skipped files + license | [references/upstream/SOURCE.md](references/upstream/SOURCE.md) |
| Canonical CLI: `init`, `add`, custom registries, `components.json` schema | [references/upstream/cli.md](references/upstream/cli.md) |
| Theming model — CSS variables, presets, dark mode, semantic tokens | [references/upstream/customization.md](references/upstream/customization.md) |
| `shadcn mcp` MCP server — search/view/install components from Claude Code / Cursor / VS Code / OpenCode / Codex | [references/upstream/mcp.md](references/upstream/mcp.md) |
| **Rule**: which preset (base-nova / radix-nova / classic / etc.) for which use case | [references/upstream/rules/base-vs-radix.md](references/upstream/rules/base-vs-radix.md) |
| **Rule**: Card / Dialog / Field composition — full sub-component usage | [references/upstream/rules/composition.md](references/upstream/rules/composition.md) |
| **Rule**: `FieldGroup`, `Field`, `data-invalid` / `aria-invalid`, ToggleGroup vs Switch | [references/upstream/rules/forms.md](references/upstream/rules/forms.md) |
| **Rule**: `data-icon` attribute, no manual icon sizing, lucide vs tabler | [references/upstream/rules/icons.md](references/upstream/rules/icons.md) |
| **Rule**: semantic colors, `gap-*` not `space-*`, `size-*` shorthand, no manual `dark:` overrides | [references/upstream/rules/styling.md](references/upstream/rules/styling.md) |
| Official eval cases (machine-readable JSON with `expectations[]`) | [references/upstream/evals.json](references/upstream/evals.json) |

### Templates

Production-ready boilerplates with `{{placeholder}}` markers — copy and fill:

| Template | File |
|---|---|
| `components.json` — production config with CSS variables, new-york style, path aliases | [templates/components.json](templates/components.json) |
| `lib/utils.ts` — `cn()` helper with tailwind-merge + clsx | [templates/utils.ts.template](templates/utils.ts.template) |
| `globals.css` — full CSS variable theme (light + dark mode, Tailwind v4) | [templates/globals.css](templates/globals.css) |

### Examples

End-to-end walkthroughs — complete flow, not just snippets:

| Scenario | File |
|---|---|
| DataTable with TanStack Table + shadcn Table, sorting, filtering, pagination | [examples/build-data-table.md](examples/build-data-table.md) |
| Form with React Hook Form + Zod + shadcn Form primitives, server action submit | [examples/form-with-rhf-zod.md](examples/form-with-rhf-zod.md) |

**How to use**: navigate to the specific file for the topic you need. Don't read all files — look up only what's relevant to the current task.
