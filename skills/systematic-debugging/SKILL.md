---
name: systematic-debugging
description: "Methodology for finding root cause of bugs, test failures, and unexpected behaviour — symptom → reproduction → hypothesis → bisection → root cause → fix → regression test. Stack-agnostic. Replaces superpowers:systematic-debugging when that plugin is removed. Use when: debug, debugging, отладка, баг, bug, root cause, test fails, тест падает, error, exception, странное поведение, не работает, regression, bisect, fix bug. SKIP: writing new code from scratch (→karpathy-guidelines); preventing future bugs via tests (→test-driven-development); auditing security holes (→cybersecurity-audit)."
tags: [debugging, root-cause, methodology, bug-fix]
---

## Usage

Loaded automatically when the user reports a bug, test failure, or unexpected behaviour, OR when the dev-orchestrator hits a verifier FAILED. Used by main thread directly (no dedicated agent — debugging needs the conversation).

## Purpose

Most "fixes" don't fix the bug — they hide the symptom. A test passes, the page renders, but the underlying cause is still there and will resurface in production. This skill encodes the discipline that separates root-cause fixes from symptom-suppression: reproduce reliably, form testable hypotheses, bisect to the smallest changing variable, name the actual cause, then fix it with a regression test that would have caught it.

## Use this skill when

- A test that used to pass is now failing
- User reports "X doesn't work" but the code looks correct
- Verifier returns FAILED and you need to diagnose before fixing
- A change made elsewhere broke something seemingly unrelated
- An intermittent / flaky issue needs to be characterised before fixing
- Production logs show an error you can't reproduce locally
- A "fix" was applied but the issue keeps coming back

## Do not use this skill when

- Writing new code from scratch (no bug yet) → use `karpathy-guidelines`
- Auditing for vulnerabilities → use `cybersecurity-audit`
- Generating tests for code that already works → use `test-driven-development` / TDD discipline
- Diagnosing UX issues (visual / layout / a11y) → use `worker-ui-verifier` agent + `css-architecture-2026`
- Pure performance optimisation without a specific bug → use stack-skill perf sections

## Capabilities

### Methodology — the canonical loop

The disciplined sequence. Skipping steps is how symptom-suppression happens.

