---
name: design-system-2026
description: "Design system foundations 2026 — OKLCH color ramps (perceptually-even, APCA/WCAG verified), fluid typography systems + font pairings, layout systems (bento, container queries, fluid space), 3-layer design tokens + DESIGN.md (DTCG/Style Dictionary), visual style taxonomy (Glass 2.0, refined brutalism, spatial, bento...), iconography/illustration direction, and art-direction synthesis per project archetype. Use when: oklch, color ramp, palette, contrast APCA, design tokens, DTCG, style dictionary, tokens studio, DESIGN.md, type scale, fluid clamp, font pairing, variable fonts, bento grid, container queries, subgrid, fluid spacing, visual style, glassmorphism, brutalism, spatial UI, iconography, lucide, art direction, moodboard to system. SKIP: animation/motion (→web-animation-router), vanilla CSS architecture/@layer (→css-architecture-2026 — complements this)."
source: gemini-harvest-2026
risk: low-stakes
---

# design-system-2026

> Built from a 2026 deep knowledge-harvest (Gemini 3.5 + live web grounding), QC'd for cross-references and package names. Some design-system token values are tagged `[UNVERIFIED]` in the references — confirm against live docs before quoting exact numbers.

## Use this skill when

- Building a color system (OKLCH ramps, dark mode, gradients) or verifying contrast in CI
- Defining typography (fluid scale, pairings, CLS-safe fallbacks) and layout (bento, container queries, fluid space)
- Architecting design tokens + authoring a DESIGN.md
- Choosing a visual style and deriving a full art-direction recipe from an audience portrait

## Reference library

| Topic | File |
|---|---|
| OKLCH Color Systems (2026 Edition) | [references/oklch_color_systems_2026.md](references/oklch_color_systems_2026.md) |
| Typography Systems for High-End Sites (2026 Edition) | [references/typography-systems.md](references/typography-systems.md) |
| Layout Systems (2026 Edition) | [references/layout-systems.md](references/layout-systems.md) |
| Design Token Architecture & DESIGN.md Integration (2026 Edition) | [references/design-tokens-architecture.md](references/design-tokens-architecture.md) |
| Visual Style Taxonomy (2026 Edition) | [references/visual-style-taxonomy.md](references/visual-style-taxonomy.md) |
| Iconography & Illustration Direction (2026 Edition) | [references/iconography-illustration.md](references/iconography-illustration.md) |
| Art Direction Synthesis (2026 Edition) | [references/art-direction-synthesis.md](references/art-direction-synthesis.md) |
| **Palette schemes — vetted interface palettes (the MENU)** | [references/palette-schemes.md](references/palette-schemes.md) |
| **Type pairings — vetted display+text pairs (the MENU)** | [references/type-pairings.md](references/type-pairings.md) |
| **Palette/type SELECTION procedure (select→justify→instantiate)** | [references/palette-selection-procedure.md](references/palette-selection-procedure.md) |
| **DESIGN.md authoring standard** — google-labs `@google/design.md` format, frontmatter schema, lint rules (folded in from the former standalone `design-md-standard` skill) | [references/design-md-standard.md](references/design-md-standard.md) |
| **Component specifications** — per-component anatomy/props/sizing (merged from former `design-system` skill) | [references/component-specs.md](references/component-specs.md) |
| **States & variants** — interactive states, variant matrices (merged from former `design-system` skill) | [references/states-and-variants.md](references/states-and-variants.md) |
| **Tailwind integration** — mapping 3-layer tokens → Tailwind config/theme (merged from former `design-system` skill) | [references/tailwind-integration.md](references/tailwind-integration.md) |

## Choosing a palette + type (the deliberate path — use this, don't improvise colors)

`oklch_color_systems_2026.md` / `typography-systems.md` are the **theory**. For real projects, do NOT
hand-mix colors (that produced the "color soup" failure). Instead:

1. Read **`palette-selection-procedure.md`** — the mandatory 6-step `select → justify → instantiate`.
2. Pick ONE scheme from **`palette-schemes.md`** and ONE pair from **`type-pairings.md`** by `mood`/`industry`/`use-when`.
3. Instantiate into the project's `docs/plans/<slug>/DESIGN.md` as `:root` tokens + a `palette: <ID>` line;
   record the WHY in `art-direction.md`.

Each palette entry carries computed OKLCH + WCAG contrast + an **anti-soup rule** (≤1 warm + 1 cool +
functional CTA). To add a new palette from raw ColorHunt/Coolors swatches, edit the `PALETTES` array in
[tools/build-palette-schemes.mjs](tools/build-palette-schemes.mjs) and re-run it — it computes OKLCH +
contrast deterministically and regenerates `palette-schemes.md` (never hand-edit that generated file).

## How to use

Each reference is a self-contained, copy-paste-ready 2026 production guide. Route to the file matching the task, apply its recipes, and honor its antipatterns + accessibility/performance notes. Prefer the cheapest technique that satisfies the requirement (CSS before JS, native before library).
