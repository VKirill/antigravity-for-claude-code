# Migration — OpenCode ↔ Claude Code ↔ Codex

## File mapping

| Concept | OpenCode | Claude Code | OpenAI Codex |
|---|---|---|---|
| Project memory | `AGENTS.md` | `CLAUDE.md` | `AGENTS.md` |
| User memory | `~/.config/opencode/AGENTS.md` | `~/.claude/CLAUDE.md` | `~/.codex/AGENTS.md` |
| Project settings | `opencode.json` / `opencode.jsonc` | `.claude/settings.json` | `.codex/config.toml` |
| User settings | `~/.config/opencode/opencode.json` | `~/.claude/settings.json` | `~/.codex/config.toml` |
| Custom commands | `.opencode/commands/*.md` | `.claude/commands/*.md` | `.codex/prompts/*.md` |
| Custom agents | `opencode.json: agent.*` or `.opencode/agents/*.md` | `.claude/agents/*.md` | profiles in `config.toml` |
| Hooks | none native — use wrapper scripts | `settings.json: hooks` (27 events) | none native — use wrapper scripts |
| MCP servers | `opencode.json: mcp` | `settings.json: mcpServers` | `config.toml: [mcp_servers.*]` |
| Skills | community plugins | `.claude/skills/<name>/SKILL.md` | none |
| Auth file | `~/.local/share/opencode/auth.json` | `~/.claude/auth.json` | `~/.codex/auth.json` |

## Headless command mapping

| Goal | OpenCode | Claude Code | Codex |
|---|---|---|---|
| One-shot | `opencode run "..."` | `claude -p "..."` | `codex exec "..."` |
| JSON output | `--json` (JSONL) | `--output-format json` (object) | `--json` |
| Read-only | `--agent plan` | `--permission-mode plan` | `-s read-only -a untrusted` |
| Full auto | `--auto` | `--permission-mode bypassPermissions` | `--full-auto` |
| Pick model | `--model anthropic/claude-sonnet-4-6` | `--model claude-sonnet-4-6` | `-m gpt-5-codex` |
| Resume | `opencode run -c` | `claude -c` | `codex --resume` |

## Slash command mapping

| Action | OpenCode | Claude Code | Codex |
|---|---|---|---|
| Clear | `/new` | `/clear` | `/clear` / `/new` |
| Compact | `/compact` | `/compact` | `/compact` |
| Init | `/init` | `/init` | `/init` |
| MCP | `/mcp` | `/mcp` | `/mcp` |
| Permissions | `/permissions` | `/permissions` | `/permissions` |
| Switch agent / mode | `/agent <name>` | `--permission-mode` flag | `/model`, `-s/-a` flags |

## Provider portability

OpenCode is the only one of the three that's multi-provider. Notable for:

| Need | Mapping |
|---|---|
| Use Claude in OpenCode | `model: "anthropic/claude-sonnet-4-6"` + `ANTHROPIC_API_KEY` |
| Use GPT in OpenCode | `model: "openai/gpt-5.4"` + `OPENAI_API_KEY` |
| Use Claude in Codex CLI | Not supported — Codex is OpenAI-only |
| Use GPT in Claude Code | Not supported — Claude Code is Anthropic-only |

## Memory file portability

`AGENTS.md` is **the** shared format between OpenCode and Codex. If you maintain `CLAUDE.md` separately, consider symlinking:

```bash
ln -s AGENTS.md CLAUDE.md
```

so all three CLIs read the same project memory.

## Hook → wrapper translation

OpenCode has no native hooks. Translate Claude Code hooks like this:

| Claude Code hook | OpenCode equivalent |
|---|---|
| `PostToolUse` on `Edit\|Write` running prettier | Shell wrapper that parses `--json` output and post-formats edited files |
| `PreToolUse` on `Bash` blocking patterns | Shell wrapper that scans args and exits non-zero |
| `Stop` notification | `;` chain after the `opencode run` command |
| `UserPromptSubmit` rewriting prompts | Pre-process prompt via `sed`/`jq` before passing to `opencode run` |

## Permission model translation

| Claude Code | OpenCode equivalent |
|---|---|
| `permissions.deny: ["Bash(rm -rf:*)"]` | Per-agent `tools.bash: false` + shell wrapper for fine-grained patterns |
| `permissions.allow: ["Edit(src/**)"]` | OpenCode allows all paths by default; restrict at OS layer |
| `sandbox.network.deniedDomains` | Run in container with `--network` rules |

## When to migrate

| You're on... | Migrate to OpenCode if... |
|---|---|
| Claude Code | You need multi-provider, want to use Gemini/Ollama, prefer open-source code |
| Codex CLI | You're not locked to OpenAI billing, want broader provider choice |

| Migrate **away** from OpenCode if... |
|---|
| You need deep hook system / fine-grained permissions → Claude Code |
| You want Anthropic OAuth subscription billing → Claude Code |
| You're invested in OpenAI subscription/quota → Codex |
| You want Rust-level sandbox guarantees → Codex |
