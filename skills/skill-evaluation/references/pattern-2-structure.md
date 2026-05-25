# Pattern 2: Domain-Specific Organization

Anthropic recommends Pattern 2 for skills that span multiple domains. SKILL.md stays small (navigator), detail goes into `references/*.md`.

## Why Pattern 2

Context costs tokens. When a user asks about "Apollo Federation", Claude shouldn't load the entire 779-line `prisma-expert/REFERENCE.md`. With Pattern 2, the skill loads SKILL.md (~200 lines) and only the references it needs.

> "For Skills with multiple domains, organize content by domain to avoid loading irrelevant context."  
> — Anthropic Agent Skills best practices

## Structure

```
my-skill/
├── SKILL.md                  # navigator (< 500 lines)
└── references/
    ├── REFERENCE.md          # slim index (50–150 lines)
    ├── domain-a.md           # < 500 lines, focused on one topic
    ├── domain-b.md
    └── domain-c.md
```

The references directory may be named `references/` (plural — our default) or `reference/` (singular — Anthropic's example). Be consistent within a skill.

## SKILL.md size limits

Two thresholds, post-May-2026-review:

| Lines | Action |
|---|---|
| ≤ 200 | Optimal — navigator + capabilities + links |
| 201–250 | **Warn** — review for body↔references duplication; trim if found |
| 251–500 | **Compress** — capabilities should be 3–5 lines each + link; remove anything quoted verbatim in references |
| > 500 | **Hard split** — must move content into references/, even if one coherent domain |

Why the new 250-line warn threshold? Two reviewers (May 2026) caught the same pattern: SKILL.md at ~300 lines was duplicating prose that already lived in `references/production-patterns.md` and `references/observability.md`. Duplication has two costs:
- Internal drift (one number rises, the other doesn't — see `internal-consistency.md`).
- Token cost on every load (SKILL.md is always loaded; references are on-demand).

If your SKILL.md is over 250 lines, ask: "Does this paragraph add value over a link to references/X.md?" If not, replace the paragraph with a one-liner + link.

## The `## API Reference` table

Every Pattern 2 skill ends with this:

```markdown
## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| [Short description ≤80 chars of topic A] | [references/domain-a.md](references/domain-a.md) |
| [Short description ≤80 chars of topic B] | [references/domain-b.md](references/domain-b.md) |
| ... |

**How to use**: search or read the specific topic file before writing code. Don't read entire files — look up only what you need.
```

**Every file in references/ must appear in this table**. Orphan files (not linked from SKILL.md) violate Pattern 2 because Claude won't know they exist.

## References file size limit

**500 lines per reference file**. If a file crosses 500, split into sub-domains.

Example: when `nextjs-app-router-patterns/references/REFERENCE.md` hit 716 lines, it was split into:
- routing.md, data-fetching.md, caching.md, rendering.md, metadata-and-seo.md, middleware-and-edge.md, error-handling.md

The original REFERENCE.md shrank to a 54-line index.

## REFERENCE.md as index

The convention in our repo: when a skill has many references, include a `REFERENCE.md` file that:

- Is < 200 lines
- Provides a "Decision Map" — "if you need X, open Y"
- May include version-history table or quick-lookup tables
- Is linked from SKILL.md's API Reference table like any other reference file

Not strictly required — skills with 2–3 references can skip REFERENCE.md and link directly.

## Splitting strategies

When a single REFERENCE.md is too big:

| Split by | When |
|---|---|
| **Topic/domain** | Most common — `schema.md`, `migrations.md`, `queries.md` |
| **API surface** | If it's a library — `client-side.md`, `server-side.md`, `cli.md` |
| **Use-case** | For methodology skills — `examples-debug.md`, `examples-refactor.md` |
| **Version** | NEVER — versions go in version block, not files |

## Sub-references (rare)

Most skills are one level deep: `references/foo.md`. Two-level nesting (`references/foo/bar.md`) is allowed but increase load-cost — Claude has to follow multiple hops. Use only when the depth is genuinely useful (e.g., `references/cloud/aws.md` vs `references/cloud/gcp.md`).

## What lives in SKILL.md vs references/

| Goes in SKILL.md | Goes in references/ |
|---|---|
| One-sentence summary of each capability | Full API surface, examples, parameters |
| Behavioral traits (concrete patterns) | Edge cases, gotchas with code |
| Important constraints (NEVER / ALWAYS) | Step-by-step procedures |
| The Pattern 2 navigator table | Long code samples (≥ 20 lines) |
| Cross-links to related skills | Migration guides between versions |

If you can summarize a topic in 5 lines, put it in SKILL.md. If it needs 50+ lines of code or detail, put it in a reference file and link.

## Validation checklist

- [ ] SKILL.md ≤ 250 lines (warn) / < 500 lines (hard)
- [ ] Every references/* file < 500 lines
- [ ] Every references/* file is listed in SKILL.md's `## API Reference` table
- [ ] No `[references/X.md]` link that points to a non-existent file (see `internal-consistency.md` for the audit grep)
- [ ] References table follows the `| Topic | File |` format with concrete topic descriptions (not "Index", not "Reference")
- [ ] For `risk: high-stakes` skills — `references/troubleshooting.md` exists (see `troubleshooting-template.md`)
- [ ] For technical skills with operational knobs — `references/recommended-defaults.md` exists (see `recommended-defaults-pattern.md`)
