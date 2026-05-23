# Changelog — pytest skill

All notable changes to this skill. Skill versioning follows SemVer at the skill level (independent of pytest's own version).

## [1.0.0]

Initial release. Pinned to pytest `9.x` (currently `9.0.3`).

### Coverage

- SKILL.md navigator with `## Use this skill when` / `## Do not use this skill when` / `## Purpose` / `## Capabilities` / `## Behavioral Traits` / `## Important Constraints` / `## Related Skills` / `## API Reference`.
- Pattern 2 references (16 files): `REFERENCE.md`, `basics.md`, `fixtures.md`, `parametrize.md`, `marks.md`, `mocking.md`, `async-testing.md`, `configuration.md`, `plugins.md`, `coverage.md`, `property-based.md`, `snapshot-and-approval.md`, `troubleshooting.md`, `recommended-defaults.md`, `wrong-vs-right.md`, `eval-cases.md`.

### pytest 9 highlights captured

- Python 3.9 support dropped (minimum 3.10).
- `PytestRemovedIn9Warning` warnings now error by default; deprecated APIs removed in 9.1.
- Duplicate-path collection coalesces overlapping arguments (`pytest a/b a/` → `a/`); opt out with `--keep-duplicates`.
- Native TOML config: `pytest.toml` / `.pytest.toml` and `[tool.pytest]` in `pyproject.toml` with real TOML types alongside the legacy `[tool.pytest.ini_options]` INI-compat path.
- First-party subtests support (no plugin needed).
- New `[strict]` config option that turns on strict parametrize IDs, xfail, markers, and config simultaneously.
- `CI` / `BUILD_NUMBER` env vars must be non-empty to activate CI mode.
- `--version` no longer loads plugins; double `--version --version` shows full plugin info.
- `config.args` (non-public) now accepts strings only — no `pathlib.Path`.

### Plugin coverage

- Tier 1: `pytest-cov`, `pytest-xdist`, `pytest-randomly`, `pytest-mock`, `pytest-asyncio`.
- Tier 2: `pytest-timeout`, `hypothesis`, `syrupy`, `pytest-freezer`.
- Tier 3 (framework-specific): `pytest-django`, `pytest-httpx`, others.

### Distinguishing `unittest.mock` from `pytest-mock`

`mocking.md` provides equivalence table and concrete guidance on when to reach for `mocker` fixture vs raw `patch` decorator/context manager.

### Risk classification

`medium-stakes` — correctness of test suite. Includes `wrong-vs-right.md` with 12 contrasted code pairs covering the most common pytest pitfalls.
