# MCP Protocol Compliance Checklist

All items are MUST unless marked MAY/SHOULD. Anchored to the current spec revision.

---

## Lifecycle

- [ ] Server MUST handle `initialize` as the first request; reject all other requests before it with a protocol error.
- [ ] `initialize` response MUST include `protocolVersion`, `capabilities`, `serverInfo`. MAY include top-level `instructions` string.
- [ ] `protocolVersion` in response MUST be a version the server supports. If the client's requested version is unsupported, return the server's latest supported version; client SHOULD disconnect on mismatch.
- [ ] Server MUST await the `notifications/initialized` notification before sending any unsolicited notifications.
- [ ] Shutdown (stdio): close stdin → wait for server exit → SIGTERM → SIGKILL.
- [ ] Shutdown (HTTP): close all open connections; server MAY disconnect SSE streams at will.

---

## stdio transport

- [ ] Messages MUST be newline-delimited JSON-RPC 2.0 objects (one complete object per line).
- [ ] Messages MUST NOT contain embedded newlines — literal `\n` in string values must be JSON-escaped as `\\n`.
- [ ] **stdout MUST contain only MCP messages.** Any other output (logs, debug, print statements) MUST go to stderr.
- [ ] stderr MAY be used for any log level (debug, info, warn, error) — per current spec (PR #670); this is no longer restricted to errors only.
- [ ] Encoding MUST be UTF-8.

---

## Streamable HTTP transport

- [ ] Server MUST expose a single endpoint accepting both `POST` and `GET`.
- [ ] Client sends `Accept: application/json, text/event-stream`; server MUST honor content negotiation.
- [ ] Server MUST validate `Origin` header. On invalid `Origin`: return **`403 Forbidden`** (not `400`). (PR #1439)
- [ ] Server MUST issue `Mcp-Session-Id` and validate it on subsequent requests.
- [ ] Every request after `initialize` MUST carry `MCP-Protocol-Version: <negotiated>` header. Server MUST return `400 Bad Request` on unsupported or missing version.
- [ ] Resumability: client MAY send `Last-Event-ID`; server SHOULD resume or replay missed events.
- [ ] GET SSE streams: server MAY disconnect at will; client MUST resume via GET (not POST). (SEP-1699)
- [ ] Server SHOULD bind to `127.0.0.1` (not `0.0.0.0`) when only local clients are expected (DNS-rebinding risk).

---

## Capabilities

Declare in `initialize` response only what the server actually implements:

- [ ] `tools` — required if server exposes tools. Include `listChanged: true` only if the server will send `notifications/tools/list_changed`.
- [ ] `resources` — include `subscribe: true` / `listChanged: true` only if implemented.
- [ ] `prompts` — same pattern.
- [ ] `logging` — if server supports `logging/setLevel`.
- [ ] `completions` — if server supports argument completion.
- [ ] `experimental` — use for experimental features such as `tasks` (SEP-1686).

Do NOT declare a capability you will not honor — clients may depend on resulting notifications.

---

## Tools

- [ ] Each tool MUST have: `name` (unique, string), `description` (string), `inputSchema` (JSON Schema object).
- [ ] `name` MUST follow SEP-986 naming conventions: lowercase, hyphens/underscores only, no spaces; keep short and stable (hosts may namespace by server id, apply glob filters).
- [ ] Optional tool fields: `title` (human display name), `outputSchema`, `annotations` (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`, `title`). Annotations are **untrusted hints**; clients MUST NOT enforce them for security.
- [ ] Optional tool icons metadata (SEP-973): `icon` field with URL or base64 data URI.
- [ ] `tools/list` MUST support pagination via `cursor` / `nextCursor`.
- [ ] `tools/call` response MUST have `content[]` array of typed blocks (`text`, `image`, `audio`, `resource_link`, `resource`). MAY include `structuredContent`.
- [ ] **Execution errors (invalid args, tool failure):** return `result.isError = true` — Tool Execution Error (SEP-1303). Do NOT return a JSON-RPC error object.
- [ ] **Protocol errors (unknown tool name, malformed JSON-RPC):** return a JSON-RPC error object (code + message).
- [ ] Validate all inputs before execution. Enforce access controls and rate limits. Sanitize outputs.

---

## JSON Schema dialect

- [ ] Default dialect for `inputSchema` and `outputSchema` is **JSON Schema 2020-12** (SEP-1613).
- [ ] If using an older dialect, include explicit `"$schema": "https://json-schema.org/draft/2019-09/schema"` (or similar) in the schema object.
- [ ] Elicitation primitive schemas (`string`, `number`, `enum`) MAY include `default` values (SEP-1034).
- [ ] `EnumSchema` supports both titled (single/multi-select) and untitled variants (SEP-1330).

---

## Security

- [ ] Validate `Origin` header on all Streamable HTTP endpoints → `403` on failure.
- [ ] Validate `Mcp-Session-Id` on all stateful HTTP requests.
- [ ] Validate `MCP-Protocol-Version` header on all post-handshake HTTP requests → `400` on failure.
- [ ] Never expose internal errors verbatim — sanitize error messages in tool results.
- [ ] OAuth (if used): expose `/.well-known/oauth-authorization-server` (OpenID Connect Discovery 1.0, SEP-797).
- [ ] OAuth Protected Resource Metadata: align with RFC 9728; `WWW-Authenticate` header now OPTIONAL with `.well-known` fallback (SEP-985).
- [ ] Support incremental scope consent via `WWW-Authenticate` partial grant (SEP-835).
- [ ] OAuth client registration: use OAuth Client ID Metadata Documents (SEP-991).

---

## Wire format

- [ ] JSON-RPC 2.0; every message MUST have `jsonrpc: "2.0"`.
- [ ] Requests MUST have `id` (string or number, non-null) and `method`.
- [ ] Notifications (no response expected) MUST omit `id`.
- [ ] Responses MUST have `id` matching the request; either `result` or `error`, never both.
- [ ] Error object MUST have `code` (integer) and `message` (string); MAY have `data`.
