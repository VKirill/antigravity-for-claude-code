# Anthropic, *Effective Harnesses for Long-Running Agents*

**Source type:** Anthropic engineering blog post
**Date:** 2025 (Claude 4-era)
**URL:** <https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents>
**Epistemic status:** distilled summary, not direct quotes

## Core thesis

> **Calibration note for our local stack.** Этот документ — про автономных long-running агентов в чужих задачах (Anthropic-cloud, многочасовые сессии без человека). **Наш dev-orchestrator стек работает иначе:** короткие worker round-trip'ы (30 сек – 5 мин), синхронная verification, человек на связи. Шкалы hours/days отсюда **не переносить** в оценки наших задач — у нас единицы измерения это task contracts и subagent round-trips. См. `dev-orchestrator.md → Time estimation discipline`.

A *harness* is the surrounding infrastructure of an agent: prompts, tools, context management, intermediate steps, retry logic. For long-running agents (hours to days), the harness matters more than the model. The same Claude with a good harness wildly outperforms the same Claude with a bad one.

## Key principles

1. **The initializer agent is different from the working agent.** The first context window does setup — installing dependencies, exploring the codebase, reading docs, choosing libraries. The subsequent windows do work. The system prompts should differ: initializer focuses on *environment*; worker focuses on *task*.

2. **Multi-context-window workflows are normal.** Long tasks span multiple compaction cycles or fresh subagent invocations. Design for handoff, not single-window completion.

3. **Context engineering > token stuffing.** It's not "how much can I cram into the context"; it's "what does the model need to see right now, in what order, with what emphasis". Most agent failures are bad context engineering, not insufficient context.

4. **Intermediate verification reduces compounding failure.** Long agent loops without checkpoints have low end-to-end success rates. Insert verification steps every few turns to catch drift early.

5. **Specialized agents within a long-running workflow** *may* outperform a generalist — but the Jan 2026 follow-up (*When to use multi-agent systems*) substantially narrowed when this applies. The general rule: specialize for clearly separable concerns (testing agent vs cleanup agent at the *end* of a feature), not for sequential phases (planner → implementer → tester).

6. **The "what's done" question is hard.** Long-running agents often don't know when they're done. Explicit acceptance criteria, written upfront, are the only reliable answer. Without them, agents either declare premature victory or loop indefinitely.

7. **Logging and observability are first-class.** A long-running agent produces a trace. That trace is the artifact you debug from. Design logging into the harness — structured events, decision points, tool calls.

8. **Recoverability over reliability.** A perfectly reliable agent is a fantasy. A recoverable agent — one that can be paused, inspected, resumed, or restarted from a known checkpoint — is achievable and more valuable.

## How to apply in code-design decisions

- **When designing a long-running task:** plan the context-window cycle. What goes in window 1 (setup)? What in window N (work)? What survives across windows (artifacts, memory)?
- **When the agent must run for hours:** add checkpoints. Every meaningful step, write state to disk so the agent can resume from there.
- **When debugging an agent that "got stuck":** look at the trace, not just the final output. Where did it last make progress? What changed when it stopped?
- **When acceptance criteria are fuzzy:** stop and clarify them with the user before launching a long-running agent. Vague criteria + long horizon = guaranteed bad outcome.
- **When choosing between "one agent runs for 4 hours" and "main agent + verifier loop, each iteration ~20 min":** prefer the second. Shorter loops have better failure containment.

## When this source is WRONG / dated

- **Pre-Claude-4.6/4.7 context.** Some "the model can't reliably do X over a long horizon" claims have weakened as base models improved at multi-turn coherence.
- **Heavily oriented toward full-stack web app development** (per the post's own caveats). For other domains (data analysis, research, scientific computing), some lessons port and some don't.
- **The "initializer vs working agent" distinction is becoming less crisp** as automatic compaction and persistent memory handle some of what initializer agents used to do.

## Cross-references

- **Pairs essentially with:** [anthropic-building-effective-agents.md](anthropic-building-effective-agents.md) — same lineage; this post is the long-running variant
- **Pairs with:** [anthropic-multi-agent-when-to-use.md](anthropic-multi-agent-when-to-use.md) — the 2026 refinement on when specialization within a long workflow actually pays off (narrowly)
- **Pairs with:** Kleppmann (long-running agents are distributed systems internally — partial failure, idempotency, checkpoint/recovery all apply)

## Use in agent system prompts

Standing rules to embed (compressed) — relevant primarily to **orchestrator / main-thread agents**:

```
- Plan the context-window lifecycle for tasks longer than one window. What's the setup? What's the work? What survives across windows?
- Acceptance criteria upfront. Long horizon + vague "done" = guaranteed bad outcome.
- Insert intermediate verification — every few turns, summarize progress, check against goal.
- Design for recoverability: checkpoint state to disk so the task can be paused/resumed.
- The trace is the debug artifact. Log structured events at decision points.
```

Less relevant for **short-running** verifier / planner subagents (most subagents in this skill). Use sparingly.
