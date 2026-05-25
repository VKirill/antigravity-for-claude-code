# OpenCode Server (`opencode serve`) — HTTP API for external orchestration

> When to use: an external process (web app, queue worker, CI step, IDE plugin) needs to drive OpenCode without owning a long-lived TCP connection. The HTTP API lets the caller submit work asynchronously and poll `/session/status` or subscribe to the `/event` SSE stream for progress — sidestepping per-request timeouts on the caller side.

> Verified against <https://opencode.ai/docs/server/> and <https://opencode.ai/docs/sdk/> on 2026-05-16. OpenAPI 3.1 schema is always served live at `/doc`.

## Quick start

```bash
# Minimum: set a password (server refuses to start without one)
OPENCODE_SERVER_PASSWORD='change-me' opencode serve

# Optional: pick port/host, enable CORS for a browser client
OPENCODE_SERVER_PASSWORD='change-me' \
  opencode serve --port 4096 --hostname 127.0.0.1 --cors http://localhost:5173
```

- **Default port:** `4096`, default hostname `127.0.0.1`
- **Auth:** HTTP Basic. Username defaults to `opencode`, override with `OPENCODE_SERVER_USERNAME`
- **OpenAPI explorer:** `http://127.0.0.1:4096/doc` (live OpenAPI 3.1 catalog — single source of truth for endpoint shapes)
- **Health probe:** `GET /global/health` (returns `{ status, version }`)

## When to use `serve` vs `run` vs TUI

| Scenario | Pick | Why |
|---|---|---|
| Long-running session, multiple clients, async work | `opencode serve` | HTTP, SSE, abort, status polling |
| One-shot CI step that completes within timeout | `opencode run --json` | Simpler; no daemon to manage |
| Interactive coding | TUI (`opencode`) | Full UX |
| Embedded into Zed/VS Code | ACP (`opencode serve --acp`) | Editor-native protocol — different surface from HTTP serve |
| Web app submits prompt, returns immediately, shows progress | `opencode serve` + `prompt_async` + SSE | Avoids HTTP timeout on the web tier |

## Endpoint reference

Pulled from the live OpenAPI catalog at `/doc`. Verified 2026-05-16.

### Health & global

| Method | Path | Notes |
|---|---|---|
| GET | `/global/health` | Server status + version. Use as liveness probe. |
| GET | `/global/event` | SSE stream of **all** server events (global scope). |

### Projects

| Method | Path | Notes |
|---|---|---|
| GET | `/project` | List projects known to this server. |
| GET | `/project/current` | Current project (resolved from `cwd` the daemon started in). |

### Sessions

| Method | Path | Notes |
|---|---|---|
| GET | `/session` | List sessions. |
| POST | `/session` | Create a session. Returns `{ id, ... }`. |
| GET | `/session/status` | Status of **all** sessions (idle, working, etc.) — cheap to poll. |
| DELETE | `/session/:id` | Delete a session. |
| POST | `/session/:id/abort` | Terminate a running session (graceful). |
| POST | `/session/:id/share` | Enable a public share link. |
| DELETE | `/session/:id/share` | Disable sharing. |

### Messaging

| Method | Path | Notes |
|---|---|---|
| POST | `/session/:id/message` | **Synchronous** prompt — blocks until the model finishes. Use only for short prompts. |
| POST | `/session/:id/prompt_async` | **Async** prompt — returns `204` immediately. Caller polls or listens to SSE. |
| GET | `/session/:id/message` | List messages of a session. |
| POST | `/session/:id/command` | Execute a slash command (`/compact`, `/init`, custom commands). |
| POST | `/session/:id/shell` | Run a shell command in the session's sandbox. |

### Config & providers

| Method | Path | Notes |
|---|---|---|
| GET | `/config` | Effective config (merged user + project). |
| PATCH | `/config` | Update config at runtime. |
| GET | `/config/providers` | Configured providers + their models. |
| GET | `/provider` | All providers. |
| GET | `/provider/auth` | Auth methods per provider. |
| POST | `/provider/{id}/oauth/authorize` | Begin OAuth flow. |
| POST | `/provider/{id}/oauth/callback` | OAuth redirect handler. |

### Files

| Method | Path | Notes |
|---|---|---|
| GET | `/find?pattern=<pat>` | Text search across the workspace. |
| GET | `/find/file?query=<q>` | Fuzzy filename search. |
| GET | `/find/symbol?query=<q>` | Workspace symbol search (LSP-backed). |
| GET | `/file?path=<p>` | Directory listing. |
| GET | `/file/content?path=<p>` | Read a file. |
| GET | `/file/status` | Tracked file changes. |

### Commands, agents, MCP

| Method | Path | Notes |
|---|---|---|
| GET | `/command` | List built-in + custom slash commands. |
| GET | `/agent` | List available agents (`build`, `plan`, custom). |
| GET | `/mcp` | MCP server statuses. |
| GET | `/lsp` | LSP server statuses. |
| GET | `/formatter` | Formatter status. |
| POST | `/log` | Caller writes a log entry into the daemon log. |

### TUI control (advanced)

