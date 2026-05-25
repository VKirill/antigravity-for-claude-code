# Changelog

All notable changes to the `remotion` skill. Versions are independent of Remotion's release cadence; the Remotion library pin lives in the sync-managed version block (root SKILL.md, sourced from `STACK_VERSIONS.md`).

## 1.0.0 — 2026-05-16

Initial creation. Hybrid pattern: upstream canonical rules mirrored verbatim + our integration layer.

### Added

- **Hybrid integration structure** mirroring the shadcn skill's pattern:
  - `references/upstream/` — verbatim mirror of `remotion-dev/remotion/packages/skills/skills/remotion/` (1 SKILL.md + 35 rule .md files + 3 asset .tsx files), source-of-truth for framework APIs and patterns. Read-only — re-sync via `rsync` workflow documented in `references/upstream/SOURCE.md`.
  - `references/upstream/SOURCE.md` — attribution, fetched date (2026-05-16), license note (Remotion license), full file index, re-sync instructions.
- **Integration reference layer** (8 sibling files, all < 500 lines):
  - `references/REFERENCE.md` — decision map, upstream-vs-ours layering rule
  - `references/compositions.md` — fundamentals (`<Composition>`, `<Sequence>`, `useCurrentFrame`, `useVideoConfig`, `registerRoot`), our project layout
  - `references/rendering.md` — CLI + programmatic `renderMedia` / `renderStill`, full param table verified against upstream docs
  - `references/lambda.md` — `@remotion/lambda` setup, `renderMediaOnLambda`, progress polling, webhook flow, cost tracking, cleanup
  - `references/data-driven.md` — props, `calculateMetadata`, Zod schema patterns, API-edge validation
  - `references/integration-nextjs.md` — `<Player>` embedding, RSC boundary, `runtime = "nodejs"`, Server Action enqueue pattern
  - `references/integration-queue.md` — BullMQ render worker, bundle-once-at-boot, concurrency tuning, graceful shutdown (cross-links to `bullmq` skill)
  - `references/troubleshooting.md` — Linux Chromium deps, FFmpeg, fonts, OOM, Lambda timeouts, audio drift, black-frame debugging
  - `references/eval-cases.md` — v3 routing eval cases (8 positive + 5 negative + behavioural disambiguation table)
- **SKILL.md navigator** (~200 lines body) with:
  - frontmatter: name, description (150–400 chars with trigger terms + SKIP rule), stacks, tags, packages (8 entries), manifests, risk = medium-stakes
  - 8 `Use this skill when` bullets, 6 `Do not use when` bullets
  - 2-paragraph Purpose
  - 7 `Capabilities` subsections with real bodies + links to detailed references
  - 10 `Behavioral Traits` (concrete patterns)
  - 10 `Important Constraints` (NEVER / ALWAYS rules — Edge runtime, CSS animations, RSC boundary, queue mandate, bundle reuse, font preload, Linux libs)
  - `Related Skills` filtered to mainstream 2026 (react, typescript, nodejs, nextjs, zod, bullmq, linux-sysadmin) — all verified to exist under `~/.claude/skills/`
  - `API Reference` table linking ALL 9 sibling reference files + ALL 39 upstream files (SKILL.md + SOURCE.md + 35 rules + 3 assets) — no orphans
- `CHANGELOG.md` (this file)
- Blank line reserved under frontmatter for the sync script to inject `<!-- versions:start -->...<!-- versions:end -->` block (sourcing `Remotion 4.0.x` pin from `STACK_VERSIONS.md`)

### Verified

- `renderMedia` signature cross-checked against current upstream docs (`https://www.remotion.dev/docs/renderer/render-media`)
- `<Player>` required-props list cross-checked against upstream docs
- Upstream file list cross-checked against `remotion-dev/remotion@main` `packages/skills/skills/remotion/` (rsync'd 2026-05-16)
- All references/ files < 500 lines (largest is `troubleshooting.md` ~130 lines, `rendering.md` ~140 lines)
- All upstream/ files preserved verbatim; largest is `rules/maplibre.md` at 458 lines (under the 500-line cap)
- No `[ref/...](ref/...)` broken links — every reference file appears in SKILL.md's API Reference
- No time-sensitive prose in SKILL.md body — dates owned by the sync-managed version block

### Notes

- License of mirrored upstream content: Remotion's source-available license. Mirroring here for AI-agent read-only use mirrors the convention used by the official Remotion skill registry.
- The upstream `SKILL.md` mirrored under `references/upstream/SKILL.md` is the Remotion team's own navigator; our skill's actual entry point is `~/.claude/skills/remotion/SKILL.md` one level up.
- Sync workflow is documented inside `references/upstream/SOURCE.md`. Re-sync involves `git sparse-checkout` + `rsync --delete`.
