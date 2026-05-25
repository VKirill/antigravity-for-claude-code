---
name: git
description: "Git distributed VCS workflows. Use when: git, rebase, interactive rebase, autosquash, fixup, worktree, conventional commits, branching, GitHub Flow, trunk-based, GitFlow, signing, GPG, SSH signing, sigstore, hooks, husky, lefthook, commitlint, .gitignore, git lfs, rerere, autostash, force-with-lease, cherry-pick, bisect, reflog. SKIP: GitHub UI/PRs (→github), SVN/Mercurial migration, monorepo tooling (nx/turbo)."
stacks:
  - vcs
risk: low-stakes
source: vechkasov-global-skills
packages:
  - "git"
tags:
  - git
  - vcs
  - workflow
  - rebase
  - worktree
  - signing
  - hooks
  - conventional-commits
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- Bash: `5.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded automatically when its description matches the active task. Read only the section you need, then follow the link to the relevant reference file for full detail.

## Use this skill when

- Choosing or implementing a branching strategy (GitHub Flow, trunk-based, GitFlow)
- Writing Conventional Commits messages or wiring up `commitlint`
- Performing or recovering from an interactive rebase (`git rebase -i`, autosquash, fixup)
- Setting up `git worktree` to work on multiple branches in parallel without stashing
- Configuring Git hooks (pre-commit, commit-msg, pre-push) via `husky`, `lefthook`, or native `.git/hooks`
- Setting up commit signing — GPG, SSH signing, or `gitsign` (sigstore keyless)
- Managing large files via Git LFS or git-fat
- Investigating bugs with `git bisect`, `git reflog`, `git blame`, or `git log -S` (pickaxe)
- Designing safer collaboration: `git push --force-with-lease`, `pull.rebase`, `rerere.enabled`, `rebase.autoStash`
- Crafting a `.gitignore` for Node/Python/Rust/.editor-files
- Recovering from "detached HEAD", lost commits, accidentally pushed secrets, or borked merges

## Do not use this skill when

- The task is GitHub-specific UI: PR templates, Actions, branch rules, labels — those are `github` / `github-actions`
- The task is monorepo orchestration (nx, turbo, lerna) — separate tooling, not git itself
- The task is migrating from SVN or Mercurial — niche, beyond scope
- The task is git internals authoring (writing a new SCM, porcelain) — beyond practical workflow scope

## Purpose

Git operationally: clean history (rebase, autosquash, fixup), safe collaboration (`--force-with-lease`, `rerere`), parallel work (worktrees), hygiene (hooks, commitlint, signed commits), recovery (`reflog`, `bisect`). Process-focused, not GitHub-focused — PRs/Actions/branch protection belong to `github` / `github-actions`. Out of scope: GitHub UI, monorepo tools (nx/turbo), SVN/Hg migration.

## Capabilities

### Branching strategies

Three mainstream 2026 patterns:

| Strategy | Use when |
|---|---|
| **GitHub Flow** | Most teams: `main` is always deployable, short-lived feature branches, PR merge |
| **Trunk-based** | High-velocity teams with strong CI: tiny branches, daily merges, feature flags for unfinished work |
| **GitFlow** (legacy) | Versioned products with parallel release lines (`develop`, `release/*`, `hotfix/*`) — rare in 2026 |

Pick the simplest one that fits your release model. GitFlow is overkill for SaaS.

> Full comparison + decision tree: [references/branching-strategies.md](references/branching-strategies.md)

### Conventional Commits

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `test`, `build`, `ci`, `perf`. Breaking change → `feat!:` or footer `BREAKING CHANGE:`.

Enforce via `commitlint` + Git hook (`commit-msg`).

> Full spec, examples, and commitlint config: [references/conventional-commits.md](references/conventional-commits.md)

### Rebasing and history

Interactive rebase is the cleanup tool:

```bash
git rebase -i HEAD~5             # rewrite last 5 commits
git commit --fixup <sha>         # mark a fixup commit
git rebase -i --autosquash main  # auto-arrange fixups
```

Always rebase BEFORE pushing. After pushing, only rebase if you own the branch and use `--force-with-lease`.

> Full rebase patterns, autosquash, recovery: [references/rebasing-and-history.md](references/rebasing-and-history.md)

### Worktrees

Work on multiple branches in parallel without stashing:

```bash
git worktree add ../proj-feature-x feature-x
git worktree add ../proj-hotfix -b hotfix/critical main
git worktree list
git worktree remove ../proj-feature-x
```

Each worktree is a full checkout of a different branch from one shared `.git` directory. Massively better than stashing for context switches.

> Worktree workflows, cleanup, IDE integration: [references/worktrees.md](references/worktrees.md)

### Hooks

Pre-commit / commit-msg / pre-push automation. Modern manager: `lefthook` (fast, parallel, no Node runtime needed). Legacy: `husky` (Node-only). Native `.git/hooks/*` work for solo projects.

```yaml
# lefthook.yml
pre-commit:
  parallel: true
  commands:
    lint:
      glob: "*.{ts,tsx}"
      run: npx eslint --fix {staged_files}
    typecheck:
      run: npx tsc --noEmit
commit-msg:
  commands:
    commitlint:
      run: npx commitlint --edit {1}
```

> Full hooks guide with husky vs lefthook vs native: [references/hooks.md](references/hooks.md)

### Signing

Three options:

| Method | Tradeoff |
|---|---|
| **SSH signing** (default since 2.34) | Reuse existing SSH keys, GitHub verifies via uploaded keys |
| **GPG** | Mature, works everywhere, key management is awkward |
| **`gitsign` / sigstore** | Keyless via OIDC, no long-lived secrets — best for CI/automation |

**Default recommendation: SSH signing**. Re-uses keys you already have; one config command:

```bash
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
git config --global commit.gpgsign true
```

> Full setup + GitHub verification + sigstore: [references/signing.md](references/signing.md)

### Large files (Git LFS)

```bash
git lfs install
git lfs track "*.psd" "*.mp4" "models/*.bin"
git add .gitattributes
```

LFS replaces the file content with a pointer; the binary lives in a separate store. Use for: design assets, binary data, ML models, video. Don't use for: anything text-diffable.

> LFS setup, migration, and pitfalls: [references/large-files-and-lfs.md](references/large-files-and-lfs.md)

### Remote collaboration

Safety-first defaults:

```bash
git config --global pull.rebase true
git config --global rebase.autoStash true
git config --global rerere.enabled true
git config --global push.default current
git config --global push.autoSetupRemote true
```

For forced pushes, ALWAYS use `--force-with-lease`:

```bash
git push --force-with-lease=main:<sha-you-expect>
```

`--force-with-lease` refuses to push if someone else committed in the meantime. Plain `--force` silently overwrites.

> Forks, PR flow, rerere, autostash: [references/remote-collaboration.md](references/remote-collaboration.md)

### Debugging history

`git bisect` (binary-search a regression, `git bisect run ./test.sh`), `git reflog` (find lost commits), `git log -S "string"` (pickaxe), `git log -p file` (file history), `git blame` (line ownership).

## Behavioral Traits

- Defaults to GitHub Flow unless the project clearly needs trunk-based or GitFlow
- Writes Conventional Commits messages without being asked (`feat:`, `fix:`, `chore:` prefixes)
- Uses `git commit --fixup <sha>` + `--autosquash` rebase instead of crafting "fix typo" commits
- Prefers `git worktree add` over `git stash` for context switches
- Uses `git push --force-with-lease`, NEVER plain `--force`
- Sets `pull.rebase = true` and `rebase.autoStash = true` globally
- Enables `rerere.enabled = true` to make recurring merge conflicts solve themselves
- Signs commits with SSH (`gpg.format = ssh`) when no other signing convention exists
- Prefers `lefthook` over `husky` for new projects (faster, no Node dependency)
- Reaches for `git reflog` before `git reset --hard` when recovery might be needed
- Uses `git bisect run <script>` for regression hunting — far faster than manual bisection

## Important Constraints

- NEVER use `git push --force` — always `--force-with-lease` (refuses to overwrite other people's work)
- NEVER rebase commits that have been pushed to a shared branch (`main`, `develop`)
- NEVER commit secrets — once pushed, they're forever; use `git-secrets`, `gitleaks`, or pre-commit hooks
- NEVER `git reset --hard` without checking `git reflog` first if you might want recovery
- NEVER commit large binaries to plain git — use Git LFS or external object storage
- ALWAYS `git fetch` before `git rebase origin/main` — rebasing against a stale ref creates phantom conflicts
- ALWAYS verify hook scripts are executable (`chmod +x`) — silent failure otherwise
- ALWAYS use `commit.gpgsign true` on shared repos that verify signatures (most modern GitHub orgs)
- ALWAYS exclude `.env`, `*.pem`, credentials in `.gitignore` BEFORE the first commit on a new repo
- NEVER use `git merge --no-ff` reflexively — only when preserving topological intent matters

## Related Skills

**90%-filter applied** — Git is universal; here are mainstream consumers.

### AI coding CLIs (deep git integration)
- ✓ `claude-code` — Anthropic's Claude Code CLI, git-aware
- ✓ `opencode` — open-source multi-provider CLI
- ✓ `codex` — OpenAI Codex CLI

### Language runtimes (universal context)
- ✓ `nodejs` — Node.js 24 (hosts husky, lefthook, commitlint)
- ✓ `typescript` — TS 5.9

### Cascade markers (loaded only if active)
- `github-actions` — CI/CD often paired with git workflows
- `commitlint` — commit-message validator
- `husky` — Node-based git hooks manager
- `lefthook` — Go-based git hooks manager (recommended modern choice)

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Index, decision map, CLI quick-lookup | [references/REFERENCE.md](references/REFERENCE.md) |
| Branching strategies (GitHub Flow, trunk-based, GitFlow) | [references/branching-strategies.md](references/branching-strategies.md) |
| Conventional Commits spec, types, commitlint integration | [references/conventional-commits.md](references/conventional-commits.md) |
| Rebasing, autosquash, fixup, history-rewriting recovery | [references/rebasing-and-history.md](references/rebasing-and-history.md) |
| `git worktree` — parallel branches, cleanup, IDE integration | [references/worktrees.md](references/worktrees.md) |
| Hooks: husky vs lefthook vs native, pre-commit / commit-msg / pre-push | [references/hooks.md](references/hooks.md) |
| Signing: SSH (default), GPG, sigstore/gitsign, GitHub verification | [references/signing.md](references/signing.md) |
| Git LFS — tracking, migration, alternatives | [references/large-files-and-lfs.md](references/large-files-and-lfs.md) |
| Remote collaboration: forks, PR flow, `--force-with-lease`, rerere | [references/remote-collaboration.md](references/remote-collaboration.md) |
| Eval cases — routing tests (10/10/5) | [references/eval-cases.md](references/eval-cases.md) |

### Templates

Production-ready configs — copy and adjust:

| Template | File |
|---|---|
| `.gitignore` for Node + TypeScript projects | [templates/.gitignore.node](templates/.gitignore.node) |
| `commitlint.config.js` — Conventional Commits enforcement | [templates/commitlint.config.js](templates/commitlint.config.js) |
| `lefthook.yml` — modern hook manager with lint/format/commitlint | [templates/lefthook.yml](templates/lefthook.yml) |
| `pre-commit` — native git hook script | [templates/pre-commit](templates/pre-commit) |

### Examples

| Scenario | File |
|---|---|
| Recovery walkthrough: lost commits via reflog after bad rebase | [examples/recover-from-bad-rebase.md](examples/recover-from-bad-rebase.md) |

**How to use**: navigate to the specific file for the topic you need. Don't read all files — look up only what's relevant to the current task.
