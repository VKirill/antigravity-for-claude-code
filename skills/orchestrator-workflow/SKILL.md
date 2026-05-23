---
name: orchestrator-workflow
description: "DB-persistent task dispatch + YAML contracts for dev-orchestrator. Use when running as dev-orchestrator and need to persist tasks, dispatch workers via YAML contracts, validate via verification_commands, recover from failures autonomously."
allowed-tools: Bash, Read, Write, Edit, Agent
---

# Orchestrator Workflow — DB Persistence + YAML Contracts

You are dispatching work, not doing it yourself. Your job: turn a SPEC into atomic tasks, persist them in SQLite, dispatch each to a worker subagent via YAML contract, validate the result, recover from failures.

## Setup (once per session)

In the project's CWD:

```bash
task init              # creates <cwd>/.claude/orchestrator.db (idempotent)
task db                # prints the path — confirm it's project-local
```

If `.claude/orchestrator.db` is not in `.gitignore`, add it (and `*.db-wal`, `*.db-shm`).

## YAML contract template

```yaml
id: TASK-001              # TASK-NNN (numeric) or TASK-AUTH-001 (alphanumeric)
parent_id: null
title: "Short imperative title"
scope: |
  What the worker must do. Concrete. No fluff.
acceptance_criteria:
  - "Observable outcome 1"
  - "Observable outcome 2"
risk_class: low           # low|medium|high — see classification below
files_to_touch:
  - src/path/to/file.ts
reuse_patterns:           # MANDATORY for "build new X" tasks. Pulled from feature-planner's SPEC `existing_patterns`.
  - symbol: PhotoGenStepFlow
    location: src/composables/usePhotoGenSteps.ts
    how_to_use: "Extend with new step type 'profile-selection' — do NOT create a new wizard"
forbidden_duplicates:     # Explicit "do NOT recreate" list. Worker pauses if about to violate.
  - "Do not create a new step-flow composable; extend usePhotoGenSteps"
  - "Do not duplicate StepNavigator; pass slot content via props"
dependencies: []          # task ids that must be 'done' first
assignee_agent: worker-coder
verification_commands:
  - "npm test -- file.test"
  - "npm run build"
expected_output: "What 'green' looks like (tests pass, files exist, etc.)"
context_refs:
  - docs/plans/<feature>/SPEC.md
skill_hints:
  - relevant-stack-skill
tool_constraints:
  allowed_tools: [Read, Edit, Write, Bash, Grep]
status: pending
```

**`reuse_patterns` / `forbidden_duplicates` rules:**
- Required when `scope` contains "new", "create", "add", "build" + a noun (component / function / page / route / step / dialog / wizard).
- Empty list `reuse_patterns: []` is acceptable ONLY when paired with a `reuse_patterns_note: "checked via gitnexus_query('<concept>'), no matches"` — proves discovery happened.
- Source of truth: feature-planner's SPEC `existing_patterns` section (step 3a, discover-before-plan). Orchestrator copies into the contract.
- Worker-coder enforces these at the "discover-before-create checkpoint" before writing new files.

**Risk classification** (auto-determined if omitted by `classifyRisk(files_to_touch)`):
- **high** — auth/payments/billing/secrets/migrations/.env touched. Escalate after 1 fail.
- **medium** — api/lib/package.json/schema/prisma touched. Auto-retry with logging.
- **low** — UI/tests/docs/refactor. Full auto-retry chain.

## Plan phase — persist tasks (NON-NEGOTIABLE)

**Sequence is rigid:**

```
1. Plan generated (by you, feature-planner, or worker-refactor-architect)
2. task init                          ← creates DB; idempotent
3. task insert (loop) per checklist item OR migration_sequence step
4. Announce to user: "N tasks in DB, see `task list`. Approve?"
5. Wait for user approval
6. Then proceed to dispatch (Phase 4)
```

**Never show user a plan without persisting it first.** The DB IS the plan. If it's not in `task list`, it doesn't exist.

### Mapping worker-refactor-architect output → task contracts

`worker-refactor-architect` returns YAML with `migration_sequence: [{step, action, files_touched, assignee_agent, verifies, ...}]`. Each step becomes ONE task contract:

