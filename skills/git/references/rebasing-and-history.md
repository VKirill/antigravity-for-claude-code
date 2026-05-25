# Rebasing and history rewriting

## When to rebase

| Scenario | Use |
|---|---|
| Update your feature branch to latest `main` | `git rebase main` |
| Clean up local commits before pushing | `git rebase -i HEAD~N` |
| Squash fixup commits | `git rebase -i --autosquash main` |
| Move commits to a different parent | `git rebase --onto newbase oldbase` |
| Edit, reorder, drop specific commits | `git rebase -i <ref>` |

## When NOT to rebase

- Commits already pushed to a **shared** branch (`main`, `develop`)
- Anyone else has the same branch checked out

Rule: **rebase before push, merge after share.**

## Interactive rebase

```bash
git rebase -i HEAD~5
```

Opens an editor:
```
pick a1b2c3d feat: add login
pick d4e5f6g fix: typo
pick h7i8j9k refactor: extract helper
pick k0l1m2n test: add cases
pick n3o4p5q docs: update README
```

Commands:

| Command | Effect |
|---|---|
| `pick` (default) | Keep commit as-is |
| `reword` | Edit commit message |
| `edit` | Stop to amend the commit |
| `squash` (`s`) | Merge into previous, keep both messages |
| `fixup` (`f`) | Merge into previous, drop this message |
| `drop` (`d`) | Discard commit |

Reorder by moving lines.

## Autosquash workflow

The clean way to amend a previous commit without manual rebase:

```bash
# Find the bad commit
git log --oneline -5

# Stage your fix
git add fixed-file.ts

# Mark it as fixup for the bad commit
git commit --fixup a1b2c3d

# Later, auto-arrange and apply
git rebase -i --autosquash main
```

`--autosquash` recognizes `fixup!` / `squash!` prefix and places them after their target automatically. Combined with `git commit --fixup <sha>`, you never write `fixup!` manually.

Enable autosquash by default:
```bash
git config --global rebase.autoSquash true
```

## Editing a specific commit

```bash
git rebase -i HEAD~3
# change "pick" to "edit" on the target line
# git stops at that commit
git commit --amend --no-edit       # fix the snapshot
# or
git commit --amend -m "new message"
git rebase --continue
```

## Splitting a commit

```bash
git rebase -i HEAD~3
# change "pick" → "edit" on the commit to split
# git stops there with the commit's changes UNSTAGED
git reset HEAD^                    # unstage the commit
git add file1.ts
git commit -m "feat: part 1"
git add file2.ts
git commit -m "feat: part 2"
git rebase --continue
```

## Recovering from a botched rebase

```bash
git rebase --abort                  # in the middle of a conflict
```

If you've already finished a rebase and want to revert:
```bash
git reflog                          # find old HEAD
git reset --hard HEAD@{5}           # restore from 5 moves back
```

`git reflog` is your safety net. Every HEAD movement is logged for ~30 days.

## Rebase with autostash

If you have uncommitted changes when rebasing:

```bash
git rebase --autostash main
```

Stashes your changes, rebases, pops the stash. Or set globally:
```bash
git config --global rebase.autoStash true
```

## Rebase across forks

```bash
git fetch upstream
git rebase upstream/main
```

Always `fetch` first — rebasing against a stale local ref creates phantom conflicts.

## `git pull --rebase`

Default `git pull` creates a merge commit when local and remote diverged. `--rebase` replays your commits on top:

```bash
git pull --rebase origin main
```

Make it the default:
```bash
git config --global pull.rebase true
```

## Cherry-pick

Apply a specific commit from another branch:

```bash
git cherry-pick a1b2c3d
git cherry-pick a1b2c3d..f6g7h8i    # range (exclusive..inclusive)
```

Useful for backporting fixes from `main` to a release branch.

## Rerere (reuse recorded resolution)

If you keep hitting the same merge conflict across rebases:

```bash
git config --global rerere.enabled true
```

The first time you resolve a conflict, git records the resolution. The next time the same conflict appears, git applies the recorded resolution automatically.

## Force push safety

After rebasing a pushed branch:

```bash
# Safe — refuses if upstream moved
git push --force-with-lease

# Even safer — also verifies the ref you THINK is there
git push --force-with-lease=feat/x:<sha-you-expect>

# Dangerous — overwrites unconditionally
git push --force                    # avoid
```

Alias for muscle memory:
```bash
git config --global alias.pushf "push --force-with-lease"
```
