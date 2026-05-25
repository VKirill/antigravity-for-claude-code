# Changelog

All notable changes to the `agent-builder` skill.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), Semantic Versioning.

## [1.1.0] — 2026-05-16 — Main-as-agent + migration

### Added

**`agents/dev-orchestrator.md`** — main-as-agent entry point. Launched via `claude --agent dev-orchestrator`, becomes the main thread and spawns the other 5 agents as subagents in 7 phases (understand → plan → confirm → implement → review → iterate → wrap up). Uses `tools: Agent(feature-planner, test-verifier, security-verifier, payments-verifier, db-reader)` to whitelist exactly which subagents can be spawned.

**`references/orchestration-modes.md`** — four modes of autonomous main work:
- Mode A: skill-driven (the superpowers paradigm)
- Mode B: main-as-agent (`claude --agent dev-orchestrator`)
- Mode C: tool-restricted subagent with PreToolUse hook
- Mode D: hook-driven review-gate (codex-plugin-cc)

Includes decision flow, when to combine modes, when NOT to combine, last-verified date.

**`references/migration-guide.md`** — step-by-step for users with 30+ accumulated agents:
- Diagnosis (when migration helps)
- Lean target (3-7 agents, not 95)
- 9-step migration with rollback path
- Triage table for community-pack prefixes (`engineering-*`, `design-*`, `roblox-*`, etc.)
- Common questions

**SKILL.md additions:**
- TL;DR section answering "can I delete all my agents?" / "how do I launch full cycle?" / "can subagents call subagents?"
- `dev-orchestrator` added to ready-made agents table with ⭐ as recommended entry point
- `claude --agent dev-orchestrator` documented in install section
- New rows in API Reference for orchestration-modes and migration-guide

### Changed

