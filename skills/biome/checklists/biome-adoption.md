# Biome Adoption Checklist

## Pre-flight (before starting migration)

- [ ] Confirm Biome supports all file types used in the project
  - [ ] JS/TS/JSX/TSX: supported
  - [ ] JSON/JSONC: supported
  - [ ] CSS: supported (partial linting)
  - [ ] Vue SFCs, Svelte, Astro files: NOT supported (Biome processes JS/TS blocks only if extracted)
  - [ ] Markdown/HTML/GraphQL: NOT supported
- [ ] List all ESLint plugins in use — check for Biome equivalents in [references/migration-from-eslint-prettier.md](../references/migration-from-eslint-prettier.md)
- [ ] Identify any ESLint rules with no Biome equivalent that are actively enforced
- [ ] Confirm team agreement on accepting coverage gaps for unmapped rules
- [ ] Check if any CI step depends on ESLint/Prettier exit codes or output format
- [ ] Verify VS Code Biome extension (`biomejs.biome`) is installable in team's VS Code setup

## Migration (during)

- [ ] Install `@biomejs/biome` as devDependency
- [ ] Run `biome init` to create `biome.json`
- [ ] Run `biome migrate prettier --write` (if Prettier is used)
- [ ] Run `biome migrate eslint --write` (if ESLint is used)
- [ ] Review unmapped rules report — document decision for each unmapped rule
- [ ] Add `$schema` to `biome.json` matching installed version
- [ ] Enable `vcs.useIgnoreFile: true`
- [ ] Set `files.ignore` for build outputs and generated files
- [ ] Run `biome check .` (dry run) — record baseline violation count
- [ ] Run `biome check --write .` — apply all auto-fixes
- [ ] Commit auto-fix changes as a standalone "chore: biome format" commit
- [ ] Fix or suppress remaining violations manually
- [ ] Add suppression comments with reasons (not just `biome-ignore lint:`)

## Cleanup (after migration)

- [ ] Remove `eslint` and all `eslint-*` packages from devDependencies
- [ ] Remove `prettier` and all `prettier-*`/`eslint-config-prettier` packages
- [ ] Delete `.eslintrc*`, `.eslintignore`, `.prettierrc*`, `.prettierignore`
- [ ] Update `package.json` scripts (replace `eslint`/`prettier` commands with `biome`)
- [ ] Update CI pipeline to use `biome ci .` instead of ESLint + Prettier steps
- [ ] Update pre-commit hook (lefthook / husky) to use Biome
- [ ] Update VS Code `.vscode/settings.json` to set `"editor.defaultFormatter": "biomejs.biome"`
- [ ] Disable Prettier VS Code extension (`"prettier.enable": false`) if installed
- [ ] Verify `biome ci .` exits 0 in CI

## Acceptance (verify migration complete)

- [ ] `npx @biomejs/biome ci .` exits 0 with no violations
- [ ] `git grep "eslint-disable"` returns 0 results (or only intentional legacy comments)
- [ ] `git grep "prettier-ignore"` returns 0 results (or only intentional ones)
- [ ] VS Code: save a `.ts` file → formatting applies automatically
- [ ] VS Code: lint violations show as inline squiggles
- [ ] GitHub Actions: CI runs Biome, reports violations as PR annotations
- [ ] Pre-commit hook: making a commit auto-fixes formatting
- [ ] No `eslint` or `prettier` in `node_modules/.bin/` (if you deleted them)

## Self-check (model verification before declaring done)

- [ ] `biome.json` has `$schema` pointing to the correct installed version
- [ ] `biome.json` has `"vcs": { "useIgnoreFile": true }` — respects `.gitignore`
- [ ] No `biome-ignore` comment without a reason string
- [ ] No unused `biome-ignore` comments (Biome reports these as errors)
- [ ] CI uses `biome ci` (not `biome check`) — correct exit codes
- [ ] `formatter.lineEnding: "lf"` set to prevent Windows churn
- [ ] `files.ignore` covers all generated/built directories
- [ ] `organizeImports.enabled: true` set if import sorting was handled by ESLint before

## Team rollout (large teams)

For teams of 5+:

- [ ] Announce migration in team channel with a "formatting-only PR" explanation
- [ ] Create the Biome config PR separately from any logic changes
- [ ] Merge the formatting-only commit before any feature work to avoid conflicts
- [ ] Share the VS Code setup instructions (`templates/.vscode/settings.json`)
- [ ] Confirm all team members have the Biome extension installed before merge
- [ ] Run `biome ci .` in CI for 1 week before removing ESLint/Prettier (parallel run)
- [ ] Remove ESLint/Prettier only after the parallel run shows no unexpected gaps
