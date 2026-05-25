# MCP — Model Context Protocol in OpenCode

MCP is a wire-level standard — the **same server binaries** work in Claude Code, OpenCode, and Codex CLI. Only the config format differs.

## Configuration

In `opencode.json` (or `.opencode/local.json` for personal/secrets):

```jsonc
{
  "mcp": {
    "filesystem": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/home/me/projects"]
    },
    "github": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "{env:GITHUB_TOKEN}" }
    },
    "postgres": {
      "type": "local",
      "command": ["node", "./tools/pg-mcp.js"],
      "env": { "DATABASE_URL": "{env:DATABASE_URL}" }
    },
    "remote-search": {
      "type": "remote",
      "url": "https://mcp.example.com/sse",
      "headers": { "Authorization": "Bearer {env:MCP_TOKEN}" }
    }
  }
}
```

## Transports

| Type | When | Spec |
|---|---|---|
| `local` | Subprocess (stdio) | `command: string[]` + optional `env` |
| `remote` | Hosted server | `url: string` + optional `headers` |

## Interactive add

```bash
opencode mcp add
```

Picks from a curated registry, prompts for env vars, writes to config.

## List & test

```bash
opencode mcp list           # show configured servers
opencode mcp test github    # call list_tools on one server
```

In TUI: `/mcp`.

## Common servers (same as Claude Code)

| Server | npm package |
|---|---|
| filesystem | `@modelcontextprotocol/server-filesystem` |
| github | `@modelcontextprotocol/server-github` |
| postgres | `@modelcontextprotocol/server-postgres` |
| brave-search | `@modelcontextprotocol/server-brave-search` |
| serena | external (semantic code navigation) |
| tavily | external (web research) |

## Per-agent MCP tools

By default all agents see all MCP tools. To restrict:

```jsonc
{
  "agent": {
    "review": {
      "tools": {
        "edit": false,
        "write": false,
        "mcp.github.create_pr": false   // disable specific MCP tool
      }
    }
  }
}
```

Tool naming: `mcp.<server-name>.<tool-name>`.

## Debugging

```bash
opencode --debug          # verbose MCP traffic to stderr
opencode mcp test <name>  # one-shot handshake check
```

Common failures:

| Symptom | Likely cause |
|---|---|
| Server not in `/mcp` list | Handshake failed; check `command` path |
| "no tools" | Server didn't implement `list_tools` |
| Auth error | env var not set or `{env:VAR}` typo |

## Security note

MCP server output is **untrusted context**. OpenCode injects it as user-content, not system-prompt. Apply prompt-injection mitigations the same way you would in Claude Code.
