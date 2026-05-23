# vitest — Reference Index

Quick-lookup table for all reference files. Open only what you need.

## Decision map

| Situation | Open this file |
|---|---|
| Setting up vitest.config.ts from scratch | [config.md](config.md) |
| Mocking a module, function, or method | [mocking.md](mocking.md) |
| Snapshot failing or needs update | [snapshots.md](snapshots.md) |
| Multi-environment or monorepo config | [projects-api.md](projects-api.md) |
| Running tests in a real browser (DOM) | [browser-mode.md](browser-mode.md) |
| Configuring coverage thresholds | [coverage.md](coverage.md) |
| Upgrading from Vitest 3 to 4 | [migration-3-to-4.md](migration-3-to-4.md) |
| Checking skill routing (eval prompts) | [eval-cases.md](eval-cases.md) |

## Quick-lookup: v4 key changes

| v3 key | v4 replacement | Notes |
|---|---|---|
| `test.workspace` | `test.projects` | Silently ignored if old key used |
| `forks: {}` (top-level) | `poolOptions.forks.*` | Pool config flattened |
| `threads: {}` (top-level) | `poolOptions.threads.*` | Pool config flattened |
| Snapshot format v1 | Snapshot format v2 | Run `--update-snapshots` once |
| Cross-file spy bleed | Per-file isolation | Fix: add `vi.restoreAllMocks()` in afterEach |

## Install cheatsheet

```bash
# Core
npm install -D vitest

# Coverage
npm install -D @vitest/coverage-v8       # fast, v8 native
npm install -D @vitest/coverage-istanbul  # accurate branches

# Browser mode
npm install -D @vitest/browser playwright

# UI
npm install -D @vitest/ui
```

## CLI cheatsheet

```bash
vitest              # watch mode
vitest run          # single pass (CI)
vitest run --coverage
vitest --ui         # visual explorer
vitest --reporter=verbose
vitest --update-snapshots
vitest run src/user.test.ts   # single file
vitest --pool=forks           # pool override
```
