# Anti-patterns — things that look like debugging but aren't

## Premature fix

**Symptom:** "I see the bug, I know the fix, let me just apply it."

**Why it fails:** You're guessing. The first fix idea is often wrong; you've narrowed too fast. Even if it works for the symptom, you may have suppressed it without removing the cause.

**Counter:** before any code change, name the root cause in ONE sentence (see [methodology.md](methodology.md#6-name-the-root-cause)). If you can't, you don't know it yet.

## Shotgun debugging

**Symptom:** "Let me try changing 5 things at once and see what helps."

**Why it fails:** if the bug stops, you don't know what fixed it. If new bugs appear, you don't know what caused them. You've added entropy, not reduced it.

**Counter:** change ONE thing at a time. Revert if no signal. Confirm cause-and-effect for each change.

## Log-spam

**Symptom:** Adding `console.log` everywhere, never removing.

**Why it fails:** signal-to-noise collapses; the actual debug signal drowns. Logs become permanent technical debt.

**Counter:** add logs at SUSPECTED boundaries only. Use logpoints (DevTools / VS Code) which don't change source. After fix, REMOVE the temp logs; only keep structured logs that have lasting observability value.

## Blame the library

**Symptom:** "Stack trace points to node_modules; must be a library bug."

**Why it fails:** 95% of "library bugs" are usage bugs. The library's been used by millions; your code is unique.

**Counter:** before opening an issue at the library, verify:
1. You're using the library correctly per its docs
2. You can reproduce the bug with a minimal repro that doesn't include your code
3. No one else has reported it (search their issues)
4. The library version is current (or check if known bug fixed in newer version)

If after all that you still think it's a library bug → open issue, but include the minimal repro. 80% of these get a "you're using it wrong" reply.

## Test weakening

**Symptom:** Test fails. Modify the assertion to make it pass.

**Why it fails:** you removed the regression detector. The bug is still there; you just can't see it anymore.

**Counter:** if the test is wrong (e.g., outdated expected value because the spec changed), say so explicitly in the commit message. If the test is right and code is wrong → fix the code.

## Try/catch swallowing

**Symptom:**
```js
try {
  doSomething(input);
} catch (e) {
  // ignore
}
```

**Why it fails:** errors are now invisible. The bug persists silently; future maintainers can't diagnose it.

**Counter:** if you genuinely want to ignore an error, log it (with `level: "warn"` and context). If it's recoverable, handle it with a fallback. If it's not recoverable, don't catch.

## Retry as "fix"

**Symptom:** "Flaky test; let me retry 3 times."

**Why it fails:** flake = something happens sometimes. Retrying hides the trigger. In production at higher scale, the flake hits MORE often, not less.

**Counter:** make the flake reproducible (see [reproduction.md](reproduction.md#intermittent-bugs)). Find what's variable (timing, random seed, cache state). Fix the root variability.

## Premature optimisation as "fix"

**Symptom:** test is slow; bug is timing-related. Optimise to make it faster → bug goes away.

**Why it fails:** the bug is still there, just timing-dependent. As traffic / data grows, timing changes and the bug recurs.

**Counter:** name the cause (race? unbounded queue? sync I/O on hot path?). Fix the cause, not the timing.

## Cargo cult

**Symptom:** "Stack Overflow says add `<X>` to fix this error. Adding it without understanding why."

**Why it fails:** the fix may be irrelevant to your bug (same error message, different cause). It may also introduce new bugs. You've added code you don't understand.

**Counter:** read the SO answer carefully. Does the cause match yours? Verify by hypothesis. If yes, apply. If unclear, dig more.

## "Worked yesterday" reflex revert

**Symptom:** "Bug appeared, last change was X, revert X."

**Why it fails:** X may have fixed something else important. Naive revert can re-introduce a different bug. Also: the symptom may be caused by something further upstream that X just exposed.

**Counter:** if reverting is the right call, do it deliberately. Note WHY in commit message. Plan to re-apply X after fixing the underlying issue.

## Multi-bug merging

**Symptom:** "I'm debugging this thing and noticed three other small bugs. Let me fix them all together."

**Why it fails:** PR becomes hard to review; reverting one bug fix reverts the others; bug fixes become coupled.

**Counter:** one bug = one fix = one commit / PR. If you spot other bugs, file them; come back later.

## "It's working now" without naming the change

**Symptom:** "I made some changes and now it works. Don't know what fixed it but ship it."

**Why it fails:** you don't know what fixed it = you don't know what's keeping it fixed. Bug recurs in 2 weeks; nobody remembers what changed.

**Counter:** before committing, identify the EXACT line(s) that fix the bug. Verify by reverting them locally and confirming the bug returns. Then commit with a message that names the cause + fix.

## Symptom suppression list

These are mechanically suspicious — flag in code review:

```bash
# Empty catch
grep -rnE 'catch\s*\([^)]*\)\s*\{\s*\}|except[^:]*:\s*pass' src/

# Force-pass test markers
grep -rnE '\.skip|\.only|xfail|@unittest\.skip' src/ tests/

# Silenced errors
grep -rnE '/\* eslint-disable \*/|# type: ignore|@ts-ignore|@ts-nocheck' src/ | head -20

# Hardcoded "fix" values
grep -rnE 'TODO|FIXME|HACK|XXX' src/
```

Each of these is sometimes legitimate. Each is often a sign of a hidden bug. Read the surrounding code + commit history before accepting.

## Diagnosis is not optional

If the user is in a hurry: "just fix it, don't waste time on root cause" — pushback gently:

> "If I fix without understanding, the bug will recur. Five minutes of diagnosis now saves five hours next month. Let me name the root cause in one sentence, then I'll fix and add a regression test — should take ~10 minutes total."

If they still insist: apply the smallest patch, **clearly mark it as workaround** (`// WORKAROUND: <issue link>` + ticket for follow-up), don't claim "fixed" without diagnosis.
