# Cascade Generation (Zero-Baseline)

How to grow the active skills set: **always generate from scratch under current popular stacks**. The archive is historical reference only — never restore content from it.

## Core principle

> Когда нужен новый скилл — пишем его с нуля под актуальные best practices.
> Archive — это исторический backup для просмотра, не источник для копирования.

## Why zero-baseline (not restore)

The archive (`~/.claude/skills.archive/`) holds 60 skills from earlier work. They're frozen at the May 2026 snapshot. Even days later they may drift from current reality:

- Versions move (Vue 3.5 → 3.6, Next 16 → 17, etc.)
- Patterns evolve (today's "best practice" gets deprecated)
- Anthropic spec changes (new directives, new conventions)
- Our own skill-evaluation standards evolve (cascade-generation.md is itself a result)

Restoring old content carries forward stale assumptions. Generating fresh under current popular stacks guarantees alignment with today's reality.

## State of the world

| Location | Role |
|---|---|
| `~/.claude/skills/` | **Active set** — Claude routes through these |
| `~/.claude/skills.archive/` | **Historical reference** — read for inspiration, never copy into active set |

## Generation workflow

When a new skill is needed:

```
1. Identify the domain noun (`fastapi`, `bun`, `kubernetes`, ...).
2. Fetch current authoritative docs via Context7 / Tavily / official source.
   Pin the version that's current TODAY.
3. Apply skill-evaluation v3 standards:
     - description (≤ 600 chars, trigger terms, anti-triggers, no migration creep)
     - Pattern 2 references/ (SKILL.md ≤ 250 warn / 500 hard)
     - operational artifacts (templates/, examples/, scripts/, checklists/) where useful
     - eval-cases.md (user-voice phrasing + Expected behavior column)
     - CHANGELOG.md starting at v1.0.0
     - if risk: high-stakes → references/troubleshooting.md
     - if has operational knobs → references/recommended-defaults.md
4. Derive ## Related Skills SEMANTICALLY — based on what the new skill
   technically/operationally depends on, NOT old SKILL_STACKS mappings.
5. If version-sensitive: add to STACK_VERSIONS.md + PINS + SKILL_STACKS; run sync.
6. Verify ALL imports and API calls (see "Anti-hallucination rules" below).
7. Commit with CHANGELOG entry.
```

## Anti-hallucination rules (mandatory)

**Why this section exists:** dual-review of bullmq (May 2026) caught two hallucinated imports — `RateLimiterPg from 'bullmq'` (doesn't exist; lives in `rate-limiter-flexible`) and `import { Type } from 'typebox'` (TypeBox 1.x uses default export, not destructured). Both passed Context7-aware generation because the agent **paraphrased** snippets instead of pasting verbatim.

### Verbatim-snippet rule

For ANY of these in references/ / templates/ / examples/:
- Import statements (`import { X } from 'pkg'` / `import X from 'pkg'`)
- API call signatures with named methods (`prisma.$transaction(...)`, `worker.rateLimit(...)`)
- Configuration object keys for the library (`{ sandbox_mode, approval_policy }`)

The rule: **paste the Context7 snippet verbatim with attribution**:

````md
```ts
// Source: https://github.com/openai/codex/blob/main/codex-rs/core/src/config/config_tests.rs
sandbox_mode = "workspace-write"

[sandbox_workspace_write]
network_access = true
```
````

Paraphrase the prose *around* the snippet. Do not paraphrase the import line itself.

### Post-generation Context7 cross-check

After writing each `import { X, Y, Z } from 'pkg'` line, the generator agent MUST run:

```
mcp__context7__query-docs({
  libraryId: <resolved pkg id>,
  query: "named exports from <pkg> — show all imports of X, Y, Z"
})
```

If a named export doesn't appear in Context7's response → **suspect hallucination**, rewrite using documented surfaces.

### Version-rename trap

Some libraries renamed their npm package across majors. Common traps:
- TypeBox: `@sinclair/typebox` (0.34.x, named `{ Type }`) → `typebox` (1.x, default `Type`)
- BullMQ → Bull (different package, not just rename): `bull` vs `bullmq` are coexisting
- Faker: `faker` (legacy) → `@faker-js/faker` (current)
- Cypress: `cypress` is fine, but several plugin namespaces moved

Rule: when Context7 returns multiple versions of the same library, **ask: "which package name + import style is current for the pinned major?"** Don't mix.

### Lint code-fences (recommended, not yet automated)

Tooling-wise, `.md` code-fences and `.template` files bypass TypeScript LSP. A pre-commit step can extract code-blocks and run `tsc --noEmit` against them to catch undefined imports. Not yet wired in our repo; add when audit cadence becomes painful.

## Related Skills derivation (semantic, not historical)

For each candidate Related Skill, check:

| Question | Include? |
|---|---|
| Is it currently in `~/.claude/skills/`? | Yes → include as bidirectional hand-off |
| Is it technically required (runtime, ORM, deploy platform)? | Yes → include even if not active (cascade hint) |
| Was it in the old skill's Related Skills? | **Irrelevant** — don't look |
| Is it from the same era but different framework? | Yes if mainstream today, No if dying |

Example: when generating `fastapi` today (plain name per naming convention):

```markdown
## Related Skills

Works with:
- **Language runtime**: `python` (Python 3.14 patterns, async)             [not yet active — cascade marker]
- **Data validation**: `pydantic` (Pydantic 2.13 model patterns)           [not yet active]
- **ORM**: `sqlalchemy` (SQLAlchemy 2.0 async session patterns)            [not yet active]
- **Deploy**: `linux-sysadmin` (PM2/systemd for Python services)           [active ✓]
- **Background**: `celery` or `arq` (Python queues)                        [not yet active]
- **Observability**: `opentelemetry-python` (OTLP, tracing)                [not yet active]
```

Note: Related Skills doesn't try to recreate old chain. It documents the **natural neighborhood** of the new skill **as it exists today**. Some entries are cascade markers — they don't exist yet, but signal "if this domain becomes active, here's where to link".

## What to do with old SKILL_STACKS entries

`~/.claude/scripts/sync_skill_versions.py` currently has 4 active mappings (nodejs, astro, telegram-bot, linux-sysadmin). The archived 60 skills are **not** mapped.

When generating a new skill, add a fresh mapping under a **plain library name** (see naming-and-frontmatter.md). Do NOT carry the archive's old suffixed names (`fastapi-pro`, `prisma-expert`, etc.) into the new mapping.

```python
# WRONG (legacy thinking — carries archive suffix forward)
SKILL_STACKS = {
    ...
    "fastapi-pro": ["FastAPI", "Python", "Pydantic", "SQLAlchemy"],
}

# RIGHT (fresh generation, plain name)
SKILL_STACKS = {
    ...
    "fastapi": ["FastAPI", "Python", "Pydantic", "SQLAlchemy"],
}
```

The shape may coincide with the old skill's stack list — but the **skill name is plain** (`fastapi`, not `fastapi-pro`), and the version values come from current `STACK_VERSIONS.md`. If today's FastAPI moved off SQLAlchemy preference toward, say, SQLModel — the mapping would reflect that.

## When archive content might inform (but never replace) generation

Three legitimate uses for reading archive content:

1. **Lessons learned** — old skill noted edge cases or anti-patterns specific to your real projects. Worth re-reading once, then rewriting cleanly.
2. **Naming consistency** — keep `fastapi-pro` name if archive used it, to maintain mental model. Don't invent `fastapi-expert` just because.
3. **Operational artifacts that are still valid** — e.g., a `pre-deploy.md` checklist from `nodejs/` was generic enough to inform the new `fastapi-pro/checklists/pre-deploy.md`. Inspiration ≠ copy.

In all three cases, the new skill is **authored fresh**. Archive is reference material, not template.

## What to do with archive over time

Recommendation: **leave alone**. Don't actively curate. After 3-6 months:

- Skills in archive that proved useful → regenerated cleanly into active set (replacing the archived version conceptually)
- Skills in archive that were never needed → can be deleted en masse

For now: archive sits at `~/.claude/skills.archive/`, 60 directories, ~19 MB. Cost is negligible.

## Popular stacks to generate from when needed

Default modern stacks (May 2026 reality) for cascade generation. Pin from `STACK_VERSIONS.md`. Names use **plain library name** convention (see naming-and-frontmatter.md):

| Domain | Stack | Skill name to generate |
|---|---|---|
| **Web backend (Node)** | Fastify 5, Hono 4, Express 5 | `fastify`, `hono`, `express` |
| **Web backend (Python)** | FastAPI 0.136, Django 6 | `fastapi`, `django` |
| **Frontend (React)** | React 19, Next.js 16 | `react`, `nextjs` |
| **Frontend (Vue)** | Vue 3.5, Nuxt 4 | `vue`, `nuxt` |
| **Static** | Astro 6 | `astro` (active ✓) |
| **Mobile** | RN 0.85, Expo 55, Flutter 3.44 | `react-native`, `expo`, `flutter` |
| **DB** | PostgreSQL 18, Redis 8 | `postgresql`, `redis` |
| **ORM** | Prisma 7, SQLAlchemy 2 | `prisma`, `sqlalchemy` |
| **Queue** | BullMQ 5 | `bullmq` |
| **Container** | Docker 29 | `docker` |
| **IaC** | Terraform 1.x, OpenTofu | `terraform` |
| **AI/LLM** | LangChain 1.x, PyTorch 2.11 | `langchain`, `pytorch` |
| **Testing** | Jest 30, Vitest 4, Playwright 1.60 | `testing` (umbrella) или `jest`, `vitest`, `playwright` (узкие) |
| **Lang** | TypeScript 5.9, Python 3.14, PHP 8.5 | `typescript`, `python`, `php` |
| **AI agent eval** | LLM benchmarks, behavioral tests | `agent-evaluation` (active ✓) |
| **Domain app** | Telegram bots, Discord bots | `telegram-bot` (active ✓), `discord-bot` |
| **Ops methodology** | Production server, incident handling | `linux-sysadmin` (active ✓), `incident-response` |

This list is the **stack roadmap**. When the user starts work that touches a stack, generate the corresponding skill from scratch — pinned to the version above, structured per skill-evaluation v2.

## Trigger to generate

A skill should be generated when ALL of:
1. The user starts real work in that domain (not hypothetical "might need someday")
2. No active skill covers it (verify: `ls ~/.claude/skills/<candidate>` returns empty)
3. The stack is genuinely relevant to user's projects

Don't preemptively generate the entire 14-stack matrix above. Generate lazily on first real touch.

## How a fresh skill takes shape (template)

```
~/.claude/skills/<new-skill>/
├── SKILL.md                              # 200–450 lines per Pattern 2
├── CHANGELOG.md                          # starts at v1.0.0 = generation event
├── references/                           # 4–8 domain files
│   ├── REFERENCE.md
│   ├── eval-cases.md                     # positive + negative routing tests
│   └── <domain-files>.md
├── templates/                            # (optional) boilerplates with {{placeholders}}
├── examples/                             # (optional) end-to-end scenarios
├── scripts/                              # (optional) validators/parsers
└── checklists/                           # (optional) pre-flight, acceptance
```

Each generation = ~30-60 minutes of focused work (or one background agent). No shortcuts that copy from archive.

## Anti-patterns to avoid

| Anti-pattern | Why bad |
|---|---|
| Restoring from archive without re-checking versions | Stale assumptions baked in |
| Copying Related Skills wholesale from old SKILL.md | Old chain may include archived neighbors that no longer reflect today's stack |
| Generating "just in case" before real task | Bloats active set, increases routing competition |
| Re-implementing identical patterns across siblings | Better: one umbrella skill covers many narrow concerns |
| Skipping eval-cases for fresh skill | No regression check possible later |
| Using "as of <today's date>" prose in body | Version block already covers this — body must stay version-agnostic |

## One-liner: generate a fresh skill now

If the user explicitly asks to generate a skill:

1. Confirm the domain noun
2. Confirm the version pin (from STACK_VERSIONS.md or fetch live via Context7)
3. Dispatch a background agent with `skill-evaluation` standards as input + popular-stacks table above as version source
4. Verify on completion: SKILL.md < 500, references/ all linked, eval-cases.md present, CHANGELOG.md at v1.0.0
5. Update `sync_skill_versions.py` SKILL_STACKS if version-sensitive
6. Run `python3 ~/.claude/scripts/sync_skill_versions.py`

Total: one explicit user prompt → fully generated, ready-to-route skill.
