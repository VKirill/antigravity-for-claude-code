# Template: stdio MCP Server (TypeScript)

Spec: current MCP revision. SDK: `@modelcontextprotocol/sdk` (latest).
This is documentation, not a runnable scaffold — no `package.json` shown.
Copy-paste into a TypeScript project; run `tsc --noEmit` to verify types.

## Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  }
}
```

## Minimal server (`server.ts`)

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ── 1. Create server with capabilities ──────────────────────────────────────
//
// `instructions`: shown to the model (Claude Code injects this into its system
// prompt). Write for an LLM reader — explain what the server does and any
// conventions the model must follow.
//
// `capabilities.tools.listChanged`: set to true ONLY if you will send
// `notifications/tools/list_changed` when the tool list changes.
const server = new Server(
  {
    name: "my-stdio-server",
    version: "1.0.0",
    // optional `description` field (aligns with MCP registry server.json format)
    // description: "Short description for registry",
  },
  {
    capabilities: {
      tools: {
        listChanged: false, // set true only if you implement the notification
      },
    },
    instructions:
      "You have access to the my-stdio-server MCP server. " +
      "Use the `echo` tool to reflect text back to you.",
  }
);

// ── 2. Implement tools/list ─────────────────────────────────────────────────
//
// inputSchema uses JSON Schema 2020-12 by default (SEP-1613).
// Do not use draft-07 or 2019-09 without an explicit $schema annotation.
//
// annotations are untrusted hints — clients MUST NOT enforce them for security.
// icon (SEP-973): optional icon metadata, omit if not registry-visible.
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "echo",                          // unique; follow SEP-986 naming: lowercase, hyphens/underscores
        title: "Echo Tool",                    // optional human-readable display name
        description: "Returns the input text unchanged.",
        inputSchema: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description: "Text to echo back.",
            },
          },
          required: ["text"],
        },
        // outputSchema is optional; if present, `structuredContent` must conform
        // outputSchema: { type: "object", properties: { result: { type: "string" } } },
        annotations: {
          readOnlyHint: true,    // does not modify external state (hint only)
          idempotentHint: true,  // same input always gives same output (hint only)
        },
        // icon: { type: "url", url: "https://example.com/icon.png" },  // SEP-973
      },
    ],
  };
});

// ── 3. Implement tools/call ─────────────────────────────────────────────────
//
// CRITICAL — error handling (SEP-1303):
//   Execution errors (bad args, tool failure): return result.isError = true
//     → model can self-correct from Tool Execution Errors
//   Protocol errors (unknown tool, malformed JSON-RPC): throw McpError
//     or return a JSON-RPC error object (for unknown method etc.)
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "echo") {
    // Input validation failure → Tool Execution Error (isError: true), NOT JSON-RPC error
    if (typeof args?.text !== "string" || args.text.trim() === "") {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Invalid input: `text` must be a non-empty string.",
          },
        ],
      };
    }

    // Success path
    return {
      content: [
        {
          type: "text",
          text: args.text,
        },
      ],
      // structuredContent: { result: args.text },  // optional; must conform to outputSchema if declared
    };
  }

  // Unknown tool name → protocol error (throw, or return JSON-RPC error)
  throw new Error(`Unknown tool: ${name}`);
});

// ── 4. Connect transport and start ──────────────────────────────────────────
//
// StdioServerTransport reads from process.stdin, writes to process.stdout.
// NEVER write to stdout directly (console.log, process.stdout.write) — it
// corrupts the protocol framing.
// Use process.stderr or a logger that targets stderr for all log output.
// stderr is allowed for ALL log levels per current spec (PR #670).
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("my-stdio-server running on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
```

## Key rules for stdio

| Rule | Reason |
|---|---|
| stdout = MCP only | Any extra byte corrupts newline-delimited framing |
| stderr = all logs | Current spec (PR #670) explicitly allows all log levels on stderr |
| No embedded newlines | Each JSON-RPC message must be one line; escape `\n` as `\\n` in strings |
| `isError: true` for arg errors | Model can self-correct; JSON-RPC errors block self-correction (SEP-1303) |
| JSON Schema 2020-12 | Default dialect per current spec (SEP-1613) |
| Declare only implemented capabilities | Hosts may wait for notifications you never send |
