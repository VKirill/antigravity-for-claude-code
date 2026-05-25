# Hooks

Git hooks run scripts at specific lifecycle events: `pre-commit`, `commit-msg`, `pre-push`, `post-merge`, etc. They live in `.git/hooks/` but that's not version-controlled — use a hook manager to share hooks across the team.

## Hook manager comparison

| Tool | Runtime | Pros | Cons |
|---|---|---|---|
| **lefthook** | Go binary, no runtime dep | Fast, parallel, single config, language-agnostic | Need to install binary |
| **husky** | Node.js | Mature, npm-installable, huge ecosystem | Slow on Windows, Node-only |
| **pre-commit** (Python) | Python | Rich plugin ecosystem | Python dep, mostly Python projects |
| **Native `.git/hooks/`** | Shell | Zero dep | Not shareable, manual install |
| **`core.hooksPath`** | Shell | Shareable, no manager | DIY |

**Recommendation 2026**: `lefthook` for new projects, `husky` if already entrenched, native for solo work.

## lefthook setup

```bash
# Install
npm install --save-dev lefthook
# or via brew / cargo / go install / curl

# Initialize
npx lefthook install
```

`lefthook.yml`:
```yaml
pre-commit:
  parallel: true
  commands:
    eslint:
      glob: "*.{js,jsx,ts,tsx,vue,astro}"
      run: npx eslint --fix --max-warnings 0 {staged_files}
      stage_fixed: true
    prettier:
      glob: "*.{json,md,yml,yaml,css}"
      run: npx prettier --write {staged_files}
      stage_fixed: true
    typecheck:
      glob: "*.{ts,tsx}"
      run: npx tsc --noEmit
    secrets:
      run: npx gitleaks protect --staged

commit-msg:
  commands:
    commitlint:
      run: npx commitlint --edit {1}

pre-push:
  commands:
    tests:
      run: npm test
```

Notes:
- `parallel: true` runs hooks concurrently
- `glob` scopes the hook to specific files
- `{staged_files}` is replaced with the actual staged file list
- `stage_fixed: true` re-stages files after auto-fix (so the commit includes the fixes)

## husky setup

```bash
# Install
npm install --save-dev husky
npx husky init
```

`.husky/pre-commit`:
```bash
#!/usr/bin/env sh
npx lint-staged
```

`package.json`:
```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": ["eslint --fix --max-warnings 0"],
    "*.{json,md,yml,css}": ["prettier --write"]
  }
}
```

`.husky/commit-msg`:
```bash
#!/usr/bin/env sh
npx commitlint --edit "$1"
```

## Native hooks (no manager)

Set a shared hooks path:

```bash
mkdir .githooks
git config core.hooksPath .githooks    # or commit this to repo via gitconfig
```

`.githooks/pre-commit`:
```bash
#!/bin/sh
set -e
exec < /dev/tty               # allow interactive prompts

# Run linter on staged files
STAGED=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx)$' || true)
if [ -n "$STAGED" ]; then
  echo "$STAGED" | xargs npx eslint --max-warnings 0
fi
```

```bash
chmod +x .githooks/pre-commit
```

Add to onboarding: `git config core.hooksPath .githooks` after clone.

## Common hooks

### pre-commit

Lint, format, type-check, secret scan, fast tests on staged files:

```yaml
pre-commit:
  parallel: true
  commands:
    lint:    { glob: "*.{ts,tsx}", run: npx eslint --fix {staged_files}, stage_fixed: true }
    format:  { glob: "*.{json,md}", run: npx prettier --write {staged_files}, stage_fixed: true }
    types:   { glob: "*.{ts,tsx}", run: npx tsc --noEmit }
    secrets: { run: npx gitleaks protect --staged --no-banner }
```

### commit-msg

Validate the message format:

```yaml
commit-msg:
  commands:
    commitlint: { run: npx commitlint --edit {1} }
```

### pre-push

Run tests before push:

```yaml
pre-push:
  commands:
    tests: { run: npm test }
```

Pre-push is better than pre-commit for slow tests — commit cycles stay fast, only pushes pay the cost.

### post-merge

Re-install deps after pulling lockfile changes:

```yaml
post-merge:
  commands:
    install:
      files: "git diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD"
      run: |
        if echo "{files}" | grep -q package-lock.json; then npm ci; fi
```

## Bypassing hooks

```bash
git commit --no-verify           # skip pre-commit + commit-msg
git push --no-verify             # skip pre-push
```

**Don't make this routine.** If hooks are too slow, optimize them (cache, scope to staged files, parallelize). If a hook is wrong, fix the hook, don't bypass.

## Performance

Slow hooks = developers bypass them. Patterns to keep them fast:

1. **Scope to staged files** — never lint the whole repo on commit
2. **Cache** — `eslint --cache`, TS incremental compile
3. **Parallel** — `lefthook` does this natively
4. **Pre-push for slow stuff** — tests, type-check on tens of thousands of files

A pre-commit hook that takes > 5 seconds is too slow.

## Secret scanning

```bash
# Install
brew install gitleaks
# or
docker run --rm -v $(pwd):/repo zricethezav/gitleaks:latest protect --staged

# Pre-commit hook
gitleaks protect --staged --no-banner
```

Catches AWS keys, GitHub tokens, private keys etc. before they leave the dev machine.

## Server-side hooks

Some hooks (`pre-receive`, `update`, `post-receive`) run on the git server, not the client. For GitHub/GitLab, use:

- **Branch protection rules** (block direct push to main)
- **Status checks** (require CI green)
- **Required reviewers**

Client-side hooks can be bypassed — server-side enforcement is the source of truth.
