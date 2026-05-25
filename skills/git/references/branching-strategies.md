# Branching strategies

## Decision tree

| Q | Yes → | No → |
|---|---|---|
| Continuous deployment, single release line? | GitHub Flow or trunk-based | GitFlow |
| Daily/hourly merges, strong CI, feature flags? | Trunk-based | GitHub Flow |
| Versioned product (v1, v2, hotfix branches)? | GitFlow | GitHub Flow |

In 2026, **GitHub Flow** fits 70%+ of teams. Trunk-based fits high-velocity teams. GitFlow is mostly legacy.

## GitHub Flow

**Premise**: `main` is always deployable. Branches are short-lived (hours to a few days). Merge via PR.

```
main ─────────────────────────────────────►
       ╲                       ╱
        ▼                     ╱
        feature/login ───────╯  (PR merged)
```

### Workflow

```bash
git switch -c feat/login main
# ...work, commit
git push -u origin feat/login
# Open PR, code review, CI passes
# Merge via PR (squash or rebase merge — see below)
git switch main && git pull
git branch -d feat/login
```

### Merge strategies (PR merge button)

| Strategy | History | When |
|---|---|---|
| **Squash** | Linear, 1 commit per PR | Default for most teams — clean history, easy revert |
| **Rebase** | Linear, preserves each commit | Good for small, well-crafted commit series |
| **Merge** | Preserves branch topology | Long-running feature branches; preserves intent |

Recommendation: **Squash by default**, with permission to use rebase for crafted commit series.

### Rules

- Branch names: `feat/...`, `fix/...`, `chore/...`, `docs/...`
- Delete branches after merge (automate via `git config branch.autoSetupMerge` or GitHub setting)
- Rebase the feature branch on `main` before merging (avoids dirty merge commits)

## Trunk-based development

**Premise**: Everyone commits to `main` (or via PRs lasting < 1 day). Unfinished work is hidden behind feature flags.

```
main ──●──●──●──●──●──●──●──●──►
        ╲    ╲    ╲
         pair  short  short
         work  branch branch (< 1 day each)
```

### Workflow

```bash
git switch -c feat/oauth main
# Small change, < 1 day's work
git push -u origin feat/oauth
# Quick PR, fast review, merge same day
```

### Requirements

- **Strong CI**: every commit on `main` runs full test suite
- **Feature flags**: unfinished features are deployed but toggled off
- **Pair programming or fast review**: avoid PRs that sit for hours

### Anti-pattern

Long-running branches (`feat/big-refactor` open for 2 weeks). That's GitHub Flow, not trunk-based.

## GitFlow (legacy)

**Premise**: Two long-lived branches (`main` for production, `develop` for next release) plus `feature/*`, `release/*`, `hotfix/*` branches.

```
main    ──●─────────●──────────●──── (tagged releases)
            ╲      ╱         ╱
             release/1.2 ───╯
              ╲          ╱
develop  ───●─●──●──●──●─────●──────
                ╲    ╱
                 feature/foo
```

### When to use

- Versioned product with multiple supported releases (v1.x, v2.x, v3.x)
- Long release cycles (monthly or quarterly)
- Need to maintain hotfix lineage

Most SaaS products do not need this complexity. If unsure, choose GitHub Flow.

## Naming conventions

```
feat/<short-slug>        — new feature
fix/<short-slug>         — bug fix
chore/<short-slug>       — maintenance
docs/<short-slug>        — documentation
refactor/<short-slug>    — refactor without behavior change
hotfix/<short-slug>      — emergency production fix
release/<version>        — GitFlow release branch
```

Avoid: `branch1`, `tmp`, `wip`, `mybranch`, name-prefixed branches (`alice/foo`).

## Branch protection (GitHub-side)

Configure on `main`:

- ✅ Require PR before merging
- ✅ Require status checks (CI must pass)
- ✅ Require linear history (forbids merge commits — enforces squash/rebase)
- ✅ Require signed commits
- ✅ Block force pushes
- ✅ Auto-delete merged branches

## Common questions

**Q: Do we still need `develop`?**
A: Only if you do GitFlow. GitHub Flow uses `main` as the single integration branch.

**Q: How long should a branch live?**
A: GitHub Flow: hours to days. Trunk-based: hours. > 1 week → red flag.

**Q: Rebase or merge?**
A: Rebase your feature branch on `main` BEFORE the PR merge. Choose squash vs rebase vs merge at the PR-merge step based on commit quality.
