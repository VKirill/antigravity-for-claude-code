# opencode — Reference Index

| If you want to... | Open |
|---|---|
| Install, auth (multi-provider) | [installation.md](installation.md) |
| Look up a CLI flag (`--json`, `--agent`, `--model`) | [cli-flags.md](cli-flags.md) |
| Author `opencode.json` (providers, agents, MCP) | [config.md](config.md) |
| Pick a provider (Anthropic, OpenAI, Gemini, Ollama, ...) | [providers.md](providers.md) |
| Define a custom agent (build/plan/scope) | [agents.md](agents.md) |
| Use built-in or custom slash commands | [commands.md](commands.md) |
| Configure MCP servers (stdio + remote) | [mcp.md](mcp.md) |
| Restrict tools per agent, sandbox setup | [permissions.md](permissions.md) |
| Run headlessly in CI, JSON event stream | [interop.md](interop.md) |
| Migrate configs from Claude Code or Codex | [migration.md](migration.md) |
| Verify routing (positive/negative/edge tests) | [eval-cases.md](eval-cases.md) |

## Quick patterns

**Multi-provider config:**
```jsonc
{ "provider": { "default": "anthropic/claude-sonnet-4-6", "fallback": "openai/gpt-5.4" } }
```

**Read-only agent:**
```jsonc
{ "agent": { "review": { "model": "anthropic/claude-sonnet-4-6", "tools": { "write": false, "edit": false } } } }
```

**Headless one-shot:**
```bash
opencode run "Summarize CHANGELOG.md" --json --agent plan
```

**ACP server for Zed/VS Code:**
```bash
opencode acp
```
