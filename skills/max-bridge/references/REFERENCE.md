# MAX Bridge Reference Index

Decision map for which file to open. All facts in this skill are verified against the upstream documentation mirrored under `upstream/` (fetched 2026-05-16).

## Decision map

| If you need... | Open |
|---|---|
| Verbatim upstream — bridge methods | [upstream/bridge.md](upstream/bridge.md) |
| Verbatim upstream — validation algorithm | [upstream/validation.md](upstream/validation.md) |
| Upstream attribution, re-sync workflow | [upstream/SOURCE.md](upstream/SOURCE.md) |
| Set up CDN script tag, detect platform/version | [setup.md](setup.md) |
| Consolidated method/event reference (our index) | [bridge-api.md](bridge-api.md) |
| Server-side validation algorithm with Node.js implementation | [launch-data-validation.md](launch-data-validation.md) |
| MAX vs VK Bridge side-by-side (migrating or supporting both) | [comparison-vk-bridge.md](comparison-vk-bridge.md) |
| Common errors and their fixes | [troubleshooting.md](troubleshooting.md) |
| Default TTL, retry policy, cache strategy | [recommended-defaults.md](recommended-defaults.md) |
| Avoiding the 5 most common identity/security mistakes | [wrong-vs-right.md](wrong-vs-right.md) |
| Routing eval cases for skill QA | [eval-cases.md](eval-cases.md) |

## Reading order for newcomers

1. `setup.md` — get the bridge loaded in your mini-app
2. `bridge-api.md` — pick the methods you actually need
3. `launch-data-validation.md` — implement server-side validation BEFORE shipping
4. `wrong-vs-right.md` — read all 5 pairs before merging
5. `recommended-defaults.md` — pin TTL and retry policy
6. `troubleshooting.md` — bookmark for production

## Status of upstream coverage (verified 2026-05-16 against dev.max.ru)

- **Bridge methods**: ~40 documented surface methods captured verbatim.
- **Validation algorithm**: 10-step abstract + 5-stage client-side, with full TypeScript reference implementation. Python/Go/Java tabs exist upstream but were not extractable from server-rendered HTML — re-fetch with a headless browser if those examples are needed.
- **Themes / payments / settings**: no dedicated pages discoverable as of fetch date. MAX appears to be in beta with API evolving; treat any non-documented capability as unsupported.
