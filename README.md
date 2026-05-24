<div align="center">

<img src="https://github.com/VKirill/codex-starter-kit/raw/main/assets/avatar-round.png" width="120" alt="Kirill Vechkasov" />

# Antigravity for Claude Code

**Turn Google's Antigravity (the Gemini coding agent) into a worker for Anthropic's Claude Code. A Model Context Protocol (MCP) server that lets Claude Code delegate real coding, multi-role debates, and code reviews to the `agy` CLI — orchestrated through a project-manager agent that plans, dispatches, verifies, and ships. Ships with 16 developer skills and main-only autopilot orchestrator agents.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-≥20-43853d.svg)](https://nodejs.org)
[![Bun](https://img.shields.io/badge/Bun-build%20%26%20test-fbf0df.svg)](https://bun.sh)
[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-7c3aed.svg)](https://modelcontextprotocol.io)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-compatible-d97757.svg)](https://docs.claude.com/en/docs/claude-code)

[💬 Telegram: @pomogay_marketing](https://t.me/pomogay_marketing) · [Русская версия (Russian)](./README.ru.md) · [GitHub](https://github.com/VKirill/antigravity-for-claude-code)

</div>

---

## What is this?

This MCP server links **Claude Code** to the **Antigravity CLI** (`agy`, running on Google Gemini) so the two coding agents work as a team.

Instead of Claude Code doing every heavy edit itself (or spawning its own slow subagents), it runs as a **project manager**: it scores the task, writes the plan, and **delegates the actual coding to `agy`** through a single MCP call. Antigravity loads local developer skills (like `coder-craft` and `orchestrator-workflow`), edits the files, runs the tests, and reports back. Claude Code then verifies the result, reviews it, and ships it.

On top of delegation you also get tools for **multi-role AI debates** (structured deliberations that end in an ADR), automated **code reviews** in Russian, and fast **programming advice**.

### What you get

- 🧑‍💼 **Orchestrator agents** — Claude Code acts as a PM that plans → dispatches → verifies → ships, never writing production code itself.
- 🤝 **Real delegation** — heavy coding goes to Gemini via `agy`, with the result fed back through MCP.
- 🧠 **16 developer skills** — clean-code rules, frontend stacks, testing and editorial guidelines that steer Gemini.
- 🗣️ **AI debates & reviews** — autonomous or interactive multi-persona deliberations, code review, and quick advice.
- 🛡️ **Quality hooks** — block `@ts-ignore` / hardcoded HEX colors before they reach disk.
- 🚀 **Main-only autopilot** — the `dev-orchestrator-agy` agent works directly on `main`, commits per task, and auto-deploys when all gates pass.
- ⏱️ **Reliable bridge** — robust subprocess lifecycle (no hangs), per-call timing, and a `files_changed` footer on every response.

---

## How it works

```
┌──────────────────────────────────────────────────────────┐
│                      Claude Code                          │
│         (dev-orchestrator-agy — the PM agent)            │
│   scores → plans → dispatches → verifies → reviews → ships│
└──────────────────────────┬───────────────────────────────┘
                           │  MCP: discuss_with_antigravity
                           │  (YAML contract + role)
┌──────────────────────────▼───────────────────────────────┐
│                  Antigravity MCP Server                   │
│   spawns agy (detached, timeout-guarded), parses result   │
└──────────────────────────┬───────────────────────────────┘
                           │  agy --print  (prompt via stdin)
┌──────────────────────────▼───────────────────────────────┐
│                   Antigravity CLI (agy)                   │
│   loads skills → edits files → runs local tests → replies │
└──────────────────────────────────────────────────────────┘
```

### How the orchestrator thinks

The `dev-orchestrator-agy` agent runs a 7-phase cycle, gated by a complexity score:

1. **Phase 0 — Score.** A heuristic (0–11+) decides the path: Express (single dispatch), Brief, Full (SPEC + N contracts), or Split (too big).
2. **Phase 1–2 — Understand & plan.** Minimal questions, then a SPEC and a set of YAML task contracts persisted to a local SQLite DB (`.claude/orchestrator.db`).
3. **Phase 3 — Confirm.** Work happens **directly on `main`** — no worktrees, no feature branches.
4. **Phase 4 — Dispatch + recover.** Each ready contract is sent to `agy` via MCP; failures trigger an autonomous recovery chain.
5. **Phase 5–6 — Review & iterate.** Test/security/payments/UI verifiers run per task; findings are fixed and re-verified.
6. **Phase 7 — Ship.** A final review gate, then commit + `git push origin main` (fast-forward only — force-push to main is always forbidden) and auto-deploy.

The user observes progress from any terminal with `task list`, `task show <id>`, `task logs <id>`, and `task graph`.

---

## Repository Structure

* `src/` — MCP server source (TypeScript, run/built with Bun).
* `dist/` — Compiled MCP server (Node target).
* `agents/` — Orchestrator agents: `dev-orchestrator-agy.md` (main-only autopilot) and `dev-orchestrator.md`.
* `skills/` — 16 developer skills with rules and instructions for Gemini.
* `examples/` — Client examples in TypeScript, Python, Go, and Bash.
* `scripts/` — Hook validator (`validate-tool-call.cjs`) and helpers.
* `CLAUDE.global.md` — Example global working-agreements config to copy into `~/.claude/CLAUDE.md`.
* `install-hooks.cjs` / `run-server.sh` — Hook installer and isolated-home launcher.

---

## Included Skills (`/skills`)

These guide Gemini to act as a professional coder, architect, or designer:

* **Core**: `coder-craft` (clean code, surgical edits, no extra refactoring), `karpathy-guidelines` (think before coding, simplicity first).
* **Workflow**: `orchestrator-workflow` (YAML contract parsing, DB structure, autonomous recovery), `claude-code` (integration patterns).
* **Frontend**: `frontend-craft`, `css-architecture-2026`, `design-system-2026`, `ux-craft-2026`, `web-animation-router`, `webgl-creative-2026`, `svg-canvas-craft`, `web-qa-2026`, `media-asset-pipeline`.
* **Testing & text**: `pytest`, `vitest`, `ru-text-quick` (strict editorial guidelines, no AI clichés).

---

## MCP Tools Provided

| Tool | What it does |
|---|---|
| `discuss_with_antigravity` | Multi-turn discussion / task delegation. Auto-detects a task ID (e.g. `id: TASK-NNN`) from the prompt to keep a task-scoped conversation. Accepts a `role` (`designer`, `copywriter`, `programmer`, `architect`). |
| `reset_antigravity_session` | Clear the active discussion session from memory. |
| `run_debate_deliberation` | Autonomous multi-persona debate (Optimist, Skeptic, Devil's Advocate…) ending in an ADR. |
| `run_interactive_debate` | Interactive debate where you act as Judge/Architect and steer the personas, culminating in a structured ADR. |
| `review_code_changes` | Code review of a git diff or snippet, in Russian (bugs, security, clean code). |
| `get_programming_advice` | Fast, focused architectural or coding advice. |
| `get_debate_receipt` | A structured Markdown "debate receipt": role claims, evidence, rejected alternatives, touched files, and hook-audit data for a session. |

Every `discuss`/`programming` response also carries a small footer with the call duration and the list of `files_changed` (computed from git), so you always know what the worker actually touched.

---

## Prerequisites

- **[Claude Code](https://docs.claude.com/en/docs/claude-code)** — the host.
- **[Antigravity CLI](https://antigravity.google)** (`agy`) — installed and **authenticated** (run it once interactively to log in). The MCP server invokes `agy --print`.
- **[Bun](https://bun.sh)** ≥ 1.0 — used to build and test the server.
- **Node.js** ≥ 20 — used to run the compiled `dist/index.js`.

---

## Installation & Setup

### 1. Build the server
```bash
git clone https://github.com/VKirill/antigravity-for-claude-code.git
cd antigravity-for-claude-code
bun install        # or: npm install
bun run build      # compiles src/ -> dist/ (Node target)
```

### 2. Register the server in Claude Code
Add it to your `~/.claude.json` (use the **absolute path** to your clone):
```json
{
  "mcpServers": {
    "antigravity": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/to/antigravity-for-claude-code/dist/index.js"],
      "timeout": 1260000
    }
  }
}
```
> Prefer running from source with an isolated config? Use `run-server.sh` (it points the spawned `agy` at a dedicated `$HOME` and runs the server via Bun).

### 3. Install the orchestrator agent
```bash
mkdir -p ~/.claude/agents
cp agents/dev-orchestrator-agy.md ~/.claude/agents/
```
Run it inside any project directory:
```bash
claude --agent dev-orchestrator-agy
```
This agent dispatches 100% of coding/verification work to the Antigravity MCP server with tailored roles and 2026 best-practice prompts. It works directly on `main` and auto-deploys when all gates pass.

### 4. (Optional) Adopt the global working agreements
```bash
cp CLAUDE.global.md ~/.claude/CLAUDE.md
```
This sets sensible defaults for every project and documents the auto-push-to-`main` policy that the orchestrator relies on. **Edit the "Server environment" and "Context" sections to match your own setup.**

### 5. Install the developer skills
```bash
mkdir -p ~/.gemini/antigravity/skills
cp -r skills/* ~/.gemini/antigravity/skills/
```

### 6. Install the quality hooks (recommended)
```bash
bun run install-hooks   # or: npm run install-hooks
```
Makes the validator executable and registers it in `~/.gemini/antigravity-cli/hooks.json` with the correct absolute path. It blocks `@ts-ignore` / `@ts-nocheck` and hardcoded HEX colors in Vue/CSS files.

---

## Configuration (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `AGY_TIMEOUT_MS` | `1200000` | Hard timeout (ms) for an `agy` call. On timeout the whole process group is killed and the call fails non-retryably (so half-done edits aren't re-run). The server also passes `--print-timeout` to `agy` derived from this (`value/1000 − 20s`). |
| `AGY_EXIT_FALLBACK_MS` | `1500` | Grace window (ms) after the process exits before the bridge force-resolves with the buffered output — this is what prevents hangs when `agy`'s engine keeps a pipe open. |

> **Timeout layering.** Three limits stack and must stay ordered
> `agy --print-timeout  <  AGY_TIMEOUT_MS  <  Claude Code's MCP tool timeout`.
> The outermost (how long Claude Code waits for a tool result) is **not** set by this server. Claude Code's
> global default is `MCP_TOOL_TIMEOUT` = **600000 ms (10 min)**, which is *below* the `AGY_TIMEOUT_MS`
> default above — so raise it. Preferred: set a **per-server** `timeout` (ms) in the `mcpServers` entry
> (see install step 2 — it scopes only the antigravity server and covers tool-call waits). Set it
> slightly above `AGY_TIMEOUT_MS` (e.g. `1260000`) so the server's own clean timeout + process-group kill
> fires first. The global `MCP_TOOL_TIMEOUT` env var works too but affects every MCP server.

---

## Author

* **Kirill Vechkasov**
* Email: [vechkasov@gmail.com](mailto:vechkasov@gmail.com)
* Telegram: [@pomogay_marketing](https://t.me/pomogay_marketing)
* GitHub: [@VKirill](https://github.com/VKirill)

---

## License

MIT License. See [LICENSE](LICENSE) for details.
