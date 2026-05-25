# agent-builder — Eval Cases

v3 format: **user-voice phrasing** (RU/EN, typos OK) + **Expected behavior** column.

## Positive — should activate agent-builder (10)

| User-voice prompt | Expected behavior |
|---|---|
| "хочу написать кастомного агента для проверки тестов" | Load `references/decision-framework.md` first (gating), then `references/verifier-agent-design.md`, mention ready-made `agents/test-verifier.md` |
| "как настроить .claude/agents/ для планировщика" | Load `references/planner-agent-design.md` + `references/subagent-anatomy.md` for frontmatter; mention `agents/feature-planner.md` |
| "стоит ли вообще делать subagent для X" | Load `references/decision-framework.md` (counter-test D — skill instead) |
| "как сделать чтобы Claude автоматически делегировал моему агенту" | Load `references/description-engineering.md` |
| "хочу планировщика который пишет SPEC и не имплементирует" | Load `references/planner-agent-design.md` + `agents/feature-planner.md` |
| "как ограничить tools для агента чтобы только Read и Bash" | Load `references/tool-permission-matrix.md` (canonical sets) |
| "subagent с памятью между сессиями" | Load `references/memory-and-skills-preload.md` (memory section) |
| "frontmatter поля subagent — что куда писать" | Load `references/subagent-anatomy.md` (full) |
| "у меня 30 агентов, как их почистить" | Load `references/anti-patterns.md` (#18, #19) + `references/decision-framework.md` |
| "verifier subagent не ловит реальные ошибки" | Load `references/verifier-agent-design.md` (Early Victory section) + `references/troubleshooting.md` |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "написать SKILL.md для библиотеки" | `skill-evaluation` | Skill authoring, not agent |
| "evaluate LLM agent in production" | `agent-evaluation` | Production eval, not building |
| "Claude API messages.create tool use" | `claude-api` | API-level, not Claude Code |
| "написать MCP server для своего сервиса" | `mcp-server-author` | MCP server construction |
| "agent-teams для нескольких сессий" | `agent-teams` cascade | Cross-session, different mechanism |
| "написать pytest fixture для мокинга" | `pytest` skill | Test infra in main |
| "hook на git commit" | `git` / `husky` cascade | Git hooks, not Claude Code hooks |
| "написать deploy script на bash" | (out of scope) | Shell scripting |
| "CLAUDE.md best practices" | `claude-code-config` | Project memory config |
| "когда opus vs sonnet вообще" | `claude-models` cascade | Model choice in general |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "написать verifier subagent который вызывает MCP tool" | **agent-builder** primary (load `references/verifier-agent-design.md` + `references/tool-permission-matrix.md` for `mcpServers:`) — cross-link `mcp-server-author` if MCP itself needs work |
| "planner-агент + skill для архитектуры — как связать" | **agent-builder** primary (load `references/memory-and-skills-preload.md` for `skills:` preload + `references/planner-agent-design.md`) — cross-link `skill-evaluation` for skill authoring |
| "хочу агента, который видит мои react/fastapi скиллы" | **agent-builder** primary (load `references/memory-and-skills-preload.md` — explain `skills:` preload pattern; counter-test D from decision-framework — maybe just use skills in main) |
| "claude --agent для запуска агента как main thread" | **agent-builder** primary (load `references/subagent-anatomy.md` for `initialPrompt:` + orchestrator template) |
| "у меня скиллы react/nextjs/fastapi уже есть, нужен ли planner-agent" | **agent-builder** primary (load `references/decision-framework.md` — counter-test D applies; agent still justified by context isolation + SPEC artifact, but with thinner body since stack-skills do the heavy lifting) |

## How to verify (manual)

1. Open fresh Claude Code session with this skill at `~/.claude/skills/agent-builder/`
2. Paste each Positive prompt → confirm:
   - System reminder lists `agent-builder` as active
   - Response references files matching "Expected behavior" column
3. Paste each Negative prompt → confirm `agent-builder` does NOT appear in routing
4. Edge cases: confirm cross-link is explicit

If routing wrong:
- Negative → Positive: tighten SKIP rules in description
- Positive → Negative: add missing trigger term to description
- Edge routing wrong: enrich Related Skills cross-links

Run after any change to SKILL.md description or major reference restructure.

## Known shadows to watch

Built-in subagents this skill must NOT trigger on:
- `Explore` invocations ("explore the codebase") — built-in operation
- `Plan` mode ("plan the changes") — built-in
- `general-purpose` — built-in fallback

Skill activates when user is **authoring or modifying agent definitions**, not when **using existing agents**.

Related skills this skill must NOT shadow:
- `skill-evaluation` — `.claude/skills/*/SKILL.md` authoring
- `agent-evaluation` — production LLM agent testing
- `mcp-server-author` — MCP server construction
