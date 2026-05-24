# CLAUDE.md — Global Working Agreements

> **This is an example global config shipped with antigravity-for-claude-code.**
> Copy it to `~/.claude/CLAUDE.md` to adopt the same working agreements (it pairs with the
> `dev-orchestrator` agents under `agents/`). Lightly sanitized for publication: host-specific
> firewall/port details and an auto-generated per-project GitNexus block were removed.
> Adjust the "Server environment" and "Context" sections to your own setup.

> Behavioral constraints for all projects. Less specific than project-level files.
> Precedence order: **user message > project `.claude/CLAUDE.md` > project `PROJECT.md` > this file**.
> On direct conflict with project rules, follow the project and surface the conflict in the response.

## Scope discipline

- Do not modify files unrelated to the current task
- Do not refactor code that wasn't part of the request
- Do not "improve" adjacent code, comments, or formatting you happen to see
- Do not delete pre-existing code you don't fully understand
- Do not rename, move, or delete files without explicit instruction
- Do not revert or overwrite user changes you didn't make
- Match existing codebase style, even if you'd design it differently
- Every changed line must trace directly to the user's request

## Simplicity constraints

- Do not add features beyond what was requested
- Do not create abstractions for single-use code
- Do not add configurability or flexibility that wasn't asked for
- Do not introduce backwards-compatibility shims or feature flags speculatively
- Do not add new production dependencies unless absolutely necessary
- Do not change build, test, or CI configuration unless asked

## Error handling

- Do not add try/catch blocks without explicit recovery logic
- Do not write empty catch blocks or generic fallbacks that hide failures
- Do not add default values for scenarios that cannot occur
- If something fails, let it fail visibly so the root cause can be diagnosed

## Verification

- Do not claim code works without running it or its tests
- If tests fail, fix the root cause — do not modify the test to make it pass
- Do not weaken assertions or add skip/xfail to silence failing tests
- After three focused failed attempts at the same fix, stop and report the blocker

## Git & commits

- Do not commit or push without explicit user confirmation
- Do not push to the main branch unless explicitly asked
- Refuse force push to main and surface a warning
- Keep commits focused — one logical change per commit
- Do not include unrelated edits in a commit just because they were in the worktree

> **Exception — dev-orchestrator agents (`dev-orchestrator`, `dev-orchestrator-agy`).**
> These agents are explicitly authorized to **auto-push to `origin/main` and auto-deploy by default, without asking**, once all verifier + review gates pass — that is their designed Phase 7 behavior and counts as standing "explicit ask".
> `dev-orchestrator-agy` additionally works with **`main` as the working branch** — it commits directly to `main` and never creates feature branches or worktrees.
> The conservative rules above (no push without confirmation, no main push without ask) remain the default for ALL other contexts — normal interactive sessions and any non-orchestrator agent.
> **Force-push to `main` stays forbidden in every context, including these agents** — the orchestrator push path is strictly fast-forward-only with no override.

## External APIs and data

- Do not make write calls to remote APIs or production databases without explicit request
- For requested write operations, perform a dry-run first and show the expected outcome
- Do not execute destructive operations (DELETE, DROP, force-push, overwrite) without confirmation

## Secrets

- Do not print secrets (tokens, keys, credentials) to terminal output
- Do not run commands that broadly dump environment variables
- Do not read or display contents of ~/.ssh, ~/.aws, or similar credential paths
- Redact sensitive strings in any displayed output

## System integrity

- Do not install system packages on the host unless explicitly instructed
- Prefer existing container workflows (Dockerfile, compose) when present in the repo

## When uncertain

- If multiple valid interpretations of the request exist, ask before choosing one
- If the request is ambiguous, ask one clarifying question instead of guessing
- If a simpler approach exists than what was requested, mention it before implementing
- State explicit assumptions when they materially affect the result
- Ask for clarification only when a wrong assumption would be costly, unsafe, or irreversible

## Task handoff heuristic

For a direct, single-line request, make a narrow edit. For complex tasks, estimate using the heuristic (scores sum):

- `+2` multiple user-visible problems
- `+2` UI state / filters / tables / payments / auth / data consistency
- `+2` likely backend / API / data root cause
- `+2` recurring pattern across modules
- `+2` multi-surface (frontend + backend + DB)
- `+2` requires verification via browser / API / DB
- `+3` production / billing / permissions / security / destructive

