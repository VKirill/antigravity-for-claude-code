---
name: coder-craft
description: "Universal coder discipline for editing files inside YAML task contracts. Distilled from 7 books — Ousterhout, Fowler, Hunt/Thomas, Feathers, Kernighan/Pike, Boswell, Beck. Use when: every implementation, refactor, or bug fix. Trigger terms: deep module, characterization test, code smell, guard clause, named refactoring, tidy first. SKIP: rename-only or config-only contracts."
stacks:
  - stack-agnostic
tags:
  - clean-code
  - refactoring
  - code-smells
  - characterization-tests
  - deep-modules
  - dry
  - guard-clauses
  - naming
source: "7 books — see ## Sources at the end"
---

## Use this skill when

- Implementing a YAML task contract that adds, fixes, or refactors logic in an existing file.
- Choosing where new logic belongs (extend an existing module vs. create a new one).
- Editing risky / `risk_class: high` code or untested code.
- Reviewing your own draft before returning the result block.
- Naming any new symbol — function, variable, file, route, env var.

## Do not use this skill when

- Contract is rename-only or config-only — no design surface.
- Throwaway one-shot scripts.
- The contract explicitly demands a specific structure that contradicts these rules.

## Purpose

Provide one stack-agnostic discipline that worker-coder applies on every contract: how to approach the task, how to write each line, where things go structurally, how to safely modify existing code, and how to verify. Rules cite consensus across seven canonical programming books so the agent has both the *rule* and the *why* in one place.

## Capabilities

### Approach the task (workflow)

Programming is the art of doing one thing at a time (Feathers, Ch. 23). For every contract: read `context_refs` first (glossary FIRST), pick the smallest meaningful unit of work, make the change, verify, repeat. Wear one hat at a time — refactor *or* tidy *or* feature, never two in one step (Fowler, Beck). Every decision asks the ETC question: "did this just make the system easier or harder to change?" (Pragmatic, Topic 8).

Apply when:
- Tempted to "while I'm here, let me also fix X" — stop. X is a separate contract.
- Picking next step — choose the smallest unit that produces a verifiable green state.
- Touching `risk_class: high` — go slower, smaller steps, more verification.

### Compose each line (clarity)

The primary metric is time-till-understanding, not line count (Boswell, Ch. 1). Names carry density: specific verbs (`fetch` > `get`, `launch` > `start`); units encoded in identifiers (`delay_ms`, `payload_bytes`); scope-appropriate length — short for locals, full for globals (Kernighan, Ch. 1). Eliminate special cases by representation: a function with many `if (x == null || x === "")` guards usually has the wrong input type (Ousterhout, Ch. 6). Define errors out of existence: redesign the API so the "error" case is a valid normal value before reaching for try/catch (Ousterhout, Ch. 10).

Apply when:
- Tempted to throw — first ask if returning empty/null/no-op is sensible.
- Tempted to add try/catch — first ask if the callee can succeed instead.
- A new branch checks for "weird input" — fix the input type or normalize once upstream.
- Naming a new symbol — say it out loud at the call site; if it needs a comment, rename it.

### Structure (where things go)

A good module is *deep*: its interface is much simpler than its implementation (Ousterhout, Ch. 4). A *shallow* module — pass-through wrapper, single-call helper, class whose public surface just forwards — costs more than it pays. DRY is about knowledge, not lines: every fact (format, protocol, schema, magic number) belongs to one place (Pragmatic, Topic 9). Orthogonality: keep code shy, prefer Tell-Don't-Ask, avoid `a.b().c().d()` train-wreck calls (Pragmatic, Topic 28). Pull complexity downward: the caller's life beats the callee's life (Ousterhout).

Apply when:
- About to add a new class — first check what existing module could absorb the logic.
- Two files reference the same constant/format — that knowledge belongs to one of them.
- A wrapper has ≤2 lines per method — candidate for inlining.

### Modify existing code (safe edits)

