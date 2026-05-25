---
name: debugging-craft
description: "Universal debugging discipline for failure investigation. Distilled from Agans + Zeller + Spinellis. Use when: a verification command failed, a test went red, an intermittent bug, or worker-doctor is dispatched on retry. Trigger terms: reproduce, minimize, SSCCE, hypothesis, bisection, delta debugging, audit trail. SKIP: feature planning or pure UI aesthetics with no failure."
stacks:
  - stack-agnostic
tags:
  - debugging
  - failure-investigation
  - root-cause-analysis
  - scientific-method
  - bisection
  - reproduction
source: "3 books — see ## Sources at the end"
---

## Use this skill when

- A `verification_command` returned non-zero / a test went red.
- The previous worker attempt left `previous_attempt_errors` and you're on retry.
- A fix was applied but the symptom persists or shifted.
- An intermittent failure that doesn't reproduce on every run.
- worker-doctor is dispatched (retry #3+) to diagnose a failure.

## Do not use this skill when

- The task is greenfield feature development with no failure yet.
- The issue is pure UX preference (use ui-craft instead).
- The contract is rename / config change with no behavior.

## Purpose

Systematic methodology for diagnosing failures: reproduce → observe → hypothesize → bisect → fix → verify. Replaces "guess + change blindly" with the scientific method applied to code. Each rule cites consensus across three canonical debugging books so the agent knows both the rule and the why.

## Capabilities

### Make it fail reliably (reproduce + minimize)

A bug you can't reproduce is a bug you can't fix (Spinellis, Ch. 2). Step 1: get from "it failed somewhere" to a known starting state + a single command that triggers the failure (Agans Rule 2 — "Make It Fail"). Step 2: shrink the failing input or scenario to the smallest possible — delta debugging (`ddmin` algorithm from Zeller, Ch. 5): split input into N subsets, keep the failing half, recurse until 1-minimal where removing any character makes the failure disappear. Spinellis calls this an SSCCE — Short, Self-Contained, Correct Example.

Apply when:
- Test fails — can you replay the exact failure with one command? If not, that's step zero.
- Failing input is a 10MB JSON — bisect it to find the minimal payload that still fails.
- Race condition — automate the trigger to run 1000× overnight to up the hit rate.

### Observe before theorizing

The most expensive class of bugs: weeks fixing things that aren't broken because the engineer guessed the cause (Agans Rule 3 — "Quit Thinking and Look"). Look at the actual failure: stack trace, log output, return values, intermediate state. Add a temporary `print` / `console.log` / `logger.debug` at suspicious points before any fix. Don't conflate "what I think happens" with "what the system shows".

Apply when:
- About to make a fix based on intuition — first add an assertion or log proving the suspected condition holds.
- "It must be X because Y" — write a one-liner that PROVES it (assertion or printed value), don't assume.

### Scientific hypothesis-experiment loop

Treat the failing program as a phenomenon needing a theory (Zeller, Ch. 6 — TRAFFIC). Process: Observe failure → form explicit Hypothesis → make Prediction ("if I change X, failure stops") → run Experiment → refine or reject hypothesis. Keep an audit trail of attempts — memory across retries is unreliable (Agans Rule 6 + Zeller's "Mastermind" critique).

Apply when:
- Multiple plausible causes — write the hypothesis explicitly before testing.
- On retry — read previous transcript's logbook before forming new hypothesis; don't repeat the same failed experiment.

### Bisect to isolate (divide and conquer)

Narrow the search by successive approximation (Agans Rule 4). Three axes:

- **Input bisection**: which subset of input triggers failure? (delta debugging from Zeller).
- **Code bisection**: `git bisect` between known-good and known-bad commits to find the introducing commit.
- **Process bisection**: where in the request pipeline does the bad value first appear? Start at the failing end, work upstream toward the source.

Inject sentinel test patterns (`0x55AA`, `XXXMARKER`) to make data corruption visible. Fix known noise first — it can mask the real bug (Agans).

Apply when:
- Worked yesterday, broken today → `git log --since=yesterday` + `git bisect`.
- Wrong value appears mid-pipeline → log at each stage, find the first stage with wrong value.

### Change one thing at a time

Rifle, not shotgun (Agans Rule 5). Change exactly one parameter / one config / one line; observe; if it doesn't fix, back it out IMMEDIATELY before trying the next thing. Don't combine "let me also tweak X and Y while I'm here" — you won't know which change mattered. After every small fix, run `verification_commands`.

Apply when:
- Multiple suspicious differences from a working baseline — sync them one-at-a-time.
- Two competing hypotheses — test each independently, never together.

### Fix the cause, not the symptom

Patching the symptom (catching the null pointer, retrying the failed call, swallowing the exception) compounds tech debt — the real bug stays and grows (Spinellis, Item 65 + Agans Rule 8: "if you didn't fix it, it ain't fixed"). Trace backward from the symptom to the originating bad state, then fix where the bad value is produced (Zeller's "infection chain").

Apply when:
- Tempted to add `if (x == null) return []` — first ask WHY x is null.
- Tempted to wrap a failing call in try/catch — first ask why it's throwing.
- Tempted to add a retry — first ask what causes the first call to fail.

### Verify the fix by re-breaking

A fix isn't proven by absence of failure — it's proven by ability to re-trigger the original failure on the un-fixed code and confirm the fix prevents it (Agans Rule 8). "Symptom gone" ≠ "cause fixed"; sometimes the bug just moved or hid due to timing changes.

Apply when:
- Just fixed — revert your change, confirm failure returns; re-apply, confirm green.
- Add a regression test that would have failed before your fix.

## Behavioral Traits

- Always reproduce before fixing — a bug you can't trigger reliably is a bug you can't verify fixed.
- Always shrink failing input to minimal before deep analysis.
- Never trust memory across retries — re-read previous transcript or write a logbook.
- Always test ONE hypothesis at a time, with an explicit prediction.
- Always back out a change that didn't help before trying the next one.
- Treat every "that can't happen" as a smoking gun — it just did.
- Distinguish reproducible (Bohr) bugs from fragile (Heisen) bugs — different tactics needed.

## Important Constraints

- NEVER change code based on theory alone — first prove the theory with a log / assertion / test.
- NEVER apply multiple fixes at once; change one thing at a time.
- NEVER add try/catch, null-check, or retry as the FIRST response to a failure — first trace why the bad state exists.
- NEVER mark "fixed" without re-triggering the original failure on un-fixed code.
- ALWAYS shrink the failing input to minimal before deep analysis.
- ALWAYS log each hypothesis + experiment outcome — memory across retries is unreliable.
- ALWAYS confirm the verification_command actually went green, not just "looks fixed".

## Anti-patterns

### ❌ The Thinker's Trap

**Source:** Agans Ch. 5. **Why wrong:** Spending hours theorizing without looking at actual logs / state / signals — fixing imaginary causes.

**Fix:** Quit thinking and look. Add a print / assertion / breakpoint that surfaces ground truth before any change.

### ❌ The Shotgun Approach

**Source:** Agans Ch. 7. **Why wrong:** Changing multiple things at once — if it fixes, you don't know which change mattered; if it doesn't, you don't know which to revert.

**Fix:** One change at a time, back out before next attempt.

### ❌ Post hoc ergo propter hoc

**Source:** Zeller Ch. 12. **Why wrong:** Assuming an anomaly that occurred before the failure caused it. Correlation ≠ causation.

**Fix:** Run an experiment where the anomaly is removed — does the failure still occur?

### ❌ Debugging into existence

**Source:** Zeller Ch. 6. **Why wrong:** Twisting code until the symptom disappears without understanding the cause. Fix sits on top of a still-broken foundation.

**Fix:** Isolate the cause-effect chain first; then make a targeted fix.

### ❌ Symptom Patching

**Source:** Spinellis Item 65. **Why wrong:** Wrapping a null-pointer / failed call / thrown exception without finding why it's bad — you just hid the bug.

**Fix:** Trace backward from the symptom to where the bad value originated. Fix it there.

### ❌ "If You Didn't Fix It, It Ain't Fixed"

**Source:** Agans Ch. 11. **Why wrong:** Assuming the symptom going away means the bug is fixed. Often the bug just moved or hid due to timing changes.

**Fix:** Re-trigger the original failure on un-fixed code; apply fix; confirm green; add regression test.

## Related Skills

### Sibling methodology skills
- `systematic-debugging` — shorter methodology skill on the same plane; this expands on it with book-derived citations
- `coder-craft` — load alongside when the fix requires writing code (most cases)
- `karpathy-guidelines` — surgical edits, don't change things you don't have to
- `tdd` — write the regression test first (red → green) before the fix

### Codebase exploration helpers
- `gitnexus-debugging` — graph-based "why is X failing" / "what depends on this" exploration
- `gitnexus-impact-analysis` — blast radius before applying a fix

## Citations from source

> When you have eliminated the impossible, whatever remains, however improbable, must be the truth.
> — *Agans, Ch. 6, p. 40*

> If you didn't fix it, it ain't fixed.
> — *Agans, Ch. 11, p. 71*

> Testing can only show the presence of defects, but never their absence.
> — *Zeller, Ch. 1, p. 4*

> Every failure can be traced back to some infection, which again can be traced back to a defect.
> — *Zeller, Ch. 1, p. 20*

> The golden standard is a minimal example: the shortest possible that reproduces the problem.
> — *Spinellis, Ch. 2, p. 26*

> If a problem is reproducible, then make no mistake, you can fix it!
> — *Spinellis, Ch. 2, p. 23*

## Sources

- David J. Agans — *Debugging: The 9 Indispensable Rules* (2002)
- Andreas Zeller — *Why Programs Fail: A Guide to Systematic Debugging* (2nd ed., 2009)
- Diomidis Spinellis — *Effective Debugging: 66 Specific Ways to Debug Software and Systems* (2016)
