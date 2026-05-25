# Bisection — binary-search the change set

"It worked yesterday / before commit X / before deploy Y." Bisection finds the exact change that introduced the bug in O(log N) steps. 100 commits → 7 checks.

## Git bisect

```bash
# Start
git bisect start
git bisect bad HEAD               # current commit is broken
git bisect good <known-good-sha>  # last known working commit

# Git checks out the middle commit. Test:
npm test                          # or whatever reproduces the bug
# If broken:
git bisect bad
# If working:
git bisect good

# Repeat until git prints "first bad commit"
git bisect reset
```

## Automate with a script

```bash
git bisect start HEAD <good-sha>
git bisect run npm test           # or any command that exits 0=good, non-0=bad
# Git iterates automatically until done
```

Make the test script:
- Fast (each iteration is one checkout + one run)
- Exit code 0 when the bug is NOT present; non-zero when present
- Exit code 125 when the commit can't be tested (e.g., compile error unrelated to the bug); bisect will skip

```bash
#!/bin/bash
# bisect-test.sh
set -e
npm install --silent          # in case deps changed
npm test -- --testPathPattern foo.test.ts
# Exits 0 if tests pass (good commit), non-zero if fail (bad commit)
```

## When git bisect is hard

### Many commits don't build / test fails for unrelated reasons

Use `git bisect skip` manually or have the script return 125 for compile errors. Git will work around skipped commits.

### Commit boundaries are too coarse

You bisected to a single commit, but it's a 500-line PR. Two options:

1. **Bisect within the commit** — split the change into chunks, apply progressively. Tedious but works.
2. **Read the commit carefully** — the diff is now small enough; manual inspection finds it.

### Multiple bugs at once

If two bugs were introduced in different commits, naive bisect may give confusing results. Strategy: fix or work around one, then bisect for the other.

## Non-git bisection — what else to bisect

### Bisect dependencies

`package.json`: which dependency upgrade broke it?

```bash
# Walk through git history of package-lock.json
git log -p package-lock.json | grep '"version"'
# Or pin everything except one dep, swap versions:
npm install lodash@4.17.20  # the version when it worked
npm install lodash@4.17.21  # the version when it broke
# Run the failing test for each
```

If you don't have a clean git history, use `npx good-fences` or `npm install <pkg>@<version>` to flip between versions.

### Bisect feature flags

If your app has many feature flags:

```
flags: { A: true, B: true, C: true, D: true }
```

Bug present. Disable half:
```
flags: { A: false, B: false, C: true, D: true }
```

Still buggy → A, B aren't the cause. Try the other half.

### Bisect dataset

10M rows, bug on some row(s). Find which row(s).

```sql
-- First half
DELETE FROM staging.users WHERE id < 5000000;
-- Run the failing test
-- If still buggy → bug is in 5000000..10000000
-- If not → bug is in 0..4999999
```

(Use a staging copy; never bisect production data destructively.)

### Bisect config

`config.yaml` has 50 settings. Toggle half off, test. Same logic.

## When NOT to use bisection

- **Bug exists in every commit since the dawn of time** — there's no "good" commit; bisection won't help
- **Bug is in a third-party dep** — bisect their git history if open-source, or report and wait
- **Bug is environmental** (not in code) — bisect won't help; check env / DB / OS instead
- **Tiny change set** (3-5 commits) — just read the diffs; faster than scripting bisect

## Common pitfalls

| Pitfall | Fix |
|---|---|
| Bisect script doesn't reproduce reliably | Make reproduction deterministic FIRST. See [reproduction.md](reproduction.md). |
| Each iteration is too slow (5 min build) | Cache builds; pre-warm; use `git worktree` to keep multiple checkouts |
| Bisect lands on a merge commit | Use `git bisect --first-parent` to follow main-line only |
| Result is a refactor commit (no obvious behaviour change) | The bug was latent; the refactor exposed it. Read the refactor carefully — it changed something subtle. |
| Wrong "good" commit (was also broken, you just didn't notice) | Verify the "good" commit really works before starting bisect |

## After bisect — what to do with the bad commit

You now know: commit XYZ introduces the bug.

1. **Read the diff** — `git show <bad-sha>` — usually the cause is obvious now
2. **Don't just revert blindly** — the commit may have been intentional with side effects; revert can re-break something it fixed. Read the commit message + linked issue.
3. **Form hypothesis** — what specifically in this commit causes the symptom? See [methodology.md](methodology.md#3-form-a-hypothesis).
4. **Fix at root** — either revert, fix the specific line, or rework the change
5. **Add regression test** — that fails on the bad commit, passes on the fix

## Worked example

> Tests passed Monday. Failing Tuesday. 15 commits in between.

```bash
git bisect start HEAD monday-tag
git bisect run npm test
# 7 iterations (log₂ 15 ≈ 4) — git finds:
# "First bad commit: a1b2c3d - feat: switch from uuid v4 to v7 for primary keys"
git bisect reset

# Read the commit:
git show a1b2c3d
# Sees: changed crypto.randomUUID() to uuid.v7()
# Hypothesis: v7 UUIDs include timestamp prefix; some downstream code parses
#   UUIDs assuming v4 format (random hex), now breaks on the structured v7.
# Confirm:
grep -rn "uuid" src/ | grep -E "slice|split|match|parse"
# Finds: src/lib/auth.ts uses uuid.slice(0,8) as session shortcode;
#   v4 was random 8 hex chars; v7 has fixed timestamp prefix → collisions.

# Fix at root: don't derive shortcode from UUID prefix; use crypto.randomBytes(4)
# Regression test: generate 1000 sessions, assert all shortcodes unique
```

This pattern — bisect → read → hypothesise from the change → fix root → regression test — is the canonical use of `git bisect`.
