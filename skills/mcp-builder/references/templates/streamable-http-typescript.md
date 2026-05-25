# Template: Streamable HTTP MCP Server (TypeScript)

Spec: current MCP revision. SDK: `@modelcontextprotocol/sdk` (latest).
This is documentation, not a runnable scaffold — no `package.json` shown.
Requires an HTTP framework; example uses Node `http` + Express-style routing.
Copy-paste and run `tsc --noEmit` to verify types.

## Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "express": "^4.18.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0"
  }
}
```

## Minimal server (`server.ts`)

```typescript
import express, { Request, Response } from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ── 1. Origin allowlist ──────────────────────────────────────────────────────
//
// Current spec (PR #1439): invalid Origin MUST return 403 Forbidden.
// Adjust ALLOWED_ORIGINS for your deployment.
// For local-only servers: ["http://localhost", "http://127.0.0.1"]
const ALLOWED_ORIGINS = new Set<string>(
  (process.env.ALLOWED_ORIGINS ?? "http://localhost").split(",").map((o) => o.trim())
);

function validateOrigin(origin: string | undefined): boolean {
  if (!origin) return false; // no Origin header → reject
  try {
    const url = new URL(origin);
    return ALLOWED_ORIGINS.has(`${url.protocol}//${url.host}`);
  } catch {
    return false;
  }
}

// ── 2. Create MCP server ─────────────────────────────────────────────────────
const server = new Server(
  {
    name: "my-http-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: { listChanged: false },
    },
    instructions:
      "Remote MCP server. Use the `ping` tool to check connectivity.",
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "ping",
      description: "Returns 'pong'. Use to verify connectivity.",
      inputSchema: {
        // JSON Schema 2020-12 default (SEP-1613)
        type: "object",
        properties: {},
        required: [],
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "ping") {
    return { content: [{ type: "text", text: "pong" }] };
  }
  throw new Error(`Unknown tool: ${request.params.name}`);
});

// ── 3. Session store ─────────────────────────────────────────────────────────
//
// Mcp-Session-Id must be issued on initialize and validated on every
// subsequent request. Simple in-memory map for illustration.
const sessions = new Map<string, StreamableHTTPServerTransport>();

function generateSessionId(): string {
  return crypto.randomUUID();
}

// ── 4. HTTP handler ──────────────────────────────────────────────────────────
//
// Single endpoint, accepts POST (messages) and GET (SSE stream / polling).
const app = express();
app.use(express.json());

// Bind to loopback when only local clients are expected — DNS-rebinding risk
// if bound to 0.0.0.0 with no other Origin protection.
const HOST = process.env.HOST ?? "127.0.0.1";
const PORT = parseInt(process.env.PORT ?? "3000", 10);

app.post("/mcp", async (req: Request, res: Response) => {
  // ── 4a. Origin validation (PR #1439) ──
  if (!validateOrigin(req.headers.origin)) {
    res.status(403).json({ error: "Forbidden: invalid Origin" });
    return;
  }

  // ── 4b. MCP-Protocol-Version header validation ──
  // All post-handshake requests must carry the negotiated protocol version.
  // Skip check on initialize (no prior negotiation yet).
  const mcpVersion = req.headers["mcp-protocol-version"] as string | undefined;
  const isInitialize = req.body?.method === "initialize";
  // SUPPORTED_VERSIONS: populate from STACK_VERSIONS.md "MCP Spec" pin
  const SUPPORTED_VERSIONS = new Set([process.env.MCP_PROTOCOL_VERSION ?? "latest"]);
  if (!isInitialize && (!mcpVersion || !SUPPORTED_VERSIONS.has(mcpVersion))) {
    res.status(400).json({ error: "Bad Request: invalid MCP-Protocol-Version" });
    return;
  }

  // ── 4c. Session routing ──
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (isInitialize) {
    // New session
    const newSessionId = generateSessionId();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => newSessionId,
    });
    sessions.set(newSessionId, transport);
    res.setHeader("Mcp-Session-Id", newSessionId);
    await server.connect(transport);
    await transport.handleRequest(req, res);
    return;
  }

  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({ error: "Bad Request: missing or unknown Mcp-Session-Id" });
    return;
  }

  const transport = sessions.get(sessionId)!;
  await transport.handleRequest(req, res);
});

app.get("/mcp", async (req: Request, res: Response) => {
  // ── Origin + version validation same as POST ──
  if (!validateOrigin(req.headers.origin)) {
    res.status(403).json({ error: "Forbidden: invalid Origin" });
    return;
  }

  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({ error: "Bad Request: missing or unknown Mcp-Session-Id" });
    return;
  }

  // GET opens an SSE stream for server-initiated notifications.
  // Server MAY disconnect at will; client resumes via GET (SEP-1699).
  // Client may send Last-Event-ID for resumption.
  const transport = sessions.get(sessionId)!;
  await transport.handleRequest(req, res);
});

// ── 5. Start ─────────────────────────────────────────────────────────────────
app.listen(PORT, HOST, () => {
  process.stderr.write(`my-http-server listening on http://${HOST}:${PORT}/mcp\n`);
});
```

## Key rules for Streamable HTTP

| Rule | Spec reference |
|---|---|
| Invalid Origin → `403` (not `400`) | PR #1439, current spec |
| Issue `Mcp-Session-Id` on initialize; validate every subsequent request | Current spec |
| Validate `MCP-Protocol-Version` header; `400` on mismatch | Current spec |
| Bind to `127.0.0.1` for local-only use | Security (DNS-rebinding) |
| GET = SSE stream; server MAY disconnect; client resumes via GET | SEP-1699 |
| `isError: true` for execution errors; throw/JSON-RPC error for protocol errors | SEP-1303 |
| JSON Schema 2020-12 for `inputSchema` / `outputSchema` | SEP-1613 |

## OAuth (Path C)

For OAuth-protected remote servers, add:
- `GET /.well-known/oauth-authorization-server` (OpenID Connect Discovery 1.0, SEP-797)
- `WWW-Authenticate` header on `401` responses for incremental scope consent (SEP-835)
- OAuth Client ID Metadata Document endpoint (SEP-991)
- Protected Resource Metadata aligned with RFC 9728 (SEP-985)

OpenCode handles the OAuth flow automatically (RFC 7591 Dynamic Client Registration).
Claude Code and Codex require a bearer token sourced from an env var.
