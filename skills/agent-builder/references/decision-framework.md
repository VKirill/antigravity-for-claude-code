# Decision framework — skill, single-agent, or sub-agent?

The gate. Before any sub-agent gets written, this file must say "yes". The default answer is **no, use a skill or improve the main prompt**.

Two layers of gating:
1. **Should you reach for an agent at all?** (Most "I need an agent" requests are actually skill requests.)
2. **If yes — which of the three Anthropic-validated agent patterns applies?**

## Layer 1 — Should this be an agent at all?

In Claude Code 2026, the surfaces for adding LLM capability are, in order of cost:

| Surface | Cost | When to use |
|---|---|---|
| Better prompt in main / CLAUDE.md | ~free | Always try this first |
| Skill (`.claude/skills/*/SKILL.md`) | Low — written once, loaded on match | Reusable knowledge, conventions, multi-step procedures |
| Subagent (`.claude/agents/*.md`) | Higher — full context window, coordination | Context isolation, parallelization, hard tool restriction, blackbox verification |

**You climb this ladder only when the lower rung fails.**

### Counter-test D — skill instead of agent

Before authoring a sub-agent, ask:

1. **Would this work as a skill in main context?**
   - Is the capability mostly *knowledge* (conventions, patterns, gotchas)? → skill
   - Is the capability mostly *procedure* (numbered steps the user invokes)? → skill (with `disable-model-invocation: true` if it's command-like)

2. **Does an equivalent skill already exist in `~/.claude/skills/`?**
   - For "agent that knows React" — you have a `react` skill. Use it. No agent.
   - For "agent that handles auth" — you have `better-auth`. Use it. No agent.
   - For "agent that runs git workflows" — you have `git`, `gitnexus-*`. Use them.

3. **Would the agent's only added value be a system prompt?**
   - If yes → skill. Skills *are* loadable system prompts that fire on description match.
   - Agents add: separate context window, separate tool permissions, separate model — only spend those when needed.

If you answer "yes, it should be a skill" — **stop here, author a skill, not an agent.**

### When skills aren't enough

Skills fail to solve the case when:
- **The work generates a lot of output that shouldn't pollute main context** (running a test suite, grepping logs) — skill runs in main, so its tool calls all dump output into main
- **The work requires hard tool restriction** (read-only, no Write/Edit, hook-validated bash) — skills can pre-approve tools but not *remove* them
- **The work benefits from a fresh context** (blackbox verification — the verifier shouldn't know the implementation reasoning)
- **The work needs `memory:`** for cross-session accumulation — only agents have this field
- **The work has tool count overflow** (main has 20+ tools and is making wrong choices) — splitting into a specialized agent with focused tools helps

When one of these applies, proceed to Layer 2.

## Layer 2 — Which agent pattern?

Three Anthropic-validated conditions. **At least one must hold.**

### Condition 1: Context isolation

Side task generates >1000 tokens of intermediate output that won't be referenced again.

Concrete signals:
- Running tests (output dumps, stack traces)
- Searching big log files
- Exploring an unfamiliar codebase (lots of file reads, only a digest matters)
- Fetching docs / web content the main agent will summarize and forget

Anti-cases:
- Reading 3 files and editing one — intermediate volume is small
- Running a calculation — output IS the result
- Anything where you'd want to inspect the intermediate output later

### Condition 2: Parallelization

Independent paths can run concurrently.

Concrete signals:
- "Research X, Y, Z" where they don't depend on each other
- Auth + DB + API exploration in a new codebase
- "Check this works in Chrome, Firefox, Safari"

Anti-cases:
- "Plan, then implement, then test" — sequential
- Anything where step 2 needs step 1's full context
- "Refactor module A and module B" when both touch shared utilities

Anthropic: the benefit of parallelization is **thoroughness**, not speed. Multi-agent uses 3-10× more tokens.

### Condition 3: Specialization

Main agent has too many tools or conflicting personas.

Concrete signals (from the doc):
- Main has 20+ tools and selection is failing
- Tools span unrelated domains (DB + API + filesystem) and the agent confuses them
- Adding new tools degrades performance on existing tasks
- System prompts that conflict (creative brainstorm vs. rigid compliance check)

Anti-cases:
- "I want a Python agent and a JS agent" — language is not specialization
- "I want a frontend agent and a backend agent" — same feature, role-split anti-pattern
- "I want an expert in domain X" — give main a skill, not an agent

## Special note: Kirill's skill-stack

You have ~65 skills in `~/.claude/skills/` covering most stacks you work in (react, nextjs, fastapi, hono, prisma, redis, bullmq, telegram-bot, vk-bridge, cloudpayments, yookassa, etc.).

**This stack collapses most "I need a specialization agent" cases.** When you're tempted to create:

- `react-agent` → use `react` skill in main. No agent.
- `fastapi-agent` → use `fastapi` skill. No agent.
- `git-workflow-agent` → use `git` + `gitnexus-*` skills. No agent.
- `auth-agent` → use `better-auth` skill. No agent.

The legitimate agent cases in your context are narrower:

- **`test-verifier`** — blackbox check on tests (skills can't be blackbox)
- **`security-verifier`** — blackbox security sweep
- **`feature-planner`** — context isolation for the planning exploration (could arguably be a skill, but the SPEC artifact on disk + dedicated `permissionMode: plan` make agent meaningfully better)
- **`payments-verifier`** — high-stakes blackbox check (the agent edition of "code review by someone who didn't write it")
- **`db-reader`** — tool restriction enforced by hook (skills can't enforce; they advise)

That's it. **Five agents.** Not 30. Not 60. Five.

## Counter-tests before authoring

Even after Layer 1 + 2 say "yes", run all three:

### Counter-test A — better main prompt
Could you achieve the result by improving the main agent's prompt? Adding to CLAUDE.md? Loading an existing skill?
→ If yes, do that.

### Counter-test B — existing built-in
Does `Explore` / `Plan` / `general-purpose` already do this?
→ If yes, use the built-in.

### Counter-test C — existing skill
Is there a skill in `~/.claude/skills/` that already covers this?
→ If yes, the skill is enough. Don't duplicate as an agent.

### Counter-test D — would a NEW skill work?
If no existing skill fits but you don't need context isolation / parallelization / tool restriction → author a skill, not an agent.

## Decision flowchart

```
Task in front of you
  │
  ├─ Could a 1-2 sentence prompt improvement solve this?
  │    └─ YES → improve main prompt, STOP
  │
  ├─ Is this a built-in subagent's job (Explore / Plan / general-purpose)?
  │    └─ YES → invoke built-in, STOP
  │
  ├─ Does an existing skill in ~/.claude/skills/ cover this?
  │    └─ YES → use the skill, STOP
  │
  ├─ Would a NEW skill cover it (knowledge / convention / procedure)?
  │    └─ YES → author a skill, STOP
  │
  ├─ Does ANY of these hold?
  │    • Side task emits >1000 tokens you won't reference again      [context isolation]
  │    • Independent paths can run in parallel                       [parallelization]
  │    • Tool restriction must be hook-enforced, not advised          [specialization via hooks]
  │    • Tool count on main >20 and selection is failing             [tool overload]
  │    • Blackbox verification needed                                [verifier pattern]
  │
  │    └─ NONE → improve main prompt / author skill
  │    └─ ≥ ONE → continue to decomposition-patterns.md
```

## "Outgrowing single-agent" — signals from the doc

From Anthropic's Jan 2026 post:

1. **Approaching context limits** — main session routinely uses large context and quality is degrading
2. **Managing many tools** — main has 15-20+ tools and is making wrong selections. **Try Tool Search Tool first** — claims up to 85% token reduction
3. **Parallelizable subtasks** — research / exploration that naturally decomposes

> These thresholds will shift as models improve. Practical guidelines, not fundamental constraints. — Anthropic, Jan 2026

## What the doc warns against (still relevant)

- Teams invest months in elaborate multi-agent setups, then find better prompting on single-agent matched the result
- **Telephone game**: agents split by role pass info back and forth, fidelity degrades each handoff
- In one Anthropic experiment with planner/implementer/tester/reviewer, sub-agents spent more tokens on coordination than on the task

## The three work-bearing patterns

If you pass all gates, the work-bearing patterns are narrow:

1. **Verifier** — blackbox checker. Main does the work, verifier confirms it meets criteria with its own tools. → [verifier-agent-design.md](verifier-agent-design.md)
2. **Tool-restricted operator** — same task domain as main, restricted to a tool set or `PreToolUse` hook (e.g., db-reader). → [tool-permission-matrix.md](tool-permission-matrix.md)
3. **High-volume isolator** — for context-pollution avoidance only; the side task generates huge output, returns a digest. (This is most of what `Explore` does built-in.)

Plus one experimental fourth:

4. **Context-keeping specialist with `memory:`** — newer (May 2026 surface), not yet well-validated; treat as experimental.

## Anthropic's bottom line

> "Start with the simplest approach that works, and add complexity only when evidence supports it."

In a skill-rich Claude Code setup, "the simplest approach that works" is **a skill**, more often than not.
