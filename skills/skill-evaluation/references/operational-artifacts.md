# Operational Artifacts (Roadmap-style Skills)

Anthropic Pattern 2 documents `references/` — but production skills often need more: templates, examples, scripts, checklists. This file documents the **roadmap-style** extension to Pattern 2 used by mature stack skills.

> Source: [roadmap.sh](https://roadmap.sh/) — community visual roadmaps for DevOps/Backend/Frontend tracks (PostgreSQL DBA, Node.js, React, etc.). Their tree-structured domain decomposition is the closest mental model to a complete domain skill.

## When you need operational artifacts

| Skill type | Add artifacts? |
|---|---|
| Tech stack (postgresql, nodejs, react) | **Yes** — produces real config files, code, deploy procedures |
| Tool wrapper (docker, terraform, kubernetes) | **Yes** — has templates and scripts |
| Process/methodology (clean-code, karpathy-guidelines) | **No** — no artifacts to template |
| Domain-narrow (copywriter, yandex-direct-ads) | **No** — different genre |
| Meta (skill-evaluation, project-actualizer) | **Partial** — checklists yes, templates no |

## Full layout (roadmap-style)

```
my-skill/
├── SKILL.md                       # navigator — small, almost never changes
├── references/                    # theory + domain knowledge
│   ├── REFERENCE.md
│   ├── domain-a.md
│   └── domain-b.md
├── templates/                     # boilerplates with placeholders
│   ├── postgresql.conf.template
│   ├── pg_hba.conf.template
│   └── docker-compose.template.yml
├── examples/                      # end-to-end input → output cases
│   ├── zero-downtime-add-column.md
│   ├── setup-pgbouncer.md
│   └── failover-drill.md
├── scripts/                       # validators, parsers, generators
│   ├── validate-config.sh
│   ├── parse-slow-queries.py
│   └── check-bloat.sh
├── checklists/                    # acceptance + pre-flight + self-check
│   ├── pre-migration.md
│   ├── pre-deploy.md
│   └── post-incident-review.md
└── assets/                        # diagrams, brand, fonts (if UI-related)
    └── architecture-diagram.svg
```

Each directory is **optional** — add only what gives concrete value. A `templates/` with one file is worth more than three empty placeholders.

## What goes where

### templates/

Concrete files with `{{placeholder}}` markers. The user/agent copies and fills in.

Good template:
```ini
# templates/postgresql.conf.template
# PostgreSQL 18.x — production preset for {{instance_size}}
shared_buffers = {{shared_buffers_mb}}MB    # rule: 25% of RAM
effective_cache_size = {{effective_cache_mb}}MB  # 75% of RAM
work_mem = {{work_mem_mb}}MB              # max_connections × parallelism
max_connections = {{max_connections}}
io_method = io_uring                       # PG 18 default
```

Bad template: a single working example with hardcoded values that can't be reused.

### examples/

End-to-end scenarios: problem → step-by-step → result. Show the **whole flow**, not just snippets.

Good example structure:
```markdown
# zero-downtime-add-column.md

## Scenario
Add a non-null column with a default value to a 50M-row Postgres table without locking.

## Approach: expand-and-contract

1. Add column as nullable
2. Backfill in batches
3. Set NOT NULL constraint with NOT VALID, then VALIDATE
4. Drop the nullable allowance

## Step 1: Add column as nullable
[exact SQL]

## Step 2: Backfill in batches of 10k
[exact script]

...

## Verification
[how to confirm no downtime occurred]

## Rollback
[if step N fails, how to undo]
```

### scripts/

Runnable utilities. Bash for ops, Python/Node for parsing. Each script:
- Has a shebang
- Has top-of-file comment explaining purpose + usage
- Validates inputs with helpful error messages
- Returns proper exit codes

Example:
```bash
#!/usr/bin/env bash
# scripts/check-bloat.sh — query PostgreSQL for table/index bloat
# Usage: ./check-bloat.sh [--threshold-pct 20] [--connection $DATABASE_URL]
set -euo pipefail
...
```

### checklists/

Pre-flight (before action), Acceptance (post-action), Self-check (during).

```markdown
# checklists/pre-migration.md

## Pre-flight checklist (run BEFORE the migration)
- [ ] Backup taken in last 1h (`pg_dump` or snapshot)
- [ ] Migration script reviewed by 2nd engineer
- [ ] Tested in staging with prod-scale data
- [ ] Rollback path written
- [ ] Maintenance window communicated (if needed)
- [ ] Monitoring alerts paused for downstream services

## Acceptance (run AFTER the migration)
- [ ] Schema diff matches expected
- [ ] Row counts match (pre vs post)
- [ ] Application health checks green for 15 min
- [ ] No new error spike in logs

## Self-check (model verifies before declaring done)
- [ ] No `DROP TABLE`/`DROP COLUMN` without `IF EXISTS`
- [ ] No `ALTER COLUMN ... SET NOT NULL` without backfill step
- [ ] All migrations are reversible OR explicit forward-only flag
```

### assets/

Diagrams, screenshots, fonts. Mostly for UI/brand-adjacent skills. Tech skills rarely need this.

## Anti-triggers in description

For routing disambiguation, add explicit **skip rules** to description. Example from `claude-api`:

```yaml
description: |
  ...
  TRIGGER when: code imports `anthropic`/`@anthropic-ai/sdk`; user asks for the Claude API.
  SKIP: file imports `openai`/other-provider SDK, filename like `*-openai.py`.
```

Anti-triggers are most valuable when two skills could plausibly match the same query.

## Eval cases

Test prompts that should/shouldn't activate the skill. Document them somewhere readable (e.g., `references/eval-cases.md`):

```markdown
# eval-cases.md — routing tests for postgresql skill

## Should activate (positive cases)
- "Optimize this query: SELECT ..."
- "How do I add an index in Postgres?"
- "PG 18 async I/O configuration"
- "Set up streaming replication"

## Should NOT activate (negative cases)
- "What's the difference between SQL and NoSQL?" → database (umbrella)
- "How to migrate from MySQL to Postgres?" → database (umbrella, migration scope)
- "Apollo Federation schema design" → graphql

## Edge cases
- "PostgreSQL vs MongoDB for time-series" → database (architecture decision)
```

Run these eval prompts periodically to catch routing regressions.

## SemVer + CHANGELOG

A skill is code. Apply SemVer:

- **Major** (`v2.0.0`) — breaking changes (renames, removed references, restructure)
- **Minor** (`v1.5.0`) — new references, new templates, new triggers
- **Patch** (`v1.5.3`) — typo fixes, link updates, content polish

Track in `CHANGELOG.md` at skill root:
```markdown
# postgresql skill — CHANGELOG

## [2.0.0] — 2026-05-15
### BREAKING
- Merged `postgresql-optimization` into this skill (umbrella)
- Renamed `optimization.md` → `query-optimization.md`

## [1.4.0] — 2026-05-08
### Added
- `pg18-features.md` — async I/O, UUIDv7, virtual columns

## [1.3.2] — 2026-04-22
### Fixed
- Broken link in indexing.md
```

This matters when projects pin skill versions or when reviewing what changed.

## Composition (skill calls skill)

A high-level umbrella skill (e.g., `database`) references narrower ones (`postgresql`, `prisma-expert`). Document the composition explicitly in `## Related Skills`:

```markdown
## Related Skills

Hands off to:
- `postgresql` — PostgreSQL-specific patterns (schema, optimization, ops)
- `prisma-expert` — Prisma ORM specifics
- `sql-pro` — cross-database SQL patterns (CTEs, window functions)
```

The umbrella **routes by topic**; the narrow skill **executes by detail**.

## What this changes for existing skills

Most existing skills don't need a retrofit. Add operational artifacts ONLY when:

1. The skill is heavily loaded (frequent routing) AND
2. Users repeatedly ask for the same templates or procedures
3. There's a concrete operational artifact (not just theory)

For 2026, the high-value candidates in our repo:
- `postgresql` — DBA templates, backup/replication scripts, checklists
- `nodejs` — production checklists, error-handling templates, monitoring scripts
- `docker` — Dockerfile templates per stack, compose templates, scout scripts
- `linux-sysadmin` — incident checklists, log-parsing scripts, hardening checklists
- `terraform` — module templates, OIDC setup templates, drift scripts
- `nextjs`, `react` — boilerplate configs, lighthouse-validation scripts

Don't retrofit everything. Add artifacts when a user demonstrably needs them.