```yaml
# worker-refactor-architect migration_sequence step:
- step: 2
  action: "Extract validate to src/payments/refund/validate.ts"
  files_touched: [src/payments/refund/validate.ts, src/payments/refund.ts]
  assignee_agent: worker-coder
  verifies: ["npm test -- refund", "tsc --noEmit"]
  skill_hints: [refactoring]
  rollback_safe: true

# becomes:
id: TASK-002                                # numeric, matches step number
title: "Extract validate to src/payments/refund/validate.ts"
scope: |
  Step 2 of refactoring plan: extract the `validateRefundRequest` function
  and its types from src/payments/refund.ts into a new file
  src/payments/refund/validate.ts. Update the import in refund.ts.
acceptance_criteria:
  - "src/payments/refund/validate.ts exists and exports validateRefundRequest"
  - "src/payments/refund.ts imports validateRefundRequest from new file"
  - "npm test -- refund passes"
  - "tsc --noEmit clean"
files_to_touch: [src/payments/refund/validate.ts, src/payments/refund.ts]
dependencies: [TASK-001]                    # chain after step 1
assignee_agent: worker-coder
verification_commands: ["npm test -- refund", "tsc --noEmit"]
context_refs:
  - docs/plans/<feature>/refactoring-plan.yaml#step-2
  - src/payments/refund.ts                  # the source being extracted from
skill_hints: [refactoring, typescript]
```

The `dependencies` chain enforces serial execution — step N waits for step N-1 to be `done` before dispatching. This is what makes refactorings safe: each step's verification gates the next.

### Mapping feature-planner SPEC → task contracts

For non-refactor work, each SPEC checklist item becomes a contract:

```markdown
# SPEC.md
- [ ] Add `/api/refund` endpoint
- [ ] Add unit tests for the endpoint
- [ ] Wire refund button in UI
```

→ 3 contracts, each scoped to its item. Dependencies form a DAG (test depends on endpoint, UI depends on endpoint+test).

### Unusual cwd handling

