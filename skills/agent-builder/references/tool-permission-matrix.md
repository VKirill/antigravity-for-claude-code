# Tool & permission matrix

Canonical tool sets and MCP scoping. **All other files cite this — they don't redefine.**

## Built-in Claude Code tools (May 2026)

| Tool | What it does |
|---|---|
| `Read` | Read file contents |
| `Write` | Create new files |
| `Edit` | Modify existing files |
| `Glob` | Find files by pattern |
| `Grep` | Search file contents |
| `Bash` | Run shell commands |
| `WebFetch` | Fetch a specific URL |
| `WebSearch` | Search the web |
| `Skill` | Invoke a Skill |
| `Agent` | Spawn a subagent (only in main thread via `claude --agent`) |
| `SendMessage` | Resume existing subagent (requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) |

## Canonical tool sets

| Role | Tools |
|---|---|
| Read-only / reviewer / verifier | `Read, Grep, Glob` |
| Research / explorer | `Read, Grep, Glob, WebFetch, WebSearch` |
| Code writer (rare for subagent) | `Read, Write, Edit, Bash, Glob, Grep` |
| Documenter | `Read, Write, Edit, Glob, Grep, WebFetch, WebSearch` |
| Bash-only with hooks | `Bash` + `PreToolUse` hook |

When uncertain: start **read-only**, add as evidence demands.

## When to use `tools:` vs `disallowedTools:`

| Situation | Use |
|---|---|
| Strictly read-only | `tools: Read, Grep, Glob` (allowlist) |
| Mostly normal, no writes | `disallowedTools: Write, Edit` (denylist) |
| Need parent's MCP + restriction | `disallowedTools: Write, Edit, Bash` (preserves MCP) |
| Clean, minimal | `tools: <explicit list>` |

If both set: `disallowedTools` first, then `tools` resolves against remaining. In both = removed.

## MCP scoping

### Pattern: scope-down (reuse configured)

```yaml
tools: Read, Grep, Glob
mcpServers:
  - serena   # reuse from .mcp.json
```

Server's tools become available **in addition to** `tools:`.

### Pattern: inline (don't bloat main)

```yaml
tools: Read, Bash
mcpServers:
  - playwright:
      type: stdio
      command: npx
      args: ["-y", "@playwright/mcp@latest"]
```

Connects when subagent starts, disconnects when done. Main never sees the server.

### Common Kirill stack mappings

| MCP server | Likely subagent | Why scoped |
|---|---|---|
| `serena` | code-archaeologist, refactor-planner | Heavy; only for deep code work |
| `git-nexus` | history-explorer | Git-archaeology only |
| `context7` | library-doc-fetcher | Doc-fetch tools; main usually doesn't need every turn |
| `supermemory` | learning-tracker | Persistent memory across sessions |
| `playwright` | browser-tester | Heavy, situational |
| `n8n-mcp` (if installed) | workflow-architect | Domain-specific |

## `permissionMode` decision table

| Subagent type | Recommended |
|---|---|
| Read-only verifier / reviewer / explorer | `plan` — belt-and-suspenders no-write |
| Tool-restricted operator | `default` — hooks handle safety, prompts still useful |
| Code-writer in own repo, trusted | `acceptEdits` |
| Headless / CI | `dontAsk` |
| Auto-classifier (advanced) | `auto` |
| Wide-open (DANGEROUS) | `bypassPermissions` — only with strict `tools:` allowlist |

**Inheritance reminder:** parent `bypassPermissions` / `acceptEdits` → subagent inherits, can't override. Parent `auto` → frontmatter `permissionMode` **ignored**.

## Forbidden combinations

| Combination | Problem |
|---|---|
| `permissionMode: bypassPermissions` + no `tools:` | Can write anywhere including `.git`, `.claude`. Catastrophic. |
| `tools: Bash` only, no PreToolUse hook | "Tool-restricted" in name only |
| `skills: [skill-with-disable-model-invocation]` | Silent fail, warning to debug log only |
| `disallowedTools: Read` | Cripples agent for nearly all useful work |
| `tools: Agent(...)` inside a subagent | Subagents can't spawn subagents — does nothing |

## Quick recipes

### Read-only reviewer

```yaml
tools: Read, Grep, Glob
permissionMode: plan
model: haiku
color: blue
```

### Verifier with full output isolation

```yaml
tools: Read, Bash
permissionMode: default
model: sonnet
effort: high
color: purple
```

### Tool-restricted DB reader (Kirill's pattern)

```yaml
tools: Bash
permissionMode: default
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./.claude/scripts/validate-readonly-db.sh"
model: haiku
color: yellow
```

### MCP-scoped semantic explorer

```yaml
tools: Read, Grep, Glob
mcpServers:
  - serena
permissionMode: plan
model: haiku
color: cyan
```

## Citation rule

Other files **must not redefine these inline.** Use:

> Tool set: read-only / reviewer (see [tool-permission-matrix.md](tool-permission-matrix.md)).

## Last verified

2026-05-16 against <https://code.claude.com/docs/en/sub-agents> and tools-reference.
