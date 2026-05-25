# Migration guide — from agent-heavy setups to skill-driven

For users who have accumulated 30+ agents in `~/.claude/agents/` (typically from community packs like Wshobson, contains-studio, or codex-style agent libraries) and want to migrate to a leaner, skill-driven setup.

## Diagnosis: do you have this problem?

You have this problem if any of:
- `ls ~/.claude/agents/ | wc -l` returns >15
- Names like `engineering-frontend-developer.md`, `design-ui-designer.md`, `roblox-avatar-creator.md` exist alongside your actual stack
- Many agent files have similar `description` fields that conflict at routing time
- Some agent bodies say "If you need help with X, delegate to subagent Y" (impossible in Claude Code — see anti-patterns.md #9)
- You don't remember why most of them are there

## Why this matters

Every agent's `description` is loaded into context at delegation time. With 95 agents:
- ~10-20K tokens spent on agent descriptions before Claude even sees your message
- Routing accuracy degrades — descriptions overlap, Claude picks wrong agent
- `/agents` UI becomes unusable for finding what you actually need
- Subagent-to-subagent calls (which don't work) sit dormant in bodies, occasionally trying to fire

## The lean target

For most users on a Claude Code 2026 setup:

**Agents in `~/.claude/agents/`:** 3-7 custom agents
- 1 orchestrator (`dev-orchestrator`) — main-as-agent entry point
- 2-4 verifiers (`test-verifier`, `security-verifier`, optionally `payments-verifier`, `db-reader`)
- 1 planner (`feature-planner`)
- Plus `codex:codex-rescue` (auto-installed by codex-plugin-cc)

**Skills in `~/.claude/skills/`:** 50-100 — this is your actual specialization surface
- Stack skills (your existing 65 are great)
- Workflow skills (brainstorming, writing-plans, etc. — from superpowers or local equivalent)

**Plugins:**
- `codex-plugin-cc` for `/codex:review`, `/codex:adversarial-review`, `/codex:rescue`
- `superpowers` (optional) for methodology skills

## Migration steps

### Step 0 — Snapshot

```bash
# Make a recoverable backup of everything you currently have
DATE=$(date +%Y-%m-%d)
cp -r ~/.claude/agents ~/.claude/agents.OLD-pre-cleanup-$DATE
cp -r ~/.claude/skills ~/.claude/skills.OLD-pre-cleanup-$DATE 2>/dev/null || true
echo "Backup created at ~/.claude/agents.OLD-pre-cleanup-$DATE"

# Generate an inventory you can review
ls ~/.claude/agents/ > ~/agent-inventory-$DATE.txt
echo "Inventory at ~/agent-inventory-$DATE.txt"
```

Don't skip this step. The migration deletes a lot.

### Step 1 — Audit existing agents

Open `~/agent-inventory-$DATE.txt`. For each agent, decide:

| Decision | When | Action |
|---|---|---|
| **Keep as-is** | It's one of `test-verifier`, `security-verifier`, `feature-planner`, `payments-verifier`, `db-reader`, `dev-orchestrator`, or a genuinely custom blackbox check | Leave it |
| **Skill instead** | Its job is "knowledge about X stack" or "follow Y convention" — no blackbox isolation needed | Migrate body content to a skill in `~/.claude/skills/X/SKILL.md`, then delete the agent |
| **Built-in covers it** | Its job is "explore code", "plan", "general-purpose" | Delete; use built-in `Explore` / `Plan` / `general-purpose` |
| **Stack-skill duplicates it** | E.g., `engineering-frontend-developer` when you have `react`, `nextjs`, `vue` skills | Delete the agent; stack-skill in main covers it |
| **Role-split anti-pattern** | E.g., separate `planner` / `implementer` / `tester` / `reviewer` for the same feature | Delete; use dev-orchestrator's phases or superpowers' methodology skills |
| **Nests subagents** | Body says "delegate to other agents" | Delete; pattern doesn't work in Claude Code |

For each agent you're unsure about, run counter-test D from `decision-framework.md`: "Would this work as a skill in main context?" Most "uncertain" agents are skills in disguise.

### Step 2 — Quick triage by name patterns

For the 95-agent screenshot Kirill showed, here's the triage by prefix:

| Prefix | Count | Decision |
|---|---|---|
| `engineering-*-developer`, `*-engineer`, `*-architect` (frontend, backend, ai, mobile, etc.) | ~30 | **Delete.** Stack skills (`react`, `nextjs`, `fastapi`, etc.) in main cover this. |
| `design-*` | ~10 | **Delete.** If you actually do design work in Claude, author a single `design-system` skill. |
| `testing-*` | ~10 | **Mostly delete.** Replace with `test-verifier`. Keep `testing-evidence-collector` ONLY if it's a real blackbox check with concrete output format. |
| `project-management-*`, `product-*` | ~10 | **Delete.** These are role-play personas, not engineering work. |
| `roblox-*`, `unity-*`, `unreal-*`, `godot-*`, `xr-*`, `visionos-*` | ~15 | **Delete unless you actually do game/XR dev.** Even if you do — most are stack-skill candidates, not agents. |
| `specialized-*` | ~6 | **Audit individually.** Some may be legitimate domain-blackbox checks. |
| `agents-orchestrator` | 1 | **Delete or replace with dev-orchestrator.md** from this skill. |
| `compliance-auditor`, `blockchain-security-auditor`, etc. | ~5 | **Audit individually.** Auditors are often legitimate verifier patterns. |

Rough net: out of 95, you'll likely keep 3-8 and delete the rest.

### Step 3 — Install the lean replacement set

```bash
# Clean slate
rm -rf ~/.claude/agents
mkdir -p ~/.claude/agents

# Install the agent-builder ready-made agents
cp ~/.claude/skills/agent-builder/agents/*.md ~/.claude/agents/

# Verify
ls ~/.claude/agents/
# Expected: db-reader.md  dev-orchestrator.md  feature-planner.md
#           payments-verifier.md  security-verifier.md  test-verifier.md
```

If you don't want all 6 — at minimum keep `dev-orchestrator`, `feature-planner`, `test-verifier`, `security-verifier`. Drop `payments-verifier` if you don't touch payments code. Drop `db-reader` if you don't connect to DBs from Claude Code.

### Step 4 — Install companion script for db-reader (if kept)

```bash
mkdir -p ~/.claude/scripts
cp ~/.claude/skills/agent-builder/scripts/validate-readonly-db.sh ~/.claude/scripts/
chmod +x ~/.claude/scripts/validate-readonly-db.sh

# Or, per-project (recommended):
# mkdir -p .claude/scripts && cp ... && chmod +x ...
```

Edit `~/.claude/agents/db-reader.md` to point the hook at the correct path if you moved it.

### Step 5 — Install codex-plugin-cc

In Claude Code:

```
/plugin marketplace add openai/codex-plugin-cc
/plugin install codex@openai-codex
/reload-plugins
/codex:setup
```

This adds:
- `/codex:review`, `/codex:adversarial-review`, `/codex:rescue` slash commands
- `codex:codex-rescue` subagent (automatically; you don't author this)

**Do NOT enable `/codex:setup --enable-review-gate` yet.** Try the lean setup first; enable review-gate only if you specifically want auto-review on every turn (read [orchestration-modes.md](orchestration-modes.md) Mode D first).

### Step 6 — (Optional) Install superpowers OR local workflow skills

**Option A: install superpowers**

```
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

This adds workflow skills: `brainstorming`, `writing-plans`, `subagent-driven-development`, `test-driven-development`, etc.

**Option B: install local workflow skill-pack** (separate deliverable; not part of this skill)

A custom `superpowers-style` skill-pack tuned for your stack (marketing automation, n8n, direct campaigns, Telegram bots, treba-online.ru specifics) instead of superpowers' generic software-dev focus.

If you're not sure → start with superpowers; it's battle-tested. You can replace skills selectively later if their style doesn't fit your work.

### Step 7 — Verify skill names referenced in agents actually exist

The provided agents reference these skills in their `skills:` preload:

```bash
for s in pytest vitest zod pydantic better-auth postgresql redis cloudpayments yookassa karpathy-guidelines claude-code; do
  if [ -d ~/.claude/skills/$s ]; then
    name=$(grep "^name:" ~/.claude/skills/$s/SKILL.md 2>/dev/null | head -1 | awk '{print $2}')
    if [ "$name" = "$s" ]; then
      echo "✅ $s"
    else
      echo "⚠️  $s (directory exists but name: in frontmatter is '$name')"
    fi
  else
    echo "❌ $s — directory missing"
  fi
done
```

For each ⚠️ or ❌:
- If the skill exists but `name:` differs → either fix the skill's `name:` to match directory, or edit the agent file's `skills:` list to use the actual `name:`
- If the skill is missing → either author it or remove from the agent's `skills:` list

If you skip this step, the agents will silently fail to preload skills they reference (warning goes to debug log only).

### Step 8 — Restart Claude Code

```bash
# Quit any running sessions
# Then start fresh:
claude
```

`/agents` should now show ~6 custom agents + built-ins + plugin agents. Clean.

### Step 9 — Test the new setup

Three smoke tests:

**Test 1: routing works**
```
You: "прогони тесты в проекте"
Expected: Claude delegates to test-verifier (visible in tool calls)
```

**Test 2: dev-orchestrator launches**
```bash
claude --agent dev-orchestrator
```
Expected: initialPrompt fires; orchestrator introduces itself.

**Test 3: codex review fires**
```
You: /codex:review
```
Expected: Codex runs (in background by default); `/codex:status` shows progress.

If any of these fail, see [troubleshooting.md](troubleshooting.md).

## Rollback if needed

```bash
DATE=<the date you used in Step 0>
rm -rf ~/.claude/agents
mv ~/.claude/agents.OLD-pre-cleanup-$DATE ~/.claude/agents
# Restart Claude Code
```

You're back to the previous state. The backup directory contained everything as it was.

## Common questions

**Q: Won't I lose specialization by deleting all the engineering-* agents?**

A: No. Your stack skills (`react`, `nextjs`, `fastapi`, `prisma`, etc.) provide the same specialization, just loaded into main's context when relevant. The agents were duplicating what skills already give you.

**Q: What about agents I built that are genuinely useful and don't fit any of the 6 patterns?**

A: Keep them. The "lean target" is a guideline, not a hard cap. The real test is whether each agent passes the gates in `decision-framework.md`. If a custom agent genuinely does something a skill can't do (blackbox isolation, parallel work, hard tool restriction) — it belongs.

**Q: I have an agent that works really well. I don't want to migrate it to a skill.**

A: Then don't. If the agent earns its keep, keep it. The migration target is "lean", not "minimum possible". Audit each one on its own merits.

**Q: Can I migrate gradually instead of all at once?**

A: Yes. Suggested gradual approach:
1. Week 1: install the 6 new agents alongside the old 95. Use them when you remember. Don't delete anything yet.
2. Week 2: note which old agents you actually used. Delete the rest.
3. Week 3: install codex-plugin-cc. Use `/codex:review` instead of any "code-reviewer" old agent.
4. Week 4: install superpowers (or local workflow skills). Replace any planning/brainstorming old agents.
5. Week 5: cleanup pass — anything not used in a month gets deleted.

## Bottom line

You're not deleting agents because they're bad. You're deleting them because they duplicate work that lives more naturally in skills, built-ins, or the methodology layer. The new agents you keep are surgical — each does something the other layers genuinely can't.

A 6-agent setup with 65 skills + a plugin will outperform a 95-agent setup. That's the whole bet.
