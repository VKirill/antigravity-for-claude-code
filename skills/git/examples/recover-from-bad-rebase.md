# Example: recover lost commits after a bad rebase

End-to-end recovery walkthrough using `git reflog`. Real scenario: you ran `git rebase -i main` on a long-lived feature branch, accidentally dropped a commit, and force-pushed before noticing.

## Scenario

You're on `feat/payments`. History before rebase:

```
* d4e5f6g  feat: add Stripe webhook   (HEAD → feat/payments)
* c3d4e5f  fix: handle null amount
* b2c3d4e  test: add webhook cases
* a1b2c3d  feat: scaffold payment service
─── (main)
```

You run `git rebase -i main`, intending to reword the first commit. Instead, you change `pick` → `drop` on `c3d4e5f` (the "fix: handle null amount" commit) by mistake. Save. Force-push.

```bash
git push --force-with-lease
```

History is now:

```
* x9y8z7w  feat: add Stripe webhook    (HEAD → feat/payments)
* y6x5w4v  test: add webhook cases
* z3a2b1c  feat: scaffold payment service
─── (main)
```

You realize 30 minutes later that the "fix: handle null amount" commit is gone.

## Step 1: Don't panic, don't reset

Your reflex is `git reset`. Resist it. The commit objects are still in `.git/objects` — only the refs pointing to them are gone.

## Step 2: Find the lost commit via reflog

```bash
git reflog feat/payments
```

Output:
```
x9y8z7w (HEAD -> feat/payments) feat/payments@{0}: rebase (finish): refs/heads/feat/payments onto a1b2c3d
y6x5w4v feat/payments@{1}: rebase (pick): test: add webhook cases
z3a2b1c feat/payments@{2}: rebase (pick): feat: scaffold payment service
d4e5f6g feat/payments@{3}: rebase (start): checkout main
d4e5f6g feat/payments@{4}: commit: feat: add Stripe webhook
c3d4e5f feat/payments@{5}: commit: fix: handle null amount
b2c3d4e feat/payments@{6}: commit: test: add webhook cases
a1b2c3d feat/payments@{7}: branch: Created from main
```

The lost commit is `c3d4e5f` at `feat/payments@{5}`.

## Step 3: Inspect the lost commit

```bash
git show c3d4e5f
```

Confirm it's the one you want:
```
commit c3d4e5f
Author: You <you@example.com>
Date:   ...

    fix: handle null amount

diff --git a/src/payments/webhook.ts b/src/payments/webhook.ts
@@ -45,7 +45,7 @@
-  const amount = event.amount;
+  const amount = event.amount ?? 0;
```

Yes, that's the commit.

## Step 4: Choose recovery strategy

You have two options:

### Option A: cherry-pick the lost commit

Cleanest if you only need that one commit back:

```bash
git cherry-pick c3d4e5f
```

If it applies cleanly:
```
[feat/payments abc1234] fix: handle null amount
```

If there's a conflict (because subsequent commits touched the same lines), resolve manually:
```bash
# Edit conflicted files
git add <files>
git cherry-pick --continue
```

Now:
```
* abc1234  fix: handle null amount        (HEAD → feat/payments)
* x9y8z7w  feat: add Stripe webhook
* y6x5w4v  test: add webhook cases
* z3a2b1c  feat: scaffold payment service
─── (main)
```

The fix is back, on top.

### Option B: reset to before the rebase

If many things went wrong, restore the whole pre-rebase branch:

```bash
git reset --hard feat/payments@{4}      # the commit BEFORE rebase started
```

Now:
```
* d4e5f6g  feat: add Stripe webhook       (HEAD → feat/payments)
* c3d4e5f  fix: handle null amount
* b2c3d4e  test: add webhook cases
* a1b2c3d  feat: scaffold payment service
─── (main)
```

Full pre-rebase state restored.

## Step 5: Force-push the recovery

Since you already force-pushed the bad state, the remote is wrong. Push again:

```bash
git push --force-with-lease
```

If `--force-with-lease` refuses (e.g. teammate already based work on the bad state), coordinate before forcing.

## Step 6: Verify

```bash
git log --oneline -5
```

Should show the recovered commit. Run tests to confirm the fix is back in effect.

## Lessons

1. **Always check `git reflog` BEFORE `git reset --hard`** — the reflog is your safety net
2. **Reflog entries last ~30 days** by default (`gc.reflogExpire`), so act within that window
3. **`--force-with-lease` doesn't save you from your own mistake** — it only protects against overwriting OTHER people's work
4. **Practice rebase in a worktree first** — `git worktree add ../test-rebase feat/payments`; experiment safely

## Configuring longer reflog retention

If you want more safety margin:

```bash
git config --global gc.reflogExpire 90.days
git config --global gc.reflogExpireUnreachable 90.days
```

90 days of "undo" history.

## Total time

- Realizing the mistake: instant once you spot the missing commit
- Finding via reflog: ~1 minute
- Cherry-picking: ~1 minute (no conflicts) to ~10 minutes (with conflicts)
- Force-push and verify: ~2 minutes

Total: 5–15 minutes for a clean recovery.
