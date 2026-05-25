# Anti-patterns for Claude Code subagents

Concrete things NOT to do. Most are Anthropic-documented; some are this skill's opinionation. Each has failure mode and fix.

---

## 1. Role-based decomposition for one feature

❌ Create `planner`, `implementer`, `tester`, `reviewer` for a single feature and chain them.

**Why fails** (Anthropic verbatim):

> "In one experiment with agents specialized by software development role (planner, implementer, tester, reviewer), the sub-agents spent more tokens on coordination than on actual work."

**Fix:** Keep planning, implementation, review in main. Use **verifier** subagents (blackbox) and **planner-with-stop** (produces SPEC, returns). Neither chains into the others.

---

## 2. Duplicating built-in subagents

❌ Custom `code-explorer` that does what `Explore` does. Custom `general-helper` that does what `general-purpose` does.

**Fix:** Use built-ins as-is, OR clearly differentiate (e.g., "semantic search via Serena MCP" not "find files").

---

## 3. Empty / vague description

❌ `description: A helpful agent that assists with coding tasks.`

**Fix:** See [description-engineering.md](description-engineering.md). Role noun + concrete action + "use proactively when..." + trigger-term list.

---

## 4. Verifier without "MUST run complete X"

❌ Verifier body says "Run the tests and report results."

**Why fails:** Early Victory Problem. Model takes shortest path satisfying instruction. "Run the tests" satisfied by running 2 of 47.

**Fix:** Use the **exact phrase** "You MUST run the complete <X> before marking as passed." Specify what "complete" means.

---

## 5. Planner with `tools: Write, Edit`

❌ Planner has write tools "just in case".

**Why fails:** Crosses from planner to implementer; role-split anti-pattern.

**Fix:** Planner is `tools: Read, Grep, Glob`, `permissionMode: plan`. Belt and suspenders.

---

## 6. `bypassPermissions` without `tools:` allowlist

❌
```yaml
permissionMode: bypassPermissions
# no tools: — inherits all
```

**Why fails:** Can corrupt `.git`, `.claude`, `.vscode`. No undo.

**Fix:** Pair with strict `tools:`. Or use `acceptEdits` / `default` — usually enough.

---

## 7. Preloading skills with `disable-model-invocation: true`

❌
```yaml
skills:
  - deploy-to-prod   # has disable-model-invocation: true
```

**Why fails:** Silent. Warning to debug log only. Agent runs without knowledge.

**Fix:** Remove `disable-model-invocation` from skill, OR inline content into agent body.

---

## 8. Name collision within scope

❌ Two files in `.claude/agents/` both have `name: code-reviewer`.

**Why fails** (official doc):

> "If two files within one scope declare the same name, Claude Code keeps one and discards the other without warning."

**Fix:** Before creating, search:
```bash
grep -r "^name: $NEW_NAME" .claude/agents/ ~/.claude/agents/
```

---

## 9. Subagent that tries to spawn another subagent

❌ Body says "If test fails, delegate to debug-helper subagent."

**Why fails:** Subagents cannot spawn subagents. Instruction is impossible.

**Fix:** Return to main with "Suggest invoking debug-helper on these failures: ...". Main delegates.

---

## 10. Embedding too much in body

❌ 400-line body with detailed instructions, examples, edge cases.

**Why fails:** Every invocation pays the token cost. Most content irrelevant on most invocations.

**Fix:** Body ~50-150 lines. Move detail to preloaded skill or project files agent reads on demand.

---

## 11. Writing an agent for one-time use

❌ "I want to refactor module X, let me write a `refactor-module-x` agent."

**Why fails:** Authoring time > doing it. Description doesn't generalize.

**Fix:** Reach for agent only when task pattern recurs.

---

## 12. `disallowedTools: Read`

❌ Agent that can't read files.

**Why fails:** Almost every agent needs to read. Cripples everything.

**Fix:** Use `permissions.deny` patterns in settings.json to deny specific paths instead.

---

## 13. `memory: user` for project-specific knowledge

❌ Architect agent has `memory: user`, accumulates Project A notes. Then used on Project B, brings Project A's conventions.

**Fix:** `memory: project`. Re-create the agent in each project.

---

## 14. Writing an agent that does what a hook does

❌ "Agent that runs after every code edit to lint."

**Why fails:** That's `PostToolUse` hooks. Hook = deterministic, free, can't hallucinate.

**Fix:** Use a hook in `settings.json`:
```json
"hooks": {
  "PostToolUse": [{
    "matcher": "Edit|Write",
    "hooks": [{ "type": "command", "command": "./scripts/lint-changed.sh" }]
  }]
}
```

Reach for agent only when task needs LLM judgment.

---

## 15. Imagining MCP tool names

❌ Body says "Use the `serena_semantic_search` tool" when actual tool is `serena_find_symbol`.

**Why fails:** Calls non-existent tool, errors, hallucinates correct name, retries.

**Fix:** Verify actual tool names. Use `/mcp` in Claude Code to list available tools.

---

## 16. Description written from agent's POV

❌ `description: I am an AI that reviews code.`

**Fix:** From user's POV. ✅ `Code reviewer. Use when user asks to review, audit, evaluate.`

---

## 17. Skipping the verifier loop in main

❌ Main invokes verifier, gets FAIL, reports to user without iterating.

**Fix:** "After verifier reports FAIL, attempt fixes and re-invoke verifier. Continue up to N attempts before escalating."

---

## 18. Treating agent count as a score

❌ "I have 30 agents in my .claude/agents/!"

**Why fails:** 30 descriptions compete at delegation time. Model spends context understanding options.

**Fix:** Healthy count: 3-10 custom agents. Audit:
- Does this match Anthropic's three conditions?
- Does it duplicate a built-in?
- Does it duplicate a skill in `~/.claude/skills/`?

For Kirill: with the skill-stack, the right count is ~5. See [decision-framework.md](decision-framework.md).

---

## 19. (Kirill-specific) Recreating a stack-skill as an agent

❌ Authoring `react-agent`, `nextjs-agent`, `fastapi-agent` when you have those skills in `~/.claude/skills/`.

**Why fails:**
- Duplicates work already done
- Main loses access to the skill (skills only load in main context unless explicitly preloaded into agent)
- Adds delegation overhead for work main does fine with skill loaded

**Fix:** Trust the skill in main. Reach for an agent only when one of the three Anthropic conditions applies.

---

## Bottom line

The shortest summary:

1. **Start with the main agent + skills.** Subagent is the exception.
2. **Use the built-ins.** Don't reinvent Explore/Plan/general-purpose.
3. **Don't recreate stack-skills as agents.** That's the Kirill-specific trap.
4. **Be explicit.** "MUST run complete X", strict `tools:`, explicit `permissionMode`.
5. **Verify assumptions.** Tool names, skill names on disk, name uniqueness.
6. **Audit, prune, simplify.** A small set of well-designed agents beats a sprawling collection.
