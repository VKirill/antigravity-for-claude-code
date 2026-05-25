# Verifier subagent design

The single best-validated subagent pattern. From Anthropic's Jan 2026 post:

> "One multi-agent pattern that consistently works well across domains is the verification subagent."

> "Verification subagents succeed because they sidestep the telephone game problem. Verification requires minimal context transfer by nature."

Most subagents in a healthy `.claude/agents/` directory should be verifiers. Kirill's ready-made set includes three: [test-verifier](../agents/test-verifier.md), [security-verifier](../agents/security-verifier.md), [payments-verifier](../agents/payments-verifier.md).

## Anatomy of a verifier

Receives:
1. The **artifact** (file diff, commit, list of changed paths)
2. **Success criteria** (what passing means)
3. **Tools to verify** (test runner, linter, security scanner)

Returns:
1. **PASSED / FAILED / INCONCLUSIVE**
2. **List of issues** if FAILED (file:line, severity, specific error)

Does NOT receive:
- The reasoning for *why* the artifact was built that way
- Full conversation history
- Context about prior attempts

**This is the point.** Blackbox testing avoids context pollution.

## The Early Victory Problem

The most common, most expensive verifier failure mode. From the doc:

> "The most significant failure mode for verification subagents is marking outputs as passing without thorough testing. The verifier runs one or two tests, observes them pass, and declares success."

### Mitigation (Anthropic's verbatim guidance)

> "Concrete criteria. Specify 'Run the full test suite and report all failures' rather than 'make sure it works.'
>
> Comprehensive checks. Require the verifier to test multiple scenarios and edge cases.
>
> Negative tests. Direct the verifier to attempt inputs that should fail and confirm they do.
>
> Explicit instructions. The instruction 'You MUST run the complete test suite before marking as passed' is essential. Without explicit requirements for comprehensive validation, verification agents take shortcuts."

The phrase **"You MUST run the complete <X> before marking as passed"** is non-negotiable. Not "should". Not "please". MUST.

## Three-valued verdict (PASSED / FAILED / INCONCLUSIVE)

A verifier that returns only PASSED/FAILED can lie by omission. INCONCLUSIVE handles:
- Couldn't run all checks (timeout, missing tool, network failure)
- Partial run by design (user asked for fast mode)
- Ambiguity in criteria

INCONCLUSIVE is always preferable to a fake PASSED.

## Standard verifier types

For full ready-to-use agents, see `agents/`:
- [test-verifier.md](../agents/test-verifier.md) — runs full pytest/vitest/jest suite
- [security-verifier.md](../agents/security-verifier.md) — six-category security sweep
- [payments-verifier.md](../agents/payments-verifier.md) — high-stakes CloudPayments/YooKassa check

Use those as templates if you need a new verifier (e.g., schema-verifier, performance-verifier).

## Bash-validation pattern for tool-restricted verifiers

When you need a verifier to run *only* specific commands, use `PreToolUse` hook:

```yaml
tools: Bash
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "${CLAUDE_SKILL_DIR}/../scripts/validate-<operation>.sh"
```

Companion script reads JSON from stdin, exits 2 (block) if command isn't in allowlist.

Canonical example: [db-reader agent](../agents/db-reader.md) + [validate-readonly-db.sh script](../scripts/validate-readonly-db.sh).

## The verification loop

```python
def implement_with_verification(requirements, max_attempts=3):
    for attempt in range(max_attempts):
        result = main_agent.implement(requirements)
        verification = verifier_subagent.verify(result, requirements)
        if verification['passed']:
            return result
        requirements += f"\n\nPrevious attempt failed: {verification['issues']}"
    raise Exception(f"Failed verification after {max_attempts}")
```

In Claude Code, this loop is the main agent's job. Main invokes verifier, reads digest, fixes or accepts, loops as needed.

## Chaining verifiers

After implementation:

```
implementation
   ↓
test-verifier    (does it work?)
   ↓ in parallel with ↓
security-verifier (does it leak?)
   ↓
ready for human review
```

Verifiers are independent — can run in parallel. Their digests merge into a single verification report main presents to user.

## What verifiers do NOT do

- **Don't fix.** They report. Main fixes (or escalates).
- **Don't have memory of past runs.** Each invocation is fresh.
- **Don't infer intent.** They check artifacts against criteria.

## When NOT to write a verifier

- "Verification" is one bash command → just have main run it
- No stable criteria → verifier becomes "ask LLM if code looks good" = useless noise
- The check is iterative → loop belongs in main, not in the verifier

## Differentiation from `general-purpose`

`general-purpose` can do verification. Reasons to write a custom verifier:

1. **Stable description for auto-delegation** — fires automatically
2. **Restricted tools** — `Read, Bash` only is safer than full toolset
3. **Standing rules in body** — "MUST run complete X" lives in system prompt
4. **Model and effort tuning** — pin to `opus, effort: high` independently of main

If you can't justify any of these — use `general-purpose`.

## Bottom line

Verifiers are the **most reliable, most useful** custom subagent pattern:
- Sidestep telephone game by design
- Catch Early Victory with explicit "MUST" instructions
- Compose well (test + security + payments in parallel)
- Justify with concrete artifacts (the verification report)

In Kirill's stack: three of the five ready-made agents are verifiers. That's the right ratio.
