# Orchestration modes

Four ways to make the main thread work autonomously through a full feature cycle. Each has a different tradeoff between automation and control.

## TL;DR — pick one

| Your situation | Pick |
|---|---|
| One-shot full cycle, you want it disciplined | Mode B: `claude --agent dev-orchestrator` |
| Day-to-day work, want skills to nudge methodology | Mode A: workflow skills + manual verifier dispatch |
| You want hands-off review on every Claude turn | Mode D: review-gate hook (risky on tokens) |
| You're already using superpowers | Mode A; this skill's verifiers complement it |
| You want hard guarantees (read-only DB, etc.) | Mode C: tool-restricted subagent with PreToolUse hook |

The four modes are **not mutually exclusive** — Mode A and Mode B can coexist; Mode D layers on top of either.

---

## Mode A — Skill-driven (the superpowers paradigm)

**Mechanism:** Methodology lives in workflow skills (`brainstorming`, `writing-plans`, `subagent-driven-development`, etc.). Main agent loads them automatically based on context. The skills instruct main *how to work*, including when to dispatch subagents.

**How a session looks:**

1. User: "Хочу добавить webhook для возврата платежа"
2. Main detects feature work → loads `brainstorming` skill
3. Brainstorming skill instructs main to ask Socratic questions, write design doc
4. After design approval → main loads `writing-plans` skill, produces plan
5. After plan → main loads `subagent-driven-development` skill, which says "for each task, dispatch fresh `general-purpose` subagent with implementer prompt template; after implementer reports done, dispatch another `general-purpose` for spec-compliance review; then another for code-quality review"
6. After all tasks → main loads `finishing-a-development-branch` skill

**Strengths:**
- Methodology is portable across harnesses (Claude Code, Codex, Gemini)
- No special launch flag — works in any session
- Each phase is a separate skill — easy to override individual phases
- Validated by 192k stars and `superpowers` track record
- Skills can be edited without touching agents

**Weaknesses:**
- Depends on main correctly auto-loading skills (descriptions must match)
- No hard guarantee main follows the methodology — relies on instruction-following
- Subagent dispatch uses `general-purpose` with prompt templates, not named specialists — so you lose the SEO benefit of named agents in `/agents` UI

**When to pick:**
- You want a portable methodology you can edit
- You're already using or planning to use superpowers
- Your work is varied across many feature types — not "every session is identical"

