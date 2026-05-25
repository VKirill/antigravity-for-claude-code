# Memory & Skills preload

Two May-2026 frontmatter surfaces that change how subagents work. Critical for skill-stack-aware agent design.

## `memory:` — persistent across sessions

Agent gets a directory it can read and write. Directory survives session restarts.

### Scopes

| Scope | Location | Use when |
|---|---|---|
| `user` | `~/.claude/agent-memory/<name>/` | Cross-project knowledge |
| `project` | `.claude/agent-memory/<name>/` | Project-specific, shareable via git |
| `local` | `.claude/agent-memory-local/<name>/` | Project-specific, gitignored |

### Default: `project`

> "`project` is the recommended default scope. It makes subagent knowledge shareable via version control." — official doc

### What happens when `memory:` is set

- System prompt extended with read/write instructions for the memory dir
- First 200 lines or 25KB of `MEMORY.md` in dir included in prompt
- Read/Write/Edit auto-enabled (overrides your `tools:` allowlist if set)

### Patterns that work

- **Codebase patterns keeper**: accumulates conventions over months of work on the same repo
- **ADR keeper**: architecture decisions logged with date and rationale
- **Debug-pattern tracker**: previous tricky bugs and their resolutions

### Patterns that DON'T work

- `memory: user` for project-specific knowledge — cross-project pollution
- No MEMORY.md hygiene instructions in body — grows unboundedly
- Treating MEMORY.md as a database — it's plaintext markdown

For full template, see [../templates/memory-keeping-architect.md.template](../templates/memory-keeping-architect.md.template).

## `skills:` — preload at startup

> "The full content of each listed skill is injected into the subagent's context at startup." — official doc

This is **the bridge between Kirill's skill-stack and subagents.** Skills you already authored become subagent equipment via `skills:`.

### When to use

- Subagent's domain has well-defined principles → preload them
- Same skills apply to multiple subagents → author once, preload into each

### When NOT to use

- Skill has `disable-model-invocation: true` → **preloading silently fails**, warning to debug log only
- Skill is large + only marginally relevant → eats compaction budget
- Only one subagent needs it AND skill is small → just inline in body

### Critical limit: ≤4 preloaded skills per agent

> "When the conversation is summarized to free context, Claude Code re-attaches the most recent invocation of each skill after the summary, keeping the first 5,000 tokens of each. Re-attached skills share a combined budget of 25,000 tokens." — official doc

6+ skills = each gets less content after compaction. Pick the ones that matter for *every* invocation, not just some.

### Kirill's stack — which skills to preload in which agents

**Ready-made agents already pick these — for reference:**

| Agent | Preloaded skills | Justification |
|---|---|---|
| `test-verifier` | `pytest`, `vitest` | Test runner conventions vary; agent needs to know commands and flags |
| `security-verifier` | `better-auth`, `zod`, `pydantic` | Auth and validation patterns — agent compares code against these |
| `feature-planner` | `karpathy-guidelines`, `claude-code` | Discipline rules applied to every plan |
| `payments-verifier` | `cloudpayments`, `yookassa`, `zod` | Provider conventions + payload validation |
| `db-reader` | `postgresql`, `redis` | Query patterns and safe defaults |

For a custom agent designing for Kirill's stack:

- **Frontend verifier** (rare but possible): `react`, `react-hook-form`, `zod`, `tailwind`
- **Architect (memory-keeping)**: `karpathy-guidelines`, `claude-code`, plus 1-2 architecture KB entries
- **Performance verifier**: `pytest`, `vitest`, `playwright` (perf testing tools)

### Important: preload != restrict access

Listing skills in `skills:` controls **what's preloaded at startup**. The subagent can still invoke other skills at runtime via the `Skill` tool — unless you omit `Skill` from `tools:` or add it to `disallowedTools:`.

To prevent skill invocation entirely:
```yaml
tools: Read, Grep, Glob   # no Skill listed
# OR
disallowedTools: Skill
```

## Combined pattern: memory + skills

```yaml
---
name: project-architect
skills:
  - karpathy-guidelines
  - claude-code
memory: project
---
```

Body instructions:
1. On invocation, read MEMORY.md for prior decisions
2. Apply preloaded principles to new request
3. Produce recommendation
4. Update MEMORY.md with one-line note

Over a year, this accumulates a project-specific style guide grounded in your discipline skills. Hard to replicate with prompting alone.

## Auto-compaction interaction

Subagents support automatic compaction. Default trigger: 95% capacity. Override via `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` env (e.g., `50` for earlier compaction).

If your subagent preloads 6 skills, they share 25K tokens after compaction. Practical: ≤4 preloaded skills, each lean.

## Common mistakes

| Mistake | Effect | Fix |
|---|---|---|
| Preload skill with `disable-model-invocation: true` | Silent fail | Drop the field or inline content |
| `memory: user` for project knowledge | Cross-project pollution | Use `memory: project` |
| Treating MEMORY.md as auto-generated | Grows into noise | Body instructions for hygiene |
| Not seeding MEMORY.md | Agent starts blank | One-line seed entry |
| Preloading 6+ skills | Each gets less content after compaction | Cap at 4 |

## Verifying skill names exist

Before adding a skill to `skills:`, verify it's actually installed:

```bash
ls ~/.claude/skills/ | grep -E '^(pytest|vitest|zod|pydantic|better-auth|...)$'
```

If a skill name is missing → preload silently fails for that skill. The agent won't have the content you expected. **Verify before relying.**

## Bottom line

- `memory:` is for **state that grows**
- `skills:` is for **content that's static and always relevant**
- Use `memory: project` by default
- Preload ≤4 skills per agent
- Never preload skills with `disable-model-invocation: true`
- Verify skill names exist on disk before adding

These two fields are the difference between an agent that resets every session and one that gets sharper over time. Critical for skill-stack-rich setups like Kirill's.
