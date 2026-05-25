---
name: skill-evaluation
description: "Audit, rewrite, and design Claude Code skills per Anthropic's Agent Skills best practices. Use when creating a new skill, refactoring an existing skill, auditing a skills directory for quality, fixing weak descriptions that prevent Claude from routing correctly, splitting oversized SKILL.md files into Pattern 2 references, or writing trigger-friendly descriptions that include 'use when' / 'do not use' guidance. Trigger terms: создать скилл, написать скилл, audit skill, evaluate skill, fix skill description, skill quality, Pattern 2, SKILL.md, references/, version block, skill triggers, skill routing, skill description, skill name."
stacks:
  - meta
  - skills
tags:
  - meta-skill
  - skill-authoring
  - audit
  - anthropic-best-practices
  - pattern-2
source: vechkasov-global-skills
---

## Usage

Loaded automatically when its description matches the active task. Use this skill BEFORE writing or refactoring any other skill — it sets the bar for everything downstream.

## Use this skill when

- Creating a new skill from scratch (you'll write it correctly the first time)
- Refactoring an existing skill that looks "thin" — placeholder section bodies, missing trigger terms, no `references/`
- Auditing a skills directory en masse (e.g. checking ~/.claude/skills/* for compliance)
- Fixing a description that doesn't route correctly — Claude can't find the skill when the user asks for it
- Splitting an oversized SKILL.md (>500 lines) into Pattern 2 references
- Adding a stack to STACK_VERSIONS.md and wiring it into `sync_skill_versions.py`
- Deciding whether a candidate skill should exist as its own SKILL.md or be folded into an existing one

## Do not use this skill when

- The task is using a skill's content to do real work — this is a meta-skill, not domain expertise
- The user is writing application code unrelated to skill authoring
- The skill in question is a `superpowers:*` plugin skill — those follow a different conventions (see plugin docs)

## Purpose

Claude Code routes skills primarily through their **frontmatter description**. A great description acts like a search-engine query expansion: it includes the verbs, nouns, and edge cases the user is likely to mention. A weak description is invisible — Claude never loads the skill even when the user clearly needs it.

This skill is the source of truth for Anthropic's [Agent Skills best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) as applied to our repo. It covers naming, description engineering, Pattern 2 (domain-specific organization), version tracking via the central registry, and the audit checklist used to flag broken skills.

## Capabilities

### Description engineering

The frontmatter `description` is the routing key. Optimize for it. Three components every description needs:

1. **What the skill does** — one short sentence with domain nouns
2. **Trigger terms** — concrete verbs and proper nouns the user will say ("Use when: telegram bot, bot api, payment, mini app")
3. **Edges (optional but helpful)** — "Skip when: ...", "Do not use for: ..."

Length sweet spot: **150–400 characters**. Under 80 chars almost always lacks triggers. Over 600 dilutes routing signal.

Avoid bare phrases like "Use PROACTIVELY for X development" without trigger terms — Claude needs specific nouns and verbs.

See [references/description-best-practices.md](references/description-best-practices.md).

### Naming and frontmatter

- **Name**: kebab-case, plain library name — no `-pro/-expert/-specialist` suffix (`prisma`, not `prisma-expert`; `bullmq`, not `bullmq-specialist`). Domain-scoped names only when the suffix is justified (`linux-sysadmin`, `react-hook-form`). No version in name (no `react-19-patterns` — version lives in the version block).
- **Required frontmatter fields**: `name`, `description`. Optional but recommended: `stacks`, `tags`, `source`, `packages`, `manifests`, `risk`.
- **Forbidden** (per Anthropic): time-sensitive content in the body (e.g., "as of May 2026" or "after May 2026" — keep dates in the version block, which the sync script owns).

See [references/naming-and-frontmatter.md](references/naming-and-frontmatter.md).

### Pattern 2: domain-specific organization

Anthropic recommends Pattern 2 for skills with multiple domains. SKILL.md stays small (under 500 lines) and acts as a navigator. Detailed content lives in `references/*.md`, each under 500 lines and focused on one domain.

```
my-skill/
├── SKILL.md           # navigator + capabilities outline
└── references/
    ├── REFERENCE.md   # slim index (50–150 lines)
    ├── domain-a.md
    ├── domain-b.md
    └── domain-c.md
```

The SKILL.md `## API Reference` section lists every reference file in a `| Topic | File |` table — this is non-negotiable. Orphan reference files (not linked from SKILL.md) violate Pattern 2.

See [references/pattern-2-structure.md](references/pattern-2-structure.md).

### Version tracking

Version-sensitive skills inject a `<!-- versions:start -->...<!-- versions:end -->` block right after frontmatter. Content is **generated** by `/home/ubuntu/.claude/scripts/sync_skill_versions.py` from `/home/ubuntu/.claude/STACK_VERSIONS.md`.

To add version tracking to a new skill:
1. Confirm the stack(s) exist in `STACK_VERSIONS.md` (add row if missing)
2. Add the stack(s) to `PINS` dict in `sync_skill_versions.py`
3. Add the skill → stacks mapping in `SKILL_STACKS` dict
4. Run `python3 ~/.claude/scripts/sync_skill_versions.py`

Process/methodology skills (clean-code, karpathy-guidelines, gitnexus-*) do NOT need version blocks — they're version-agnostic.

See [references/version-tracking.md](references/version-tracking.md).

### Audit checklist

Use this checklist for every skill — new or existing:

- [ ] Description length 150–400 chars
- [ ] Description has trigger terms (concrete verbs/nouns user will say)
- [ ] Description has "use when" guidance
- [ ] Name is kebab-case and domain-scoped
- [ ] SKILL.md < 500 lines
- [ ] Body has `## Use this skill when` section
- [ ] Body has `## Do not use this skill when` section
- [ ] Body has `## Purpose` paragraph (≥ 2 sentences, no placeholder)
- [ ] Body has `## Capabilities` with **real subsection bodies**, not just dash lists or empty `### ❌ headings`
- [ ] Body has `## Behavioral Traits` (concrete `do X / always Y` patterns)
- [ ] Body has `## Important Constraints` (concrete `NEVER X / ALWAYS Y`)
- [ ] Body has `## Related Skills` (only references to skills that actually exist)
- [ ] Body has `## API Reference` table linking ALL files in references/
- [ ] All references/ files exist and link back from SKILL.md
- [ ] All references/ files < 500 lines
- [ ] If version-sensitive: registered in `sync_skill_versions.py` + version block present
- [ ] No time-sensitive prose in body (e.g., "as of May 2026") — versioned content goes in the version block
- [ ] No placeholder stub bodies (`### Title` immediately followed by another `###` with no content between)

See [references/audit-checklist.md](references/audit-checklist.md).

### Operational artifacts (roadmap-style extension)

Anthropic's Pattern 2 documents `references/` only. Mature stack skills often need more:

- `templates/` — boilerplates with `{{placeholder}}` markers (e.g., `postgresql.conf.template`, `Dockerfile.template`)
- `examples/` — end-to-end input → output scenarios (e.g., `zero-downtime-add-column.md`)
- `scripts/` — runnable validators, parsers, generators (bash/python/node)
- `checklists/` — pre-flight, acceptance, self-check procedures
- `assets/` — diagrams, brand, fonts (for UI-adjacent skills)

Add these ONLY when the skill produces real operational artifacts. Process/methodology skills (clean-code, planning-methodology) stay reference-only.

See [references/operational-artifacts.md](references/operational-artifacts.md).

### Anti-triggers (skip rules in description)

For two skills that could match the same prompt, add explicit `SKIP:` rules to description for disambiguation. Pattern from `claude-api`:

```yaml
description: |
  TRIGGER when: code imports `anthropic`/`@anthropic-ai/sdk`.
  SKIP: file imports `openai`/other-provider SDK.
```

Anti-triggers prevent Claude from loading the wrong skill when context is ambiguous.

### Eval cases & versioning

Skills are code. Test routing with eval prompts (positive + negative), apply SemVer at the skill level, track changes in `CHANGELOG.md`. See [references/eval-and-versioning.md](references/eval-and-versioning.md).

### Popularity filter (90% rule)

`## Related Skills` must list only **mainstream 2026 choices** — tech used in ≥30% of relevant projects or recognized as the #1–2 dominant option in its category. Niche libs, beta tools, vendor-specific SaaS, and sunset libraries don't belong there. Cap per category: 1–3 entries; drop categories where everything is niche. See [references/popularity-filter.md](references/popularity-filter.md).

### Common anti-patterns

- **Empty sections**: `### ❌ Some Anti-Pattern` with no body — readers see a title but no explanation
- **Boilerplate `## Limitations`**: generic "stop and ask for clarification" text adds zero signal
- **Generic `When to Use`**: "This skill is applicable to execute the workflow described in the overview" — meaningless
- **Vague descriptions**: "Master Python with modern features" lacks any specific trigger
- **Hardcoded versions in body**: maintenance hell — use the version block
- **Stale frontmatter description**: refactored content but description still says "Vue 3 + Nuxt 3" after Vue 3.5 + Nuxt 4 rewrite
- **Dash-list Capabilities**: just identifiers like `- graphql-schema-design` without subsections

See [references/common-anti-patterns.md](references/common-anti-patterns.md).

## Behavioral Traits

- Treats the description as the routing key — optimizes it before anything else
- Reads `/home/ubuntu/.claude/STACK_VERSIONS.md` before adding any version pin
- Runs `python3 ~/.claude/scripts/sync_skill_versions.py` after any change to `PINS` or `SKILL_STACKS`
- Compares new skills against `nodejs`, `astro`, `telegram-bot`, `cloudpayments`, `claude-code` as the quality bar
- Splits SKILL.md eagerly when it crosses 500 lines — pulls content into `references/<domain>.md`
- Lists every reference file in SKILL.md's `## API Reference` table — orphan refs = Pattern 2 violation
- Refuses to add time-sensitive prose to skill bodies (dates, "current version") — versioned content stays in the sync-managed block

## Important Constraints

- NEVER skip the `## Use this skill when` and `## Do not use this skill when` sections — they're the routing edges
- NEVER write a description under 80 characters — it almost certainly lacks trigger terms
- NEVER edit the `<!-- versions:start -->...<!-- versions:end -->` block by hand — it's sync-script-owned
- NEVER add hardcoded version numbers in SKILL.md prose — they rot and contradict the version block
- NEVER reference a related skill that doesn't exist in `~/.claude/skills/` — broken pointers in `## Related Skills` reduce trust
- ALWAYS verify reference files actually exist and link from SKILL.md before declaring a skill done
- ALWAYS run the audit checklist as a final pass — most quality regressions are caught here

## Related Skills

### Skill-authoring meta-tools
- ✓ `superpowers:writing-skills` — Anthropic's own writing-skills meta-guide
- `project-actualizer` — creating `.claude/` configs at project level   [cascade marker]
- ✓ `karpathy-guidelines` — general code-discipline traits (think before coding, surgical changes, simplicity, goal-driven loop) that apply to skill writing too

### Host AI coding CLIs (skills run inside these)
- ✓ `claude-code` — Anthropic's CLI; skills load from `.claude/skills/`
- ✓ `opencode` — open-source multi-provider CLI; AGENTS.md instead of CLAUDE.md
- ✓ `codex` — OpenAI Codex CLI; AGENTS.md + profile-based config

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Index, decision map, when-to-use which doc | [references/REFERENCE.md](references/REFERENCE.md) |
| Description engineering — length, trigger terms, edges, examples of good/bad | [references/description-best-practices.md](references/description-best-practices.md) |
| Naming conventions, frontmatter fields, stacks/tags/packages/manifests | [references/naming-and-frontmatter.md](references/naming-and-frontmatter.md) |
| Pattern 2 structure, SKILL.md size limits, references/ layout, navigation tables | [references/pattern-2-structure.md](references/pattern-2-structure.md) |
| Version block lifecycle, STACK_VERSIONS.md, sync_skill_versions.py, when to skip | [references/version-tracking.md](references/version-tracking.md) |
| Common anti-patterns with before/after examples | [references/common-anti-patterns.md](references/common-anti-patterns.md) |
| Full audit checklist + automation greps for batch auditing | [references/audit-checklist.md](references/audit-checklist.md) |
| Roadmap-style operational artifacts — templates/, examples/, scripts/, checklists/, assets/, anti-triggers | [references/operational-artifacts.md](references/operational-artifacts.md) |
| Eval cases (routing tests) + SemVer + CHANGELOG patterns for skill versioning | [references/eval-and-versioning.md](references/eval-and-versioning.md) |
| Cascade generation + archive workflow — lean active set, restore-on-demand, no preemptive regeneration | [references/cascade-generation.md](references/cascade-generation.md) |
| **90% popularity filter** for `## Related Skills` — include only mainstream 2026 choices, exclude niche/beta/vendor-locked | [references/popularity-filter.md](references/popularity-filter.md) |
| **Wrong vs Right code pairs** — methodology for contrasted code blocks in high-stakes references (v3) | [references/wrong-vs-right-patterns.md](references/wrong-vs-right-patterns.md) |
| **Recommended defaults** as single source of truth — `references/recommended-defaults.md` structure for retry/concurrency/timeout knobs (v3) | [references/recommended-defaults-pattern.md](references/recommended-defaults-pattern.md) |
| **Internal consistency audit** — cross-file numeric drift, fabricated imports, broken links, SKIP orphans (v3) | [references/internal-consistency.md](references/internal-consistency.md) |
| **Troubleshooting template** — required `references/troubleshooting.md` for `risk: high-stakes` skills (v3) | [references/troubleshooting-template.md](references/troubleshooting-template.md) |

**How to use**: open the specific topic file. The audit-checklist file has copy-paste bash greps that find broken skills automatically.
