# Biome — CI Integration

## `biome ci` vs `biome check`

Always use `biome ci` in CI pipelines.

| | `biome check` | `biome ci` |
|---|---|---|
| Writes fixes | With `--write` flag | Never |
| Exit code on violation | 0 (warning only) without `--error-on-warnings` | 1 (non-zero) always |
| Reporter | Human-readable | CI-optimized (no color by default) |
| Suitable for CI | Only with `--write=false --error-on-warnings` | Yes, by default |

`biome ci` = `biome check` + `--write=false` + `--error-on-warnings` + CI reporter. Use it.

## Basic GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  biome:
    name: Lint & Format
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: "npm"

      - run: npm ci

      - name: Biome check
        run: npx @biomejs/biome ci .
```

## Check only changed files (PR optimization)

```yaml
- name: Biome check (changed files only)
  run: |
    npx @biomejs/biome ci --changed --since=origin/${{ github.base_ref }} .
```

`--changed` requires `vcs.enabled: true` and `vcs.defaultBranch` in `biome.json`:
```json
"vcs": {
  "enabled": true,
  "clientKind": "git",
  "useIgnoreFile": true,
  "defaultBranch": "main"
}
```

Without `--changed`, Biome checks all files in the project on every PR. For large repos (>50k files), `--changed` reduces CI time from ~5s to ~0.2s.

## GitHub Actions with reviewdog annotations

```yaml
- name: Biome (with PR annotations)
  uses: biomejs/setup-biome@v2
  with:
    version: latest

- name: Run Biome
  run: biome ci --reporter=github .
```

`--reporter=github` outputs GitHub Actions annotation format (`::error file=...`), which shows inline violations directly in PR diffs.

## GitLab CI

```yaml
# .gitlab-ci.yml
biome:
  image: node:24-alpine
  stage: lint
  cache:
    paths:
      - node_modules/
  script:
    - npm ci
    - npx @biomejs/biome ci .
  only:
    - merge_requests
    - main
```

## Pre-commit hook — lefthook

```yaml
# lefthook.yml
pre-commit:
  commands:
    biome:
      glob: "*.{js,ts,jsx,tsx,json,jsonc,css}"
      run: npx @biomejs/biome check --write --no-errors-on-unmatched --files-ignore-unknown=true {staged_files}
      stage_fixed: true
```

- `{staged_files}` — lefthook variable for staged files
- `stage_fixed: true` — re-stage files modified by Biome
- `--no-errors-on-unmatched` — no error if staged files don't match glob
- `--files-ignore-unknown=true` — skip files Biome can't handle

## Pre-commit hook — husky + lint-staged

```json
// package.json
{
  "lint-staged": {
    "*.{js,ts,jsx,tsx,json,jsonc,css}": [
      "biome check --write --no-errors-on-unmatched --files-ignore-unknown=true"
    ]
  }
}
```

```bash
# .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
npx lint-staged
```

Note: lint-staged passes file paths as arguments. Biome accepts a list of file paths or globs as positional arguments.

## Pre-commit hook — standalone (no tool)

```bash
# .git/hooks/pre-commit (or scripts/pre-commit.sh symlinked)
#!/usr/bin/env bash
set -euo pipefail

STAGED=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(js|ts|jsx|tsx|json|jsonc|css)$' || true)

if [ -n "$STAGED" ]; then
  echo "$STAGED" | xargs npx @biomejs/biome check --write --no-errors-on-unmatched
  echo "$STAGED" | xargs git add
fi
```

## Reporters

```bash
# Default: human-readable with colors
biome ci .

# GitHub Actions annotations
biome ci --reporter=github .

# JSON output (for custom tooling)
biome ci --reporter=json . > violations.json

# JUnit XML (for CI artifact upload)
biome ci --reporter=junit . > biome-report.xml
```

## Exit codes

| Code | Meaning |
|---|---|
| 0 | No violations |
| 1 | Violations found (lint errors, format issues) |
| 2 | Configuration error or Biome internal error |

Always check exit code — CI pipelines should fail on exit code 1.

## Skipping CI on format-only commits

If you commit a `biome format --write` batch, add `[skip ci]` or equivalent to the commit message, or use path filters in GitHub Actions:

```yaml
on:
  push:
    paths-ignore:
      - "**/*.md"
    # Note: you cannot skip your own lint job — use concurrency groups instead
```

Better pattern: run Biome as a separate job that can be re-run independently:

```yaml
jobs:
  biome:
    runs-on: ubuntu-latest
    concurrency:
      group: biome-${{ github.ref }}
      cancel-in-progress: true
```

## Caching

Biome is fast enough that caching is rarely needed. The binary itself is 10–20MB. If you want to cache:

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}

- run: npm ci
```

`npm ci` restores node_modules from cache, which includes `@biomejs/biome`. No separate Biome cache needed.

## Monorepo CI

Run Biome from the root with a root `biome.json`:
```bash
npx @biomejs/biome ci .
```

Or per-package:
```bash
for pkg in packages/*/; do
  npx @biomejs/biome ci "$pkg"
done
```

For Turborepo:
```json
// turbo.json
{
  "pipeline": {
    "lint": {
      "outputs": [],
      "inputs": ["**/*.ts", "**/*.tsx", "biome.json"]
    }
  }
}
```

```json
// package.json (root)
{
  "scripts": {
    "lint": "turbo run lint"
  }
}
```

```json
// packages/ui/package.json
{
  "scripts": {
    "lint": "biome ci ."
  }
}
```
