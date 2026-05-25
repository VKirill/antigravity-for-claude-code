# Conventional Commits

The 2026 mainstream commit message convention. Machine-parseable, human-friendly, drives changelog generation and SemVer bumps.

## Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

- `type` — required, lowercase
- `scope` — optional, parenthesized
- `subject` — short imperative sentence ("add login", not "added login")
- `body` — wrap at ~72 chars, blank line above
- `footer` — `BREAKING CHANGE:`, `Refs:`, `Closes #123`

## Types

| Type | Meaning | SemVer bump |
|---|---|---|
| `feat` | New feature | minor |
| `fix` | Bug fix | patch |
| `docs` | Documentation only | — |
| `style` | Formatting, no logic change | — |
| `refactor` | Code change, no behavior change | — |
| `perf` | Performance improvement | patch |
| `test` | Tests only | — |
| `build` | Build system, dependencies | — |
| `ci` | CI configuration | — |
| `chore` | Other maintenance | — |
| `revert` | Reverts a previous commit | varies |

Breaking change: append `!` after type → `feat!:` or add `BREAKING CHANGE:` in footer. Drives **major** SemVer bump.

## Examples

```
feat(auth): add OAuth2 PKCE flow

Replace legacy implicit grant with PKCE for SPA security.

Closes #142
```

```
fix(api): handle null cursor in pagination

Calling /api/items with cursor=null threw 500.
Now returns the first page.

Fixes #251
```

```
feat(api)!: drop deprecated /v1 endpoints

BREAKING CHANGE: /v1 has been removed. Migrate to /v2.
```

```
chore(deps): bump typescript-eslint to 8.20.0
```

## Scope conventions

Scopes are domain-specific. Pick one strategy and be consistent:

- **By package** (monorepo): `feat(web): ...`, `fix(api): ...`
- **By feature**: `feat(auth): ...`, `fix(billing): ...`
- **By layer**: `feat(ui): ...`, `fix(db): ...`

Scope is optional. Skip it when global: `chore: update CI runner`.

## Subject line rules

- Imperative mood: "add", "fix", "remove" — not "added"/"adding"
- No period at the end
- Capitalize the first word (style preference; some teams use lowercase)
- < 72 chars (50 is the GitHub display limit)

## commitlint setup

```bash
npm install --save-dev @commitlint/cli @commitlint/config-conventional
```

`commitlint.config.js`:
```js
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore", "revert"],
    ],
    "scope-case": [2, "always", "kebab-case"],
    "subject-case": [2, "never", ["pascal-case", "upper-case"]],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "header-max-length": [2, "always", 100],
  },
};
```

Wire into commit-msg hook (lefthook):
```yaml
commit-msg:
  commands:
    commitlint:
      run: npx commitlint --edit {1}
```

## Why bother

1. **Changelog automation** — `conventional-changelog`, `release-please`, `semantic-release` all parse this format
2. **SemVer automation** — release tools infer the next version (patch/minor/major) from commit types
3. **History grep** — `git log --grep="^fix"` finds all bug fixes
4. **Code review signal** — reviewers know the scope of a change before opening the diff

## Common mistakes

| Anti-pattern | Better |
|---|---|
| `update stuff` | `chore: update README` |
| `fix bug` | `fix(auth): reject expired tokens` |
| `WIP` | Don't push WIP commits; squash before merge |
| `Merge branch 'main'` | Use rebase, or set `pull.rebase=true` |
| `feat: massive refactor + new feature` | Split into separate `refactor:` + `feat:` commits |

## Tooling

- `commitizen` — interactive prompts to compose conventional commits
- `commitlint` — validates messages
- `release-please` — Google's auto-release tool, parses conventional commits
- `semantic-release` — fully automated SemVer + npm publish
- `git-cliff` — Rust-based changelog generator from conventional commits
