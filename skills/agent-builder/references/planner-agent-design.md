# Planner subagent design

This is one of two patterns explicitly requested in the task. **The non-negotiable rule:**

**A planner subagent produces a SPEC and stops. It does not implement. Main agent implements against the SPEC.**

If you think "and then the planner hands off to the implementer subagent" — stop. That's the telephone-game anti-pattern. There is no implementer subagent.

See [decomposition-patterns.md](decomposition-patterns.md) Pattern E.

## Why a planner subagent at all?

Because planning generates **a lot of exploration output** — reading files, checking dependencies, looking at adjacent patterns. That output:
- Stays out of main context (context isolation)
- Returns a small structured artifact: SPEC.md + checklist + budgets
- Lets main implement with a clear persistent target

## What the planner produces

Three artifacts. No exceptions.

### 1. SPEC.md

```markdown
# SPEC: <feature name>

## Goal
<2-3 sentences, user's POV>

## Non-goals
<What this explicitly does NOT cover>

## Acceptance criteria
- [ ] Testable criteria

## File plan (with budgets)
| File | New/Modified | Target lines | Purpose |

## Dependencies / external touches
<libs, services, skills for main to load, env vars>

## Architecture decisions
<2-5 bullets — choices + rejected alternatives>

## Open questions
<What planner could not resolve without user input>
```

### 2. Checklist

Flat list of concrete, verifiable steps. Each item executable in isolation.

### 3. (Optional) Verifier hand-off note

Which verifier(s) main should invoke after implementation, what they check.

## File budgets — why they matter

A **forecast**, not a hard limit. >50% divergence = signal to stop and reassess.

Guidance:
- New leaf files: 50-150 lines typical
- Test files: roughly match the file under test
- Anything over 300 lines: split or justify

Encodes Ousterhout's "deep modules" principle without spending 50 lines explaining.

## Tools and permissions

```yaml
tools: Read, Grep, Glob
permissionMode: plan
model: opus
effort: high
```

**Belt and suspenders no-write.** If `tools:` gets expanded by accident, `permissionMode: plan` still enforces.

For full ready-to-use planner: [../agents/feature-planner.md](../agents/feature-planner.md).

## Stop condition

> "After producing the three artifacts, summarize them in 5 lines and return. Do not continue past that."

Embed this verbatim in the body. Planner that keeps going past the summary is the telephone-game starting.

## Recursive planning

For features >10 checklist items / >5 files: structure SPEC as phases (Phase 1: foundation, Phase 2: integration, Phase 3: polish). Each phase independently implementable.

**Do NOT recurse if phases are tightly coupled** — decomposition is wrong, keep as one phase.

## MCP integrations (when justified)

- `serena` — semantic exploration; useful when user's domain language doesn't match identifiers ("2FA" vs `multi_factor`)
- `context7` — library docs; prevents "imagined API" failures
- `git-nexus` — commit history for "why is this code like this" investigations

## When the planner should refuse

> "If the request is ambiguous on any of these, ask 1-2 clarifying questions before producing a SPEC:
> - Acceptance criteria (what does 'done' look like)?
> - Breaking changes acceptable?
> - Greenfield or must integrate?
> - Deadline / scope budget?"

A planner that produces a SPEC for "make it better" wastes everyone's time.

## Common failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Planner writes code | `permissionMode` overridden or `tools: Write` in error | Audit frontmatter, re-restrict |
| Vague SPECs | Weak body or model = `haiku` | Enforce 3-artifact structure, upgrade to `opus` |
| Behaves like built-in `Plan` | Insufficient differentiation | Emphasize what your planner adds (file budgets, persistent SPEC.md, KB grounding) |

## The artifact-on-disk pattern

Cleanest use:

1. User: "Plan how to add 2FA"
2. Main delegates to `feature-planner`
3. Planner reads files, **writes SPEC.md and CHECKLIST.md to `.claude/plans/<feature>/`** (actually planner returns content; main writes — see [../agents/feature-planner.md](../agents/feature-planner.md) for the exact contract)
4. Planner returns: "SPEC written to disk. 12 steps, 4 new files, 2 modified."
5. User decides whether to proceed
6. User: "Looks good, implement" → main reads SPEC from disk and starts

The SPEC on disk survives session compaction. Can be re-read. Edited. Committed.

## Bottom line

**The planner produces files, then stops.** Not "plans, then implements". Not "plans, then hands off to implementer". Files. Then stop.
