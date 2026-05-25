# Recommended defaults

Canonical values for every frontmatter field. **All other files cite this — they don't redefine inline.** (Same pattern as bullmq's recommended-defaults.)

Source: synthesized from <https://code.claude.com/docs/en/sub-agents> + Anthropic's Jan 2026 multi-agent guidance + operational experience.

## `name`

| Convention | Example |
|---|---|
| `<role>` for general | `test-verifier`, `security-verifier` |
| `<role>-<modifier>` for variants | `test-verifier-strict` |
| `<domain>-<role>` for domain-specific | `payments-verifier`, `n8n-workflow-planner` |

Rules: lowercase letters/numbers/hyphens, max 64 chars, unique within scope.

## `description`

Pattern: `<role noun>. <concrete action>. Use <proactively/when X>. <trigger terms>.`

See [description-engineering.md](description-engineering.md). No fixed defaults.

## `tools` — canonical sets

(Repeating from [tool-permission-matrix.md](tool-permission-matrix.md).)

| Role | Tools |
|---|---|
| Read-only / verifier | `Read, Grep, Glob` |
| Research / explorer | `Read, Grep, Glob, WebFetch, WebSearch` |
| Code writer (rare for subagent) | `Read, Write, Edit, Bash, Glob, Grep` |
| Documenter | `Read, Write, Edit, Glob, Grep, WebFetch, WebSearch` |
| Bash-only with hook gating | `Bash` (+ PreToolUse hook) |

When uncertain: start **read-only**, add as evidence demands.

## `model`

| Subagent type | Recommended | Why |
|---|---|---|
| Fast read-only ops (search, lint, format-check) | `haiku` | Cost/latency dominate |
| Test runners, schema validators, simple verifiers | `sonnet` | Balanced default |
| Planners, security verifiers, payments verifiers, judgment-heavy | `opus` | Errors compound |
| When uncertain | `inherit` | Match main session |

Use full model ID (`claude-opus-4-7`) only for reproducibility across updates.

## `permissionMode`

| Subagent type | Recommended |
|---|---|
| Read-only verifier / reviewer / explorer | `plan` |
| Tool-restricted operator (with hooks) | `default` |
| Code-writer in trusted local repo | `acceptEdits` |
| CI / headless | `dontAsk` |
| Uncertain | `default` |

**Avoid `bypassPermissions`** unless paired with strict `tools:` allowlist AND audited.

## `color` — suggested role mapping

| Role | Color |
|---|---|
| Planner | `purple` |
| Test verifier | `purple` |
| Security verifier | `red` |
| Payments verifier | `red` |
| Schema verifier | `yellow` |
| Explorer / archaeologist | `cyan` |
| Documenter | `blue` |
| DB-reader / data tool | `yellow` |
| Tool-restricted bash | `orange` |
| Memory-keeping architect | `green` |
| Main-thread orchestrator | `pink` |

Conventions, not rules. Goal: glance at task list, know which agent is running.

## `effort`

| Subagent type | Recommended |
|---|---|
| Fast read-only checks | `low` or `medium` |
| Standard verifier | `medium` |
| Security / payments / judgment-heavy | `high` |
| Planner | `high` or `xhigh` |

## `memory`

| Subagent type | Recommended |
|---|---|
| Stateless verifier | (omit) — fresh per invocation is better |
| Codebase archaeologist | `project` |
| Architecture decision keeper | `project` |
| Cross-project habits keeper | `user` |
| Default if uncertain | `project` |

Always include MEMORY.md hygiene instructions in body.

## `skills` — preload

| Subagent type | Recommended preloads |
|---|---|
| Planner | Discipline + KB skills (e.g., `karpathy-guidelines`, `claude-code`) |
| Security verifier | Auth/validation skills (`better-auth`, `zod`, `pydantic`) |
| Payments verifier | Provider skills (`cloudpayments`, `yookassa`) + `zod` |
| Test verifier | Test-runner skills (`pytest`, `vitest`) |
| DB-reader | DB skills (`postgresql`, `redis`) |
| Generic verifier | None — body is enough |

**Cap at 4 preloaded skills.** Compaction budget = 25K shared.

**Never preload** skills with `disable-model-invocation: true`.

## `maxTurns`

| Subagent type | Recommended |
|---|---|
| Verifier (5-10 turn task) | `maxTurns: 15` (safety net) |
| Planner | `maxTurns: 20` |
| Open-ended explorer | (omit) |

Circuit breaker, not a tight limit.

## `background`

| Subagent type | Recommended |
|---|---|
| Long-running test suites | `background: true` |
| Long-running code-gen | `background: true` |
| Standard verifier | (omit) |
| Needs user prompts mid-run | (omit — background auto-denies) |

## `isolation`

| Subagent type | Recommended |
|---|---|
| Bulk-change agent (review before applying) | `isolation: worktree` |
| Standard verifier (no writes) | (omit) |

## Body length

| Subagent type | Target |
|---|---|
| Minimal verifier | 30-50 lines |
| Standard verifier | 50-100 lines |
| Planner | 80-150 lines |
| Orchestrator | 150-200 lines |
| Past 200 lines | Move content to preloaded skill |

## Three reference setups

### A: Minimal viable verifier (test-runner)

```yaml
---
name: test-verifier
description: Test-suite verifier. Runs full pytest/vitest/jest, returns failing tests with file:line. Use proactively after code changes.
tools: Read, Bash, Grep, Glob
permissionMode: default
model: sonnet
effort: medium
color: purple
maxTurns: 15
skills:
  - pytest
  - vitest
---
```

### B: Standard planner

```yaml
---
name: feature-planner
description: Feature planner. Produces SPEC + checklist + budgets. Read-only — does NOT implement.
tools: Read, Grep, Glob
permissionMode: plan
model: opus
effort: high
color: purple
maxTurns: 20
skills:
  - karpathy-guidelines
  - claude-code
mcpServers:
  - serena   # optional, if configured
---
```

### C: Memory-keeping architect

```yaml
---
name: project-architect
description: Architecture keeper. Accumulates ADRs across sessions.
tools: Read, Grep, Glob
permissionMode: plan
model: opus
effort: high
color: green
memory: project
skills:
  - karpathy-guidelines
  - claude-code
---
```

## Citation rule

Other files **must not redefine these defaults inline.** Use:

> Defaults: see [recommended-defaults.md](recommended-defaults.md).

## Last verified

2026-05-16 against the May 2026 Claude Code sub-agents doc.
