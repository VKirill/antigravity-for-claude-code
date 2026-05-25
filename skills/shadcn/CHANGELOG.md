# shadcn skill — CHANGELOG

## [2.1.0] — 2026-05-16

### Added — upstream verbatim mirror
- `references/upstream/` — verbatim mirror of the official shadcn skill at `github.com/shadcn-ui/ui/tree/main/skills/shadcn` (synced 2026-05-16):
  - `cli.md` (276 L) — canonical CLI usage from shadcn maintainers
  - `customization.md` (209 L) — canonical theming model
  - `mcp.md` (94 L) — **new content we didn't have**: shadcn's own MCP server (`shadcn mcp`) for AI-tool component browsing/installing (Claude Code / Cursor / VS Code / OpenCode / Codex configs all documented)
  - `rules/base-vs-radix.md` (306 L), `rules/composition.md` (195 L), `rules/forms.md` (192 L), `rules/icons.md` (101 L), `rules/styling.md` (162 L) — **new** canonical patterns: preset selection, full component composition, `FieldGroup`/`data-invalid`/`aria-invalid`, `data-icon` attribute, semantic colors / `gap-*` / `size-*` shorthand / no manual `dark:` overrides
  - `evals.json` — official machine-readable eval cases (complements our v3 markdown `eval-cases.md`)
  - `SOURCE.md` — attribution + sync workflow (rsync command for next refresh)
- API Reference table in SKILL.md extended with the upstream section (clearly labelled "DO NOT EDIT — verbatim mirror").

### Intentionally skipped on import
- `agents/openai.yml` — OpenAI Codex CLI agent config, irrelevant for Claude Code / OpenCode setups.
- `assets/shadcn.png`, `assets/shadcn-small.png` — brand images, not informational.

### Rationale
Same precedent as `karpathy-guidelines`: when an upstream maintainer ships an official Agent Skills bundle, mirror it verbatim with attribution rather than paraphrase. Our sibling references (`theming.md`, `setup-and-cli.md`, `accessibility.md`, etc.) stay in place to extend or contextualize the upstream rules for our specific workflows, but don't override them.

### Source
- <https://github.com/shadcn-ui/ui/tree/main/skills/shadcn> (verified 2026-05-16; MIT license per shadcn-ui/ui repository)

## [2.0.0] — 2026-05-16

### Changed

- `references/eval-cases.md` migrated to v3 format: user-voice + Expected behavior + How to verify (10/10/5)
- Added `risk: medium-stakes` frontmatter
- SKILL.md left at 230 lines (under 250) — no compression needed

### Added

- `references/recommended-defaults.md` — `components.json` baseline (style: new-york, baseColor: zinc, RSC, lucide), style/baseColor choice tables, dark mode strategy, custom registry config

## [1.0.0] — 2026-05-15

### Added
- Initial skill generation at skill-evaluation v2 quality bar
- SKILL.md — navigator with full capabilities outline (Pattern 2)
- `references/REFERENCE.md` — decision map, import cheat-sheet, CLI command reference
- `references/setup-and-cli.md` — `npx shadcn init`, components.json fields, path aliases, Tailwind v3/v4 differences
- `references/theming.md` — CSS variable architecture, Tailwind v4 `@theme inline`, dark mode with next-themes
- `references/form-integration.md` — RHF + Zod + shadcn Form stack, controlled components, Server Actions, useFieldArray
- `references/custom-registry.md` — registry manifest format, hosting options, cssVars injection
- `references/accessibility.md` — Radix ARIA guarantees, what to add vs not to add, keyboard nav reference
- `references/popular-components.md` — Button, Dialog, Select, Sheet, Tabs, Sonner, DropdownMenu, Command, Table, Card, Badge, Skeleton
- `references/eval-cases.md` — routing test prompts (positive, negative, edge cases)
- `templates/components.json` — production-ready config template (new-york style, zinc base, CSS vars)
- `templates/utils.ts` — cn() helper with comments explaining tailwind-merge + clsx
- `templates/globals.css` — full CSS variable theme with Tailwind v4 setup and `{{placeholder}}` markers
- `examples/build-data-table.md` — complete DataTable with TanStack Table: sorting, filtering, pagination, row selection
- `examples/form-with-rhf-zod.md` — profile form with text, textarea, select, checkboxes, Server Action, toast