- SKILL.md ready-made agents table reordered: `dev-orchestrator` first (it's the orchestrating entry point), then verifiers/planner

### Reasoned about (not added)

- `tools: Agent(...)` syntax: verified against May 2026 docs. `Agent(a, b, c)` whitelists which subagent types can be spawned. Confirmed in `dev-orchestrator.md` frontmatter.
- Subagent nesting limit: re-verified `tools: Agent(...)` is no-op inside subagents — only effective when agent runs as main via `--agent`. This is what makes Mode B distinct from Mode A.
- Superpowers' design: confirmed they removed their named `code-reviewer` agent in v5.1.0+ and now dispatch `general-purpose` with prompt templates. This validates our recommendation: most "specialization" belongs in skills, not agents.

### Companion deliverable (planned separately)

Workflow skills pack styled after superpowers but tuned to Kirill's stack (marketing automation, n8n, direct campaigns, treba-online.ru). Not part of this skill — separate skill-pack project.

## [1.0.0] — 2026-05-16 — Claude Code edition

First release. Focused on Claude Code sub-agents (not codex agents) and assumes a rich existing `~/.claude/skills/` stack.

### Added — primary deliverable

**5 ready-to-install agents in `agents/`**, each calibrated for Kirill's skill-stack:

- `test-verifier` — auto-detects pytest/vitest/jest, runs full suite. Preloads `pytest`, `vitest`
- `security-verifier` — 6-category security sweep. Preloads `better-auth`, `zod`, `pydantic`
- `feature-planner` — produces SPEC + checklist + budgets, then stops. Preloads `karpathy-guidelines`, `claude-code`. Read-only via `permissionMode: plan`
- `payments-verifier` — high-stakes CloudPayments/YooKassa check. Preloads `cloudpayments`, `yookassa`, `zod`
- `db-reader` — read-only Postgres/Redis. Tool-restricted via `Bash` + `PreToolUse` hook

**Companion script** for `db-reader`:
- `scripts/validate-readonly-db.sh` — blocks SQL writes + Redis writes. jq → python3 → python → sed fallback chain. Smoke-tested with 8 cases (SQL SELECT/INSERT/DROP, Redis GET/SET/FLUSHDB/SCAN, EXPLAIN ANALYZE)

### Added — knowledge

**SKILL.md** (~280 lines) — pure navigator. Capabilities + references + ready-made agents + templates + KB.

**12 references** in `references/`:
- `decision-framework.md` — Layer 1 (skill or agent?) + Layer 2 (which agent pattern?) — includes counter-test D "skill instead"
- `decomposition-patterns.md` — context-centric vs role-centric; Telephone Game
- `subagent-anatomy.md` — every frontmatter field, May 2026 schema
- `description-engineering.md` — auto-delegation, "use proactively" idiom, RU+EN trigger terms
- `tool-permission-matrix.md` — canonical sets + MCP scoping for Kirill's MCPs (serena, git-nexus, context7, supermemory, playwright)
- `planner-agent-design.md` — SPEC + checklist + budgets, stop-here pattern
- `verifier-agent-design.md` — "MUST run complete X" verbatim, Early Victory mitigation
- `memory-and-skills-preload.md` — May 2026 fields, ≤4 preload cap, Kirill's stack mappings
- `anti-patterns.md` — 19 documented anti-patterns (incl. #19 "Recreating a stack-skill as an agent")
- `recommended-defaults.md` — single source of truth for all frontmatter values
- `troubleshooting.md` — symptom-indexed diagnosis
- `eval-cases.md` — 10 positive + 10 negative + 5 edge cases, user-voice phrasing (RU/EN)

**3 KB entries** in `knowledge-base/` (intentionally lean for 25K compaction budget):
- Ousterhout — *A Philosophy of Software Design*
- Martin — *Clean Architecture*
- Anthropic — *When to Use Multi-Agent Systems* (Jan 23 2026)
- `INDEX.md` documents why these three and what was deferred (Feathers, Kleppmann, older Anthropic posts)

**4 templates** in `templates/`:
- `verifier-generic.md.template` — for NEW verifiers beyond the 3 ready-made
- `memory-keeping-architect.md.template` — long-running projects with `memory: project`
- `explorer-deep.md.template` — MCP-backed semantic explorer (Serena)
- `orchestrator-main-agent.md.template` — for `claude --agent` entry points

**3 examples** in `examples/`:
- `planner-spec-output.md` — what a real SPEC.md from feature-planner looks like (2FA via TOTP)
- `verifier-checklist.md` — what test-verifier / security-verifier / payments-verifier return on the same PR
- `building-feature-end-to-end.md` — full session transcript: planner → main implements → 3 verifiers parallel → iteration

**3 scripts** in `scripts/`:
- `validate-readonly-db.sh` — db-reader hook (smoke-tested)
- `new-agent.sh` — scaffold a new agent from template (smoke-tested: name validation, template selection, collision check)
- `eval-routing.sh` — print eval cases for manual routing verification (smoke-tested)

### Design decisions

- **Mono-skill** (not skill-pack): unified discovery, single entry point
- **Single-agent + skills as default**: Counter-test D added to decision-framework — "Would this work as a skill?" gates BEFORE the three Anthropic conditions
- **5 ready-made agents, not 30+**: with Kirill's 65-skill stack, most "specialization agent" cases collapse to "use the skill in main"
- **3 KB entries, not 7**: respects 25K compaction budget; agents need room for stack-skills
- **Stack-aware `skills:` preload**: each ready-made agent names skills that actually exist in Kirill's `~/.claude/skills/`
- **Companion script with multi-tool fallback**: jq absent in test container exposed the assumption; refactored to jq → python3 → python → sed

### Distinctions from earlier codex-paradigm draft

This edition replaces a prior internal draft that was built around codex-specific orchestration patterns. Key differences:

- Codex-edition assumed 30+ agents with custom orchestration; Claude Code edition has 5 agents
- Codex-edition didn't recognize that Kirill already had stack-skills covering React/Next.js/FastAPI/etc; this edition does
- Counter-test D ("skill instead") is new — no equivalent in codex paradigm
- Anti-pattern #19 ("Recreating a stack-skill as an agent") is new — Kirill-specific trap
- Templates calibrated for `~/.claude/skills/` ecosystem, not codex agent registry

### Tested against

- Authoritative sources (verified 2026-05-16):
  - <https://code.claude.com/docs/en/sub-agents>
  - <https://code.claude.com/docs/en/skills>
  - <https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them> (Jan 23 2026)
- Claude Code 2.1.x sub-agent surface
- Smoke-tested: all three scripts pass their respective test cases
- Ready-made agents reviewed against actual Kirill skill names (verified from screenshot of `~/.claude/skills/` directory listing)

### Known limitations

- `skills:` preload assumes skill `name:` in frontmatter matches directory name. If Kirill's `~/.claude/skills/<dir>/SKILL.md` has a different `name:` field, preload list needs adjustment.
- `db-reader`'s `validate-readonly-db.sh` uses word-boundary grep — SQL keywords inside string literals (e.g., `SELECT comment WHERE comment LIKE '%UPDATE%'`) trigger false positives. Documented in script header.
- Templates use placeholder substitution via sed in `new-agent.sh`; complex placeholders (multi-line, regex) won't substitute cleanly.

### Installation

```bash
# Install skill
cp -r agent-builder ~/.claude/skills/

# Install ready-made agents
cp ~/.claude/skills/agent-builder/agents/*.md ~/.claude/agents/

# If using db-reader, install companion script
mkdir -p .claude/scripts
cp ~/.claude/skills/agent-builder/scripts/validate-readonly-db.sh .claude/scripts/
chmod +x .claude/scripts/validate-readonly-db.sh

# Restart Claude Code
```

Verify with:
```bash
ls ~/.claude/agents/ | grep -E '^(test-verifier|security-verifier|feature-planner|payments-verifier|db-reader)\.md$'
```

Verify skill name matches in preload (replace `<skill>` with names from agent frontmatter):
```bash
ls ~/.claude/skills/ | grep -E '^(pytest|vitest|zod|pydantic|better-auth|postgresql|redis|cloudpayments|yookassa|karpathy-guidelines|claude-code)$'
```

If any expected skill is missing → preload silently fails for that skill. Either author the missing skill or remove from the agent's frontmatter.
