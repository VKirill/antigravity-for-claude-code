# Upstream canonical reference — shadcn-ui/ui

These files are a **verbatim mirror** of the official shadcn skill at:

> https://github.com/shadcn-ui/ui/tree/main/skills/shadcn

**Last synced:** 2026-05-16
**License:** MIT (shadcn-ui/ui repository license)

## DO NOT EDIT files in this directory directly
Edits will be overwritten on the next upstream re-sync. To customize behaviour for our workflows, put the override in the **sibling** reference files (`../accessibility.md`, `../theming.md`, etc.) and cite the upstream rule it adapts.

## Contents

| File | Purpose | Upstream path |
|---|---|---|
| `cli.md` | Canonical CLI usage (`init`, `add`, custom registries, components.json schema) | `skills/shadcn/cli.md` |
| `customization.md` | Theming model (CSS variables, presets, dark mode, semantic tokens) | `skills/shadcn/customization.md` |
| `mcp.md` | shadcn's own MCP server (`shadcn mcp` — search/view/install components from AI tools) | `skills/shadcn/mcp.md` |
| `rules/base-vs-radix.md` | Which preset to choose for which use case | `skills/shadcn/rules/base-vs-radix.md` |
| `rules/composition.md` | Card/Dialog/Field composition patterns | `skills/shadcn/rules/composition.md` |
| `rules/forms.md` | FieldGroup, Field, validation states, ToggleGroup vs Switch | `skills/shadcn/rules/forms.md` |
| `rules/icons.md` | `data-icon` attribute, no manual sizing, lucide vs tabler | `skills/shadcn/rules/icons.md` |
| `rules/styling.md` | Semantic colors, `gap-*` not `space-*`, `size-*` shorthand, no manual `dark:` overrides | `skills/shadcn/rules/styling.md` |
| `evals.json` | Official routing/behaviour eval cases (machine-readable JSON) — complements our `../eval-cases.md` (human-readable v3 markdown) | `skills/shadcn/evals/evals.json` |

## Intentionally skipped on import
- `agents/openai.yml` — OpenAI Codex CLI config; we use `claude-code` / `opencode` instead, configs aren't transferable.
- `assets/shadcn.png`, `assets/shadcn-small.png` — brand images, not informational.

## How to re-sync
```bash
cd /tmp && rm -rf shadcn-ui-repo
git clone --depth 1 --filter=blob:none --sparse https://github.com/shadcn-ui/ui.git shadcn-ui-repo
cd shadcn-ui-repo && git sparse-checkout set skills/shadcn

# Then rsync into our upstream/ directory (excluding agents + assets)
rsync -a --delete \
  --exclude='agents' --exclude='assets' \
  /tmp/shadcn-ui-repo/skills/shadcn/ \
  /home/ubuntu/.claude/skills/shadcn/references/upstream/

# Update the "Last synced" date at the top of this file.
```
