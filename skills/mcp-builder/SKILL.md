---
name: mcp-builder
description: "Design, build, and validate MCP (Model Context Protocol) servers for Claude Code, Codex CLI, OpenCode and other MCP hosts. Use when: mcp server, model context protocol, build mcp, design mcp, stdio transport, streamable http, tool schema, mcp host config, json-rpc tools. SKIP: using existing MCP tools as a consumer (→host's own MCP config), authoring SKILL.md (→skill-evaluation)."
stacks:
  - MCP Spec
tags:
  - mcp
  - model-context-protocol
  - server
  - claude-code
  - codex
  - opencode
  - protocol
source: vechkasov-global-skills
risk: medium-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- MCP Spec: `2025-11-25`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Use this skill when

- Building a new MCP server in TypeScript or Python (local tool exposure, remote service, OAuth-protected API)
- Validating an existing server for cross-host compatibility (Claude Code, Codex CLI, OpenCode)
- Translating a server config from one host format to another (e.g., Claude Code `.mcp.json` → Codex `config.toml`)
- Debugging stdio framing issues or Streamable HTTP Origin/session problems
- Choosing between stdio and Streamable HTTP transport
- Implementing OAuth flow for a remote MCP server
- Ensuring tool schema dialect compliance or fixing error-handling paths

## Do not use this skill when