`/tui/append-prompt`, `/tui/submit-prompt`, `/tui/open-sessions`, `/tui/show-toast`, etc. — used when an external client drives a live TUI instance. Skip unless you're embedding.

## Three usage patterns

### Pattern 1 — Fire-and-forget (recommended for web backends)

Caller submits prompt, returns to user immediately, polls or listens for completion.

```bash
# 1. Create session
SID=$(curl -s -u opencode:$PW -X POST http://127.0.0.1:4096/session | jq -r .id)

# 2. Submit async (returns 204 immediately, no timeout pressure on caller)
curl -u opencode:$PW -X POST http://127.0.0.1:4096/session/$SID/prompt_async \
  -H 'content-type: application/json' \
  -d '{"text":"Refactor the auth module to JWT"}'

# 3. Poll status until idle
while [ "$(curl -s -u opencode:$PW http://127.0.0.1:4096/session/status \
  | jq -r ".[\"$SID\"].state")" != "idle" ]; do sleep 2; done

# 4. Fetch final messages
curl -s -u opencode:$PW http://127.0.0.1:4096/session/$SID/message | jq .
```

### Pattern 2 — Streaming via SSE

Open one persistent SSE stream; submit prompts asynchronously; render tokens live.

```ts
// Node 24 + TypeScript
import { EventSource } from 'eventsource'; // node:undici has it native in 24

const PW = process.env.OPENCODE_SERVER_PASSWORD!;
const auth = 'Basic ' + Buffer.from(`opencode:${PW}`).toString('base64');

const es = new EventSource('http://127.0.0.1:4096/event', {
  fetch: (url, init) =>
    fetch(url, { ...init, headers: { ...init?.headers, authorization: auth } }),
});

es.onmessage = (ev) => {
  const event = JSON.parse(ev.data);
  if (event.type === 'message.part.delta') process.stdout.write(event.content);
  if (event.type === 'session.idle') console.log('\n[done]');
};

// Submit a prompt while the stream is open
await fetch(`http://127.0.0.1:4096/session/${sid}/prompt_async`, {
  method: 'POST',
  headers: { authorization: auth, 'content-type': 'application/json' },
  body: JSON.stringify({ text: 'Summarize README.md' }),
});
```

### Pattern 3 — Sync proxy (only for short prompts)

```bash
# Blocks for the entire model run. Subject to caller-side HTTP timeouts.
curl -u opencode:$PW -X POST http://127.0.0.1:4096/session/$SID/message \
  -H 'content-type: application/json' \
  -d '{"text":"What does package.json export?"}'
```

Use this only when the prompt is bounded (<30s) and the caller's HTTP client tolerates the wait. For anything longer, switch to Pattern 1 or 2.

## Production patterns

### systemd unit

```ini
# /etc/systemd/system/opencode-serve.service
[Unit]
Description=OpenCode HTTP server
After=network-online.target

[Service]
Type=simple
User=opencode
WorkingDirectory=/srv/opencode
EnvironmentFile=/etc/opencode/serve.env   # OPENCODE_SERVER_PASSWORD=..., provider keys
ExecStart=/usr/local/bin/opencode serve --hostname 127.0.0.1 --port 4096
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Reload + start: `sudo systemctl daemon-reload && sudo systemctl enable --now opencode-serve`.

### Angie / nginx reverse proxy

Terminate HTTPS, keep SSE alive, forward Basic auth.

```nginx
location /opencode/ {
  proxy_pass http://127.0.0.1:4096/;
  proxy_http_version 1.1;
  proxy_set_header Connection '';
  proxy_buffering off;          # critical for SSE
  proxy_read_timeout 1h;        # SSE keepalive
  proxy_send_timeout 1h;
}
```

Without `proxy_buffering off` SSE chunks pile up server-side and clients see nothing for minutes.

### Avoiding HTTP timeouts in the caller

The whole point: caller's HTTP client (axios, fetch, browser) typically has a 30–60s default timeout. With sync POST `/session/:id/message` a 5-minute model run = timeout error even though the daemon is healthy. Solution:

1. POST `/session/:id/prompt_async` — caller gets `204` in <100ms.
2. Background worker / browser tab polls `GET /session/status` every 2–5s OR subscribes to `/event` SSE.
3. When the session transitions to `idle`, fetch the final message list.

### Aborting

User cancels in the UI → `POST /session/:id/abort`. Daemon stops the run gracefully (no `SIGKILL`).

### Liveness

`GET /global/health` — cheap, no auth needed for the health field in some builds (check yours via `/doc`). Hook into Kubernetes/PM2 health checks.

## Node.js client wrapper (paste-runnable)

