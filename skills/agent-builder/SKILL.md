---
name: agent-builder
description: "Designs and authors Claude Code sub-agents (.claude/agents/*.md files) that integrate with an existing skill-stack. Use when: subagent, sub-agent, agent design, .claude/agents, custom agent, agent frontmatter, verifier agent, planner agent, agent description, agent delegation, Explore, Plan, general-purpose, Agent tool, agent permissions, agent tools field, agent skills preload, agent memory field, isolation worktree, permissionMode, agent decomposition, multi-agent decision, planner SPEC, verifier checklist, agent context isolation, tool-restricted agent, нужен ли мне агент, как сделать сабагента, как настроить .claude/agents. SKIP: building skills (→skill-evaluation), evaluating LLM agents in production (→agent-evaluation), Claude API / Messages SDK outside Claude Code (→claude-api), MCP server authoring (→mcp-server-author), agent-team coordination across separate sessions (→agent-teams), codex-specific agent authoring (use codex own conventions)."
stacks:
  - claude-code
  - agent-design
  - multi-agent
packages:
  - "@anthropic-ai/claude-code"
tags:
  - claude-code
  - subagent
  - agent-design
  - multi-agent
manifests:
  - .claude/agents
  - .claude/skills
source: vechkasov-global-skills
risk: high-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- Claude Code: `2.1.x+` (Task tool renamed to Agent in 2.1.63; `memory:`, `isolation: worktree`, `effort:`, fork mode require recent versions)
- Authoritative doc: <https://code.claude.com/docs/en/sub-agents> (verified 2026-05-16)
- Companion doc: <https://code.claude.com/docs/en/skills>
- Methodology source: Anthropic *When to use multi-agent systems (and when not to)*, 2026-01-23 — <https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them>

<!-- versions:end -->

## Usage

Loaded automatically when the description matches the active task. Read only the section you need.

This is the **Claude Code edition** of agent-builder. It is *skill-stack-aware*: it assumes you already have a rich `~/.claude/skills/` collection and tells you to **use skills first, agents second**. For codex-specific agent authoring, this skill does not apply.

## The core insight (read first)

In Claude Code, **skills do 90% of what people reach for agents to do**. The agent surface is narrow:

1. **Blackbox verification** — main can't critique its own work objectively
2. **High-volume isolation** — operations producing >1000 tokens of intermediate output
3. **Hard tool restriction** — guarantees enforced by `PreToolUse` hooks, not by prompting

If your need isn't one of these three — author a skill, not an agent.

## Use this skill when

- Deciding whether a task needs a sub-agent at all, vs. better prompting / a new skill on the main agent
- Designing a custom sub-agent for `.claude/agents/` or `~/.claude/agents/`
- Writing a `description` field that Claude will actually delegate to
- Building a **verifier** subagent (test-runner, security-checker, payments-checker)
- Building a **planner** subagent that produces SPEC.md + checklist + file budgets and stops
- Restricting tools / permissions / MCP for one subagent without affecting main
- Preloading skills from your stack into a subagent via `skills:` frontmatter
- Giving a subagent persistent `memory:` for cross-session accumulation
- Auditing an existing `.claude/agents/` directory to prune anti-patterns

## Do not use this skill when

- Task is to build a Skill (`.claude/skills/*/SKILL.md`) — that's `skill-evaluation`
- Task is to evaluate an LLM agent already in production — that's `agent-evaluation`
- Task is to coordinate sessions across machines / peer-to-peer — that's `agent-teams`
- Task is to author an MCP server — that's `mcp-server-author`
- Task is purely Claude Messages API outside Claude Code — that's `claude-api`
- Task is for codex-specific agents — codex has its own conventions; do not import these patterns blindly

## Purpose

This skill teaches how to design and write Claude Code sub-agents that integrate with an existing skill-stack — specifically the kind of stack Kirill has assembled (~65 skills covering frontend, backend, data, infra, and domain). It is grounded in:

1. The May 2026 official sub-agent docs
2. Anthropic's January 2026 multi-agent guidance, which refuted the "split by role" intuition
3. The reality that skills are the primary specialization surface in Claude Code 2026 — agents are a narrower tool than the codex / generic agent-framework world suggests

