---
name: review-craft
description: "Code review discipline from Cohen's SmartBear empirical research. Use when: worker-reviewer reviews a diff/PR, evaluates someone's code change, checks acceptance_criteria coverage. Trigger terms: code review, defect density, review velocity, author preparation, checklist, LOC/hour, pass-through review. SKIP: writing your own code, pair-programming, automated linter output."
stacks:
  - stack-agnostic
tags:
  - code-review
  - inspection
  - defect-detection
  - checklist
  - author-preparation
source: "Cohen + cross-discipline distillation — see ## Sources"
---

## Use this skill when

- worker-reviewer is dispatched to review another worker's diff.
- Evaluating a PR or commit before approving it.
- Auditing a file or module for code-quality issues before refactoring.
- Looking for defects (omissions, missing edge cases, unclear naming) — not for bugs in running code.

## Do not use this skill when

- Writing your own code from scratch (use coder-craft).
- Pair-programming style continuous review.
- Pure machine-generated code (config, schemas) with no human-meaningful logic.
- The diff is rename-only or formatting-only.

## Purpose

Translate Cohen's SmartBear research — based on the largest empirical study of code review — into a practical discipline for an LLM reviewer agent. The aim: maximize defect density (defects found per kLOC reviewed) by enforcing pacing, scope limits, checklist-driven scanning, and author-preparation expectations. Avoid the most common review failure modes: rubber-stamping, surface-only "looks fine", and missed omissions.

## Capabilities

### Pacing and scope discipline

Cohen's research shows defect-finding effectiveness drops sharply when reviews exceed ~400 LOC or run >60 min (Cisco study, p. 28-31). For an LLM reviewer this translates: large diffs (>500 LOC) require explicit chunking into reviewable units, each treated as a separate review. Don't try to "review the whole PR" in one pass — issue density per unit collapses to near-zero on big diffs. Beyond 90 minutes of equivalent attention / saturation of context window, no new defects are found regardless of effort.

Apply when:
- PR diff >500 LOC — request author to split, OR review in chunks of ≤400 LOC with separate result blocks.
- Effective inspection rate >500 LOC/hour-equivalent — slow down, you're skimming.
- After ~60 min of attention or ~30k tokens of diff content — write up findings and stop; review fatigue is real.

### Author-preparation expectation

Cohen: when authors annotate their own diff before review, defect density found by reviewers DROPS — because the author self-found the obvious ones. For the orchestrator context: a worker-coder's `summary` field IS the author preparation. A reviewer should expect and use it; absence of clear summary is itself a finding ("author did not justify why X").

Apply when:
- worker-coder's `summary` is vague ("updated X") — flag "summary doesn't explain intent; can't tell what changed structurally vs cosmetically".
- Contract scope says X but diff also touches Y unrelated — flag scope creep before evaluating quality.
- A non-obvious design choice has no annotation — ask the author to justify before approving.

### Checklist-driven scanning

Checklists catch OMISSIONS — the defect class hardest to spot by reading alone (Cohen, SEI Perspective, p. 51). For each diff, scan against an explicit checklist:

**Logic & correctness**
- Are all error / exception paths exercised by tests?
- Are boundary conditions (empty, single, full, N×N) handled?
- Is each `if` branch reachable and meaningful?
- Are concurrent paths protected (locks, atomicity)?

**Resources & cleanup**
- Are resources (file handles, connections, subscriptions) freed in all exit paths?
- Are listeners / event subscriptions removed when scope ends?

**Inputs & validation**
- Is every external input validated at the boundary (HTTP / CLI / DB / queue)?
- Are SQL params parameterized (no string concatenation)?
- Are auth / permission checks present where required?

**Tests & verification**
- Does each new branch / capability have a test?
- Are tests asserting outcomes, not implementation details?
- Did `verification_commands` actually go green?

**Surface & contract**
- Are new public symbols documented in `glossary.md` if defined as canonical names?
- Are breaking API changes flagged in the result `summary`?
- Does the diff stay within declared `files_to_touch`?

### Defect-density mindset, not approval-rubber-stamp

A passing test suite + clean style is NOT proof of correctness. The reviewer's job is to find the defect the tests missed. Maintain an explicit "did I look at:" trail: each section reviewed with at least one concrete observation logged (even if "no issues in section X — checked Y and Z"). A review with zero observations across a large diff is itself a red flag.