- Consuming an existing MCP server as a tool — that is host configuration, not server authoring
- Building a non-MCP plugin or extension (use the host's own extension API)
- Authoring a SKILL.md file — use `skill-evaluation` for that

## Purpose

This skill encodes the full authoring surface for MCP servers: transport selection, lifecycle discipline, tool schema, OAuth paths, per-host quirks, and verification. It exists because each host (Claude Code, Codex CLI, OpenCode) has behavioral differences that silently break compliant servers, and the spec has non-obvious rules (stdio stdout-only, 403 vs 400, Tool Execution Error vs protocol error) that trip up even experienced implementors. See `references/protocol-checklist.md` for spec deltas from the prior revision.

## Capabilities

### Transport selection

Choose transport based on where the server process runs. For local processes on the same machine as the host, use stdio transport with `StdioServerTransport` from `@modelcontextprotocol/sdk`. For remote or cross-network servers, use Streamable HTTP transport with `StreamableHTTPServerTransport`. The decision matrix covers the main combinations:

```
Local process (same machine as host)?
  YES → stdio  (see references/templates/stdio-server-typescript.md)
  NO  → Streamable HTTP  (see references/templates/streamable-http-typescript.md)
```

| Use case | Recommended transport | Notes |
|---|---|---|
| Local tools (filesystem, DB, subprocess) | stdio | Stdout MCP-only; logs to stderr |
| Remote service, cross-network | Streamable HTTP | Validate Origin → 403; issue Mcp-Session-Id |
| OAuth-protected remote API (OpenCode) | Streamable HTTP + OAuth | OpenCode handles RFC 7591 automatically |
| OAuth-protected remote API (Claude Code / Codex) | Streamable HTTP + bearer token | Manual token lifecycle via env var |
| Server-push events | Either | Declare `listChanged` / `subscribe` only if implemented |
| Experimental durable requests | Either | Use `tasks` (SEP-1686) gated behind capability negotiation |

### Lifecycle compliance

The MCP handshake is strict. The server must handle `initialize` as the absolute first request and reject all other requests before it with a protocol error. The `initialize` response must include `protocolVersion`, `capabilities`, and `serverInfo`. After the client sends `notifications/initialized`, the server may begin sending unsolicited notifications. Declare in `capabilities` only what the server actually implements — hosts may cache capability claims and wait for notifications that never arrive.

For stdio shutdown: host closes stdin → server exits cleanly → host sends SIGTERM → host sends SIGKILL. For HTTP: close all open connections; server may disconnect SSE streams at will.

### Tool schema and error handling

Every tool must have a unique `name` (lowercase, hyphens/underscores only per SEP-986), a `description` string, and an `inputSchema` JSON Schema object. The default JSON Schema dialect is **2020-12** — include an explicit `$schema` annotation if using an older dialect. Optional fields: `title`, `outputSchema`, `annotations` (readOnlyHint, destructiveHint, etc.), and `icon` (SEP-973).

Error handling has two distinct paths. For **execution errors** (invalid args, tool failure, upstream API down): return `result.isError = true` with a `content[]` array — this is a Tool Execution Error (SEP-1303) and the model can self-correct. For **protocol errors** (unknown tool name, malformed JSON-RPC): return a standard JSON-RPC error object with `code` and `message`. Never swap these — a JSON-RPC error for an execution failure prevents the model from recovering.

### Host config translation

Each host has its own config schema, quirks, and defaults. When translating a server registration between hosts, map the fields and adjust for behavioral differences.

**Claude Code** — uses `.mcp.json` (project scope, git-tracked) or `~/.claude.json` (user scope). Config key is `mcpServers.<name>` with `command`, `args`, `env` (expanding from host process env via `${VAR}` syntax). The server's `instructions` string from the `initialize` response is injected into Claude's system prompt — write it for an LLM reader. Secrets must come from env refs, never inlined. Scopes: project (shared via git), user (personal), local (project-personal, not committed).

**Codex CLI** — uses `~/.codex/config.toml` with `[mcp_servers.<id>]` sections. Default `startup_timeout_sec = 10`; any stdio server with slow startup must override this or Codex kills it. `required = true` causes Codex to refuse launch if the server fails — correct for prod-critical, dangerous for optional. `enabled_tools`/`disabled_tools` accept glob patterns applied in that order; tool names must be stable.

**OpenCode** — uses the `"mcp"` object in OpenCode's config with `"type": "local"` (stdio) or `"type": "remote"` (HTTP). OAuth for remote servers is fully automatic: OpenCode detects `401`, runs RFC 7591 Dynamic Client Registration, and manages token lifecycle — no manual bearer token setup. Tool toggling is per-agent via glob patterns; keep tool names stable.

### Verification

Before shipping any server, register it against the target host and run the full check suite. Use `npx @modelcontextprotocol/inspector` to inspect any stdio or HTTP server independently of the host. The minimum verification checklist: `initialize` → `notifications/initialized` handshake completes; `tools/list` returns expected tools with correct `inputSchema`; `tools/call` with valid args returns `content[]`; `tools/call` with invalid args returns `isError: true` (not a JSON-RPC error); HTTP servers return `403` on bad `Origin`; HTTP servers return `400` on missing `MCP-Protocol-Version`; stdio servers produce no non-MCP output on stdout.

See `references/verification.md` for copy-paste curl and CLI commands for all three hosts.

## Behavioral Traits

- Chooses stdio for any local-process server; only escalates to Streamable HTTP when the server must be remote or cross-network
- Always routes execution errors through `result.isError = true`, never through JSON-RPC error objects
- Writes the server `instructions` field (from `initialize` response) as LLM-readable context, not a human readme
- Declares only capabilities the server actually implements — never speculative `listChanged` or `subscribe` flags
- Puts secrets in env vars referenced by `${VAR}`, never inlined in config files committed to git
- Checks `startup_timeout_sec` when targeting Codex CLI — assumes 10s default and overrides for slow servers
- Runs `npx @modelcontextprotocol/inspector` as the first debug step before blaming the host

## Important Constraints

- NEVER write non-MCP bytes to stdout in stdio mode — any stray output (logs, print statements, debug) corrupts the framing
- NEVER embed literal newlines in stdio messages — JSON string `\n` must be escaped as `\\n`
- NEVER return `400` for an invalid `Origin` header on Streamable HTTP — the spec requires `403 Forbidden`
- NEVER return a JSON-RPC error object for a tool execution failure — use `result.isError = true` (Tool Execution Error)
- NEVER declare `listChanged: true` or `subscribe: true` in capabilities unless the server sends the corresponding notifications
- NEVER inline secrets in `command`/`args`/`env` config — always reference from host process environment
- ALWAYS validate `Mcp-Session-Id` on every stateful HTTP request after the handshake
- ALWAYS validate `MCP-Protocol-Version` header on every post-initialize HTTP request, returning `400` on mismatch
- ALWAYS use JSON Schema 2020-12 as the default dialect for `inputSchema` and `outputSchema`, or annotate explicitly with `$schema`

## Related Skills

### Host AI CLIs (the consumers)
- `claude-code` — configure MCP servers in Claude Code via `.mcp.json` or `claude mcp add`
- `codex` — configure MCP servers in Codex CLI via `~/.codex/config.toml`
- `opencode` — configure MCP servers in OpenCode; automatic OAuth for remote servers

### Authoring and meta
- `skill-evaluation` — authoring SKILL.md, Pattern 2 layout, description engineering (not MCP)

### TypeScript runtime
- `nodejs` — Node.js runtime for stdio and HTTP server implementations
- `typescript` — TypeScript patterns for `@modelcontextprotocol/sdk` usage

## API Reference

| Topic | File |
|---|---|
| Protocol compliance checklist (all MUSTs: lifecycle, stdio, HTTP, tools, schema, security; spec deltas) | [references/protocol-checklist.md](references/protocol-checklist.md) |
| Per-host config schema, transports, env, timeouts, quirks (Claude Code / Codex / OpenCode) | [references/host-matrix.md](references/host-matrix.md) |
| Minimal stdio server template (TypeScript, @modelcontextprotocol/sdk) | [references/templates/stdio-server-typescript.md](references/templates/stdio-server-typescript.md) |
| Minimal Streamable HTTP server template (TypeScript, @modelcontextprotocol/sdk) | [references/templates/streamable-http-typescript.md](references/templates/streamable-http-typescript.md) |
| Register and test commands for all three hosts (claude, codex, opencode) | [references/verification.md](references/verification.md) |
