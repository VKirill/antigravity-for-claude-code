# Worktrees

`git worktree` lets you check out multiple branches simultaneously into separate directories — without stashing, cloning, or switching branches in your main checkout.

## The problem worktrees solve

You're mid-feature on `feat/x`. A critical bug report comes in for `main`. Options:

1. **Stash**: `git stash; git switch main; ...; git switch feat/x; git stash pop` — works but tedious, breaks IDE state
2. **Clone**: `git clone repo repo-hotfix` — works but slow, duplicates `.git`
3. **Worktree**: `git worktree add ../repo-hotfix main` — fast, shared `.git`, both checkouts active at once

Worktrees win on every axis except "muscle memory" until you build it.

## Basic commands

```bash
# Create a worktree for an existing branch
git worktree add ../proj-feature-x feature-x

# Create a worktree with a NEW branch
git worktree add ../proj-hotfix -b hotfix/critical main

# Create a worktree at a specific commit (detached HEAD)
git worktree add ../proj-old a1b2c3d

# List all worktrees
git worktree list

# Remove a worktree (deletes the directory)
git worktree remove ../proj-feature-x

# Prune stale worktree metadata after manual rm
git worktree prune
```

## Directory layout

```
~/code/
├── myproject/              ← main worktree, has .git
│   └── .git/
└── myproject-hotfix/        ← second worktree
    └── .git                 ← FILE (points to ../myproject/.git/worktrees/hotfix)
```

Both directories share the same `.git/objects`. Switching between them is instant.

## Real workflow: hotfix without disrupting feature work

```bash
# You're on feat/x in the main checkout, with uncommitted changes
cd ~/code/myproject

# Spawn a worktree on main for the hotfix
git worktree add ../myproject-hotfix main
cd ../myproject-hotfix

# Fix the bug
git switch -c hotfix/null-cursor
# ...fix
git commit -am "fix(api): handle null cursor"
git push -u origin hotfix/null-cursor

# Open PR. Once merged, clean up
cd ~/code/myproject
git worktree remove ../myproject-hotfix
git fetch
```

Your `feat/x` work is untouched the whole time.

## IDE integration

VS Code / Cursor / WebStorm: open the worktree directory as a separate window. The IDE treats it as an independent project (linting state, terminal cwd, debugger config).

```bash
git worktree add ../proj-hotfix main
code ../proj-hotfix
```

## Worktree per branch pattern

For long-lived branches (release, develop, main), keep dedicated worktrees:

```bash
~/code/myproject-main/         # main
~/code/myproject-develop/      # develop
~/code/myproject-release-1.x/  # release/1.x
```

Switching is just `cd`. No `git switch` overhead, no stashing.

## Locking a worktree

Prevent accidental removal:
```bash
git worktree lock ../proj-hotfix --reason "long-running release branch"
git worktree unlock ../proj-hotfix
```

## Constraints

- A branch can be checked out in only **one** worktree at a time
- The main worktree (the one with `.git/` as a directory) cannot be moved easily
- Some operations (`git gc`, `git fsck`) affect all worktrees

## Cleanup script

```bash
# Remove all worktrees except main
git worktree list --porcelain | awk '/^worktree / {print $2}' | tail -n +2 | xargs -I {} git worktree remove {}

# Prune stale references
git worktree prune
```

## Useful aliases

```bash
git config --global alias.wt "worktree"
git config --global alias.wta "worktree add"
git config --global alias.wtl "worktree list"
git config --global alias.wtr "worktree remove"
```

## When NOT to use worktrees

- Quick branch switches that take < 30 seconds and don't touch IDE state — `git switch` is fine
- Tiny repos where clone is instant
- Branches that share heavy untracked artifacts (node_modules) — each worktree needs its own install
