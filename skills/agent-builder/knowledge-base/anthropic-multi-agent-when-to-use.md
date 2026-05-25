# When to Use Multi-Agent Systems — Anthropic, Jan 23 2026

The single most important post for designing Claude Code subagents. Compact reference for preload into planner / architect / orchestrator agents.

Source: <https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them> (Jan 23, 2026)

## Central thesis

**Start with a single agent. Add subagents only when evidence forces you to.**

The post is a corrective to the early-2025 multi-agent hype. The empirical reality: most "I need agent A, B, and C" requests are solved by a better single agent + skills.

## When single-agent works (default)

> "If you can solve a task with a single agent loop using your full set of available tools, do that."

Single-agent works when:
- Total context for the task fits comfortably under the model's window
- Tool count is manageable (~15-20 tools) and the agent picks well
- Subtasks don't naturally decompose into independent parallel work

This is most tasks. Even most complex ones.

## When to add subagents

Three validated conditions. **At least one must hold.**

### Condition 1: Context isolation

Side task generates a lot of intermediate output (>1000 tokens) that won't be referenced later. Subagent contains the noise; main gets a digest.

> "Running tests, searching log files, exploring an unfamiliar codebase — these all produce volume of intermediate output that doesn't need to live in main context."

### Condition 2: Parallelization

Genuinely independent paths can run concurrently. Benefit is **thoroughness** (and somewhat speed), at the cost of 3-10× tokens.

> "Investigating 'market trends in Asia' versus 'market trends in Europe' can proceed in parallel with no shared context."

### Condition 3: Specialization

Main agent has tool-count overload, or conflicting personas (creative + strict-compliance, for example).

> "When main has 20+ tools and selection is failing, splitting the tools across specialized subagents can recover performance. Try Tool Search Tool first — claims up to 85% token reduction."

## The verification subagent pattern

Highlighted as the **most consistently-working** subagent pattern:

> "One multi-agent pattern that consistently works well across domains is the verification subagent."

> "Verification subagents succeed because they sidestep the telephone game problem. Verification requires minimal context transfer by nature."

The verifier needs:
- The artifact (file, diff, output)
- Success criteria
- Tools to verify

Does NOT need: the reasoning, the conversation history, prior attempts.

This is the reason most subagents in healthy directories are verifiers.

## The Early Victory Problem

The single biggest failure mode for verifiers:

> "The most significant failure mode for verification subagents is marking outputs as passing without thorough testing. The verifier runs one or two tests, observes them pass, and declares success."

**Mitigation — verbatim from Anthropic:**

> "Concrete criteria. Specify 'Run the full test suite and report all failures' rather than 'make sure it works.'
>
> Comprehensive checks. Require the verifier to test multiple scenarios and edge cases.
>
> Negative tests. Direct the verifier to attempt inputs that should fail and confirm they do.
>
> Explicit instructions. The instruction 'You MUST run the complete test suite before marking as passed' is essential. Without explicit requirements for comprehensive validation, verification agents take shortcuts."

The phrase "You MUST run the complete <X> before marking as passed" is the canonical Early Victory mitigation.

## Anti-pattern: role-based decomposition

The most documented failure:

> "In one experiment with agents specialized by software development role (planner, implementer, tester, reviewer), the sub-agents spent more tokens on coordination than on actual work."

The mechanism: telephone game. Each handoff requires the receiving agent to reconstruct context the sending agent already processed. Fidelity degrades; total token cost balloons.

**Don't split a single feature into role-based subagents.** Verifiers (Pattern A) work because they don't chain.

## Context-centric decomposition (when you must split)

> "Adopt a context-centric view rather than a problem-centric view when decomposing work. Group work by what context it requires, not by what kind of work it is."

Good boundaries:
- Independent research paths (no shared context per path)
- Components with stable contracts (frontend and backend after API freeze)
- Blackbox verification (no context transfer needed)

Bad boundaries:
- Sequential phases of the same work (telephone game)
- Tightly coupled components (constant resync)
- Work requiring shared state

## "Outgrowing single-agent" signals

When to start considering multi-agent:

1. **Approaching context limits** — main session routinely uses large context and quality degrades
2. **Managing many tools** — main has 15-20+ tools and selection fails. **Try Tool Search Tool first.**
3. **Parallelizable subtasks** — research / exploration that decomposes naturally

> "These thresholds will shift as models improve. Practical guidelines, not fundamental constraints."

## On cost

Multi-agent uses **3-10× more tokens** than single-agent for the same work. Justify the cost:
- Thoroughness benefit (verification, parallel exploration)
- Context preservation benefit (isolation)
- Constraint enforcement benefit (tool restriction)

If none of these → don't multi-agent.

## On coordination

The harder the coordination, the worse multi-agent fares. Pure verification (one-shot blackbox check) coordinates perfectly. Iterative back-and-forth (planner → implementer → planner → implementer) coordinates poorly.

## Anthropic's bottom line

> "Start with the simplest approach that works, and add complexity only when evidence supports it."

For Claude Code in 2026: the simplest approach is **main + skills**. Subagents come in when skills aren't enough.

## Applying in agent-builder

This KB is preloaded into the `feature-planner` agent because every plan should be aware of:
- The cost of decomposition (3-10× tokens)
- The Early Victory mitigation (planner's checklist enables it for verifiers)
- The verification pattern (planner can suggest which verifiers main should invoke)

Verifier agents (test, security, payments) don't preload this KB directly — they ARE the pattern.

## Citation rule

Other files reference this with:
> "Apply Anthropic's three multi-agent conditions (see [knowledge-base/anthropic-multi-agent-when-to-use.md](../knowledge-base/anthropic-multi-agent-when-to-use.md))."

Not by re-quoting inline.

## Last verified

2026-05-16 against the original post.
