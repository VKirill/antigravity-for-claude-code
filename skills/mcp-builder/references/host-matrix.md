# Host Compatibility Matrix

Three supported hosts: Claude Code, Codex CLI, OpenCode.

---

## Claude Code

| Property | Value |
|---|---|
| **Config files** | `.mcp.json` (project scope, git-tracked) · `~/.claude.json` (user scope, personal) |
| **CLI to add** | `claude mcp add <name> <command> [args...]` · `claude mcp add --transport sse <name> <url>` |
| **Transports** | stdio, SSE, Streamable HTTP |
| **Env passthrough** | Env vars in `command`/`args` expand from host process env |
| **Timeout defaults** | Not published; uses OS/process defaults |

### Config schema example (`.mcp.json`)

```json
{
  "mcpServers": {
    "my-tool": {
      "command": "node",
      "args": ["/path/to/server.js"],
      "env": {
        "API_KEY": "${API_KEY}"
      }
    }
  }
}
```

For remote (Streamable HTTP):
```json
{
  "mcpServers": {
    "my-remote": {
      "transport": "sse",
      "url": "https://example.com/mcp"
    }
  }
}
```

### Quirks

- **Quirk CC-1:** Scopes: `project` (`.mcp.json`, shared via git), `user` (`~/.claude.json`, personal), `local` (project-personal hybrid, not committed). Scope determines visibility and sharing.
- **Quirk CC-2:** Server `instructions` string (from `initialize` response) is injected into Claude's system prompt — write for an LLM reader, not a human.
- **Quirk CC-3:** Secrets must be referenced from env, not inlined. `"${VAR}"` syntax expands from host env.

---

## Codex CLI (OpenAI)

| Property | Value |
|---|---|
| **Config file** | `~/.codex/config.toml` |
| **Config section** | `[mcp_servers.<id>]` |
| **Transports** | stdio (`command`) · Streamable HTTP (`url`) — no SSE-only fallback documented |
| **Env passthrough** | `env` (inline key-value) · `env_vars` (with `source = "local"` or `"remote"`) |
| **Startup timeout** | `startup_timeout_sec` — **default 10 seconds** |
| **Tool timeout** | `tool_timeout_sec` — default 60 seconds |

### Config schema example (`~/.codex/config.toml`)

```toml
[mcp_servers.my-tool]
command = "node"
args = ["/path/to/server.js"]
startup_timeout_sec = 30
tool_timeout_sec = 60
enabled = true

[mcp_servers.my-tool.env]
API_KEY = "env:API_KEY"

# Fine-grained tool filtering (optional):
enabled_tools = ["search", "fetch"]
disabled_tools = ["delete_*"]

# For remote HTTP server:
# url = "https://example.com/mcp"
# bearer_token_env_var = "MY_BEARER_TOKEN"
```

### Quirks

- **Quirk CX-1:** `startup_timeout_sec = 10` by default. Any stdio server with slow startup (heavy imports, DB connect) must override this or Codex will kill it.
- **Quirk CX-2:** `required = true` makes Codex fail entirely if the server cannot initialize. Use for prod-critical servers; do NOT use for optional/convenience servers.
- **Quirk CX-3:** `enabled_tools` / `disabled_tools` support glob patterns. Deny list is applied after allow list. Tool names must be stable — glob filters break on rename.

Additional fields: `cwd`, `http_headers`, `env_http_headers`, `oauth_resource` (RFC 8707), `experimental_environment` (`local|remote`).

---

## OpenCode

| Property | Value |
|---|---|
| **Config field** | `"mcp"` object in OpenCode config file |
| **Server type: local** | `"type": "local"` with `"command": [...]` array and `"environment": {}` object |
| **Server type: remote** | `"type": "remote"` with `"url"` and optional `"headers"` |
| **Transports** | stdio (local), Streamable HTTP (remote) |
| **Env passthrough** | `"environment"` object in local server config |
| **OAuth** | Automatic for remote: detects `401` → RFC 7591 Dynamic Client Registration → token management |
| **Timeout defaults** | Not published separately |

### Config schema example

```json
{
  "mcp": {
    "my-local-tool": {
      "type": "local",
      "command": ["node", "/path/to/server.js"],
      "environment": {
        "API_KEY": "value"
      }
    },
    "my-remote-tool": {
      "type": "remote",
      "url": "https://example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${TOKEN}"
      }
    }
  }
}
```

### Quirks

- **Quirk OC-1:** OAuth for remote servers is fully automatic — no bearer token setup needed. OpenCode detects `401`, runs RFC 7591 Dynamic Client Registration, and manages the token lifecycle. Claude Code and Codex require manual env-var-sourced bearer tokens.
- **Quirk OC-2:** Tools can be toggled globally or per-agent via glob patterns. Tool names must be stable and predictable; renaming breaks existing glob filters.
- **Quirk OC-3:** OpenCode explicitly warns that MCP servers consume context tokens. Selective enablement is recommended. Keep tool count low and descriptions tight.