```ts
// opencode-client.ts — minimal wrapper around opencode serve
// Node 24+, no extra deps.

type Options = { baseUrl?: string; user?: string; password: string };

export class OpencodeClient {
  private auth: string;
  constructor(private opts: Options) {
    const u = opts.user ?? 'opencode';
    this.auth = 'Basic ' + Buffer.from(`${u}:${opts.password}`).toString('base64');
    this.opts.baseUrl ??= 'http://127.0.0.1:4096';
  }

  private async req(path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(this.opts.baseUrl + path, {
      ...init,
      headers: {
        authorization: this.auth,
        'content-type': 'application/json',
        ...init.headers,
      },
    });
  }

  async health() {
    return (await this.req('/global/health')).json();
  }

  async createSession(): Promise<{ id: string }> {
    return (await this.req('/session', { method: 'POST' })).json();
  }

  async submitPrompt(sessionId: string, text: string): Promise<void> {
    const r = await this.req(`/session/${sessionId}/prompt_async`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    if (r.status !== 204) throw new Error(`prompt_async: ${r.status}`);
  }

  async pollStatus(sessionId: string): Promise<string> {
    const all = await (await this.req('/session/status')).json();
    return all[sessionId]?.state ?? 'unknown';
  }

  async waitIdle(sessionId: string, pollMs = 2000, timeoutMs = 600_000): Promise<void> {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if ((await this.pollStatus(sessionId)) === 'idle') return;
      await new Promise((r) => setTimeout(r, pollMs));
    }
    throw new Error('timeout waiting for idle');
  }

  async getMessages(sessionId: string): Promise<unknown[]> {
    return (await this.req(`/session/${sessionId}/message`)).json();
  }

  async abort(sessionId: string): Promise<void> {
    await this.req(`/session/${sessionId}/abort`, { method: 'POST' });
  }

  // SSE — pass an AbortSignal to cancel
  async *listenEvents(signal?: AbortSignal): AsyncGenerator<unknown> {
    const r = await fetch(this.opts.baseUrl + '/event', {
      headers: { authorization: this.auth },
      signal,
    });
    if (!r.body) return;
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      for (const chunk of buf.split('\n\n')) {
        const m = chunk.match(/^data: (.+)$/m);
        if (m) yield JSON.parse(m[1]);
      }
      buf = buf.endsWith('\n\n') ? '' : buf.split('\n\n').pop() ?? '';
    }
  }
}

// Usage
const cli = new OpencodeClient({ password: process.env.OPENCODE_SERVER_PASSWORD! });
const { id } = await cli.createSession();
await cli.submitPrompt(id, 'Summarize README.md');
await cli.waitIdle(id);
console.log(await cli.getMessages(id));
```

> The official `@opencode-ai/sdk` package (`createOpencodeClient({ baseUrl, fetch })`) covers the same surface with generated types from the OpenAPI spec. Prefer it for production; the wrapper above is for reference and pinning.

## Wrong-vs-right

### 1. Don't hold a TCP connection for 10 minutes

```ts
// ❌ Caller blocks for the full run — vulnerable to upstream/CDN/proxy timeouts.
const r = await fetch(`${base}/session/${sid}/message`, {
  method: 'POST', body: JSON.stringify({ text: longPrompt }),
});

// ✅ Fire-and-forget, poll or stream.
await fetch(`${base}/session/${sid}/prompt_async`, {
  method: 'POST', body: JSON.stringify({ text: longPrompt }),
});
// then SSE or pollStatus()
```

### 2. Always wire up abort

```ts
// ❌ User clicks Cancel; server keeps burning tokens.
controller.abort();

// ✅ Tell the daemon too.
controller.abort();
await fetch(`${base}/session/${sid}/abort`, { method: 'POST', headers: { authorization } });
```

### 3. Don't hard-code URL / password

```ts
// ❌
const PW = 'hunter2';
const URL = 'http://localhost:4096';

// ✅
const PW = process.env.OPENCODE_SERVER_PASSWORD;
const URL = process.env.OPENCODE_SERVER_URL ?? 'http://127.0.0.1:4096';
if (!PW) throw new Error('OPENCODE_SERVER_PASSWORD required');
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `401 Unauthorized` | Wrong password / no `Authorization` header | Check `OPENCODE_SERVER_PASSWORD`; default user is `opencode` |
| Server refuses to start | `OPENCODE_SERVER_PASSWORD` not set | Set the env var; serve refuses unauthenticated startup by design |
| SSE stream cuts after ~30s | Reverse proxy buffering / read timeout | Set `proxy_buffering off`, `proxy_read_timeout 1h` (Angie/nginx) |
| `/session/status` shows stale `working` | Daemon crashed mid-run | Check `/global/health`; restart via systemd; client should also subscribe to `/event` for `session.error` |
| Provider OAuth doesn't finish | Callback URL mismatch | The flow is `POST /provider/{id}/oauth/authorize` → user visits URL → `POST /provider/{id}/oauth/callback`. Walk through `/doc` for exact body shape. |
| CORS preflight blocked | Browser client not in CORS allowlist | Pass `--cors https://app.example.com` (repeatable) when starting `serve` |
| Port conflict | 4096 in use | `--port 4097` or `lsof -i :4096` to find the offender |

## See also

- `claude-code/references/external-orchestration.md` — Claude Code has no built-in HTTP daemon; uses `claude agents` background sessions or subprocess streaming
- `codex/references/interop.md` — Codex `app-server` is JSON-RPC over stdio/WebSocket (different shape)
- `linux-sysadmin` — Angie/nginx reverse proxy + systemd patterns
- `bullmq` — queue long prompts to a worker pool that drives `opencode serve`
