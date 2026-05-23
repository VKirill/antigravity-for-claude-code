<div align="center">

<img src="https://github.com/VKirill/codex-starter-kit/raw/main/assets/avatar-round.png" width="120" alt="Kirill Vechkasov" />

# Antigravity for Claude Code

**Connect Google's Antigravity (Gemini coding agent) to Anthropic's Claude Code. Use it as a local pair programmer, multi-role debater, and code reviewer via the Model Context Protocol (MCP).**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-≥20-43853d.svg)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-7c3aed.svg)](https://modelcontextprotocol.io)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-compatible-d97757.svg)](https://docs.claude.com/en/docs/claude-code)

[💬 Telegram: @pomogay_marketing](https://t.me/pomogay_marketing) · [Русская версия (Russian)](./README.ru.md) · [GitHub](https://github.com/VKirill/antigravity-for-claude-code)

</div>

---

## What is this?

This MCP server links **Claude Code** (through a custom `dev-orchestrator-test`) to the **Antigravity CLI** (`agy`). 

Instead of spawning standard subagents for heavy programming tasks, Claude Code delegates them to `agy` (running Gemini 3.5 Flash/Pro). The agent loads your local skills (like `coder-craft` and `orchestrator-workflow`), modifies code, runs tests, and outputs results.

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

## MCP Tools

The server registers four main tools:

### 1. `discuss_with_antigravity`
Passes task descriptions (YAML contracts) to Antigravity (`agy`). The agent creates a local git worktree, writes code, runs test suites, and returns a structured YAML result.

### 2. `run_debate_deliberation`
Simulates a multi-role expert panel to discuss architectural or business decisions. The debate goes through key viewpoints:
* **Optimist**: Proposes bold approaches, shows benefits.
* **Skeptic**: Highlights risks, questions assumptions.
* **Agreer**: Finds compromise, suggests fast shortcuts.
* **Hater**: Looks for critical points of failure, challenges feasibility.
* **Synthesizer**: Combines all arguments into a final decision record (ADR).

### 3. `review_code_changes`
Analyzes git diffs or code snippets for security flaws, resource leaks, and style. Groups findings into:
* **P0/P1 (Critical)**: Security bugs, memory leaks, invalid logic.
* **P2 (Standard)**: Clean-code violations, DRY/SOLID refactoring.

### 4. `get_programming_advice`
Quick developer helper. Answers technical questions or suggests tech stacks without keeping dialog history.

---

## Setup

### 1. Build the server
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

---

## Author

* **Kirill Vechkasov**
* Email: [vechkasov@gmail.com](mailto:vechkasov@gmail.com)
* Telegram: [@pomogay_marketing](https://t.me/pomogay_marketing)
* GitHub: [@VKirill](https://github.com/VKirill)

---

## License

MIT License. See [LICENSE](LICENSE) for details.
