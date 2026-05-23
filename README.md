<div align="center">

<img src="https://github.com/VKirill/codex-starter-kit/raw/main/assets/avatar-round.png" width="120" alt="Kirill Vechkasov" />

# Antigravity for Claude Code

**An advanced Model Context Protocol (MCP) server that integrates Google's Antigravity (Gemini-based coding agent) as a dedicated co-developer, multi-role debater, and code reviewer directly into Claude Code.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-≥20-43853d.svg)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-7c3aed.svg)](https://modelcontextprotocol.io)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-compatible-d97757.svg)](https://docs.claude.com/en/docs/claude-code)

[💬 Telegram: @pomogay_marketing](https://t.me/pomogay_marketing) · [Русская версия (Russian)](./README.ru.md) · [GitHub](https://github.com/VKirill/antigravity-for-claude-code)

</div>

---

## Overview

**Antigravity for Claude Code** is an MCP server designed to act as an integration bridge between Anthropic's **Claude Code** (via a custom `dev-orchestrator-test`) and Google's **Antigravity CLI** (`agy`). 

Instead of spawning standard subagents for heavy programming tasks, this bridge lets Claude Code delegate tasks to `agy` (running Gemini 3.5 Flash/Pro), which processes them using professional coding skills such as `coder-craft` and `orchestrator-workflow`. 

Additionally, it equips Claude Code with **multi-agent debate simulations** (deliberations) and **autonomous code reviews/programming advice** to make pair programming with AI truly elite.

---

## How It Works (Architecture)

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
│                     (this project)                       │
└──────────────────────────┬───────────────────────────────┘
                           │
                  Spawn Shell Command
                           │
┌──────────────────────────▼───────────────────────────────┐
│                 Antigravity CLI (agy)                    │
│      (Loads Skills, modifies files, runs local tests)    │
└──────────────────────────────────────────────────────────┘
```

---

## Exposed MCP Tools

The server exposes the following tools to any MCP-compatible agent:

### 1. `discuss_with_antigravity`
A core integration tool. Passes task descriptions (YAML contracts) to Antigravity (`agy`), which applies code changes in a project-local git worktree, runs test suites, and returns results in structured YAML format.

### 2. `run_debate_deliberation`
Simulates a multi-role panel discussion (deliberation) about complex technical or business decisions. The debate goes through several rounds:
* **Optimist** (proposes bold ideas, highlights benefits)
* **Skeptic** (questions assumptions, lists risks)
* **Agreer** (finds middle ground, adds constructive details)
* **Hater** (criticizes aggressively, highlights breaking changes)
* **Synthesizer** (combines all arguments into a final consensus plan)

### 3. `review_code_changes`
Analyzes git diffs or code snippets for bugs, security issues, performance bottlenecks, and clean-code violations. Returns categorized recommendations:
* **P0/P1 (Critical)**: Security flaws, leaks, logical bugs.
* **P2 (Medium/Low)**: Style improvements, refactoring, DRY/SOLID.

### 4. `get_programming_advice`
Provides architectural decisions, tech-stack suggestions, or code implementation guides. Works as a fast, non-continuous developer assistant.

---

## Installation & Setup

### 1. Build the MCP Server
```bash
cd ~/tools/antigravity-for-claude-code
npm install
npm run build
```

### 2. Configure Claude Code
Add the server to your `~/.claude.json` configuration file:
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

---

## Author

* **Kirill Vechkasov**
* Email: [vechkasov@gmail.com](mailto:vechkasov@gmail.com)
* Telegram: [@pomogay_marketing](https://t.me/pomogay_marketing)
* GitHub: [@VKirill](https://github.com/VKirill)

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