| Score | Mode |
|---|---|
| 0–3 | Direct narrow edit |
| 4–6 | Brief task ledger with acceptance criteria |
| 7–10 | Full handoff: ledger → root cause → implementation → self-review → verification |
| 11+ | Subagents with disjoint write scopes, when independent workstreams exist |

When spawning subagents: do not allow overlapping write scopes, do not declare the task complete before integrating outputs.

## Context

- User is not a professional developer — background is marketing and AI
- Russian by default for explanations; English for code, comments, commit messages
- Prefer plain language for errors, avoid unexplained jargon
- Lead the final answer with what changed, where, and how it was verified

## Server environment

Ubuntu 24.04 · PM2 · PostgreSQL · Redis · reverse proxy · firewall enabled.

For server tasks: `reload > restart`, back up before destructive operations, read logs via journalctl / PM2 rather than tailing raw files.

## Project files

If the project root contains `PROJECT.md` or `.claude/CLAUDE.md`, read them before making edits. Project-level rules win over this file.

## Dev orchestrator (preferred for multi-step work)

For non-trivial features, launch via `claude --agent dev-orchestrator` in the project directory. The orchestrator persists tasks in `<cwd>/.claude/orchestrator.db`, dispatches them to worker subagents through YAML contracts, runs autonomous recovery on failures, and reports progress.

User can observe progress in any other terminal:

```
task list                     # all tasks with status
task show <id>                # YAML contract + recent events
task logs <id>                # full event stream
task graph                    # dependency tree
task ready                    # what's currently ready to run
```

Add `.claude/orchestrator.db*` to `.gitignore` (local state, contains binary SQLite). For history-in-git use `task export <id>` or `task list --json`.

**Do NOT invoke `superpowers:*` skills** — we're on the local stack. Replacements: `brainstorming` (Phase 1), `orchestrator-workflow` (Phase 2+4), `tdd`, `systematic-debugging`. Plugin can be disabled via `/plugins` slash command in Claude Code UI.

## Memory MCP — recall via tencentdb-memory

A long-term memory pipeline is wired across all projects on this machine via the `tencentdb-memory` MCP server. Every conversation turn is captured to L0 (raw JSONL), distilled to L1 facts (persona / episodic / instruction) by a background scheduler, and embedded into a vector store for semantic recall. **Use it actively — it exists to spare you from asking the user the same questions twice.**

### Four MCP tools

| Tool | Returns | Use when |
|------|---------|----------|
| `mcp__tencentdb-memory__memory_search` | top-K L1 facts ranked by Voyage embedding similarity | starting any non-trivial task — "what did we decide about X", "have we touched this module before", "what stack does the user prefer here" |
| `mcp__tencentdb-memory__conversation_search` | raw L0 turns matching a keyword substring | semantic search drew a blank but you remember an exact phrase the user used; fallback when L1 facts are too summarized |
| `mcp__tencentdb-memory__recall_persona` | the project's `persona.md` (synthesized user portrait) | user says "as usual" / "the way we agreed" / "you know my style"; whenever you're about to make a choice on tone, stack, or workflow |
| `mcp__tencentdb-memory__recall_scenes` | list of L2 scenes (thematic groupings) with heat & summary | scoping a feature — "what are the active threads in this project right now"; auditing what topics have been captured |

### When to call (proactive)

- **At the start of any feature / SPEC / planning task** — fire one `memory_search` with the task title or the keyword the user used. Read top-5 matches before writing the plan. Saves re-deriving constraints.
- **When the user references past decisions** ("как мы договаривались", "помнишь, ты делал…") — `memory_search` first, never guess. If it misses, fall back to `conversation_search` on the exact word.
- **Before generating a SPEC / persona-shaped output** — `recall_persona` to align tone, language register, stack preferences. The persona is single source of truth for user profile.
- **When you smell that the user has explained this before** — silent `memory_search`; if you find it, acknowledge briefly ("в прошлый раз мы решили X — продолжаю отсюда"), do NOT make the user repeat.

### When NOT to call

- Mechanical edits with no ambiguity (rename a variable, fix a typo) — recall adds latency for zero gain.
- Inside tight loops or after every step — one recall per task is enough; not one per tool call.

### Hygiene

- **Don't paste recalled facts back at the user verbatim** — synthesize them into your reply. The user wrote them once already; reciting is annoying.
- **Distrust stale facts** — if recall returns something dated >6 months old or contradicting current request, surface the conflict, ask the user.
- **Don't try to "write" to memory** — capture is automatic. There is no manual write API and shouldn't be one.
