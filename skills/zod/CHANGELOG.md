# zod — CHANGELOG

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and SemVer.

## [Unreleased]

## [2.0.0] — 2026-05-16

### Changed

- `references/eval-cases.md` migrated to v3 format: user-voice + Expected behavior + How to verify (10/10/5)
- Added `risk: medium-stakes` frontmatter
- SKILL.md untouched (204 lines — under 250)
- Verified Zod 4 top-level format validators (`z.email()`, `z.url()`) clean per Wave 3a audit

### Added

- `references/recommended-defaults.md` — `strict`/`strip`/`passthrough` mode choice, error map customization, `safeParse` at boundaries, env var validation, `discriminatedUnion` over `union`, coerce vs preprocess vs transform, branded types
- `references/troubleshooting.md` — `discriminatedUnion` not narrowing, transform breaks inference, async refine race, sync parse on async schema, `z.string().email()` removed, `.extend()` ZodObject argument throws, `z.infer` any, coerce produces NaN, "Required" on wrong type
- `references/wrong-vs-right.md` — `parse` in handlers vs `safeParse`, Zod 3 chain vs Zod 4 top-level, `union` vs `discriminatedUnion`, raw `process.env` vs validated, `preprocess` vs `transform`, `.extend(zodObject)` vs `.extend(shape)`, strip vs strict at boundaries, `z.any()` at boundaries

## [1.0.0] — 2026-05-15

### Added

- Initial skill generation per skill-evaluation v2 + 90% filter
- SKILL.md: full Pattern 2 navigator (description, Use when, Do not use, Purpose, Capabilities, Traits, Constraints, Related Skills, API Reference table)
- `references/REFERENCE.md` — index + decision map + quick-lookup patterns + Zod 4 migration summary
- `references/schema-primitives.md` — string/number/boolean/date/enum/literal/coerce/optional/nullable/default
- `references/composition.md` — object extend/merge/pick/omit/partial, union, discriminated union, branded types, z.lazy, zod-to-json-schema
- `references/transforms-and-refinements.md` — .transform, .refine, .superRefine, .pipe, z.preprocess, async refinements, z.NEVER
- `references/error-handling.md` — ZodError, safeParse patterns, flatten, format (deprecated), per-framework patterns
- `references/integration-rhf.md` — React Hook Form zodResolver, nested fields, useFieldArray, Controller, async validation
- `references/migration-3-to-4.md` — all breaking changes: .email() moved, .extend() shape-only, format() deprecated
- `references/eval-cases.md` — positive routing, negative routing, edge cases
- `templates/env-schema.ts` — typed env loader with parseEnv/getEnv/env export
- `templates/api-route-validator.ts` — Express middleware factories (validateBody, validateQuery, validateParams) + inline patterns
- `examples/discriminated-union-state-machine.md` — 7-state order lifecycle with TypeScript narrowing
- `examples/recursive-tree-schema.md` — z.lazy + branded IDs + discriminated variant
- Version block managed by sync_skill_versions.py (Zod: 4.x, TypeScript: 5.9.x)