Code without tests is, by definition, legacy code (Feathers). Before editing risky/untested code, write a characterization test: call the code in a harness, write a failing assertion, then update the assertion to match observed output — this pins the current behavior so refactoring can't silently change it (Feathers, Ch. 13). Use a named refactoring from Fowler's catalog, not free-form rewrites — small, behavior-preserving steps with verification after each. For tangled code, use Seams (object / link / preprocessor) to break dependencies, or Sprout Method / Wrap Method to add new code beside the old without immediately decoupling everything (Feathers, Ch. 4, 6).

Smell → refactoring shortlist (Fowler, Ch. 3):
- Duplicated Code → Extract Function / Move Statements
- Long Function → Extract Function / Replace Temp with Query
- Long Parameter List → Introduce Parameter Object
- Feature Envy → Move Method to where the data lives
- Data Clumps → Extract Class
- Primitive Obsession → Replace Primitive with Object
- Shotgun Surgery → Combine related changes into one module
- Speculative Generality → Collapse Hierarchy / Remove Dead Code
- Mysterious Name → Rename
- Comments (as a smell) → Extract Function with intent-revealing name

Tidying choices (Beck): tidy *first* when it makes the change easier; tidy *after* when cleanup is tangled with the feature and would obscure review; tidy *never* when the code won't change again. Separate tidying from feature in distinct commits (Beck, Ch. 21-26).

### Verify

Test boundaries before middle: empty input, single item, full buffer, N×N (Kernighan, Ch. 6). Reproduce bugs minimally before fixing — minimal failing input + binary search on input or code (Kernighan, Ch. 5). After every small change, run `verification_commands`; on red, revert to last green immediately, don't try to "fix forward" through multiple failures (Fowler, Ch. 2). Optimization: first principle is *don't*. Measure first; algorithm beats micro-tweak (Kernighan, Ch. 7). Honesty in the result block: if verification fails, return `errors: [...]` with real messages; never mark green what isn't green.

## Behavioral Traits

- Smallest reversible step always beats one big jump.
- Reading time > writing time — optimize the code for the next reader, not the typist.
- Trust nothing: check return values, validate at boundaries, fail loudly at "impossible" states.
- Program deliberately: know *why* every line works, not just that it does.
- When a draft feels long, look for special cases collapsing into the normal case.
- Names earned, not borrowed: every new symbol checked against `glossary.md` first.
- Sign the result block: prefer honest red over false green.

## Important Constraints

- NEVER mix structural changes and behavior changes in one commit (Beck).
- NEVER refactor untested code without a characterization test first (Feathers, Fowler).
- NEVER add a class whose public surface only forwards to another (Ousterhout).
- NEVER add try/catch when the callee could return a normal value instead (Ousterhout).
- NEVER repeat the same knowledge in two places — one canonical owner (Pragmatic).
- NEVER use generic names like `tmp` / `retval` / `data` / `info` when a specific name fits (Boswell).
- NEVER optimize without measuring; algorithm beats micro-tweak (Kernighan).
- NEVER take small steps then skip verification — small steps require constant feedback (Fowler, Pragmatic).
- NEVER reach beyond `files_to_touch` to "clean up" something you spotted — note it in the result `summary` so the orchestrator can file a separate contract.
- ALWAYS extend a deep module before creating a shallow new one (Ousterhout).
- ALWAYS test after every transformation; revert immediately on red (Fowler).
- ALWAYS pull complexity downward — the caller's life beats the callee's life (Ousterhout).
- ALWAYS use named refactorings from a catalog, not free-form rewrites (Fowler).

## Related Skills

### Sibling methodology skills (load alongside on coding tasks)
- `karpathy-guidelines` — anti-overcomplication, surgical edits, simplicity discipline (already preloaded with coder-craft on worker-coder)
- `simplify` — review changed code for reuse/quality/efficiency after the change
- `tdd` — write failing test first when behavior is testable
- `systematic-debugging` — diagnose root cause when a test fails or a bug surfaces
- `refactoring` — multi-file architecture planning before splitting / decomposing

