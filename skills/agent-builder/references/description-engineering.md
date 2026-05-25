# Description engineering

The `description` field is the most important line in any subagent file. If it doesn't match how a user phrases requests, Claude never delegates and your subagent is dead weight.

## How auto-delegation works

> "Claude uses each subagent's description to decide when to delegate tasks."

At runtime Claude sees: user's message, descriptions of all available subagents (across user/project/plugin scopes), descriptions of built-ins. Then it picks one — or none.

## Anatomy of a good description

```
<role noun>. <what it does, concretely>. Use <proactively / when X / immediately after Y>. <trigger-term list>.
```

### Part 1: role noun

Front-load the noun the user thinks in.

✅ `Expert test-runner.`
✅ `Senior security reviewer.`
✅ `Payments integration verifier.`

❌ `A helpful assistant that...` (generic, no anchor)

### Part 2: what it does, concretely

Specifics. Mention tools/domains the user types about.

✅ `Runs the full pytest/vitest/jest test suite, parses output, returns only failing tests with file:line.`

❌ `Checks code quality.` (vague)

### Part 3: invocation cue

> "To encourage proactive delegation, include phrases like 'use proactively' in your subagent's description field." — Anthropic doc

- `Use proactively after <event>.` — for verifiers
- `Use immediately after <event>.` — stronger
- `Use when user asks <about X / for Y>.` — for user-driven tasks

### Part 4: trigger-term list (incl. Russian for Kirill's stack)

Pack synonyms users actually type.

```yaml
description: Expert test-runner. Runs pytest/vitest/jest, parses output, returns only failing tests with file:line. Use proactively after any code edit. Use when user asks to test, run tests, check the build, verify changes, или проверить тесты, прогнать тесты, убедиться что не сломал.
```

Not elegant prose. It's an SEO problem. Treat it like one.

## Description templates by agent type

### Verifier

```
description: <Domain> verifier. <Specific check>. Use proactively after <trigger event>. Use when user asks to <verify words, RU + EN>.
```

### Planner-with-stop

```
description: <Domain> planner. Produces SPEC.md + checklist + file budgets. Read-only — does NOT implement. Use when user asks to plan, design, scope, спланировать, набросать, распланировать.
```

### Tool-restricted operator

```
description: <Restricted operation>. Enforces <constraint> via <mechanism>. Use when user needs <safe variant of operation>.
```

### High-volume isolator

```
description: <Operation producing big output> isolator. Runs <operation>, returns only <digest>. Use proactively when <task implies big output>.
```

## Anti-patterns

### "I'm a helpful agent"

❌ `description: A helpful AI agent that assists with various coding tasks.`

Matches nothing specific. Never delegated.

### Agent's POV instead of user's

❌ `description: I am an agent that reviews code.`

Write from user's POV. ✅ `Code reviewer. Use when user asks to review, audit, check code.`

### Over-narrow

❌ `description: Reviews pull requests for the auth module.`

Misses 90% of cases. Generalize, then narrow via "use when".

### Shadow of built-in

❌ `description: Searches the codebase to find files matching a query.`

That's built-in `Explore`. Differentiate or delete.

## Testing your description

Before committing:

1. Read it aloud — does it sound like a job listing, or like marketing copy? Job listing = good.
2. Find your trigger terms — verbs and nouns a user would type?
3. Imagine the user message — would your description match it?
4. Compare to built-ins — clearly differentiated from Explore/Plan/general-purpose?
5. Add to eval-cases.md — 3 positive, 3 negative prompts.

## When auto-delegation isn't working

Symptoms:
- "test this" goes to main instead of `test-verifier`
- Claude delegates to `general-purpose` instead of your domain-specific agent

Diagnosis:
1. **Description too vague** — add trigger terms
2. **Shadows built-in** — differentiate
3. **Missing "use proactively"** — add it
4. **Name conflict** — check duplicates across scopes
5. **Scope priority** — managed > CLI > project > user > plugin

Workaround for testing: force via `@-mention` (`@agent-test-verifier`). If forced works but auto doesn't, description is the bottleneck.

See [troubleshooting.md](troubleshooting.md) for symptom-indexed diagnosis.
