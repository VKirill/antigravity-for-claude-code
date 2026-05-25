# Upstream Mirror — Attribution

This `references/upstream/` directory mirrors public documentation from MAX for developers (dev.max.ru) so the skill remains usable when network is unavailable and so changes can be diffed across re-syncs. Content is reproduced verbatim or near-verbatim from upstream and is the property of VK Tech / MAX. No interpretation has been added inside this folder; consolidated guidance lives one level up in `references/*.md`.

## Sources

| File | Upstream URL | Status |
|---|---|---|
| `bridge.md` | https://dev.max.ru/docs/webapps/bridge | Fetched verbatim |
| `validation.md` | https://dev.max.ru/docs/webapps/validation | Fetched verbatim |

## Fetched

- **Date:** 2026-05-16
- **Method:** HTTP GET via curl + HTML text extraction
- **User agent:** Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36
- **Encoding:** UTF-8

## Sibling navigation discovered

The upstream nav under «Мини-приложения» exposes three pages:

- Общее описание — https://dev.max.ru/docs/webapps/overview (returned 404 on direct fetch; index page only reachable via JS-rendered nav)
- MAX Bridge — https://dev.max.ru/docs/webapps/bridge (mirrored)
- Валидация данных — https://dev.max.ru/docs/webapps/validation (mirrored)

No separate `payments`, `themes`, or `getting-started` pages were discoverable from the rendered nav as of fetch date.

## Re-sync instructions

When upstream content changes (MAX is a young platform — expect API additions):

```bash
# 1. Re-fetch both pages
curl -sL -A "Mozilla/5.0" https://dev.max.ru/docs/webapps/bridge -o /tmp/max-bridge.html
curl -sL -A "Mozilla/5.0" https://dev.max.ru/docs/webapps/validation -o /tmp/max-validation.html

# 2. Diff against current upstream/ mirrors and update by hand —
#    preserving the "verified <date>" footer line at the end of each file.

# 3. Bump the version block in SKILL.md frontmatter (skill SemVer minor when API surface grows,
#    major when an existing method signature changes).

# 4. If a new method is added, also add it to:
#    - references/bridge-api.md (consolidated reference)
#    - references/comparison-vk-bridge.md (if there's a VK equivalent)
#    - CHANGELOG.md
```

## License / usage

Content is reproduced under fair-use for technical reference. Use upstream URLs as the authoritative source when in doubt; this mirror may lag.

## Verification

Re-fetch and diff at least once per quarter, or when a user reports a method that "should exist per docs" but isn't in our consolidated reference. The verbatim mirror is the floor — our consolidated `bridge-api.md` is the ceiling.