### Adjacent stack-skills (load via `skill_hints` in YAML contract)
- `typescript`, `python`, `nodejs`, `fastapi`, `react`, `vue`, `nextjs`, `nuxt`, `prisma`, `sqlalchemy`, `postgresql`, `redis` — the contract's `skill_hints` will inject the relevant stack skill alongside this one

## Anti-patterns

### ❌ Edit and Pray

**Source:** Feathers, Ch. 1. **Why wrong:** Modify untested code hoping it works. Regressions land in production undetected.

**Fix:** Cover and Modify — write characterization tests first, then change.

### ❌ Programming by Coincidence

**Source:** Pragmatic, Topic 38. **Why wrong:** Code works but you don't know why; first new environment breaks it.

**Fix:** Program deliberately — document assumptions, test boundary conditions, know why each line works.

### ❌ The Train Wreck

**Source:** Pragmatic, Topic 28. **Why wrong:** `a.b().c().d()` couples the caller to navigation through unrelated objects.

**Fix:** Tell, Don't Ask. Delegate the action to the immediate object instead of reaching through it.

### ❌ Speculative Generality

**Source:** Fowler, Ch. 3 + Beck Ch. 26. **Why wrong:** Hooks and options for features that aren't needed inflate the surface and rot.

**Fix:** Collapse Hierarchy / Remove Dead Code. Add the option when the second concrete need appears.

### ❌ The Tangled PR

**Source:** Beck, Part II. **Why wrong:** Refactor + feature in one commit makes review impossible — reviewers can't tell which lines change behavior.

**Fix:** Separate commits or PRs for tidying vs. behavior.

### ❌ Crutch Comment

**Source:** Boswell, Ch. 5. **Why wrong:** A comment that exists only to explain a bad name — the bug stays, the name stays bad.

**Fix:** Rename the symbol; the comment becomes redundant and gets deleted.

### ❌ Classitis / Pass-through Method

**Source:** Ousterhout, Ch. 4. **Why wrong:** Many shallow classes / methods that just forward — interface surface without abstraction.

**Fix:** Merge into deeper modules; inline single-use helpers.

### ❌ Magic Number

**Source:** Kernighan Ch. 1 + Boswell Ch. 5. **Why wrong:** Literal value with no name — every reader has to guess intent and unit.

**Fix:** Named constant explaining intent and unit (e.g. `MAX_RETRY_ATTEMPTS = 3`, not `3`).

## Citations from source

> Complexity is anything related to the structure of a software system that makes it hard to understand and modify the system.
> — *Ousterhout, Ch. 2, p. 5*

> Any fool can write code that a computer can understand. Good programmers write code that humans can understand.
> — *Fowler, Ch. 1, p. 10*

> Every piece of knowledge must have a single, unambiguous, authoritative representation within a system.
> — *Pragmatic, Topic 9, p. 31*

> Code without tests is bad code. It doesn't matter how well written it is.
> — *Feathers, Preface, p. xvi*

> The first principle of optimization is don't.
> — *Kernighan & Pike, Ch. 7, p. 165*

> Code should be written to minimize the time it would take for someone else to understand it.
> — *Boswell & Foucher, Ch. 1, p. 3*

> The biggest cost of code is the cost of reading and understanding it, not the cost of writing it.
> — *Beck, Ch. 13, p. 27*

## Sources

- John Ousterhout — *A Philosophy of Software Design* (2nd ed., 2021)
- Martin Fowler — *Refactoring: Improving the Design of Existing Code* (2nd ed., 2019)
- David Thomas & Andrew Hunt — *The Pragmatic Programmer* (20th anniv. ed., 2020)
- Michael C. Feathers — *Working Effectively with Legacy Code* (2005)
- Brian W. Kernighan & Rob Pike — *The Practice of Programming* (1999)
- Dustin Boswell & Trevor Foucher — *The Art of Readable Code* (2011)
- Kent Beck — *Tidy First?* (2024)
