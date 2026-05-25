# Agents — Built-in, Custom, Subagents, ACP

## Two built-in primary agents

| Agent | Behaviour |
|---|---|
| `build` | Default. Full toolset (Read, Edit, Write, Bash, Web). |
| `plan` | Read-only. Drafts a plan, no side effects. |

Switch live in TUI with `Tab`. From CLI: `opencode run "..." --agent plan`.

## Defining custom agents

Two locations:

### A. In `opencode.json: agent.<name>`

```jsonc
{
  "agent": {
    "code-reviewer": {
      "description": "Read-only review focused on security and tests",
      "model": "anthropic/claude-sonnet-4-6",
      "prompt": "You are a focused code reviewer. Output Markdown.",
      "tools": { "write": false, "edit": false, "bash": false }
    }
  }
}
```

### B. As markdown — `.opencode/agents/<name>.md` (project) or `~/.config/opencode/agents/<name>.md` (user)

```markdown
---
description: "Read-only code review"
model: anthropic/claude-sonnet-4-6
tools:
  write: false
  edit: false
  bash: false
---

You are a focused code reviewer. Output Markdown.

For each issue, include:
- Severity (high/medium/low)
- File path + line
- Suggested fix
```

Markdown form is preferred when the system prompt is long.

## Primary vs subagent

| | Primary agent | Subagent |
|---|---|---|
| Launches a session? | Yes | No — called by a primary |
| Set as `default_agent`? | Yes | No |
| `--agent` flag picks one? | Primary only | No (call via task delegation) |
| Common use | `build`, `plan`, custom workflow | Reviewer, tester, search worker |

Mark an agent as subagent by setting `primary: false` (default is `true`).

## Tool allowlist

```yaml
tools:
  read: true       # default true
  edit: false
  write: false
  bash: false
  web: false
  task: true       # ability to call subagents
```

Disabling `bash` and `write` on a `review` agent is the canonical safe pattern.

## Default agent

```jsonc
{ "default_agent": "build" }
```

Falls back to `build` with a warning if the named agent doesn't exist or is a subagent.

## Invocation

- TUI: `Tab` cycles primary agents
- CLI: `opencode run "..." --agent <name>`
- Programmatic via SDK: `opencode-ai` npm package, `await opencode.run({ agent, prompt })`

## ACP — Agent Client Protocol

ACP is an emerging standard for editor↔agent communication (Zed-pioneered). OpenCode implements both ends:

```bash
opencode acp        # run as ACP server
```

Zed integration (`~/.config/zed/settings.json`):

```jsonc
{ "agent_servers": { "opencode": { "command": "/opt/homebrew/bin/opencode", "args": ["acp"] } } }
```

Then drive OpenCode agents from inside Zed's panel — no separate terminal.

## Composition pattern

Common production setup:

```jsonc
{
  "default_agent": "build",
  "agent": {
    "build": { "model": "anthropic/claude-sonnet-4-6" },
    "plan":  { "model": "anthropic/claude-opus-4-7" },
    "review": {
      "primary": false,
      "model": "anthropic/claude-haiku-4-5",
      "tools": { "edit": false, "write": false, "bash": false },
      "prompt": "You are a security-focused reviewer."
    },
    "doc-lookup": {
      "primary": false,
      "model": "groq/llama-3.3-70b-versatile",
      "tools": { "edit": false, "write": false, "bash": false, "web": true }
    }
  }
}
```

The `build` agent delegates to `review` and `doc-lookup` via the `task` tool.
