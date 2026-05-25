# Methodology — the canonical 9-step loop

Walk this sequence. Don't skip. Most "I'm stuck on this bug" cases = skipped step 1 (reproduction) or step 6 (name root cause).

## 1. Reproduce reliably

Goal: can you make the bug happen on command, every time?

- Yes, deterministically → proceed to step 2
- Yes, but only ~50% of the time → flaky / race condition → keep working on reproduction until 100%. Note: 100% is what you target; sometimes "make it 90%" is acceptable for advancement but you must know which 10% doesn't reproduce.
- No → go to [reproduction.md](reproduction.md)

Without reproduction: you can't tell if your "fix" works.

## 2. Characterise — exact symptom, exact input

Write down (in your head or chat):

- **Trigger:** smallest input/action that causes the bug
- **Expected:** what should happen
- **Actual:** what does happen
- **Scope:** does it happen for all users / all data / always after step X?
- **Environment:** local, staging, prod, CI; OS, Node/Python version; browser

If you can't fill all five → you don't know the bug well enough yet. Investigate more.

## 3. Form a hypothesis

A hypothesis is **testable** and **falsifiable**. Bad hypothesis: "something's wrong with auth." Good: "the JWT verify step returns true for expired tokens because we set `ignoreExpiration: true` in jwt.verify options."

Write it down as: **"If [cause], then [observation]."**

Pick the cheapest hypothesis to test first — usually a `grep` or a `console.log`, not a 2-hour refactor.

## 4. Test the hypothesis — change ONE variable

- Add a log statement at the suspected boundary
- Set a breakpoint
- Bisect a commit range
- Toggle a feature flag
- Comment out a line and re-run

**ONE change.** If you change multiple things and the bug "disappears," you don't know what fixed it. The bug WILL come back.

## 5. Iterate

Hypothesis wrong → discard, form next. Don't try to salvage a wrong hypothesis.

Hypothesis right (or partly right) → drill into "but why does it do that?" Each "why" peels back a layer.

The classic "5 whys":
- Why is balance wrong? → Transfer credited twice.
- Why credited twice? → Retry hit the endpoint again.
- Why retry hit again? → No idempotency key.
- Why no idempotency key? → Client doesn't send one.
- Why client doesn't send? → API spec didn't require it.

Root cause = the deepest "why" you can act on. Here: API spec.

## 6. Name the root cause

In one sentence. If you can't, you haven't found it yet. Examples:

- ✅ "The webhook handler treats `X-Signature` header lookup as case-sensitive; CloudPayments sends `X-CHECKSUM`."
- ✅ "The cron job uses local time; production runs in UTC, so 'midnight' runs at 8 PM Moscow."
- ✅ "The retry queue retries without the idempotency key from the original request."
- ❌ "Something to do with timezones."
- ❌ "The auth is broken."

## 7. Fix at the root, not the symptom

Symptom suppression patterns (don't do):

- `try/catch` swallowing the error
- Re-running until it passes ("flaky test, retry it")
- Adding `if (x == null) x = ''` to silence a NaN without asking why x was null
- Hardcoding a workaround value
- Disabling a check ("just remove the assertion")
- Reverting the offending commit without understanding why it broke (regression-prone)

Root-cause fix:

- The cause you named in step 6 is removed
- The symptom goes away because the cause is gone, not because you papered over it

## 8. Add a regression test

The test must:
- **Fail without the fix** — verify by reverting the fix temporarily
- **Pass with the fix**
- **Name the bug** in a comment: `// regression: webhook X-Checksum vs X-Signature case mismatch (issue #123)`
- **Be in the right scope** — unit test if you isolated cause to a function; integration if it spans modules; E2E only if both unit + integration would miss it

## 9. Re-verify in the original failing scenario

The regression test ≠ the user's original scenario. Run the failing scenario again with the fix applied. Confirm the bug is gone.

Also: run the full test suite (`@worker-test-verifier`). Did your fix break something else?

## Characterise — the worked example

> "App is slow."

Not a bug report. Force it into the structure:

- **Trigger:** clicking the Save button on profile page
- **Expected:** save completes in <500ms
- **Actual:** save takes 4-8 seconds, sometimes timeout (>10s)
- **Scope:** all users; reproduces in staging; not reproducible in local dev
- **Environment:** prod + staging share same DB; local uses SQLite

Now you have a real bug. Hypotheses surface (DB difference? Network? N+1 query?).

## Fix vs symptom suppression — the test

After your fix, ask: **"If I introduce a NEW input that triggers the same root cause, will it also bypass my fix?"**

- Yes → you suppressed the symptom; the bug is still there
- No → you fixed the cause

Example. Bug: division by zero crash.
- Symptom fix: `if (denominator === 0) return 0;` — works for the test, but `denominator = 0.0000001` still produces Infinity; cause was "we didn't validate the input".
- Root fix: validate denominator at input boundary; reject non-finite + zero before reaching division.

## When to stop

Sometimes the root cause is "out of our control" (a vendor bug, a third-party API quirk). Mitigation:

1. Document the upstream issue + workaround clearly
2. Open an issue with the vendor
3. Apply the smallest workaround that handles the case
4. Add the regression test
5. Move on — but tag the workaround so when upstream fixes it, you can remove yours

Don't fall into "I must find the *real* root cause" rabbit hole if you've reached a stable, documented boundary.

## Communication: how to explain the fix

When the user asks "what was the bug?":

| Bad | Good |
|---|---|
| "Fixed the auth" | "JWT verify accepted expired tokens because ignoreExpiration was true; turned it off; added regression test that signs an expired token and asserts 401." |
| "Race condition" | "Two concurrent /transfer requests both read balance=100, both subtracted 50, one was lost. Fixed with FOR UPDATE row lock in the transaction." |
| "Library bug" | "lodash.merge mutated default config when merging user input with `__proto__: {...}`. Replaced merge with Object.assign + schema validation." |

State: what was broken, why, what you changed, and how you proved it.
