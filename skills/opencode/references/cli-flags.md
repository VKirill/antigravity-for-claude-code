# CLI Flags Reference

## Modes

| Form | Purpose |
|---|---|
| `opencode` | Interactive TUI |
| `opencode run "<prompt>"` | One-shot, headless |
| `opencode acp` | Run as ACP server (for Zed/VS Code) |
| `opencode serve` | Run as HTTP API server |

## `run` flags

| Flag | Notes |
|---|---|
| `--json` | Emit JSONL event stream (one event per line) |
| `--agent <name>` | Pick agent: `build`, `plan`, or custom name |
| `--model <provider/model>` | Override model for this run |
| `--auto` | Skip approval prompts (use only in sandbox/CI) |
| `-c, --continue` | Resume most recent session in this dir |
| `--cwd <path>` | Set working directory |
| `--mcp <file>` | Extra MCP server config to merge |
| `--no-tools` | Disable all tools (chat-only mode) |
| `--max-turns N` | Cap loops |
| `--stdin` | Read prompt from stdin |

## Subcommands

| Subcommand | Purpose |
|---|---|
| `auth login` / `auth logout` | Manage provider credentials |
| `auth list` | Show authenticated providers |
| `mcp add` / `mcp list` / `mcp remove` | Manage MCP servers |
| `models` | List all reachable models |
| `agents list` | List defined agents |
| `agents run <name>` | Invoke an agent (one-shot) |
| `upgrade` | Self-update |
| `doctor` | Diagnose install + auth + MCP |
| `serve` | HTTP API server (programmatic control) |
| `acp` | ACP server for editor integration |

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Provider error / auth failure |
| `2` | User cancelled |
| `3` | Tool denied / blocked |

## JSON event stream (`--json`)

Each line is a JSON object with `type`:

| Type | Payload |
|---|---|
| `message` | Assistant message chunk |
| `tool_use` | Tool call being made (`tool`, `input`) |
| `tool_result` | Result of a tool call |
| `done` | Final result, usage, cost |
| `error` | Error event |

Example consumer:

```bash
opencode run "list files in src" --json \
  | jq -r 'select(.type=="message") | .content'
```

## Examples

```bash
# Headless review using a cheap model
opencode run "Review the diff" --json --agent plan --model groq/llama-3.3-70b

# Switch provider mid-run via flag
opencode run "Refactor auth.ts" --model anthropic/claude-opus-4-7

# ACP server for Zed
opencode acp

# Continue last session
opencode run -c "and also add tests"
```
