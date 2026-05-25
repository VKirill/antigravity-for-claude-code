# Anthropic, *Building Effective Agents*

**Source type:** Anthropic engineering blog post
**Date:** Dec 2024 (foundational); revised and extended through 2025-26
**URL:** <https://www.anthropic.com/engineering/building-effective-agents>
**Epistemic status:** distilled summary, not direct quotes

## Core thesis

Distinguish **workflows** (LLM steps orchestrated by code) from **agents** (LLMs dynamically deciding their own steps). Most production "agents" should be workflows. Start with the simplest pattern that works.

## Key principles

1. **Workflows vs agents.**
   - **Workflows**: orchestrated pipelines where code controls the flow; LLM is invoked at known steps.
   - **Agents**: the LLM itself decides next actions, often in a loop with tool use and self-evaluation.
   - Workflows are predictable, debuggable, cheaper. Agents are flexible but harder to operate.
   - **Start with workflows.** Reach for agents only when task variance demands dynamic decision-making.

2. **The five workflow patterns** (in order of complexity):
   - **Prompt chaining**: output of one LLM call → input to the next. Useful when steps have clear sub-tasks.
   - **Routing**: classify the input, dispatch to a specialized prompt. Useful when inputs have categories.
   - **Parallelization**: same input → multiple LLM calls in parallel → aggregate. Useful for breadth (multi-source synthesis) or voting.
   - **Orchestrator-workers**: a central LLM plans subtasks, delegates to worker LLMs, synthesizes. Useful when the decomposition is non-obvious.
   - **Evaluator-optimizer**: an LLM generates, another evaluates, the first revises. Useful when there are clear quality criteria.

3. **Agent loop = perceive → act → observe → repeat.** An agent is just an LLM with tools and a loop. The tools define what it can perceive and do.

4. **Tool design matters more than model choice.** Bad tools (vague descriptions, inconsistent parameters, error messages that don't help the model recover) destroy agent performance regardless of model.

5. **Build agents transparently.** Show the user the agent's plan and reasoning before destructive actions. Let humans intervene. This is both a safety feature and a debugging feature.

6. **Cost compounds.** Agent loops can multiply token cost by 10-100x vs a single LLM call. Cost-conscious design: set max-turn limits, prefer workflows over agents when both work, use cheaper models for non-judgment steps.

7. **Failures compound.** A 95%-reliable step run 10 times yields ~60% end-to-end reliability. Long agent loops without intermediate verification have very low end-to-end success rates.

8. **Augmented LLM = LLM + tools + memory + retrieval.** An "agent" in 2024-26 parlance is rarely just a model — it's a system with all four. Design the augmentation, not just the prompt.

## How to apply in code-design decisions

- **When asked to "build an agent":** ask whether a workflow would work first. Most "agents" should be prompt chains, routing, or parallelization.
- **When designing tools for an agent:** test the tool descriptions independently. Show them to a fresh LLM and ask "when would you call this tool?" If the answer is fuzzy, the description is bad.
- **When building an agent loop:** add intermediate verification. After every N turns, summarize progress and check against the original goal.
- **When choosing model tier:** the orchestrator/planner step justifies opus; the worker steps may run on sonnet or haiku.
- **When debugging an underperforming agent:** check tool quality first, prompt second, model choice last. Almost always a tool issue.

## When this source is WRONG / dated

- **The original post pre-dates Claude 4.6/4.7-era reasoning.** Some "you need orchestration" advice softens as base models get better at planning in a single context.
- **The Jan 2026 follow-up (*When to use multi-agent systems*) refines the orchestrator-workers pattern significantly** — that pattern is now considered an anti-pattern when applied to **roles within a single feature** (planner/implementer/tester subagents). The original post didn't anticipate this nuance.
- **Tooling has matured.** Tool Search, automatic compaction, persistent memory — these reduce the need for hand-orchestrated workflows. Read the original alongside its 2025-26 successors.

## Cross-references

- **Pairs essentially with:** [anthropic-multi-agent-when-to-use.md](anthropic-multi-agent-when-to-use.md) — that's the 2026 refinement on when orchestrator-workers actually pays off.
- **Pairs with:** [anthropic-effective-harnesses.md](anthropic-effective-harnesses.md) — for long-running agents specifically.
- **Conflicts with itself over time:** the 2024 post implies orchestrator-workers is broadly applicable. The 2026 post narrows that significantly. Treat the 2026 post as authoritative.

## Use in agent system prompts

Standing rules to embed (compressed):

```
- Default to workflows over agents. Reach for agentic loops only when task variance demands it.
- Tool descriptions are first-class artifacts. Vague tools = poor agent performance regardless of model.
- Add intermediate verification in agent loops. A 95%-reliable step compounds badly over 10 turns.
- Show the plan before destructive actions. Transparency is a debugging feature, not just a safety one.
- Cost-tier strategically: opus at orchestration / judgment, sonnet at workers, haiku at search.
```

Relevant for **planner / orchestrator subagents** and for any **agent-design discussion** the subagent participates in.
