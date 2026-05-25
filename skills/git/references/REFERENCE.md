# git — Reference Index

## Decision map

| Situation | Open this file |
|---|---|
| Choosing a branching model | [branching-strategies.md](branching-strategies.md) |
| Writing better commit messages or setting up commitlint | [conventional-commits.md](conventional-commits.md) |
| Cleaning history via rebase, fixup, autosquash | [rebasing-and-history.md](rebasing-and-history.md) |
| Working on two branches in parallel | [worktrees.md](worktrees.md) |
| Setting up pre-commit / commit-msg hooks | [hooks.md](hooks.md) |
| Signing commits and tags | [signing.md](signing.md) |
| Managing large binary files | [large-files-and-lfs.md](large-files-and-lfs.md) |
| Forks, PRs, safer collaboration defaults | [remote-collaboration.md](remote-collaboration.md) |
| Testing skill routing | [eval-cases.md](eval-cases.md) |

## Quick-lookup: essential commands

| Command | What it does |
|---|---|
| `git status -sb` | Short branch status |
| `git log --oneline --graph --decorate -20` | Pretty 20-commit history |
| `git log --oneline main..HEAD` | Commits on current branch ahead of `main` |
| `git diff --staged` | What's in the index |
| `git diff main...HEAD` | What this branch added (since branch point) |
| `git commit --fixup <sha>` | Mark a commit to be squashed into `<sha>` |
| `git rebase -i --autosquash main` | Auto-arrange fixup commits, then interactive |
| `git rebase --abort` | Bail out of an in-progress rebase |
| `git push --force-with-lease` | Safer than `--force` |
| `git reflog` | View HEAD movement history — find lost commits |
| `git worktree add ../other-branch <branch>` | Check out another branch in a sibling directory |
| `git bisect start bad good` | Begin binary search for regression |
| `git bisect run ./test.sh` | Automate bisect |
| `git stash --include-untracked` | Stash including new files |
| `git restore --source=HEAD~3 file` | Restore one file from 3 commits back |
| `git switch -c feat/x` | Create + checkout new branch (modern alternative to `checkout -b`) |
| `git restore --staged file` | Unstage (modern alternative to `git reset HEAD file`) |

## Safety-first global config

```bash
git config --global pull.rebase true
git config --global rebase.autoStash true
git config --global rerere.enabled true
git config --global push.default current
git config --global push.autoSetupRemote true
git config --global init.defaultBranch main
git config --global core.autocrlf input          # Linux/macOS
git config --global core.autocrlf true           # Windows
git config --global fetch.prune true
git config --global commit.gpgsign true
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
```

## Process versus tooling

This skill is process-focused. The mainstream 2026 toolchain on top of git:

| Layer | Tool |
|---|---|
| Hook runner | `lefthook` (preferred), `husky` (Node-only) |
| Commit lint | `commitlint` |
| Signing | SSH signing (built-in), GPG (legacy), `gitsign` (sigstore) |
| LFS | `git-lfs` |
| Secret scanning | `gitleaks`, `trufflehog` |

## Version block reference

Git is a system tool; this skill is registered in `sync_skill_versions.py` with `["Git"]`. The version block above is auto-managed — do not edit manually.
