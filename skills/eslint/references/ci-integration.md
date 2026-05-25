# CI integration

## Command for CI

```bash
eslint . --cache --cache-location node_modules/.cache/eslint --max-warnings 0
```

- `--cache` — only re-lint changed files (caches results to `.eslintcache` or specified location)
- `--cache-location` — put cache where CI can restore it between runs
- `--max-warnings 0` — non-zero exit on any warning (forces zero-warning policy)

## GitHub Actions

```yaml
name: Lint
on: [push, pull_request]

jobs:
  eslint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: "npm"

      - run: npm ci

      - name: Restore ESLint cache
        uses: actions/cache@v4
        with:
          path: node_modules/.cache/eslint
          key: eslint-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}-${{ github.sha }}
          restore-keys: |
            eslint-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}-

      - run: npx eslint . --cache --cache-location node_modules/.cache/eslint --max-warnings 0
```

Cache key strategy: include `github.sha` for unique caches, fall back via `restore-keys` to the previous build for the same lockfile.

## Only lint changed files

```yaml
- name: Get changed files
  id: changed
  uses: tj-actions/changed-files@v45
  with:
    files: |
      **/*.{js,jsx,ts,tsx,vue}

- name: Run ESLint on changed
  if: steps.changed.outputs.any_changed == 'true'
  run: npx eslint ${{ steps.changed.outputs.all_changed_files }} --max-warnings 0
```

For PR-only lint, this is dramatically faster than linting the whole repo.

## Pre-commit hook (lint-staged)

```bash
npm install --save-dev lint-staged
```

`package.json`:
```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": ["eslint --fix --max-warnings 0"]
  }
}
```

`lefthook.yml` (recommended modern hook runner):
```yaml
pre-commit:
  parallel: true
  commands:
    eslint:
      glob: "*.{js,jsx,ts,tsx,vue}"
      run: npx eslint --fix --max-warnings 0 {staged_files}
      stage_fixed: true
```

## Reporters

| Reporter | When |
|---|---|
| `stylish` (default) | Local dev |
| `json` | Machine processing |
| `compact` | Single-line per error — easier for logs |
| `junit` | Required by Jenkins/Bamboo |
| `@microsoft/eslint-formatter-sarif` | GitHub Code Scanning integration |

```bash
eslint . --format json -o eslint-report.json
```

## SARIF for GitHub Code Scanning

```yaml
- run: npx eslint . --format @microsoft/eslint-formatter-sarif --output-file eslint-results.sarif
  continue-on-error: true

- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: eslint-results.sarif
    wait-for-processing: true
```

Lint findings show up in the GitHub Security tab — much better UX than reading CI logs.

## Performance tips

1. **Always use `--cache`** — 10–50x faster on rerun
2. **Use `projectService: true`** — faster than legacy `project:` field
3. **Scope plugins via `files`** — don't parse Node config files with React plugin
4. **Skip in dependabot/docs PRs** — use path filters

```yaml
on:
  pull_request:
    paths:
      - "**/*.{js,jsx,ts,tsx}"
      - "eslint.config.*"
      - "package.json"
```

## Exit codes

| Exit | Meaning |
|---|---|
| `0` | Clean (or warnings without `--max-warnings 0`) |
| `1` | Lint errors found |
| `2` | ESLint internal error (config invalid, parser crash) |

Treat `2` differently from `1` in CI — it indicates broken setup, not bad code.

## Local dev script

```json
{
  "scripts": {
    "lint": "eslint . --cache",
    "lint:fix": "eslint . --cache --fix",
    "lint:ci": "eslint . --cache --max-warnings 0",
    "lint:debug": "eslint . --inspect-config"
  }
}
```
