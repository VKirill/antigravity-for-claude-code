# Common Anti-Patterns

Real examples from our repo, with the fix.

## 1. Empty `### ❌ Anti-Pattern` headings

### Bad (from `bullmq-specialist` before fix)
```markdown
## Anti-Patterns

### ❌ Giant Job Payloads

### ❌ No Dead Letter Queue

### ❌ Infinite Concurrency
```

Section bodies are empty. Reader sees titles, learns nothing.

### Good
Either fill in each body with a paragraph of explanation, OR move them into the `## Important Constraints` section as `NEVER` rules with the reason inline:

```markdown
## Important Constraints

- NEVER store buffers, streams, or class instances in job data — only JSON-serializable values
- NEVER set `concurrency: Infinity` — Redis maxclients and Node event loop will choke
- NEVER skip `removeOnComplete` — unbounded retention is the #1 Redis OOM cause
```

## 2. Sharp Edges with placeholder `// comment` solutions

### Bad (from `agent-evaluation`)
```markdown
## ⚠️ Sharp Edges

| Issue | Severity | Solution |
|-------|----------|----------|
| Agent scores well on benchmarks but fails in production | high | // Bridge benchmark and production evaluation |
| Same test passes sometimes, fails other times | high | // Handle flaky tests in LLM agent evaluation |
```

The "solution" column is a placeholder comment, not an actual solution. This is a half-finished scaffold.

### Good

Either write the real solution inline, OR replace with a reference to the file that explains it:

```markdown
| Agent scores well on benchmarks but fails in production | high | Add canary evaluation set sampled from prod traffic; see [reliability-metrics.md](references/reliability-metrics.md) |
```

## 3. Generic `## When to Use` boilerplate

### Bad (from `agent-evaluation`)
```markdown
## When to Use
This skill is applicable to execute the workflow or actions described in the overview.
```

Meaningless. Adds no signal for routing.

### Good

Use the `## Use this skill when` and `## Do not use this skill when` sections with concrete bullet points:

```markdown
## Use this skill when

- Designing an evaluation suite for an LLM agent (RAG, tool-use, coding agent)
- Investigating flaky agent behavior over multiple runs
- Adding production monitoring (LangSmith, Arize Phoenix)

## Do not use this skill when

- You need to write the agent itself — use `llm-app-patterns` or `langchain-architecture`
- The task is unit-testing traditional code — use `testing-patterns`
```

## 4. Dash-list `## Capabilities` with no bodies

### Bad (from `graphql`)
```markdown
## Capabilities

- graphql-schema-design
- graphql-resolvers
- graphql-federation
- graphql-subscriptions
- graphql-dataloader
```

These are tag identifiers, not capabilities. A reader can't tell what the skill actually offers for each item.

### Good

Use subsections with real content:

```markdown
## Capabilities

### Schema design

Schema is the API contract — design it first. Default to **non-null** for fields that always exist; use **nullable** when absence is meaningful (failed authorization, deleted resource, async-not-ready). Pagination via Relay-style connections for >100 items. See [reference/schema-design.md](reference/schema-design.md).

### Resolvers and DataLoader

N+1 prevention is mandatory at any scale. Wrap every collection field with DataLoader from `request-scope`. See [reference/dataloader-n-plus-1.md](reference/dataloader-n-plus-1.md).
```

## 5. Truncated content from generation

### Bad (from `agent-evaluation`)
```markdown
You've built evaluation frameworks that catch issues before production: behavioral regression
tests, capability assessments, and reliability metrics. You understand that the goal isn't
100% test pass rate—it
```

Sentence cuts off mid-thought. Generated content was truncated; nobody fixed it.

### Good

Always read the SKILL.md end-to-end after a generation. If a sentence cuts off, finish it (or delete it).

## 6. Stale frontmatter description after content refactor

### Bad

After rewriting body for Vue 3.5 + Nuxt 4, but frontmatter still reads:
```yaml
description: "Vue 3 + Nuxt 3 development. ..."
```

Claude routes by description. Stale description = wrong routing.

### Good

Update description in lockstep with body refactor:
```yaml
description: "Vue 3.5 + Nuxt 4 development. ..."
```

## 7. Hardcoded versions in body prose

### Bad
```markdown
## Capabilities

### Redis 7+ patterns

Redis 7 introduced...
```

After bumping to Redis 8, this prose contradicts the version block.

### Good

Reference the pinned version generically:
```markdown
### Patterns for current Redis

See version block above. Current major (`8.x`) ships with built-in JSON/Search/TimeSeries modules.
```

Or move version-specific content into a versioned reference file like `redis-8-migration.md` that's clearly time-bound.

## 8. Orphan reference files

### Bad

`my-skill/references/advanced-patterns.md` exists, but SKILL.md's `## API Reference` table doesn't list it. Claude has no signal to read it.

### Good

Every file in references/ MUST appear in the SKILL.md table:

```markdown
| Topic | File |
|---|---|
| Basic patterns | [references/patterns.md](references/patterns.md) |
| Advanced patterns | [references/advanced-patterns.md](references/advanced-patterns.md) |  ← was missing
```

## 9. Generic `## Limitations` boilerplate (vibeship-spawner)

### Bad
```markdown
## Limitations

- Use this skill only when the task clearly matches the scope above.
- Do not treat the output as a substitute for environment-specific validation, testing, or expert review.
- Stop and ask for clarification if required inputs, permissions, safety boundaries, or success criteria are missing.
```

These are template defaults that apply to every skill. They add no skill-specific signal and waste body space.

### Good

Replace with concrete `## Important Constraints` for THIS skill:

```markdown
## Important Constraints

- NEVER skip schema validation in resolvers — partial-input attacks exploit nullable fields
- NEVER expose raw database errors in GraphQL responses — clients will infer schema from error messages
- ALWAYS disable introspection in production
```

## 10. Time-sensitive prose

### Bad
```markdown
As of May 2026, Next.js 16 is the current major version. After May 2026 the proxy.ts rename ships.
```

This rots immediately. Future readers see "as of May 2026" and don't know if it's still true.

### Good

Move version-specific claims to the version block (sync-managed) or a clearly-dated migration reference. SKILL.md body should be version-agnostic except where versions are an intrinsic part of the topic (in which case use the version block as the canonical source).
