# agent-evaluation — Eval Cases

v3 format: **user-voice phrasing** (Russian/typos/incomplete welcome) + **Expected behavior** column.

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "как протестировать LLM агента" | Load `references/behavioral-testing.md` + `references/reliability-metrics.md` |
| "eval suite для RAG пайплайна" | Load `references/behavioral-testing.md` + `references/llm-as-judge.md` |
| "регрессионные тесты на каждое изменение промпта" | Load `references/behavioral-testing.md` (invariant/contract/snapshot patterns) |
| "DeepEval vs Promptfoo что выбрать" | Load `references/REFERENCE.md` framework decision + `references/behavioral-testing.md` |
| "измерить надёжность агента над N прогонами" | Load `references/reliability-metrics.md` (pass@k, consistency, drift) |
| "оценить агента на SWE-bench" | Load `references/capability-benchmarks.md` SWE-bench section |
| "LangSmith для production monitoring" | Load `references/production-monitoring.md` |
| "LLM-as-judge для семантической корректности" | Load `references/llm-as-judge.md` |
| "статистически значимый A/B test prompt change" | Load `references/statistical-design.md` |
| "red-team prompt injection тесты" | Load `references/red-teaming.md` |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "evaluate classification model precision/recall" | `ml-engineer` cascade | Classical ML, not LLM agent |
| "построить агента с tool use" | `autonomous-agent-patterns` cascade | Building, not evaluating |
| "pytest fixtures для http mocks" | `testing-patterns` / `vitest` | Generic testing infra |
| "claude sonnet vs opus benchmarks" | `claude-api` | Vendor model comparison, not eval methodology |
| "evaluation в openai dashboard" | `openai-sdk` cascade | Vendor UI, not methodology |
| "huggingface dataset загрузить" | (out of scope) | Dataset tooling |
| "написать SKILL.md для Pattern 2" | `skill-evaluation` | Skill authoring |
| "линтер для python кода" | `ruff` / lint cascade | Not eval |
| "ci/cd pipeline для деплоя модели" | `mlops` cascade | Deployment infra |
| "анализ датасета в pandas" | (data analysis) | Data wrangling |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "evaluate coding agent end-to-end" | **agent-evaluation** primary (load `references/capability-benchmarks.md` SWE-bench/HumanEval) — cross-link `claude-code`/`opencode` for the agent under test |
| "skill description quality routing tests" | **skill-evaluation** primary (description engineering) — but if user wants behavior-after-routing evals → **agent-evaluation** |
| "monitoring агента в проде LangFuse vs Arize Phoenix" | **agent-evaluation** primary (load `references/production-monitoring.md`) |
| "guardrails injection защита" | **agent-evaluation** primary (load `references/red-teaming.md`) — flag overlap with vendor SDK guardrails |
| "benchmark коды — HumanEval, AgentBench, SWE-bench" | **agent-evaluation** primary (load `references/capability-benchmarks.md`) |

## How to verify (manual)

1. Open a fresh session with this skill at `~/.claude/skills/agent-evaluation/`.
2. Paste each Positive prompt → confirm:
   - System reminder lists `agent-evaluation` as active
   - Response references files matching the "Expected behavior" column
3. Paste each Negative prompt → confirm `agent-evaluation` is NOT routed; fallback skill is mentioned
4. Edge cases: confirm the cross-link is explicit (e.g., "primary: agent-evaluation, agent under test: claude-code")

If a prompt routes wrong:
- Negative → Positive: tighten SKIP rules in the description
- Positive → Negative: add the missing trigger term to the description
- Edge routes only to one: enrich Related Skills cross-links

Run after any change to `SKILL.md` description or major reference restructure — that's the regression check.