**What you install:**
- Superpowers (or our `superpowers-style` skill-pack written for Kirill's stack — separate deliverable)
- This skill's verifier agents are still useful for blackbox checks the methodology skills don't cover

---

## Mode B — Main-as-agent (`claude --agent dev-orchestrator`)

**Mechanism:** Start the session with `--agent dev-orchestrator`. The orchestrator's frontmatter and body become main's system prompt. It has `tools: Agent(feature-planner, test-verifier, security-verifier, payments-verifier, db-reader)`, which means it (running as main) can spawn those subagents.

**How a session looks:**

1. User: `claude --agent dev-orchestrator`
2. Session starts. The `initialPrompt` from dev-orchestrator.md auto-submits as first turn — orchestrator introduces itself and its workflow
3. User: "Хочу webhook для возврата платежа"
4. Orchestrator runs its 7-phase cycle (understand → plan → confirm → implement → review → iterate → wrap up)
5. At phase 2, orchestrator dispatches `@feature-planner` as a subagent
6. At phase 5, orchestrator dispatches `@test-verifier` + `@security-verifier` + `@payments-verifier` (parallel)
7. Orchestrator handles implementation in its own (= main's) context

**Strengths:**
- One launch command for the whole cycle
- Methodology is in the agent file, not scattered across skills
- Strong typing via `tools: Agent(name1, name2, ...)` — orchestrator can ONLY spawn the named subagents (security guarantee)
- Reproducible — every session starts the same way

**Weaknesses:**
- Methodology baked into one agent file — less composable
- Requires Claude Code (other harnesses don't support `--agent`)
- Subagents are still subagents — can't spawn other subagents (Anthropic's documented limit)
- One file gets long — the agent body has the full methodology

**When to pick:**
- You want repeatable, opinionated cycles
- Your workflows are similar enough that one orchestrator covers most cases
- You like the `claude --agent` launch ritual

**What you install:**
- `agents/dev-orchestrator.md` (provided)
- The 5 verifier/planner agents it dispatches

**Important: nesting restriction reminder.**

The doc is clear:
> "Subagents cannot spawn other subagents. `Agent(agent_type)` has no effect in subagent definitions. This restriction only applies to agents running as the main thread with `claude --agent`."

So:
- ✅ `dev-orchestrator` launched as main via `claude --agent` → can spawn `feature-planner` ✓
- ❌ `feature-planner` running as a subagent (dispatched from main) → cannot spawn `test-verifier`
- ✅ Orchestrator spawns planner; planner returns SPEC; orchestrator (back in main) then spawns verifier

The cycle always returns to the orchestrator between subagent dispatches. That's why dev-orchestrator's body is structured as phases — each phase is "orchestrator does X, dispatches subagent Y, gets result, decides next phase".

---

## Mode C — Tool-restricted subagent with hooks

**Mechanism:** A subagent has `tools: Bash` (or similar minimal set) and a `PreToolUse` hook validates each invocation. The hook can be a shell script that exits 2 to block. This gives **hard guarantees** that prompting alone can't.

**How it looks:**

The `db-reader` agent in this skill is the canonical example:
- `tools: Bash` only
- `PreToolUse` hook → `validate-readonly-db.sh` → exits 2 on INSERT/UPDATE/DELETE/Redis SET/etc

The agent cannot write to the DB even if the LLM "decides" to. The hook is OS-level enforcement.

**Strengths:**
- Hard guarantees, not just prompting
- Works for any blocked behavior (writes, network calls, specific commands)
- Composable with other modes — Mode B's dev-orchestrator can dispatch the Mode C agent

**Weaknesses:**
- Requires writing and maintaining the validation script
- Word-boundary grep has false-positive edges (e.g., SQL keyword inside a string literal); document them
- Hook script must exist on disk at the path declared in frontmatter — easy to break by moving files

**When to pick:**
- You need a security guarantee for one operation (read-only DB, no network, sandbox)
- The constraint is checkable by a shell script

**What you install:**
- The agent file (e.g., `db-reader.md`)
- Companion script (e.g., `validate-readonly-db.sh`) at the path declared in the agent's `hooks` block

See [tool-permission-matrix.md](tool-permission-matrix.md) for canonical permission sets.

---

## Mode D — Hook-driven (review-gate)

**Mechanism:** A `Stop` hook in `settings.json` fires after Claude's response and runs an external check (linter, test runner, code review). If the check finds issues, the hook can block the stop, forcing Claude to continue (fixing).

**The canonical example: codex-plugin-cc's review-gate.**

```bash
/codex:setup --enable-review-gate
```

After this, every time Claude finishes a turn, codex-plugin-cc's Stop hook runs a targeted Codex review. If issues are found, Claude can't stop until they're addressed.

**Strengths:**
- Fully automatic — no orchestrator needed
- Works on every turn, including ad-hoc one-off requests
- Codex gives a genuine second opinion (different model, different training)

**Weaknesses:**
- **Heavy token cost** — every turn pays for Codex review
- Can create long loops where Codex keeps finding things and Claude keeps fixing
- Hard to debug when the gate fires unexpectedly
- Anthropic and OpenAI both warn: "May drain usage limits quickly"

**When to pick:**
- High-stakes code where you'd want manual review on every change anyway
- You're actively monitoring the session and can stop it if loops emerge
- You can absorb 2-3× the token cost of normal Claude Code use

**When NOT to pick:**
- Long autonomous sessions you'll come back to in hours — too easy to drain budget
- Exploratory / brainstorming work — review on every turn is excessive
- Default mode for everyday use

**What you install:**
- `codex-plugin-cc` (via Claude Code's `/plugin` interface)
- `/codex:setup --enable-review-gate` to turn on
- `/codex:setup --disable-review-gate` when done

---

## Combining modes

**Mode A + B (recommended for Kirill):**
- Install superpowers (or local equivalent) for general methodology
- Have `dev-orchestrator.md` for full-cycle sessions you launch via `claude --agent`
- They overlap, but the overlap is fine — orchestrator's phases align with skill phases; if both are present, orchestrator's body defers to skills where they exist (see `dev-orchestrator.md`'s "How this fits with superpowers" section)

**Mode A + C:**
- Skills handle methodology
- Verifier agents handle blackbox checks
- Tool-restricted agents handle hard guarantees (db-reader, sandboxed bash)

**Mode B + D:**
- Orchestrator runs the cycle
- Review-gate adds a second-opinion layer per turn
- WARNING: token-heavy; only enable for genuinely high-stakes work

**Mode A + B + C + D (everything):**
- Possible but excessive for most cases
- The combined token cost is significant
- Reach for this only when shipping high-stakes payments / security / compliance code

## What to NOT do

❌ **Don't use Mode D as default.** Review on every turn turns simple chats into multi-Codex-call sessions. Reserve for actively-monitored work.

❌ **Don't write a "super-orchestrator" that combines all four modes.** That's adding complexity for the sake of it. Pick the modes you need; layer additively.

❌ **Don't expect Mode B to behave like Mode A.** Mode B's discipline lives in one file; Mode A's lives across many skills. They have different evolution patterns.

❌ **Don't enable review-gate on Kirill's typical work** (n8n automation, marketing copy, light scripting). Heavyweight review on lightweight tasks burns tokens for no quality gain.

## Decision flow

```
Session is for: a non-trivial feature with implementation phase?
├─ No → Mode A (skills nudge methodology, you stay loose)
└─ Yes
   ├─ One-shot disciplined cycle? → Mode B (claude --agent dev-orchestrator)
   ├─ Day-to-day, varies a lot? → Mode A (skills + manual verifier dispatch)
   ├─ Need hard guarantee on specific operation? → Mode C (tool-restricted subagent + hook)
   └─ High-stakes, want second opinion every turn? → Mode D (review-gate, token-aware)
```

## Last verified

2026-05-16 against:
- https://code.claude.com/docs/en/sub-agents (sub-agent docs)
- https://github.com/openai/codex-plugin-cc (review-gate mechanism)
- https://github.com/obra/superpowers (Mode A methodology)
