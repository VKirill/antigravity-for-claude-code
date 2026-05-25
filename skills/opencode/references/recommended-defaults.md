# Recommended defaults — opencode

Canonical defaults for OpenCode CLI 1.0.92+. **Other files in this skill cite this — do not redefine inline.**

> Citation rule: every recommendation includes a default + a tune-up/tune-down condition.

## Provider priority list (recommended scaffolding)

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "anthropic": { "options": { "apiKey": "{env:ANTHROPIC_API_KEY}" } },
    "openai":    { "options": { "apiKey": "{env:OPENAI_API_KEY}" } },
    "google":    { "options": { "apiKey": "{env:GOOGLE_API_KEY}" } },
    "groq":      { "options": { "apiKey": "{env:GROQ_API_KEY}" } },
    "ollama":    { "options": { "baseURL": "{env:OLLAMA_BASE_URL}" } }
  }
}
```

Model selection per task:

| Task | Recommended model |
|---|---|
| Hard reasoning, refactor, design | `anthropic/claude-opus-4-7` |
| Daily build agent | `anthropic/claude-sonnet-4-6` |
| Read-only review (fast, cheap) | `anthropic/claude-haiku-4-5` |
| Bulk/CI runs (cheap + fast) | `groq/llama-3.3-70b-versatile` |
| Long context (1M+ tokens) | `google/gemini-2.5-pro` |
| Offline / local | `ollama/codellama:34b` or similar |

## Agent type selection

| Built-in agent | When |
|---|---|
| `plan` | Unfamiliar repo; large refactor scope; before any Edit/Write |
| `build` | Daily-driver writing/editing/refactoring |

Custom agent rules:
- Read-only review agent: set `tools.write = false, edit = false, bash = false`
- Bulk-task agent: route to cheap provider (`groq/llama-3.3-70b-versatile`)
- Agent system prompt > 5 lines → put in markdown body, not inline JSON

## opencode.json defaults (project scaffold)

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "default_agent": "build",
  "agent": {
    "build":  { "model": "anthropic/claude-sonnet-4-6" },
    "plan":   { "model": "anthropic/claude-opus-4-7" },
    "review": {
      "model": "anthropic/claude-haiku-4-5",
      "tools": { "write": false, "edit": false, "bash": false }
    },
    "bulk":   { "model": "groq/llama-3.3-70b-versatile" }
  },
  "mcp": {
    "github": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "{env:GITHUB_TOKEN}" }
    }
  }
}
```

## tui.json (separate file)

Theme + keybinds live in `tui.json`, NOT `opencode.json`:

```jsonc
{
  "$schema": "https://opencode.ai/tui.json",
  "theme": "tokyonight",
  "leader_timeout": 2000,
  "keybinds": { "leader": "ctrl+x", "command_list": "ctrl+p" }
}
```

## Failover (no generic `provider.fallback`)

OpenCode has no top-level `provider.fallback` knob. Use:

1. **OpenRouter** — per-model `order` + `allow_fallbacks`
2. **Vercel gateway** — per-model `order`
3. **Shell wrapper** — retry `opencode run` with a different `--model`

See `providers.md` for snippets.

## Config precedence

CLI flag > project `opencode.json` > user `~/.config/opencode/opencode.json` > built-in defaults.

| Knob | Recommended location |
|---|---|
| Provider API keys | User (cross-project) via `{env:VAR}` |
| Agent definitions | Project (matches codebase) |
| MCP servers | User for general tools; project for project-specific |
| Theme / keybinds | User (`~/.config/opencode/tui.json`) |

## Headless / CI defaults

```bash
opencode run "review PR diff" --agent review --json
```

| Knob | CI default |
|---|---|
| `--json` | Always — JSONL events parseable |
| `--agent` | Pin a read-only agent for CI review |
| `--auto` | Only inside sandboxed runner (devcontainer/CI VM) |
| API key | From secret store via env; never inline |

## Hard rules

- NEVER commit API keys inline — use `{env:VAR}` or `{file:~/.secrets/...}`
- NEVER `--auto` outside sandboxed environment
- NEVER mix Anomaly fork and SST origin docs — they diverged late 2025; confirm install repo
- NEVER omit provider prefix in model IDs (`claude-sonnet-4-6` is ambiguous; use `anthropic/claude-sonnet-4-6`)

## Citation rule

Other files MUST NOT redefine these values inline. Use:

> Defaults: see [recommended-defaults.md](recommended-defaults.md).

## Last verified

2026-05-15 against opencode-ai 1.0.92+ docs (`/anomalyco/opencode` via Context7).
