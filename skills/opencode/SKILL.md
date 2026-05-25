---
name: opencode
description: "OpenCode CLI — open-source multi-provider terminal coding agent (sst/opencode, Anomaly fork) with BYOK for Claude/GPT/Gemini/Ollama, opencode.json, AGENTS.md, plan/build agents, MCP, ACP. Use when: opencode, sst/opencode, anomaly opencode, opencode.json, AGENTS.md, /agent build, /agent plan, opencode run, opencode auth login, opencode mcp, BYOK, 75+ providers, ACP protocol, opencode-ai npm SDK, custom agents markdown. SKIP: Claude Code (→claude-code), OpenAI Codex CLI (→codex), Cloudflare-hosted OpenCode server, general agent design (→agent-evaluation), authoring SKILL.md (→skill-evaluation)."
stacks:
  - opencode
  - cli-agents
tags:
  - opencode
  - cli
  - agent
  - multi-provider
  - byok
  - mcp
  - acp
  - bun
  - go
packages:
  - opencode-ai
manifests:
  - opencode.json
  - opencode.jsonc
  - AGENTS.md
source: vechkasov-global-skills
risk: medium-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- OpenCode CLI: `1.15.x (`opencode-ai` npm, Anomaly fork at github.com/anomalyco/opencode)`
- Node.js: `24.x (Active LTS)`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded automatically when the description matches the active task. Read only the section needed.

## Use this skill when

- Installing or updating the `opencode` CLI (`curl ... | bash`, `brew install`, `npm i -g opencode-ai`)
- Authoring `opencode.json` / `opencode.jsonc` (project) or `~/.config/opencode/opencode.json` (user)
- Writing or editing `AGENTS.md` for project memory (same file used by OpenAI Codex)
- Configuring providers in `opencode.json: provider.*` for BYOK (Claude, OpenAI, Gemini, Mistral, Groq, Ollama, etc.)
- Defining agents in `opencode.json: agent.*` (build/plan/custom) or `.opencode/agents/<name>.md`
- Setting up MCP servers in `opencode.json: mcp.*` (stdio + http)
- Running headless: `opencode run "..."`, JSON output, CI integration
- Using ACP (Agent Client Protocol) to drive OpenCode from Zed editor / IDE
- Switching themes via `tui.json: theme` (tokyonight, dracula, etc.)
- Migrating between OpenCode, Claude Code, and OpenAI Codex configs
- Picking the right CLI: when multi-provider/BYOK is the requirement

## Do not use this skill when

- Task is Claude Code CLI specifics (settings.json hooks, .claude/skills, /loop) — use `claude-code`
- Task is OpenAI Codex CLI (Rust, config.toml, codex exec) — use `codex`
- Task is hosting the OpenCode server on Cloudflare / SST — focus here is the CLI client
- Task is general LLM agent design (planning, evaluation, benchmarking) — use `agent-evaluation`
- Task is authoring a Claude Code SKILL.md file — use `skill-evaluation`
- User wants the deprecated 2021-era OpenAI Codex completion model — that's been discontinued; modern Codex is `codex` skill

## Purpose

OpenCode (currently maintained by Anomaly at `github.com/anomalyco/opencode`, originally `github.com/sst/opencode`) is the leading **open-source, multi-provider** terminal coding agent. Unlike Claude Code (Anthropic-only) and OpenAI Codex (OpenAI-only), OpenCode is BYOK across 75+ providers including Anthropic, OpenAI, Google, Mistral, Groq, Together, and local models via Ollama. Built with Bun + TypeScript (with a Go TUI), 100K+ stars, Apache-2.0.

This skill covers the **CLI operating surface**: install, auth across providers, `opencode.json` config schema, agents (built-in `build`/`plan` + custom markdown agents), MCP servers, ACP protocol (for editor integration), headless `opencode run`, and the migration path to/from Claude Code and OpenAI Codex.

What this skill does NOT cover: hosting an OpenCode server on Cloudflare/SST (infra, not CLI), general agent benchmarking (`agent-evaluation`), or building custom MCP servers (`mcp-builder`).

## Capabilities

### Installation & auth

Native install script: `curl -fsSL https://opencode.ai/install | bash`. Brew: `brew install sst/tap/opencode`. npm SDK: `npm i -g opencode-ai`. Verify: `opencode --version`. Auth: `opencode auth login` opens a provider picker and stores credentials in `~/.local/share/opencode/auth.json`. Per-provider env vars (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `OLLAMA_BASE_URL`) also work directly.

> Full reference: [references/installation.md](references/installation.md)

### CLI flags

