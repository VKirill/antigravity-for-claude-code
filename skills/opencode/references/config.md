# `opencode.json` — Config Schema

## Top-level keys

```jsonc
{
  "$schema": "https://opencode.ai/config.schema.json",
  "model": "anthropic/claude-sonnet-4-6",
  "default_agent": "build",
  "instructions": ["./AGENTS.md", "./docs/conventions.md"],
  "share": "manual",
  "provider": { /* ... */ },
  "agent":    { /* ... */ },
  "mcp":      { /* ... */ },
  "keybindings": { /* ... */ },
  "permissions": { /* ... */ }
}
```

## `provider`

Define provider-specific options and credentials. Common pattern:

```jsonc
{
  "provider": {
    "default": "anthropic/claude-sonnet-4-6",
    "fallback": "openai/gpt-5.4",
    "anthropic": {
      "options": { "apiKey": "{env:ANTHROPIC_API_KEY}" }
    },
    "openai": {
      "options": { "apiKey": "{file:~/.secrets/openai-key}" }
    },
    "ollama": {
      "options": { "baseURL": "http://localhost:11434" }
    }
  }
}
```

Interpolation:
- `{env:VAR}` — environment variable
- `{file:path}` — file content (relative to config file, or absolute with `/` or `~`)

## `agent`

Define agents (primary + sub). See [agents.md](agents.md) for full schema.

```jsonc
{
  "agent": {
    "review": {
      "description": "Read-only PR review",
      "model": "anthropic/claude-sonnet-4-6",
      "prompt": "You are a focused reviewer...",
      "tools": { "write": false, "edit": false }
    }
  }
}
```

## `mcp`

Configure MCP servers. See [mcp.md](mcp.md).

```jsonc
{
  "mcp": {
    "github": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "{env:GITHUB_TOKEN}" }
    },
    "search": { "type": "remote", "url": "https://mcp.example.com/sse" }
  }
}
```

## `permissions`

```jsonc
{
  "permissions": {
    "auto": false,
    "tools": {
      "edit": true,
      "write": true,
      "bash": true,
      "web": false
    }
  }
}
```

## `keybindings`

```jsonc
{ "keybindings": { "submit": "Enter", "newline": "Shift+Enter", "switch_agent": "Tab" } }
```

## `share`

Controls share-link generation: `"manual"` (default), `"auto"`, `"disabled"`.

## Theme (separate file: `tui.json`)

```jsonc
{ "$schema": "https://opencode.ai/tui.schema.json", "theme": "tokyonight" }
```

## File layering

Resolution order:

```
1. CLI flag                      (highest priority)
2. <project>/opencode.json
3. <project>/.opencode/local.json (gitignored, user-local)
4. ~/.config/opencode/opencode.json
5. Built-in defaults              (lowest priority)
```

## JSONC (comments)

Use `opencode.jsonc` if you need comments. Both extensions are supported.

```jsonc
{
  // Default model for `build` agent
  "model": "anthropic/claude-sonnet-4-6"
}
```
