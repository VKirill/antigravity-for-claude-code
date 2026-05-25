# skill-evaluation — CHANGELOG

## [3.0.0] — 2026-05-15

Synthesized from dual-review of `bullmq` skill (ChatGPT 9.1/10 + Opus). The reviews surfaced gaps that are universal across high-stakes skills, not bullmq-specific. Methodology updated to catch them upstream.

### Added
- `references/wrong-vs-right-patterns.md` — when and how to write contrasted code pairs; audit grep for high-stakes skills missing them.
- `references/recommended-defaults-pattern.md` — single-source-of-truth file structure for retry/concurrency/timeouts/pool sizes; eliminates inline drift across files (Opus caught `concurrency 10-20` vs `20-50` in bullmq).
- `references/internal-consistency.md` — pre-merge audit step covering: broken-link detector, numeric-knob drift, fabricated imports (catches the `RateLimiterPg` hallucination class of bug), SKIP-rule orphans.
- `references/troubleshooting-template.md` — mandatory `references/troubleshooting.md` for `risk: high-stakes` skills; symptom-indexed structure (Symptoms → Diagnose → Causes → Fix); minimum-coverage table per domain.

### Changed
- `references/description-best-practices.md` — added compactness rule with concrete "creep" examples; hard cap = 600 chars; emphasized triggers-only content (move migration notes/feature lists to body).
- `references/pattern-2-structure.md` — SKILL.md size limits split into warn (≥251) / hard (>500) instead of single 500 threshold; reasoning: duplication between body and references drives drift.
- `references/audit-checklist.md` — added grep recipes for: warn-vs-hard SKILL.md length, missing `troubleshooting.md` on high-stakes, numeric-knob drift detection, suspicious imports listing.
- `references/eval-and-versioning.md` — eval-cases must use **user-voice phrasing** (Russian/typos/incomplete) and an **Expected behavior** column (which sub-files/templates should load), replacing the older "Why" column that only justified routing.
- `references/REFERENCE.md` — decision-map entries for the 4 new files; quality-bar list updated (bullmq, astro, telegram-bot, yookassa).
- `SKILL.md` — API Reference table extended with 4 new entries.

### Sources
- ChatGPT review: 8.7 → 9.1 after archive re-verification (`bullmq` skill, May 2026)
- Opus review: 8.5/10 post-archive-fix; flagged internal-consistency drift, line-count threshold
- Real bug confirmed and fixed: `import { RateLimiterPg } from 'bullmq'` in `bullmq/references/concurrency-and-rate-limit.md` — `RateLimiterPg` does not exist in BullMQ; corrected to `import { Worker, RateLimitError, UnrecoverableError } from 'bullmq'` per official BullMQ docs.

### Not in this release (deferred to Phase B)
- Retrofit of existing 7 high-stakes skills (bullmq, cloudpayments, yookassa, prisma, postgresql, redis, linux-sysadmin) to the new standards. Methodology shipped first; retrofit on demand.

## [2.0.0] — 2026-05-15

### Added
- Pattern 2 enforcement via `pattern-2-structure.md`
- `popularity-filter.md` (90% rule)
- `cascade-generation.md` (lean active set, on-demand restore)
- `naming-and-frontmatter.md` (plain library names, no -pro/-expert suffix)

## [1.0.0] — 2026-05-15

- Initial release: description-best-practices, audit-checklist, common-anti-patterns, version-tracking, eval-and-versioning, operational-artifacts.