Interactive TUI: `opencode`. One-shot: `opencode run "<prompt>"`. Key flags: `--json` (JSON output), `--agent <build|plan|name>`, `--model <provider/model>`, `--auto` (skip approvals), `-c` (continue), `--cwd <path>`, `--mcp <file>`. Subcommands: `auth`, `mcp`, `upgrade`, `models`, `agents`, `serve` (ACP server mode).

> Full reference: [references/cli-flags.md](references/cli-flags.md)

### Configuration (`opencode.json`)

Single JSON/JSONC file controls everything. Top-level keys: `provider`, `model`, `agent`, `mcp`, `default_agent`, `instructions`, `share`, `keybindings`, `theme`. Layered config: user (`~/.config/opencode/opencode.json`) → project (`opencode.json` at root) → CLI flag. Supports file inclusion (`{file:./custom-instructions.md}`) and env interpolation (`{env:OPENAI_API_KEY}`).

> Full reference: [references/config.md](references/config.md)

### Providers (75+ BYOK)

Configure once in `provider`, pick per-agent in `agent.<name>.model`. Provider format: `<provider>/<model-id>`. Examples: `anthropic/claude-sonnet-4-6`, `openai/gpt-5.5`, `google/gemini-2.5-pro`, `groq/llama-3.3-70b-versatile`, `ollama/codellama:34b`. Failover is provider-specific (e.g., OpenRouter `allow_fallbacks`/`order`, Vercel gateway `order`) — there is no generic top-level `provider.fallback` key. Use `opencode models` to list everything available with current auth.

> Full reference: [references/providers.md](references/providers.md)

### Agents (built-in + custom)

Two built-in **primary agents**: `build` (full tools, default) and `plan` (read-only, drafts a plan). Switch live with `Tab` in TUI or `--agent` flag. Custom agents: define in `opencode.json: agent.<name>` OR as markdown at `~/.config/opencode/agents/<name>.md` / `.opencode/agents/<name>.md`. Frontmatter: `description`, `model`, `tools`, `prompt`. Subagents (non-primary) are called by primary agents via task delegation.

> Full reference: [references/agents.md](references/agents.md)

### Commands (built-in + custom)

Slash commands (verified against opencode.ai/docs, May 2026): `/connect` (configure provider API keys), `/init` (analyze project + generate AGENTS.md), `/undo` (revert last change), `/redo` (re-apply undone change), `/share` (generate shareable conversation link), `/new` (clear session), `/compact`, `/permissions`, `/mcp`, `/models`, `/agent <name>`, `/help`. Tab key toggles **planning mode** (read-only) ↔ **build mode** (implementation) in the TUI. Custom commands: drop markdown in `.opencode/commands/<name>.md`, invoke as `/<name>`. Frontmatter supports `description`, `tools`, `agent` (run via a specific agent).

> Full reference: [references/commands.md](references/commands.md)

### MCP servers

Configure in `opencode.json: mcp`. Same protocol as Claude Code/Codex — server binaries are interchangeable. Transports: `local` (stdio) and `remote` (http/sse). Example:

```json
{ "mcp": { "github": { "type": "local", "command": ["npx", "-y", "@modelcontextprotocol/server-github"], "env": { "GITHUB_TOKEN": "{env:GITHUB_TOKEN}" } } } }
```

> Full reference: [references/mcp.md](references/mcp.md)

### Permissions

OpenCode permission model is simpler than Claude Code's: per-agent `tools` allowlist (disable `write`, `edit`, `bash`, `web` per agent), plus a runtime approval prompt by default. `--auto` flag or `permissions.auto` config skips prompts. There are **no native hooks** — wrap `opencode run` in a shell script for post-edit formatting.

> Full reference: [references/permissions.md](references/permissions.md)

### ACP, headless, migration

ACP (`opencode serve --acp`) exposes OpenCode as an Agent Client Protocol server for editors (Zed native, VS Code via SDK). Headless: `opencode run "<prompt>" --json` returns a JSONL event stream. `AGENTS.md` is shared with Codex; `CLAUDE.md` is Claude Code's analogue. See [references/agents.md](references/agents.md), [references/interop.md](references/interop.md), [references/migration.md](references/migration.md).

## Behavioral Traits

- Reads `opencode.json` and `AGENTS.md` first when entering a project
- Picks the provider per task: Anthropic for hard reasoning, Groq/Ollama for bulk/fast, Gemini for long context
- Uses `build` agent by default; switches to `plan` for unfamiliar code or large refactors
- Defines a `code-reviewer` custom agent with `write: false, edit: false` for read-only review work
- Uses OpenRouter / Vercel gateway `order` + `allow_fallbacks` for per-model failover (no generic top-level `provider.fallback` exists)
- Wraps `opencode run` in a shell script when hooks-like behaviour is needed (OpenCode has no native hooks)
- Uses ACP mode when working inside Zed/VS Code rather than a separate TUI
- Stores secrets in `{env:VAR}` interpolation, never inline in `opencode.json`
- Commits `opencode.json` and `AGENTS.md`; gitignores `.opencode/local.json` if present

