# git skill — CHANGELOG

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and SemVer.

## [1.1.0] — 2026-05-16

### Changed
- `references/eval-cases.md` migrated to v3: user-voice phrasing (RU/EN mixed, incomplete welcome), `Expected behavior` column citing target sub-files, `How to verify` section. 10/10/5 structure preserved.
- SKILL.md condensed slightly (282 lines, was 292): Purpose section compressed; Debugging History table inlined. Inline code blocks (lefthook.yml, bash one-liners) preserved as load-bearing for a process skill.

## [1.0.0] — 2026-05-15

### Added

- Initial skill creation for Git (process-focused, version-agnostic at the workflow level)
- `SKILL.md` — Pattern 2 navigator with full capabilities, behavioral traits, constraints
- `references/REFERENCE.md` — decision map + CLI quick-lookup + safety-first global config
- `references/branching-strategies.md` — GitHub Flow, trunk-based, GitFlow, decision tree
- `references/conventional-commits.md` — spec, types, commitlint config, anti-patterns
- `references/rebasing-and-history.md` — interactive rebase, autosquash, fixup, recovery
- `references/worktrees.md` — `git worktree` workflows, IDE integration, cleanup
- `references/hooks.md` — lefthook vs husky vs native, pre-commit/commit-msg/pre-push
- `references/signing.md` — SSH (default), GPG, sigstore/gitsign comparison + setup
- `references/large-files-and-lfs.md` — Git LFS setup, migration, partial clone alternative
- `references/remote-collaboration.md` — forks, PRs, `--force-with-lease`, rerere, autostash
- `references/eval-cases.md` — routing tests (10 positive, 10 negative, 5 edge)
- `templates/.gitignore.node` — Node + TypeScript projects
- `templates/commitlint.config.js` — Conventional Commits enforcement
- `templates/lefthook.yml` — modern hook manager with lint/format/commitlint/gitleaks
- `templates/pre-commit` — native git hook script
- `examples/recover-from-bad-rebase.md` — end-to-end reflog recovery walkthrough
- Version block placeholder; register in `sync_skill_versions.py` as `["Git"]`

### Decisions

- **Signing default**: SSH signing (since git 2.34, reuses existing keys). GPG documented as alternative; sigstore for CI/keyless.
- **Hook manager default**: `lefthook` recommended over `husky` (faster, language-agnostic). Both documented.
- **Branching default**: GitHub Flow as default recommendation. Trunk-based and GitFlow documented as alternatives.
- **Force push policy**: Only `--force-with-lease` mentioned in templates; plain `--force` listed as anti-pattern.
