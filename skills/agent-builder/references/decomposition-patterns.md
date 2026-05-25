# Decomposition patterns — context-centric, not role-centric

Once [decision-framework.md](decision-framework.md) said "yes, sub-agent", this file says *where* to draw the boundary. The wrong boundary causes the failures Anthropic documented; the right one captures the wins.

## Core principle

> "Adopt a **context-centric view** rather than a problem-centric view when decomposing work."
> — Anthropic, *Multi-agent systems: when and how to use them*, 2026-01-23

### Context-centric (right)

Divide where **context can be truly isolated**. An agent that owns one piece of context owns everything that depends on that context.

### Problem-centric / role-centric (usually wrong)

Divide by **type of work** (one agent plans, another implements, a third tests). Every handoff loses context. Each agent fills its window with information the previous agent already processed and digested.

## Why role-split fails — the documented experiment

> "In one experiment with agents specialized by software development role (planner, implementer, tester, reviewer), the sub-agents spent more tokens on coordination than on actual work."

The mechanism is the **Telephone Game**:

1. Planner produces SPEC — full context spent on planning
2. Implementer reads SPEC + reconstructs why decisions were made + implements — full context spent on reconstruction + implementation
3. Tester reads implementation + reconstructs intent + writes tests — full context spent on reconstruction + testing
4. Reviewer reads everything + reconstructs design rationale + reviews — full context spent on reconstruction + review

By step 4, you've burned 4× the context tokens on **reconstructing what the previous agent meant**, not on the work itself.

## Effective decomposition boundaries

### 1. Independent research paths

> "Investigating 'market trends in Asia' versus 'market trends in Europe' can proceed in parallel with no shared context."

For code:
- "Find all auth code paths" + "Find all DB connection setup" + "Find all API entry points" — three parallel Explore-style agents
- "Check this works in Chrome / Firefox / Safari" — three parallel browser-tester subagents

### 2. Separate components with clean interfaces

> "With a well-defined API contract, frontend and backend work can proceed in parallel."

This works ONLY when:
- The API contract is genuinely stable before split
- The contract is in a shared artifact (OpenAPI, TypeScript interface, Protobuf)
- Iterations on the contract are rare

If the contract is still being discovered — keep it in one agent.

### 3. Blackbox verification

> "A verifier that only needs to run tests and report results does not require implementation context."

This is the **single best-validated pattern**. The verifier:
- Receives the artifact (diff, file list, commit)
- Receives success criteria
- Receives test/lint/security tools
- Returns pass/fail + issues
- Never needs to know *why* the artifact looks the way it does

## Problematic decomposition boundaries

### 1. Sequential phases of the same work

❌ Plan → Implement → Test → Review for one feature

These share too much context. Keep in main session.

### 2. Tightly coupled components

❌ Frontend agent + backend agent for the same feature when the API is still in flux

Constant back-and-forth on contract changes — keep together.

### 3. Work requiring shared state

❌ Agents that would frequently sync understanding belong as one agent.

## Concrete patterns that work

### Pattern A: main + verifier

```
main (implements feature)
  ↓ artifact + criteria
verifier (runs tests / security sweep / schema validate)
  ↓ pass / fail + issues
main (fixes if any, or proceeds)
```

Justified by: blackbox verification. Most reliable pattern. **Five out of five of Kirill's ready-made agents follow this.**

### Pattern B: main + parallel explorers

```
main ("I need to understand auth, DB, and API in this codebase")
  ├→ Explore (auth)     ─┐
  ├→ Explore (DB)        │  parallel
  └→ Explore (API)      ─┘
       ↓ three digests
main (synthesizes, plans, implements)
```

Justified by: parallel research with no shared context per branch.

### Pattern C: main + tool-restricted operator

```
main ("I need to query the DB for user count, with hard guarantee read-only")
  ↓ query
tool-restricted db-reader (Bash + PreToolUse hook blocking writes)
  ↓ result
main
```

Justified by: enforcing constraints with hooks. Same domain, narrower permissions. **Kirill's `db-reader` agent is this exact pattern.**

### Pattern D: main + high-volume isolator

```
main ("Run the full test suite and tell me what failed")
  ↓ command
test-runner (runs vitest, parses 10k lines of output)
  ↓ digest: 3 failing tests with file:line and error
main (context preserved)
```

Justified by: context isolation. Without it, 10k lines of test output would pollute main for the rest of the session.

### Pattern E: planner-with-stop (special)

The one place a planner subagent **can** be justified:

```
main ("I want to add feature X but I want a clean SPEC first")
  ↓ user intent + repo context
planner (reads relevant files, produces SPEC.md + checklist + budgets)
  ↓ SPEC artifact
main (implements against SPEC)
```

The planner is **read-only** and **terminates after producing SPEC**. The SPEC.md on disk is the persistent artifact. Main implements.

Not the role-split anti-pattern because there is no implementer subagent — main implements. The planner's output is closer to Pattern D (high-volume isolation of the exploration work) than to role-split.

If you find yourself wanting a separate implementer subagent — that's role-split. Don't.

## Mapping common temptations to correct patterns

When you're tempted to create...

| Tempting agent name | Correct approach |
|---|---|
| `planner` (general) | Either built-in `Plan`, or custom planner-with-stop (Pattern E) — never paired with an implementer subagent |
| `researcher` / `explorer` | Built-in `Explore` — do not duplicate. If you need stack-specific exploration, author a Skill |
| `implementer` | Main agent. Do not create. |
| `reviewer` / `tester` | Verifier (Pattern A). Variants: test-verifier, security-verifier, schema-verifier, payments-verifier |
| `documenter` | Skill, not subagent. Documentation runs in main context — it benefits from full conversation memory |
| `debugger` | Main agent. Debugging is iterative back-and-forth that loses too much in handoff. Exception: log-grepper subagent (Pattern D) for big log files |
| `<stack>-implementer` (react-agent, fastapi-agent, etc.) | Skill from `~/.claude/skills/` in main — these likely already exist |
| `<domain>-helper` (auth, payments, telegram) | Skill in main, UNLESS it's a blackbox check → then verifier |

## When you're tempted to split anyway

Ask: "If I split, what context does each side need to do its job?"

- If the answer overlaps heavily → don't split
- If one side needs almost nothing from the other → split is fine
- If you're imagining "the other agent will figure it out" → that's the telephone-game illusion

## Bottom line

> "Group work by what context it requires, not by what kind of work it is."

For Kirill's stack: with ~65 skills already covering specializations, the agent surface is narrow — verifiers, the planner-with-stop, and tool-restricted operators. That's the full design space.