## Important Constraints

- NEVER commit API keys inline in `opencode.json` — use `{env:VAR}` or `{file:~/.secrets/...}`
- NEVER assume Claude Code hooks have an OpenCode equivalent — they don't; use shell wrappers
- NEVER use `--auto` outside a sandboxed environment (devcontainer/VM/CI runner)
- NEVER mix Anomaly fork and SST origin docs — they diverged in late 2025; check which repo your install came from
- NEVER omit the provider prefix in model IDs — `claude-sonnet-4-6` is ambiguous; use `anthropic/claude-sonnet-4-6`
- ALWAYS run `opencode models` after `opencode auth login` to verify the provider is reachable
- ALWAYS pin OpenCode version in CI: install script accepts `VERSION=1.0.92 bash`
- ALWAYS write subagent system prompts in their markdown body (not in `opencode.json`) when they exceed ~5 lines

## Related Skills

**90%-filter applied.** ✓ = active; rest are cascade markers.

### Cousin CLI agents
- ✓ `claude-code` — Anthropic's official CLI (depth in skills/hooks/subagents)
- ✓ `codex` — OpenAI's official CLI (Rust, OpenAI-only)
- `gemini-cli` — Google's CLI agent (cascade marker)
- `cursor-cli` — Cursor's headless agent (cascade marker)
- `aider` — Python CLI pair-programmer (cascade marker)

### SDKs (provider-side)
- `anthropic-sdk` — cascade marker
- `openai-sdk` — cascade marker

### Runtime / language
- ✓ `nodejs` — Node 24; OpenCode SDK (`opencode-ai`) is npm
- ✓ `typescript` — TS 5.9
- ✓ `linux-sysadmin` — sandbox setup, devcontainer

### CI/CD
- `github-actions` — cascade marker

### Git
- ✓ `git` — heavy git integration (cascade marker)

### MCP
- `mcp-builder` — building custom MCP servers (cascade marker)

## API Reference

### Reference files (Pattern 2)

| Topic | File |
|---|---|
| Index + decision map | [references/REFERENCE.md](references/REFERENCE.md) |
| Install methods, auth, providers, devcontainer | [references/installation.md](references/installation.md) |
| Full CLI flag reference + subcommands | [references/cli-flags.md](references/cli-flags.md) |
| `opencode.json` schema, layering, file/env interpolation | [references/config.md](references/config.md) |
| Provider catalog: Anthropic, OpenAI, Google, Mistral, Groq, Ollama, etc. | [references/providers.md](references/providers.md) |
| Agents: built-in `build`/`plan`, custom agent markdown, ACP | [references/agents.md](references/agents.md) |
| Slash commands + custom commands in `.opencode/commands/` | [references/commands.md](references/commands.md) |
| MCP server config, transports, debugging | [references/mcp.md](references/mcp.md) |
| Permissions, sandboxing, hooks-as-wrappers | [references/permissions.md](references/permissions.md) |
| Headless mode, JSON events, GitHub Actions | [references/interop.md](references/interop.md) |
| `opencode serve` HTTP API: endpoints, SSE, auth, async prompts, abort, production patterns, Node client | [references/server-mode.md](references/server-mode.md) |
| Migration table OpenCode ↔ Claude Code ↔ Codex | [references/migration.md](references/migration.md) |
| Recommended defaults (provider priority, agent types, opencode.json scaffold, tui.json, failover) | [references/recommended-defaults.md](references/recommended-defaults.md) |
| Troubleshooting (BYOK auth, provider failover, schema errors, agent switching, MCP) | [references/troubleshooting.md](references/troubleshooting.md) |
| Wrong vs right code pairs (secrets, agent choice, model prefix, tool allowlist, tui.json) | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases (10 pos / 10 neg / 5 edge) | [references/eval-cases.md](references/eval-cases.md) |

### Templates

| Template | File |
|---|---|
| Project `opencode.json` with multi-provider, plan/build agents, MCP | [templates/opencode.json.template](templates/opencode.json.template) |
| `AGENTS.md` for project memory | [templates/AGENTS.md.template](templates/AGENTS.md.template) |
| Custom agent markdown | [templates/agent.md.template](templates/agent.md.template) |
| MCP server entry (local + remote) | [templates/mcp-server.json.template](templates/mcp-server.json.template) |

### Examples

| Scenario | File |
|---|---|
| Full session: install → multi-provider auth → first edit | [examples/quickstart-session.md](examples/quickstart-session.md) |
| GitHub Actions: headless PR review using cheap Groq model | [examples/github-actions-pr-review.md](examples/github-actions-pr-review.md) |
