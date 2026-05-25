# opencode — Eval Cases

v3 format: **user-voice phrasing** (Russian/typos/incomplete welcome) + **Expected behavior** column.

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "поставь opencode через bun" | Load `references/installation.md` install methods |
| "opencode.json чтоб claude и openai одновременно" | Load `references/providers.md` + `references/config.md`; cite `templates/opencode.json.template` + `references/recommended-defaults.md` |
| "BYOK anthropic key в opencode" | Load `references/providers.md` auth section; show `{env:ANTHROPIC_API_KEY}` |
| "/agent plan vs /agent build разница" | Load `references/agents.md` built-in primary agents |
| "opencode run в CI с json output" | Load `references/interop.md` headless + cite `examples/github-actions-pr-review.md` |
| "ollama codellama локально" | Load `references/providers.md` Ollama section + `references/recommended-defaults.md` model picker |
| "ACP протокол с Zed редактором" | Load `references/agents.md` ACP section |
| "кастомный subagent в .opencode/agents/" | Load `references/agents.md` custom agent markdown + cite `templates/agent.md.template` |
| "тему сменить tokyonight" | Load `references/config.md` theme section; note `tui.json` separate from `opencode.json` |
| "opencode → claude code мигрировать config" | Load `references/migration.md` mapping table |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "claude code hooks PreToolUse" | `claude-code` | Different CLI; OpenCode has no native hooks |
| "codex sandbox workspace-write" | `codex` | Different CLI |
| "openai sdk gpt-5.5 из node" | `openai-sdk` | SDK not CLI |
| "anthropic prompt caching" | `claude-api` / `anthropic-sdk` | API feature |
| "написать mcp server" | `mcp-builder` | Server authoring |
| "SKILL.md Pattern 2" | `skill-evaluation` | Skill authoring |
| "развернуть opencode на cloudflare" | (out of scope — server hosting) | This skill is CLI client only |
| "оценить LLM агента benchmark" | `agent-evaluation` | Different domain |
| "aider python pair-programmer" | `aider` cascade | Different tool |
| "gemini cli" | `gemini-cli` cascade | Different tool |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "AGENTS.md схема" | Either **opencode** or **codex** — both use it. Default to **opencode** if user mentions multi-provider; **codex** if ChatGPT/OpenAI |
| "хочу claude локально с opencode" | **opencode** primary (load `references/providers.md` Anthropic section) — clarify "локально" means Claude API access not local model; for local model → Ollama route |
| "fallback провайдеров если anthropic упал" | **opencode** primary, but flag: no generic `provider.fallback` exists. Load `references/providers.md` Fallback section — use OpenRouter/Vercel `order` + `allow_fallbacks` or shell-wrap retry |
| "vs code расширение для opencode" | **opencode** ACP section (load `references/agents.md`) — Zed has native, VS Code via SDK |
| "anomaly fork vs sst origin" | **opencode** — clarify install came from which repo; configs differ slightly. Load `references/installation.md` |

## How to verify (manual)

1. Open a fresh session with this skill at `~/.claude/skills/opencode/`.
2. Paste each Positive prompt → confirm:
   - System reminder lists `opencode` as active
   - Response references files matching the "Expected behavior" column
3. Paste each Negative prompt → confirm `opencode` is NOT routed; fallback skill is mentioned
4. Edge cases: confirm cross-link is explicit ("primary: opencode, see also: ...")

If a prompt routes wrong:
- Negative → Positive: tighten SKIP rules in description
- Positive → Negative: add missing trigger term
- Edge routes only to one: enrich Related Skills cross-links

Run after any description or major reference restructure — that's the regression check.
