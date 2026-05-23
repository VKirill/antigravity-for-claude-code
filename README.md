<div align="center">

<img src="https://github.com/VKirill/codex-starter-kit/raw/main/assets/avatar-round.png" width="120" alt="Kirill Vechkasov" />

# Antigravity for Claude Code

**Connect Google's Antigravity (Gemini coding agent) to Anthropic's Claude Code. Use it as a local pair programmer, multi-role debater, and code reviewer via the Model Context Protocol (MCP). Includes 17 preloaded developer skills and a custom Orchestrator agent.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-≥20-43853d.svg)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-7c3aed.svg)](https://modelcontextprotocol.io)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-compatible-d97757.svg)](https://docs.claude.com/en/docs/claude-code)

[💬 Telegram: @pomogay_marketing](https://t.me/pomogay_marketing) · [Русская версия (Russian)](./README.ru.md) · [GitHub](https://github.com/VKirill/antigravity-for-claude-code)

</div>

---

## What is this?

This MCP server links **Claude Code** (through a custom `dev-orchestrator-test`) to the **Antigravity CLI** (`agy`) on top of Google Gemini.

Instead of spawning standard subagents for heavy programming tasks, Claude Code delegates them to `agy` (running Gemini 3.5 Flash/Pro). The agent loads local developer skills (like `coder-craft` and `orchestrator-workflow`), modifies code, runs tests, and outputs results.

You also get tools for **multi-role AI debates** (deliberations), automated **code reviews**, and fast **programming advice** to speed up development.

---

## How it works

```
┌──────────────────────────────────────────────────────────┐
│                      Claude Code                         │
│               (dev-orchestrator-test)                    │
└──────────────────────────┬───────────────────────────────┘
                           │
             MCP Call: discuss_with_antigravity
                           │
┌──────────────────────────▼───────────────────────────────┐
│                 Antigravity MCP Server                  │
└──────────────────────────┬───────────────────────────────┘
                           │
                     Executes shell
                           │
┌──────────────────────────▼───────────────────────────────┐
│                 Antigravity CLI (agy)                    │
│      (Loads Skills, modifies files, runs local tests)    │
└──────────────────────────────────────────────────────────┘
```

---

## Repository Structure

* `dist/` — Compiled MCP server files.
* `examples/` — Code client examples on TypeScript, Python, Go, and Bash.
* `agents/` — Configuration for the custom `dev-orchestrator-test.md` agent.
* `skills/` — 17 preloaded developer skills containing rules and instructions for Gemini.

---

## Included Skills (`/skills`)

These files guide Gemini to act as a professional coder, architect, or designer:
* **Core Skills**: `coder-craft` (clean code, surgical edits, no extra refactoring), `karpathy-guidelines` (think before coding, simplicity first).
* **Workflow**: `orchestrator-workflow` (YAML contract parsing, DB structure, autonomous recovery), `claude-code` (standard integration patterns).
* **Frontend Stacks**: `frontend-craft`, `css-architecture-2026`, `design-system-2026`, `ux-craft-2026`, `web-animation-router`, `webgl-creative-2026`, `svg-canvas-craft`, `motion-spec-handoff`, `web-qa-2026`.
* **Testing & Text**: `pytest`, `vitest`, `ru-text-quick` (strict editorial guidelines, no AI clichés).

---

## MCP Tools Provided

The server exposes the following tools:
* `discuss_with_antigravity` — Engage in a multi-turn deliberative debate or discussion session with Antigravity.
* `reset_antigravity_session` — Clear active discussion session history in memory.
* `run_debate_deliberation` — Runs a multi-turn autonomous debate between specialized AI personas (Optimist, Skeptic, Devil's Advocate) ending with an ADR.
* `run_interactive_debate` — Runs an interactive multi-turn debate session where you act as a Judge/Architect, guiding AI personas (Optimist, Skeptic, Agreer, Hater) with comments, culminating in a structured ADR.
* `review_code_changes` — Conducts a code review of a git diff or snippet on Russian language (bugs, security, clean code).
* `get_programming_advice` — Fast, focused architectural or coding advice for a specific problem.

---

## Installation & Setup

### 1. Build the server
Clone the repo, install dependencies, and compile:
```bash
cd ~/tools/antigravity-for-claude-code
npm install
npm run build
```

### 2. Add to Claude Code config
Add this block to your `~/.claude.json` file:
```json
{
  "mcpServers": {
    "antigravity": {
      "command": "node",
      "args": ["/home/ubuntu/tools/antigravity-for-claude-code/dist/index.js"]
    }
  }
}
```

### 3. Setup the Orchestrator Agent
Copy the custom agent from the repository to your Claude Code configuration directory:
```bash
mkdir -p ~/.claude/agents
cp agents/dev-orchestrator-test.md ~/.claude/agents/
```
You can now run the orchestrator with:
```bash
claude --agent dev-orchestrator-test
```
This agent is configured to dispatch 100% of tasks (including coder workers, UI/accessibility checkers, payments/security auditors, and diagnostics) to the Antigravity MCP server with tailored roles and 2026 best practices prompts.

### 4. Setup the Developer Skills
For Antigravity (`agy`) to use the included skills, copy them to your global Antigravity skills directory:
```bash
mkdir -p ~/.gemini/antigravity/skills
cp -r skills/* ~/.gemini/antigravity/skills/
```

---

## Author

* **Kirill Vechkasov**
* Email: [vechkasov@gmail.com](mailto:vechkasov@gmail.com)
* Telegram: [@pomogay_marketing](https://t.me/pomogay_marketing)
* GitHub: [@VKirill](https://github.com/VKirill)

---

## License

MIT License. See [LICENSE](LICENSE) for details.
