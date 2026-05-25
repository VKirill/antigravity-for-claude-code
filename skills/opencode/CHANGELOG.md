# opencode skill — CHANGELOG

## [2.2.0] — 2026-05-16

### Added
- `references/server-mode.md` — full `opencode serve` HTTP API reference (~360 lines). Documents authentication (`OPENCODE_SERVER_PASSWORD` / `OPENCODE_SERVER_USERNAME`, HTTP Basic, default port 4096), endpoint catalog (sessions, messages, `prompt_async`, abort, `/event` SSE, config, providers, files, commands, health, session status), three usage patterns (fire-and-forget, SSE streaming, sync proxy), production patterns (systemd unit, Angie reverse proxy with `proxy_buffering off` for SSE), a paste-runnable Node 24 + TS client wrapper covering `submitPrompt` / `listenEvents` (EventSource via streams) / `pollStatus` / `waitIdle` / `abort`, three wrong-vs-right pairs (sync-block vs `prompt_async`, missing abort wiring, hard-coded URL/password), and a troubleshooting table.
- Wired the new file into SKILL.md API Reference table.

### Source
- <https://opencode.ai/docs/server/> — endpoint catalog (OpenAPI 3.1 live at `/doc`)
- <https://opencode.ai/docs/sdk/> — `@opencode-ai/sdk` createOpencodeClient surface verification
- <https://opencode.ai/docs/cli/> — `opencode serve` flags (`--port`, `--hostname`, `--cors`, `--mdns`)

## [2.1.0] — 2026-05-16

### Changed (version + commands re-verified against upstream)
- **Version pin**: `1.0.92+` → `1.15.x` (per github.com/anomalyco/opencode/releases — latest v1.15.0 released 2026-05-15). 14+ minor versions had passed since the initial Wave 1 pin; documentation was stale.
- **Slash commands** rewritten per `https://opencode.ai/docs/ru` (verified May 16, 2026): added `/connect`, `/init`, `/undo`, `/redo`, `/share` to the upstream list. Tab-key planning/build mode toggle now explicit in SKILL.md.
- **Provider failover wording** (`Providers` section in SKILL.md, line 96) — `Set provider.fallback for automatic failover` → "Failover is provider-specific (OpenRouter `allow_fallbacks`/`order`, Vercel gateway `order`); no generic top-level `provider.fallback` key." Aligns with the Wave 4b fix in `references/providers.md`.
- **Model example** in the same paragraph: `openai/gpt-5.4` → `openai/gpt-5.5` (matches the codex skill update from prior session).

### Source
- Documentation: <https://opencode.ai/docs/ru> (last updated 2026-05-15)
- Release: <https://github.com/anomalyco/opencode/releases> (v1.15.0)

## [2.0.0] — 2026-05-16

### Added (v3 retrofit)
- `references/recommended-defaults.md` — provider priority list, agent type selection, `opencode.json` scaffold, `tui.json` split (theme/keybinds), failover patterns (OpenRouter/Vercel — no generic `provider.fallback`), headless/CI defaults
- `references/troubleshooting.md` — symptom-indexed: BYOK auth fail, provider fallback not engaging, schema error, agent switching, MCP not connecting
- `references/wrong-vs-right.md` — 5 side-by-side pairs: secrets interpolation, `plan` vs `build` choice, model prefix, tool allowlist, `tui.json` vs `opencode.json`

### Fixed
- Removed hallucinated generic `provider.fallback` knob. Replaced `references/providers.md` Fallback section with the real patterns: OpenRouter `allow_fallbacks`/`order`, Vercel gateway `order`, shell-wrapper retry (verified via Context7 `/anomalyco/opencode`).
- Removed duplicate `risk:` frontmatter key (was both `medium-stakes` and `safe`); kept `medium-stakes` as the task-brief target.

### Changed
- `references/eval-cases.md` migrated to v3: user-voice phrasing, `Expected behavior` column citing target sub-files, `How to verify` section. 10/10/5 structure preserved.
- SKILL.md condensed: collapsed ACP / Headless / Migration into one combined section. Now 217 lines (was 232).
- "Behavioral Traits" line on `provider.fallback` updated to reflect the real pattern.

### Verified (Context7 sources)
- `/connect` slash command — confirmed real (`packages/web/src/content/docs/providers.mdx`)
- `tui.json` theme/keybinds file — confirmed real, separate from `opencode.json`
- `provider.fallback` — confirmed NOT a documented OpenCode primitive; corrected

## [1.0.0] — 2026-05-15

### Added
- Initial skill generation
- SKILL.md with Pattern 2 layout
- 11 reference files: install, CLI flags, config, providers, agents, commands, MCP, permissions, interop, migration, eval-cases
- Templates: `opencode.json`, `AGENTS.md`, custom agent, MCP server entry
- Examples: quickstart session, GitHub Actions PR review (Groq-cheap variant)
- Cross-links to `claude-code` and `codex` skills

### Verified versions (May 2026)
- OpenCode CLI 1.0.92+ (Anomaly fork of sst/opencode)
- `opencode-ai` npm SDK
- ACP protocol support for Zed editor integration

### Scope decisions
- Excludes Cloudflare/SST hosting (infra, not CLI)
- Excludes general LLM agent design (`agent-evaluation`)
- Notes: project originally at `github.com/sst/opencode`; active maintenance moved to `github.com/anomalyco/opencode` in late 2025
