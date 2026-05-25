# Knowledge Base — Index

Three sources, intentionally lean. Each is a **compact reference**, not a textbook. The goal: enough content for agents to apply principles without burning the 25K-token preload budget.

## Entries

| File | Source | When loaded |
|---|---|---|
| [ousterhout-philosophy-of-software-design.md](ousterhout-philosophy-of-software-design.md) | Ousterhout, *Philosophy of Software Design* (2021) | Planner / architect agents |
| [martin-clean-architecture.md](martin-clean-architecture.md) | Martin, *Clean Architecture* (2017) | Planner / architect agents |
| [anthropic-multi-agent-when-to-use.md](anthropic-multi-agent-when-to-use.md) | Anthropic blog, Jan 23 2026 | Planner / orchestrator agents — agent-builder skill |

## Why so few

Compaction budget for preloaded skills is **25K tokens shared**. Each KB entry, if loaded as a skill, consumes part of that budget. Three lean entries leaves room for stack-skills (`react`, `fastapi`, `cloudpayments`, etc.) which are usually more directly relevant.

## When to add a 4th entry

Add when:
- A specific agent's domain has a stable, canonical reference not in any existing skill
- The reference would be applied on *every* invocation of that agent (otherwise inline in body)
- You've measured the agent's behavior is missing the principles

Candidates considered and deferred:
- **Feathers — Working Effectively with Legacy Code** — useful but applies in narrow scenarios (refactoring legacy); load on demand, don't preload
- **Kleppmann — Designing Data-Intensive Applications** — too broad; load specific chapters as skills if needed
- **Anthropic — Building Effective Agents** — older post (Dec 2024), largely subsumed by Jan 2026 multi-agent post
- **Anthropic — Effective Agent Harnesses** — relevant to agent-team coordination, not to single-agent design

## How agents reference

In agent body:

```markdown
Apply principles from preloaded KBs:
- Deep modules + pull-complexity-downward (Ousterhout)
- Dependency Rule + layer boundaries (Martin)
- Three multi-agent conditions (Anthropic Jan 2026)
```

The KB files have the full content. Agent body just names the principle.

## How to preload

In agent frontmatter:

```yaml
skills:
  - karpathy-guidelines             # behavioral discipline
  - claude-code                     # platform conventions
  # KBs preloaded as skills only if standalone, otherwise inline reference
```

KBs in this directory are **markdown notes**, not skills. To preload them as skills, wrap each in `~/.claude/skills/<name>/SKILL.md` with appropriate frontmatter — see `skill-evaluation` for the skill-authoring conventions.

The `feature-planner` agent in `agents/` references these KBs by path in its body, not as `skills:` preload — that lets main load them on-demand when reading SPECs rather than every invocation.

## Last reviewed

2026-05-16
