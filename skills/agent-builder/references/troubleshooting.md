# Troubleshooting

Symptom-indexed. Find what's happening, follow diagnosis steps, apply fix. Required for `risk: high-stakes` skills.

---

## Claude doesn't delegate to my subagent

**Symptoms:** "test this" runs in main instead of calling `test-verifier`. Auto-delegation never fires. `@-mention` works fine.

**Diagnose:**

1. **Check description:** has role noun + concrete action + "Use proactively..." idiom?
2. **Check name uniqueness:**
   ```bash
   grep -r "^name: $AGENT_NAME" .claude/agents/ ~/.claude/agents/
   ```
3. **Check shadowing:** built-ins (`Explore`, `Plan`, `general-purpose`) or managed subagents may shadow yours
4. **Verify it's loaded:** `/agents` — does it appear in Library tab?

**Common causes:**
- ❌ Description too vague — no trigger terms
- ❌ Missing "use proactively"
- ❌ Name collision (silently dropped)
- ❌ File added after session start (restart needed for on-disk creates; `/agents` UI creates = live reload)
- ❌ Description shadows a built-in

**Fix:** Rewrite description per [description-engineering.md](description-engineering.md). Restart. Test.

If `@-mention` works but auto doesn't → description is the bottleneck.

---

## Subagent uses wrong tools / inherits what I didn't intend

**Symptoms:** Subagent calls `Write` when you wanted read-only.

**Diagnose:** If `tools:` is absent, the subagent inherits **everything** from main — including MCP tools.

**Fix:**

Path A (explicit allowlist):
```yaml
tools: Read, Grep, Glob
```

Path B (denylist):
```yaml
disallowedTools: Write, Edit, Bash
```

For max safety: also set `permissionMode: plan` — enforces read-only regardless.

---

## Tool list seems ignored

**Symptoms:** `tools: Read, Grep, Glob` but agent uses `Write` anyway.

**Diagnose:**
1. **`memory:` set?** Auto-enables Read/Write/Edit on the memory dir
2. **Parent `permissionMode`?** `bypassPermissions` / `acceptEdits` from parent override subagent's
3. **`mcpServers:` adds tools** on top of `tools:` allowlist
4. **Right agent?** Names collide silently across scopes

**Fix:** If `memory:` + strict tool restriction conflict — drop `memory:`, use a different state mechanism.

---

## Subagent finishes too quickly (Early Victory)

**Symptoms:** Verifier reports PASSED but issues remain. Ran 2 of 50 tests.

**Diagnose:** Does the body have the **exact phrase** "You MUST run the complete <X> before marking as passed"?

**Fix:** Add it verbatim. Specify what "complete" means:

```
You MUST run the COMPLETE test suite (all tests discovered by the runner) before marking as passed.
If you ran fewer than the runner's total discovered count, verdict is INCONCLUSIVE, not PASSED.
```

See [verifier-agent-design.md](verifier-agent-design.md).

---

## Context isn't isolated like expected

**Symptoms:** Main context still pollutes with test output / log content / fetched docs.

**Diagnose:** Subagent isolation is automatic. Intermediate work stays in subagent context. **What returns to main is the final response.** If final response is verbose, you see that.

**Fix:** In body:
```
Output format:
- 5-line summary, no more
- For each failure: <file>:<line> <one-line error>
- Do not include full test output. No traces beyond 5 lines.
```

---

## Subagent loses context across turns

**Symptoms:** Subagent forgets info from earlier in its own conversation.

**Diagnose:** Subagents auto-compact at ~95% capacity. Preloaded skills share 25K-token budget after compaction.

**Fix:**
- Use `memory:` for state that should persist
- Set `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=50` to compact earlier
- Re-invoke the skill after compaction
- Reduce preloaded skills to ≤4

---

## "Subagents cannot spawn other subagents" error

**Symptoms:** Subagent tries Agent tool, fails.

**Diagnose** (official doc):
> "Subagents cannot spawn other subagents."

**Fix:** Rewrite body to **report back to main**:

Before: "If tests fail, delegate to debug-helper."
After: "If tests fail, return failure list with recommendation to invoke debug-helper."

---

## Skills aren't preloading

**Symptoms:** `skills:` lists a skill but subagent doesn't have the knowledge.

**Diagnose:**
1. **Skill exists?**
   ```bash
   find ~/.claude/skills -name SKILL.md | xargs grep -l "^name: $SKILL_NAME"
   ```
2. **`disable-model-invocation: true`?** Silent fail, warning to debug log only
3. **Typo in `skills:` list?** Must match exactly

**Fix:**
- For `disable-model-invocation: true` skill: drop that field, OR inline skill content into body
- Verify name spelling

---

## Too many subagents, Claude routes poorly

**Symptoms:** Auto-delegation fires wrong agent. Performance feels slower.

**Diagnose:** Every agent's description is in context at delegation time. 30+ descriptions = significant tokens just on routing.

**Fix:** Audit:
1. Passes [decision-framework.md](decision-framework.md)'s gates?
2. Duplicates a built-in (`Explore`, `Plan`, `general-purpose`)?
3. Duplicates another custom agent in different words?
4. Duplicates a stack-skill from `~/.claude/skills/`?

Typical healthy count: **3-10 custom agents.** For Kirill's stack: **5** is right.

---

## `permissionMode` ignored

**Symptoms:** Subagent has `permissionMode: plan` but writes prompts still appear.

**Diagnose:**
- Parent `bypassPermissions` / `acceptEdits` → subagent inherits, can't override
- Parent `auto` → subagent inherits, frontmatter `permissionMode` **ignored**

**Fix:** For subagent's mode to take effect, parent must be `default`.

---

## Companion script (db-reader hook) not blocking writes

**Symptoms:** db-reader agent allows INSERT/UPDATE despite hook.

**Diagnose:**
1. Script exists at the configured path?
2. Script is executable (`chmod +x`)?
3. Script has `jq` or `python` available?
4. Hook `command:` path matches actual file location?

**Test:**
```bash
echo '{"tool_input":{"command":"psql -c \"INSERT INTO foo VALUES (1)\""}}' | ./.claude/scripts/validate-readonly-db.sh
echo "exit=$?"   # should be 2
```

**Fix:** Re-copy [scripts/validate-readonly-db.sh](../scripts/validate-readonly-db.sh) from the skill, chmod, verify path.

---

## CHANGELOG / history of agent isn't tracked

**Symptoms:** You edit agent file, behavior changes, no record of what changed.

**Fix:** Discipline, not a bug:
1. Commit `.claude/agents/*.md` to git
2. Significant agents: add comment block at top of body documenting recent revisions
3. Review `.md` changes in PRs like code

---

## More symptoms?

Gather:
1. Full subagent file (`cat ~/.claude/agents/<name>.md`)
2. User message that should have triggered
3. What actually happened (wrong agent / handled in main / error)
4. `/agents` output showing the agent is loaded
5. `claude --debug` output for the relevant turn

File against this skill; common patterns become new sections.