If cwd is `~/.claude/`, `/tmp/<scratch>/`, or anywhere not a typical project — **still run `task init` there**. The DB is local-only (`.gitignore`'d). The work and the tracking live together. If user cared about isolation they'd `cd` to a different directory before starting.

## Dispatch loop — Phase 4 replacement

Replace per-task implementation-in-main with this loop:

```
while task ready --json returns non-empty:
  for each ready task:
    1. Read contract:           task export <id> > /tmp/contract.yaml
    2. Mark assigned:           task update <id> --status assigned
    3. Dispatch worker via Agent tool:
       - subagent_type = contract.assignee_agent (e.g. worker-coder)
       - prompt = the YAML contract verbatim + instruction to return YAML result block
    4. Mark in_progress:        task update <id> --status in_progress
    5. Wait for worker return.
    6. Save transcript:         echo "$transcript" | task save-artifact <id> --kind transcript
    7. VALIDATE result schema:  echo "$transcript" | task validate-result --task-id <id>
       - exit 0 → valid; result saved as artifact, 'verification' event logged
       - exit 1 → INVALID. stderr lists schema errors. Capture them.
         Re-dispatch SAME worker with previous_attempt_errors = stderr.
         This is retry #1 BEFORE running verification_commands — the
         worker didn't even comply with the output contract.
    8. Run each verification_commands; collect output.
    9. Decision:
       - All verifications green → task update <id> --status done --payload '{"summary":"...","verification_output":"..."}'
       - Any verification red → enter recovery chain (below)
```

**Step 7 is non-negotiable.** Without schema validation you can't tell whether
"worker said done" means "actually done" or "LLM hallucinated a confident-looking
summary while skipping required artifacts/errors fields". The validator catches:
- Missing `result:` block entirely
- YAML syntax errors in the result block
- Wrong types (e.g. `artifacts: "src/x.ts"` instead of array)
- Extra/misspelled fields (strict zod schema)

Each of these has a deterministic auto-fix path: re-dispatch the worker with
the parser's error messages as `previous_attempt_errors`.

## Autonomous Recovery Chain

| Retry # | Action |
|---|---|
| 1 | Re-dispatch SAME worker with prompt = original_yaml + `previous_attempt_errors: [...]` + verification stdout/stderr |
| 2 | Re-dispatch SAME worker, prompt also includes git diff of files_to_touch + full prior transcript |
| 3 | Spawn `worker-doctor` (read-only investigator). Prompt = contract + both prior transcripts + verification outputs. Doctor returns YAML with `diagnosis` + `proposed_fix_strategy`. Save as artifact. |
| 4 | Re-dispatch original worker, prompt includes doctor's `proposed_fix_strategy` as `guidance` field |
| 5+ | `task update <id> --status blocked`, save full state as transcript artifact, log to events. **Do NOT halt** — pick next ready task. |

**Track retries via task_events:**

```bash
task update <id> --status in_progress --payload '{"retry": 2, "reason": "verification_failed"}'
```

(Use status `in_progress` for retries — the payload tracks retry count.)

**Circuit breaker (mandatory):**

Before each dispatch, run:

```bash
task list --json | jq '[.[] | select(.status == "failed" or .status == "blocked")] | length'
task list --json | jq 'length'
```

If `failed+blocked > 50% of total` → **HALT**. Surface state to user:
> «Половина тасков не проходит. Останавливаюсь — нужно посмотреть что не так. Заблокированы: TASK-XXX, TASK-YYY.»

**High-risk escalation:**

For tasks with `risk_class: high`:
- **NO auto-retry beyond retry #1.** After single failure → escalate to user.
- **NO destructive commands in verification_commands** (DROP/TRUNCATE/rm -rf/git push --force). Reject contract at insert time.

## End-of-session report

After the ready-queue is empty, always emit:

```bash
task list --status blocked
task list --status failed
task list --status done
```

Plain summary to user:
> «Готово. Сделано N из M тасков. Заблокировано K — вот они: ...»

## Worker prompt template

When dispatching via Agent tool, prompt structure:

```
You are <assignee_agent>. Execute the YAML contract below.

CONTRACT:
<paste full YAML>

RULES:
- Touch only files listed in files_to_touch (unless creating new files in the same module).
- Use tools from tool_constraints.allowed_tools only.
- Run verification_commands yourself before reporting done.
- Return your result as a YAML block at the end:

```yaml
result:
  summary: "what you did, 1-3 sentences"
  verification_output: |
    <stdout of verification_commands>
  artifacts: ["paths/of/files/changed.ts"]
  errors: []  # or list of error messages if anything failed
```

If you cannot satisfy acceptance_criteria, set errors and explain.
```

## Skills available to workers

Workers automatically have access to stack skills (react, postgresql, etc.) via their own skill resolution. The `skill_hints` field in the contract is a STRONG SUGGESTION — the worker should load those skills first.

## Anti-patterns

- ❌ **You implement the task yourself.** That's the old pattern (current dev-orchestrator.md still says "implementation happens in YOUR context"). For DB+contract flow, you DISPATCH. The orchestrator is a PM, not an IC.
- ❌ **Skip verification_commands.** Status `done` requires all commands green. No exceptions.
- ❌ **Mutate contract YAML after insert.** Source of truth is the row. Add events/artifacts, don't rewrite the contract.
- ❌ **Catch CycleError silently.** If insert throws cycle error — that's a planning bug, escalate to user.
- ❌ **Use task IDs across sessions.** Each project has its own DB; IDs are per-project.

## Cheatsheet

```bash
task init                                   # one-time per project
task list                                   # human view
task list --json                            # for jq/scripting
task list --status pending|in_progress|done|failed|blocked
task ready [--json]                         # tasks ready for dispatch
task show <id>                              # full contract + recent events
task logs <id>                              # full event stream from DB
task graph                                  # dependency tree
task export <id> [--out file.yaml]          # dump contract YAML
task insert <file.yaml>                     # insert (use '-' for stdin)
task update <id> --status <s> [--payload <json>]
task save-artifact <id> --kind <k>          # content from stdin
task artifacts <id> [--kind k] [--cat id]
task tail [-n 30] [--follow] [--json]       # JSONL lifecycle log (auto-written
                                            #   alongside DB at
                                            #   <cwd>/.claude/orchestrator-events.jsonl)
task journal                                # print event log path
task validate-result [--task-id <id>] [--json]
                                            # Parse + validate worker's YAML
                                            # result block from stdin against
                                            # TaskResultSchema. exit 0 = valid,
                                            # exit 1 = invalid (errors on stderr).
                                            # With --task-id, save as artifact +
                                            # emit 'verification' event.
task trace [-n 50] [-f] [-a agent] [--tool name] [--json]
                                            # Behavioral trace: every tool call
                                            # by orchestrator + workers. Captures
                                            # WHAT the agent did, not just task
                                            # status. File:
                                            #   <cwd>/.claude/orchestrator-trace.jsonl
                                            # Written by PreToolUse hook
                                            # orchestrator-trace.sh — only when
                                            # agent_type is dev-orchestrator,
                                            # worker-*, worker-refactor-architect, or
                                            # feature-planner.
task db                                     # print db path

## Two logs, two purposes

| File | Source | Contents | Use for |
|---|---|---|---|
| `orchestrator-events.jsonl` | mirror of `task_events` DB table | Lifecycle: created/started/completed/failed/comment | Task state history |
| `orchestrator-trace.jsonl` | PreToolUse hook | Every tool call by orchestrator/workers (Bash, Agent, Edit, Write, ...) | Verify the agent FOLLOWED THE PROTOCOL — did it call `task init` before `insert`? Did it spawn `worker-refactor-architect` for a refactor request? Did it run `verification_commands` before marking done? |

Both are JSONL, both grep-friendly. Combine for full picture:
```bash
cat .claude/orchestrator-events.jsonl .claude/orchestrator-trace.jsonl | \
  jq -s 'sort_by(.ts)' | less
```
```