The default position is **single-agent + skills**. A sub-agent earns its place when one of three conditions holds (context isolation, parallelization, specialization that even a strong skill can't deliver).

## Capabilities

Each line below points to the canonical reference. The reference owns full content — do not duplicate.

- **Single-agent vs sub-agent decision** — three Anthropic conditions + the **counter-test for skills**. → [decision-framework.md](references/decision-framework.md)
- **Context-centric decomposition** — divide by context, not by role; the Telephone Game with Anthropic's own evidence. → [decomposition-patterns.md](references/decomposition-patterns.md)
- **Subagent anatomy** — every frontmatter field with when-to-set semantics. → [subagent-anatomy.md](references/subagent-anatomy.md)
- **Description engineering** — auto-delegation, "use proactively" idiom, trigger-term packing. → [description-engineering.md](references/description-engineering.md)
- **Tool-permission matrix** — canonical tool sets + how to scope Serena/git-nexus/Context7/playwright. → [tool-permission-matrix.md](references/tool-permission-matrix.md)
- **Planner subagent design** — SPEC + checklist + file budgets, stop-here pattern. → [planner-agent-design.md](references/planner-agent-design.md)
- **Verifier subagent design** — Anthropic's "consistently works" pattern; Early Victory Problem. → [verifier-agent-design.md](references/verifier-agent-design.md)
- **Memory & skills preload** — `memory:` scopes, `skills:` semantics, compaction budget. → [memory-and-skills-preload.md](references/memory-and-skills-preload.md)
- **Anti-patterns** — 18 documented things NOT to do. → [anti-patterns.md](references/anti-patterns.md)
- **Recommended defaults** — single source of truth for model/color/effort/permissionMode/tools. → [recommended-defaults.md](references/recommended-defaults.md)
- **Orchestration modes** — four ways to run autonomous cycles (skill-driven, main-as-agent, hook-driven, tool-restricted). → [orchestration-modes.md](references/orchestration-modes.md)
- **Migration guide** — clean up 30+ agent setups to a lean 5-7. → [migration-guide.md](references/migration-guide.md)
- **Troubleshooting** — symptom-indexed. → [troubleshooting.md](references/troubleshooting.md)

## Behavioral Traits

- **Starts with "Skill or agent?"** — for every request, first asks whether a skill in main would suffice. Agent is the exception.
- **Reuses built-in subagents** (`Explore`, `Plan`, `general-purpose`) before authoring custom alternatives
- **Writes descriptions in user-voice** (what user types), not agent-voice (what agent does); includes Russian trigger terms where appropriate
- **Sets `tools:` explicitly** for read-only agents; `disallowedTools:` for "inherit minus writes"
- **For planners**: produces SPEC + checklist + budgets and **stops** — no implementer hand-off
- **For verifiers**: includes the verbatim phrase "You MUST run the complete <X> before marking as passed"
- **Preloads ≤4 skills** per agent (compaction budget); picks skills relevant to *every* invocation, not just some
- **Names agents in lowercase-with-hyphens**; checks `name:` uniqueness across user + project + plugin scopes before creating
- **Avoids `bypassPermissions`** unless paired with strict `tools:` allowlist
- **Documents which condition** (context / parallel / specialization) justified the agent — so a future audit can verify the rationale still holds

## Important Constraints

- NEVER decompose a single feature into separate planner / implementer / tester subagents — Anthropic documented this fails (telephone game; coordination > work). Use **context-centric** boundaries: independent research paths, separate components with clean interfaces, blackbox verification.
- NEVER write a custom subagent that duplicates `Explore`, `Plan`, or `general-purpose`
- NEVER write a verifier without a "You MUST run the complete <X>" instruction
- NEVER let a planner subagent edit files — planner returns SPEC, main implements
- NEVER set `permissionMode: bypassPermissions` without an explicit `tools:` allowlist
- NEVER write `skills: [skill-name]` for a skill with `disable-model-invocation: true` — silent fail
- NEVER duplicate a stack-skill as an agent (no `react-agent` when `react` skill exists in `~/.claude/skills/`)
- ALWAYS write the description from the *user's* point of view
- ALWAYS verify `name:` uniqueness across `.claude/agents/`, `~/.claude/agents/`, plugin scopes
- ALWAYS keep the subagent body under ~150 lines; preloaded skills carry the deep content
- ALWAYS verify skill names exist before adding to `skills:` preload list — silent fail otherwise

## Related Skills

### Authoring layer (siblings)
- ✓ `skill-evaluation` — for writing the SKILL.md files that subagents preload
- ✓ `agent-evaluation` — for testing whether a built subagent works in production

### Stack-skills this skill references for preload guidance
- Backend / data: `pytest`, `vitest`, `zod`, `pydantic`, `postgresql`, `redis`, `prisma`, `bullmq`, `playwright`
- Auth & domain: `better-auth`, `cloudpayments`, `yookassa`, `telegram-bot`, `vk-bridge`
- Discipline: `karpathy-guidelines`, `claude-code`

### Runtime
- `claude-code-config` — settings.json, permission rules, hooks setup
- `mcp-server-author` — when an agent needs an MCP tool that doesn't exist

## API Reference

| Topic | File |
|---|---|
| **Decision framework** (skill or agent? then which agent type?) | [references/decision-framework.md](references/decision-framework.md) |
| **Decomposition patterns** (context-centric vs role-centric) | [references/decomposition-patterns.md](references/decomposition-patterns.md) |
| **Subagent anatomy** (every frontmatter field) | [references/subagent-anatomy.md](references/subagent-anatomy.md) |
| **Description engineering** (auto-delegation) | [references/description-engineering.md](references/description-engineering.md) |
| **Tool-permission matrix** (canonical tool sets, MCP scoping) | [references/tool-permission-matrix.md](references/tool-permission-matrix.md) |
| **Planner agent design** | [references/planner-agent-design.md](references/planner-agent-design.md) |
| **Verifier agent design** | [references/verifier-agent-design.md](references/verifier-agent-design.md) |
| **Memory & skills preload** | [references/memory-and-skills-preload.md](references/memory-and-skills-preload.md) |
| **Anti-patterns** | [references/anti-patterns.md](references/anti-patterns.md) |
| **Recommended defaults** | [references/recommended-defaults.md](references/recommended-defaults.md) |
| **Troubleshooting** | [references/troubleshooting.md](references/troubleshooting.md) |
| **Orchestration modes** (skill-driven / main-as-agent / hook-driven / tool-restricted) | [references/orchestration-modes.md](references/orchestration-modes.md) |
| **Migration guide** (from 30+ agents to lean setup) | [references/migration-guide.md](references/migration-guide.md) |
| Routing eval cases | [references/eval-cases.md](references/eval-cases.md) |

### Ready-to-use agents (the main deliverable)

**Copy from `agents/` directly to `~/.claude/agents/`. Each is calibrated for Kirill's skill-stack.**

| Agent | File | Preloaded skills | Justification |
|---|---|---|---|
| `dev-orchestrator` ⭐ | [agents/dev-orchestrator.md](agents/dev-orchestrator.md) | `karpathy-guidelines`, `claude-code` | Main-as-agent entry point: `claude --agent dev-orchestrator` runs the full plan→implement→verify cycle |
| `test-verifier` | [agents/test-verifier.md](agents/test-verifier.md) | `pytest`, `vitest` | Verifier (blackbox check on tests) |
| `security-verifier` | [agents/security-verifier.md](agents/security-verifier.md) | `better-auth`, `zod`, `pydantic` | Verifier (blackbox security sweep) |
| `feature-planner` | [agents/feature-planner.md](agents/feature-planner.md) | `karpathy-guidelines`, `claude-code` | Context isolation (planning generates lots of intermediate exploration) |
| `payments-verifier` | [agents/payments-verifier.md](agents/payments-verifier.md) | `cloudpayments`, `yookassa`, `zod` | Verifier (high-stakes domain check) |
| `db-reader` | [agents/db-reader.md](agents/db-reader.md) | `postgresql`, `redis` | Tool-restricted operator (PreToolUse hook enforces SELECT-only) |

**⭐ `dev-orchestrator` is the recommended entry point** for full-cycle sessions. Launched via `claude --agent dev-orchestrator`, it becomes the main thread and spawns the other agents as subagents in disciplined phases. See [references/orchestration-modes.md](references/orchestration-modes.md) for when to use it vs. skill-driven mode (superpowers-style).

**Required companion script** for `db-reader`: copy [scripts/validate-readonly-db.sh](scripts/validate-readonly-db.sh) to your project's `.claude/scripts/` and `chmod +x` it. Smoke-tested for SQL + Redis write detection with jq / python / sed fallbacks.

### Templates (for authoring NEW agents beyond the five above)

| Template | File |
|---|---|
| Generic verifier shell | [templates/verifier-generic.md.template](templates/verifier-generic.md.template) |
| Memory-keeping architect (`memory: project`) | [templates/memory-keeping-architect.md.template](templates/memory-keeping-architect.md.template) |
| Deep semantic explorer (MCP-backed) | [templates/explorer-deep.md.template](templates/explorer-deep.md.template) |
| Main-thread orchestrator (for `claude --agent`) | [templates/orchestrator-main-agent.md.template](templates/orchestrator-main-agent.md.template) |

### Knowledge Base (preloaded into planner / architect agents)

| Source | File |
|---|---|
| A Philosophy of Software Design — Ousterhout | [knowledge-base/ousterhout-philosophy-of-software-design.md](knowledge-base/ousterhout-philosophy-of-software-design.md) |
| Clean Architecture — Martin | [knowledge-base/martin-clean-architecture.md](knowledge-base/martin-clean-architecture.md) |
| Anthropic — When to Use Multi-Agent Systems (Jan 2026) | [knowledge-base/anthropic-multi-agent-when-to-use.md](knowledge-base/anthropic-multi-agent-when-to-use.md) |
| Index | [knowledge-base/INDEX.md](knowledge-base/INDEX.md) |

(KB intentionally lean — 3 entries vs the 7 in earlier draft. Compaction budget for preloaded skills is 25K shared; deep KBs eat that fast. Add Feathers / Kleppmann / Anthropic-effective-harnesses only if a specific agent justifies them.)

### Examples (concrete scenarios)

| Scenario | File |
|---|---|
| Real SPEC.md from feature-planner — what good looks like | [examples/planner-spec-output.md](examples/planner-spec-output.md) |
| What verifiers return for a typical feature PR | [examples/verifier-checklist.md](examples/verifier-checklist.md) |
| End-to-end: main + planner + test-verifier + security-verifier | [examples/building-feature-end-to-end.md](examples/building-feature-end-to-end.md) |

### Scripts

| Script | File |
|---|---|
| Validates SELECT-only / GET-only for `db-reader` agent | [scripts/validate-readonly-db.sh](scripts/validate-readonly-db.sh) |
| Scaffold a new agent file from a template | [scripts/new-agent.sh](scripts/new-agent.sh) |
| Print eval-cases for manual routing verification | [scripts/eval-routing.sh](scripts/eval-routing.sh) |

## TL;DR — what should I actually do?

Three common questions, three concrete answers:

**"I have 30+ agents, can I delete them all?"**
→ Read [references/migration-guide.md](references/migration-guide.md). Short answer: yes, archive them, install the 6 ready-made agents from `agents/`, install `codex-plugin-cc` plugin, optionally install `superpowers` for workflow skills. Net: 6 custom agents + 1 plugin + 65 stack skills covers everything.

**"How do I launch a full development cycle with one command?"**
→ `claude --agent dev-orchestrator`. The orchestrator becomes main thread and runs the 7-phase cycle (understand → plan → confirm → implement → review → iterate → wrap up), spawning `feature-planner`, `test-verifier`, `security-verifier` as needed. See [agents/dev-orchestrator.md](agents/dev-orchestrator.md).

**"Can subagents call other subagents?"**
→ **No.** This is documented and enforced. Solution: either (a) run an orchestrator as main thread via `claude --agent`, which CAN spawn subagents (this is `dev-orchestrator`), or (b) put methodology in workflow skills so main itself follows the cycle (the superpowers paradigm). See [references/orchestration-modes.md](references/orchestration-modes.md).

## How to install the ready-made agents

```bash
# from inside this skill directory
cp agents/*.md ~/.claude/agents/

# if you plan to use db-reader, also install the companion script
mkdir -p .claude/scripts
cp scripts/validate-readonly-db.sh .claude/scripts/
chmod +x .claude/scripts/validate-readonly-db.sh

# restart Claude Code so agents load (or use /agents UI for live reload)
```

To launch a full development cycle in one command:

```bash
claude --agent dev-orchestrator
```

This makes `dev-orchestrator` the main thread for the session, with permission to spawn `feature-planner`, `test-verifier`, `security-verifier`, `payments-verifier`, `db-reader` as subagents.

**Verify skill names match before relying on auto-delegation:**

```bash
# Confirm preloaded skill names actually exist
ls ~/.claude/skills/ | grep -E '^(pytest|vitest|zod|pydantic|better-auth|postgresql|redis|cloudpayments|yookassa|karpathy-guidelines|claude-code)$'
```

If any expected skill is missing → `skills:` preload silently fails for that skill. Either author the missing skill or remove it from the agent's frontmatter.

**How to use**: start at [decision-framework.md](references/decision-framework.md). If it says "use a skill instead", stop. If it says "yes, agent", go to [decomposition-patterns.md](references/decomposition-patterns.md) to pick the right boundary, then either copy a ready-made agent from `agents/` or use a template from `templates/`.
