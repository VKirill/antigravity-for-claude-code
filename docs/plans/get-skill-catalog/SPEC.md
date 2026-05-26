# SPEC — get_skill_catalog MCP tool

## Goal
Add a read-only MCP tool `get_skill_catalog(category?, name?)` that parses
`prompts/skills-catalog.md` (the same file dev-orchestrator-agy uses to validate
skill_hints) and returns a structured list of skills with their on-disk SKILL.md
paths. Lets agent planners enumerate / filter the catalog programmatically instead
of relying on a sed grep.

## Observable outcomes
- `tools/list` MCP response includes a `get_skill_catalog` entry with declared
  inputSchema (optional `name`, optional `category`).
- `tools/call get_skill_catalog {}` returns >=100 skills from the real catalog
  (currently 127), each shaped `{ name, category, description, file_path }`.
- `category: "testing"` (any case) returns ONLY skills under the `**Testing**`
  header (playwright, pytest, vitest) — substring & case-insensitive.
- `name: "typescript"` returns exactly one entry; combined with a category filter,
  name wins.
- Filter with no matches → `{ skills: [], total: 0 }`, `isError: false`.
- Missing catalog file → MCP response `isError: true`, content text starts with
  "skills catalog not found at " (the parser does NOT throw; the handler returns
  a clean error envelope).
- Catalog without `<!-- SKILLS:START/END -->` markers → empty list + warning.
- Malformed bullet inside markers → skipped, warning emitted, others returned.
- `AGY_SKILLS_DIR` env var overrides `~/.agents/skills` in every `file_path`.
- `bun test` is fully green (existing + new suites).

## Touched areas + blast radius
- NEW: `src/tools/skill_catalog.ts` — parser + handler (~120 LoC).
- NEW: `src/tools/skill_catalog.test.ts` — 9+ test cases.
- MODIFY: `src/index.ts` — 1 import line + 1 ListTools entry + 1 CallTool dispatch
  case. Hot file, but additive only.
- Blast radius: zero downstream effect — additive tool registration.

## Reuse (mandatory)
- `resolvePromptsDir()` from `src/utils/prompts.ts` — catalog path =
  `path.join(resolvePromptsDir(), "skills-catalog.md")`. DO NOT reinvent path
  resolution.
- `MockTransport` + `resetMockState` from `src/test-setup.ts` — used for the
  registration smoke test (same pattern as `usage_stats.test.ts`).
- DI for the parser: exported `parseSkillCatalog(catalogPath, skillsDir)` so tests
  can point at synthetic / non-existent paths.

## Parser pseudocode
```
parseSkillCatalog(catalogPath, skillsDir):
  try read file → text          # ENOENT → return { skills: [], warnings: [], error: "skills catalog not found at <path>" }
  find markers <!-- SKILLS:START --> / <!-- SKILLS:END -->
    not found → return { skills: [], warnings: ["markers not found"] }
  slice lines between (exclusive) start and end
  currentCategory = ""
  skills = []; warnings = []
  for line in slice:
    if /^\*\*(.+?)\*\*$/ → currentCategory = group1
    else if /^-\s+`([^`]+)`\s+[—-]\s+(.+)$/ →
      skills.push({ name, category: currentCategory,
                    description: group2.trim(),
                    file_path: path.join(skillsDir, name, "SKILL.md") })
    else if line starts with "- " → warnings.push("malformed bullet: <line>")
    # blank lines / quotes / anything else → ignore
  return { skills, warnings }
```

Filter (in handler, AFTER parse):
```
if args.name     → skills = skills.filter(s => s.name === args.name)  # name wins
else if args.category → cat = args.category.toLowerCase()
                        skills = skills.filter(s => s.category.toLowerCase().includes(cat))
```

`skillsDir = process.env.AGY_SKILLS_DIR || path.join(process.env.HOME ?? os.homedir(), ".agents/skills")`

## Edge case test matrix
1. happy path no filters → length >= 100
2. name = "typescript" → exactly 1 entry, file_path ends with /typescript/SKILL.md
3. category = "Testing" → playwright + pytest + vitest only
4. category = "TESTING" → same (case-insensitive)
5. category = "Backend & data" → contains postgresql, prisma, zod
6. name + category together → name wins
7. category = "nonexistent-xyz" → skills:[], total:0, isError:false
8. parser(non-existent path) via DI → error field set, no throw
9. parser(synthetic input WITHOUT markers) → skills:[], warnings non-empty
10. parser(synthetic WITH malformed bullet) → bad bullet skipped + warning
11. AGY_SKILLS_DIR override → file_path uses that prefix; unset → uses HOME/.agents/skills

## Verification
- `bun test src/tools/skill_catalog.test.ts` green.
- `bun test` full suite green.
- `bun run build` clean TS compile.

## Simplicity (anti-bloat)
- Plain regex parser, no markdown lib.
- One module file, no parser/normalizer/formatter split.
- No new runtime deps. No caching. No `Skill` class.
- DI = one optional arg, not a `ParserOptions` interface.
