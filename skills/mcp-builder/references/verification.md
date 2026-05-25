# Verification — Register and Test an MCP Server

How to register and validate an MCP server against each host.
All JSON-RPC samples use the current MCP spec wire format.

---

## Claude Code

### 1. Register (stdio server)

```bash
# Add a stdio server (project scope — writes .mcp.json)
claude mcp add my-tool node /path/to/server.js

# Add with env var
claude mcp add my-tool --env API_KEY=value node /path/to/server.js

# Add a remote Streamable HTTP server
claude mcp add --transport sse my-remote https://example.com/mcp

# Verify the server appears in the list
claude mcp list
```

### 2. Inspect via MCP Inspector

```bash
# Launch inspector against a stdio server
npx @modelcontextprotocol/inspector node /path/to/server.js

# Launch inspector against an HTTP server
npx @modelcontextprotocol/inspector --url http://127.0.0.1:3000/mcp
```

### 3. tools/list (raw JSON-RPC)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

Expected response shape:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "echo",
        "description": "Returns the input text unchanged.",
        "inputSchema": { "type": "object", "properties": { "text": { "type": "string" } }, "required": ["text"] }
      }
    ]
  }
}
```

### 4. tools/call (raw JSON-RPC)

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "echo",
    "arguments": { "text": "hello" }
  }
}
```

Expected response (success):
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [{ "type": "text", "text": "hello" }]
  }
}
```

Expected response (execution error — NOT a JSON-RPC error):
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "isError": true,
    "content": [{ "type": "text", "text": "Invalid input: `text` must be a non-empty string." }]
  }
}
```

---

## Codex CLI

### 1. Register (stdio server)

Edit `~/.codex/config.toml`:
```toml
[mcp_servers.my-tool]
command = "node"
args = ["/path/to/server.js"]
startup_timeout_sec = 30   # override if server is slow to start
enabled = true
```

For an HTTP server:
```toml
[mcp_servers.my-remote]
url = "https://example.com/mcp"
bearer_token_env_var = "MY_BEARER_TOKEN"
enabled = true
```

### 2. Verify startup

```bash
# Codex logs MCP server startup on launch; watch for errors
codex --verbose 2>&1 | head -50
```

### 3. Inspect via MCP Inspector

```bash
npx @modelcontextprotocol/inspector node /path/to/server.js
# or for HTTP:
npx @modelcontextprotocol/inspector --url http://127.0.0.1:3000/mcp
```

### 4. tools/list and tools/call

Use the same JSON-RPC samples as the Claude Code section above.
For HTTP servers, send via `curl`:

```bash
# Initialize first to get session id
curl -s -X POST http://127.0.0.1:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"<MCP_SPEC_VERSION>","capabilities":{},"clientInfo":{"name":"test","version":"0.0.1"}}}' \
  -D -   # print response headers to see Mcp-Session-Id
```

```bash
# Then use the session id for tools/list
SESSION_ID="<from Mcp-Session-Id header>"
curl -s -X POST http://127.0.0.1:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost" \
  -H "MCP-Protocol-Version: <MCP_SPEC_VERSION>" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

---

## OpenCode

### 1. Register

Edit OpenCode config (location varies; typically `~/.config/opencode/config.json`):
```json
{
  "mcp": {
    "my-tool": {
      "type": "local",
      "command": ["node", "/path/to/server.js"],
      "environment": {}
    }
  }
}
```

For remote (OAuth handled automatically):
```json
{
  "mcp": {
    "my-remote": {
      "type": "remote",
      "url": "https://example.com/mcp"
    }
  }
}
```

### 2. Verify

```bash
# OpenCode logs MCP initialization on startup
opencode --verbose 2>&1 | grep -i mcp
```

### 3. Inspect via MCP Inspector

```bash
npx @modelcontextprotocol/inspector node /path/to/server.js
```

### 4. tools/list and tools/call

Use the same JSON-RPC samples as the Claude Code section.
For local/HTTP testing, use the `curl` workflow from the Codex section.

---

## Checklist — what to verify on every server

- [ ] `initialize` → `notifications/initialized` handshake completes without error.
- [ ] `tools/list` returns expected tools with correct `inputSchema`.
- [ ] `tools/call` with valid args returns `content[]` (no `isError`).
- [ ] `tools/call` with invalid args returns `isError: true` (not a JSON-RPC error).
- [ ] (HTTP only) Request with bad `Origin` → `403`.
- [ ] (HTTP only) Request missing `MCP-Protocol-Version` → `400`.
- [ ] No output on stdout except MCP messages (stdio only).
- [ ] Server shuts down cleanly on stdin close (stdio) or connection close (HTTP).