1. **Reproduce reliably** — can you make the bug happen on demand? If not, you're guessing. → [references/reproduction.md](references/reproduction.md)
2. **Characterise** — what's the exact symptom? What's the expected vs actual? Smallest input that triggers it? → [references/methodology.md](references/methodology.md#characterise)
3. **Form a hypothesis** — what specifically would cause this symptom? Pick the cheapest-to-test hypothesis first.
4. **Test the hypothesis** — change ONE variable. Logging, breakpoint, bisect, isolate.
5. **Iterate** — wrong hypothesis → discard, form next. Right one → drill deeper.
6. **Name the root cause** — in one sentence, why does the bug exist? If you can't say it, you don't know yet.
7. **Fix at the root, not the symptom** — the fix should remove the cause, not mask the effect.
8. **Add a regression test** that fails without the fix and passes with it.
9. **Verify in the original failing scenario** — not just the regression test.

→ Deep dive: [references/methodology.md](references/methodology.md)

### Reproduction

The hardest step. Most "intermittent" bugs are reproducible once you find the right conditions.

→ [references/reproduction.md](references/reproduction.md)

### Bisection — binary search the change set

Bug appeared between version A (good) and B (bad). `git bisect` finds the exact commit in O(log N). Also: bisect feature flags, bisect dependencies, bisect dataset rows.

→ [references/bisection.md](references/bisection.md)

### Log-driven debugging

When you can't attach a debugger (production, async, distributed). Reading structured logs by correlation ID, querying by trace_id, identifying the missing-event pattern.

→ [references/log-driven-debugging.md](references/log-driven-debugging.md)

### Runtime debugging

Breakpoints, conditional breakpoints, watch expressions, REPL inspection, post-mortem (core dumps, Node `--inspect`).

→ [references/runtime-debugging.md](references/runtime-debugging.md)

### Graph-aware debugging (2026)

Using `mcp__gitnexus__impact` to find all callers, `mcp__serena__find_referencing_symbols` to trace data flow, `git log -S "<symbol>"` to find when behaviour changed.

→ [references/graph-aware-debugging.md](references/graph-aware-debugging.md)

### Common bug classes

Catalogue of bug families: race conditions, off-by-one, NaN propagation, type coercion, timezone, locale, encoding, async ordering, memory leaks, retry storms. Recognising the class shortcuts diagnosis.

→ [references/common-bug-classes.md](references/common-bug-classes.md)

### Anti-patterns

Things that look like debugging but aren't: premature fix, blame-driven (it's the library's fault!), log-spam, shotgun (let me try changing 10 things), guess-and-check, premature optimisation as bug fix.

→ [references/anti-patterns.md](references/anti-patterns.md)

## Behavioral Traits

- **Reproduces first, theorises second.** No reproduction → no diagnosis.
- **Names the root cause in one sentence** before writing any fix. If unable → keep investigating.
- **Tests hypotheses one at a time.** No shotgun changes.
- **Uses graph tools before grep** for "who calls this" / "where is this set" questions.
- **Adds a regression test for every bug** — the test must fail without the fix.
- **Records the diagnosis** — not just the fix. Future maintainer reads "this WAS the bug, this WAS the cause" and avoids regressions.
- **Distinguishes "fixed" from "symptom hidden"** — if the same bug could reappear under different conditions, it's hidden, not fixed.
- **Defaults to logs over breakpoints** in async / distributed / production-only bugs.
- **Bisects rather than guesses** when timeline-based ("worked yesterday").

## Important Constraints

- NEVER ship a fix without a reliable reproduction
- NEVER mark "fixed" without a regression test that fails without the fix
- NEVER change >1 variable at a time during diagnosis
- NEVER blame a dependency without bisecting / reading its source / opening their issue tracker
- NEVER use `try/except: pass` or `catch {}` as a "fix" — that's symptom suppression
- NEVER weaken a test assertion to make it pass — fix the code, not the test
- ALWAYS state the root cause in one sentence before fixing
- ALWAYS re-verify in the original failing scenario after fix, not just in the regression test

## Related Skills

### Discipline / methodology
- ✓ `karpathy-guidelines` — coding discipline (prevents future bugs)
- ✓ `test-driven-development` (or superpowers:test-driven-development while it's installed) — for writing the regression test

### Verification (run after fix lands)
- `worker-test-verifier` agent — runs full suite to confirm no other tests broke
- `worker-security-verifier` agent — if the bug was security-adjacent (auth bypass, injection)
- `cybersecurity-audit` skill — for security root-cause patterns

### Graph tools for tracing
- `mcp__gitnexus__impact` — who calls this; what depends on this
- `mcp__gitnexus__detect_changes` — what's actually staged
- `mcp__serena__find_referencing_symbols` — exact AST-level callers
- `mcp__serena__find_symbol` — definition + signature
- `git log -S "<text>"` / `git log -G "<regex>"` — find commits that introduced/removed text

### Stack-specific debug helpers
- `pytest` skill — pytest --pdb, fixture inspection
- `vitest` skill — vitest --inspect, snapshots
- `playwright` skill — trace viewer, screenshot on failure
- `nodejs` skill — `--inspect`, AbortController, AsyncLocalStorage
- `postgresql` skill — EXPLAIN ANALYZE, pg_stat_statements

## API Reference

| Topic | File |
|---|---|
| Index, decision map, when-to-open-what | [references/REFERENCE.md](references/REFERENCE.md) |
| Methodology — the 9-step canonical loop | [references/methodology.md](references/methodology.md) |
| Reproduction — making the bug happen on demand | [references/reproduction.md](references/reproduction.md) |
| Bisection — git bisect + variants (feature flags, deps, data) | [references/bisection.md](references/bisection.md) |
| Log-driven debugging — when you can't attach a debugger | [references/log-driven-debugging.md](references/log-driven-debugging.md) |
| Runtime debugging — breakpoints, watch, post-mortem | [references/runtime-debugging.md](references/runtime-debugging.md) |
| Graph-aware debugging — gitnexus + serena patterns | [references/graph-aware-debugging.md](references/graph-aware-debugging.md) |
| Common bug classes — race, NaN, timezone, encoding, retry storms | [references/common-bug-classes.md](references/common-bug-classes.md) |
| Anti-patterns — things that look like debugging but aren't | [references/anti-patterns.md](references/anti-patterns.md) |
