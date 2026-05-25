# Remote collaboration

Safe defaults and patterns for collaborating via git without losing work, breaking history, or stepping on teammates.

## Safety-first config

Set these globally on every machine:

```bash
git config --global pull.rebase true              # always rebase on pull
git config --global rebase.autoStash true         # stash uncommitted on rebase
git config --global rerere.enabled true           # remember conflict resolutions
git config --global push.default current          # push current branch by default
git config --global push.autoSetupRemote true     # auto -u on first push
git config --global fetch.prune true              # auto-prune deleted remote branches
git config --global init.defaultBranch main
git config --global merge.conflictStyle zdiff3    # better 3-way conflict markers
```

## The Golden Rules

1. **Never `git push --force`** — use `--force-with-lease`
2. **Never rewrite shared history** — rebase before push only
3. **Always `fetch` before any history operation** — rebasing against stale refs creates phantom conflicts
4. **Always pull before push** — avoid surprising teammates
5. **Use PRs even for solo repos** — record of intent

## Force pushing

```bash
# Safe — refuses if upstream moved since your last fetch
git push --force-with-lease

# Even safer — verifies the EXACT ref you expect
git push --force-with-lease=feat/x:abc1234

# Dangerous — overwrites unconditionally; can erase teammate's work
git push --force                    # avoid
```

`--force-with-lease` is enough for 99% of cases. Set an alias:

```bash
git config --global alias.pushf "push --force-with-lease"
```

## Forks and upstreams

Working on a fork:

```bash
# Clone YOUR fork
git clone git@github.com:you/repo.git
cd repo

# Add the original as "upstream"
git remote add upstream git@github.com:original/repo.git

# Verify
git remote -v
# origin    git@github.com:you/repo.git (fetch/push)
# upstream  git@github.com:original/repo.git (fetch/push)

# Stay in sync
git fetch upstream
git switch main
git rebase upstream/main             # or merge --ff-only
git push                             # to your fork's main
```

For PR work:
```bash
git fetch upstream
git switch -c feat/foo upstream/main
# ...work
git push -u origin feat/foo
# Open PR from you:feat/foo → upstream:main
```

## Pull request lifecycle

```bash
# 1. Branch from current main
git fetch origin
git switch -c feat/foo origin/main

# 2. Work, commit often (Conventional Commits)
git commit -am "feat(api): add /items endpoint"

# 3. Rebase onto latest main BEFORE marking ready
git fetch origin
git rebase origin/main

# 4. Push
git push -u origin feat/foo

# 5. Open PR. Code review. Address comments.
git commit --fixup <bad-sha>
git rebase -i --autosquash origin/main
git push --force-with-lease

# 6. Merge via PR button (squash or rebase merge — team choice)

# 7. Clean up locally
git switch main
git pull
git branch -d feat/foo
```

## rerere — reuse recorded resolution

When you keep hitting the same conflict on rebase:

```bash
git config --global rerere.enabled true
```

First time you resolve a conflict, git records (`pre-image`, `post-image`). Next time the same conflict appears, git applies the recorded resolution automatically. Huge time-saver on long-lived branches and repeated rebases.

## Autostash

If you have uncommitted changes during a rebase or pull:

```bash
git rebase --autostash main      # stashes, rebases, pops
git pull --autostash             # same for pull
```

Or set globally:
```bash
git config --global rebase.autoStash true
git config --global pull.autostash true
```

## Updating a long-lived branch

For a feature branch open for days:

```bash
# Refresh
git fetch origin
git rebase origin/main

# OR: merge (if your team prefers merge over rebase)
git merge --no-ff origin/main

# If conflicts, resolve; then continue
git add .
git rebase --continue
```

Rebase keeps history linear. Merge preserves parallel timeline. Pick one and stick to it per project.

## Pushing tags

```bash
# Create
git tag -a v1.2.0 -m "Release 1.2.0"

# Push a single tag
git push origin v1.2.0

# Push all tags
git push origin --tags

# Delete tag locally and remotely
git tag -d v1.2.0
git push origin :refs/tags/v1.2.0
```

## Cherry-picking across branches

Backport a fix from `main` to `release/1.x`:

```bash
git switch release/1.x
git fetch origin
git cherry-pick abc1234              # the fix commit's sha

# Multiple commits
git cherry-pick abc1234..def5678     # exclusive..inclusive range

git push
```

## Recovering deleted branches

```bash
# Find the lost branch's tip via reflog
git reflog | grep "checkout: moving from"

# Once you have the sha
git switch -c feat/recovered <sha>
```

Branches are just refs — the commits are still in `.git/objects` until `git gc` collects them (default 30 days).

## Common collaboration mistakes

| Mistake | Consequence | Fix |
|---|---|---|
| `git push --force` to shared branch | Teammates' commits erased | Always `--force-with-lease`; respect "is this shared?" |
| Rebasing pushed commits without coordination | Teammates' clones diverge silently | Communicate; or only rebase before push |
| Merging with unresolved binary conflicts | Bad file committed | Always inspect after `git add` resolved conflicts |
| Pulling without fetching first | Local rebase against stale ref → fake conflicts | `git fetch` first, then `git rebase` |
| Pushing to wrong remote | Code leaks across forks | `git remote -v` to verify before push |

## Diff and review

```bash
# See what THIS branch added since branching from main
git diff main...HEAD                  # three dots: branch point

# See what's between local and remote
git fetch && git diff @{upstream}

# Word-level diff
git diff --word-diff

# Whitespace-ignoring
git diff -w

# Patience or histogram algorithm for cleaner diffs
git config --global diff.algorithm histogram
```