Apply when:
- Reviewing — log per-file or per-capability observations, not a single "LGTM".
- Tempted to approve fast on familiar patterns — pause; that's where confirmation bias kills defects.
- A nit is the only finding on a 300-line diff — keep looking, the omissions hide elsewhere.

## Behavioral Traits

- Always state pacing target before starting: chunk size, attention budget.
- Always read author's `summary` first; treat absence or vagueness as a finding.
- Find defects in the inspection phase; do NOT propose fixes inline (that's worker-coder's job).
- Distinguish nits (formatting, naming preferences) from blocking issues (correctness, security, broken contract); label each finding.
- Use a checklist for every review; do not rely on impression alone.
- Maintain neutral tone; review the code, not the author.

## Important Constraints

- NEVER approve a diff >500 LOC without splitting into reviewable chunks.
- NEVER review >~30k tokens of diff in one block — fatigue effect destroys defect detection.
- NEVER write "LGTM" or "looks good" without per-section observations.
- NEVER let "tests pass" stand alone as proof of correctness — tests can be wrong or insufficient.
- NEVER use defect counts to evaluate worker-coder performance (Cohen: this destroys honest reviewing).
- ALWAYS run an explicit checklist scan, not just impression-based reading.
- ALWAYS check scope: does the diff stay within `files_to_touch`? Reaching beyond = blocking finding.

## Anti-patterns

### ❌ The Pass-Through Review

**Source:** Cohen, Brand New Information. **Why wrong:** Reviewer marks "LGTM" without looking — the defect ships.

**Fix:** Require per-section observations; flag reviews with high LOC/hour rate as suspicious.

### ❌ The Author-Driven Walkthrough

**Source:** Cohen, Social Effects. **Why wrong:** Following the author's narrative makes you see what they want you to see and miss what they don't mention.

**Fix:** Read the diff in your own order — start with tests, then config, then logic, then boundaries.

### ❌ Surface-Pattern Approval

**Source:** Cohen, Brand New Information. **Why wrong:** "Looks like every other auth middleware we've shipped, must be fine" — copy-paste defects are systemic.

**Fix:** Apply the checklist regardless of pattern familiarity. Tests passing is necessary, not sufficient.

### ❌ Bundled-PR Confusion

**Source:** Cohen + Beck's tidy-vs-feature separation. **Why wrong:** Diff mixes refactor + feature — impossible to tell which line was the defect.

**Fix:** Flag in result; ask the author to split into a refactor commit + a feature commit.

### ❌ Nit-First Review

**Source:** Cross-discipline. **Why wrong:** Spending review budget on `var → const`, whitespace, naming preferences while logic defects sit unread.

**Fix:** Pass 1 = correctness + security + contract. Pass 2 = nits if time remains. Never reverse.

## Related Skills

### Sibling methodology skills
- `coder-craft` — the author's craft: load when you need to suggest the actual fix (review identifies, coder fixes)
- `debugging-craft` — load if review uncovers a failure that needs investigation
- `karpathy-guidelines` — anti-overcomplication lens to spot over-engineered diffs
- `cybersecurity-audit` — load for security-sensitive diffs (auth, payments, input handling)
- `simplify` — review changed code for reuse/quality/efficiency

### Adjacent tools
- `gitnexus-pr-review` — graph-based PR review integration

## Citations from source

> Reviewers are most effective at reviewing small amounts of code. Anything below 200 lines produces a relatively high rate of defects.
> — *Cohen, Cisco Case Study, p. 31*

> In no case is a defect discovered after 90 minutes. This is direct and conclusive evidence that reviews should be limited to around one hour.
> — *Cohen, Brand New Information, p. 20*

> Code review would have saved half the cost of fixing the bugs. Plus they would have found 162 additional bugs.
> — *Cohen, The Case for Peer Review, p. 4*

> The more time the reviewer spends during that 'first scan' period, the faster the reviewer will be at finding the defect.
> — *Cohen, Brand New Information, p. 22*

> Every defect found and fixed in peer review is another bug a customer never saw.
> — *Cohen, Social Effects, p. 37*

## Sources

- Jason Cohen — *Best Kept Secrets of Peer Code Review* (SmartBear, 2012)
- Cross-discipline checks adapted from OWASP Top 10 (security boundary scanning) and Beck *Tidy First?* (bundled-PR antipattern)
