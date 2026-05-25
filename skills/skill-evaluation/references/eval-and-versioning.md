# Eval Cases & Skill Versioning

Skills are code. Test them, version them, track changes.

## Eval cases — what they prove

An eval case is a **prompt + expected behavior**. Three categories:

1. **Positive routing** — prompts that SHOULD load this skill
2. **Negative routing** — prompts that should NOT load this skill (would be wrong match)
3. **Output behavior** — once loaded, does the skill produce the right artifact?

For most skills only (1) + (2) matter. Output evals are for code-generation skills.

## Where to store eval cases

Option A: `references/eval-cases.md` inside the skill — visible to humans, not loaded into model context unless asked.

Option B: a project-level `~/.claude/evals/` directory with per-skill test files — separates eval data from documentation.

We use **Option A** (inline) because it keeps the skill self-contained and reviewers see them next to the description.

## Eval case format

Two rules tightened post-May-2026 review:

1. **User-voice phrasing** — prompts should match what users *actually type*, not what an engineer would write in a JIRA ticket. Mix Russian/English where natural. Include incomplete sentences, typos, vague verbs ("у меня воркер тормозит", "почему jobs копятся", "redis жрёт память").
2. **Expected behavior column** — what content/files should be loaded, not just "this skill activates". Helps the audit catch wrong sub-domains.

```markdown
# bullmq — Eval Cases

## Positive — should activate

| User-voice prompt | Expected behavior |
|---|---|
| "у меня воркер тормозит и jobs застряли в waiting" | Activate bullmq; load references/production-patterns.md (stalled-jobs) + references/troubleshooting.md (workers don't start) |
| "как сделать DLQ для упавших задач" | Activate bullmq; load references/production-patterns.md (DLQ pattern) + examples/webhook-flow-dead-letter.md |
| "rate limit 100 jobs / minute" | Activate bullmq; load references/concurrency-and-rate-limit.md; cite the recommended-defaults `limiter` config |
| "повторяющаяся задача каждое утро" | Activate bullmq; load references/job-options.md (repeat); cite templates/repeating-job.ts.template |
| "BullMQ migration from Bull" | Activate bullmq; load references/migration.md |

## Negative — should NOT activate

| User-voice prompt | Should route to | Why |
|---|---|---|
| "Celery best practices for retries" | (no skill) — Python tool | Out of scope; bullmq is Node-only |
| "Inngest vs Trigger.dev" | (no skill — SaaS comparison) | SKIP rule applies |
| "Redis HSET command syntax" | redis | Pure Redis question, not queue |
| "Telegram bot reply to message" | telegram-bot | Different domain |
| "raw bash background job" | nodejs / linux-sysadmin | OS-level, not queue |

## Edge cases

| User-voice prompt | Resolution |
|---|---|
| "распределить задачи между серверами через Redis" | Ambiguous — could be bullmq OR redis pub-sub. Default to bullmq if user mentions "job/queue/worker"; redis if "channel/pub-sub". |
| "Bull legacy migration to BullMQ 5" | Both `bull` and `bullmq` keywords. Activate bullmq + load references/migration.md. |
| "BullMQ Pro group keys" | bullmq covers Pro distinction but does not deep-dive Pro features; flag as "for Pro see official docs". |
```

The two key differences vs the older format:
- "Why" column → "Expected behavior" — forces you to say which sub-file/template should load, not just which skill
- Prompts include user-voice phrasings (Russian, typos, incomplete) — not engineer-polished requirements

## Running evals

There is no automated runner in Claude Code (yet). Manual procedure:

1. Open a fresh session
2. Paste each "positive" prompt → confirm the right skill is mentioned in the system reminder
3. Paste each "negative" prompt → confirm this skill is **not** mentioned
4. If something routes wrong, adjust the `description` trigger terms

When you change a skill's description, re-run the evals — that's the regression check.

## Versioning

Apply SemVer at the skill level. Bump rules:

| Change | Bump |
|---|---|
| Reword description without changing routing scope | Patch (1.2.X) |
| Fix typo in references | Patch |
| Add a new reference file | Minor (1.X.0) |
| Add a new trigger term that captures previously-missed prompts | Minor |
| Remove a reference (or rename one) | Major (X.0.0) |
| Restructure references/ layout | Major |
| Rename the skill itself | Major |
| Merge two skills into an umbrella | Major (both sources gone) |

## Where to record version

Two options. Pick one per skill — be consistent.

### Option A: frontmatter `version` field

```yaml
---
name: postgresql
version: 2.0.0
description: "..."
---
```

Simple. Visible. Not auto-bumped — you update it manually when you commit.

### Option B: CHANGELOG.md at skill root

```
postgresql/
├── SKILL.md
├── CHANGELOG.md       # versioned history
└── references/
```

More detail. Better for high-traffic skills where multiple people contribute.

## CHANGELOG.md template

```markdown
# postgresql — CHANGELOG

All notable changes to this skill follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and SemVer.

## [Unreleased]

## [2.0.0] — 2026-05-15
### Changed (BREAKING)
- Merged `postgresql-optimization` into this skill — now a single umbrella

### Added
- `references/pg18-features.md` — async I/O, UUIDv7, virtual columns, RETURNING OLD/NEW
- `references/operations.md` — VACUUM, replication, backups

### Removed
- Old `references/REFERENCE.md` (split into domain files)
- `postgresql-optimization` skill (merged here)

## [1.4.0] — 2026-05-08
### Added
- PG 18 features documented
- Async I/O configuration patterns

## [1.3.0] — 2026-03-12
### Added
- `references/indexing.md` — B-tree, GIN, GiST, BRIN, partial, covering
- pgvector section
```

## When evals catch problems

Most common failure modes our evals would catch:

1. **Description too generic** — Claude doesn't load skill when it should. Symptom: positive case fails.
2. **Description over-triggers** — Claude loads skill for unrelated queries. Symptom: negative case fails.
3. **Trigger term ambiguity** — Two skills share a trigger; neither disambiguates. Symptom: both load (wasteful) or wrong one loads. Fix: add anti-trigger to description.
4. **Stale triggers** — Skill renamed but old name still appears in description body. Symptom: routing inconsistent.

For each fix, bump SemVer accordingly and update CHANGELOG.

## Skill composition (skill calls skill)

A high-level umbrella references narrow skills. Composition is implicit — Claude loads multiple if relevant — but be explicit in `## Related Skills`:

```markdown
## Related Skills

For deep specialization, hand off to:
- `postgresql` — PG-specific (schema, optimization, ops)
- `prisma-expert` — Prisma ORM details
- `sql-pro` — cross-DB SQL patterns

This skill (`database`) routes architectural decisions; narrow skills handle implementation detail.
```

Cross-reference helps the user/agent understand the hierarchy and prevents Claude from re-implementing what a narrower skill already covers.

## Owners and review

For team-shared skills, list an owner in frontmatter:

```yaml
---
name: postgresql
owners: ["@vechkasov"]
review-cadence: monthly
last-reviewed: 2026-05-15
---
```

This is convention, not required by Anthropic spec. But it answers "who do I ping when this is stale?"
