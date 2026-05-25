# Version Tracking

Version-sensitive skills (anything tied to a library/runtime/tool) get an auto-managed `<!-- versions:start -->...<!-- versions:end -->` block injected after frontmatter.

## Lifecycle

```
STACK_VERSIONS.md (canonical pin)
        │
        ▼
sync_skill_versions.py
   PINS dict (canonical)
   SKILL_STACKS dict (skill → stack list)
        │
        ▼
   <!-- versions:start --> block in each SKILL.md
```

To bump a version: edit `STACK_VERSIONS.md` + `PINS` dict → run sync.

## Adding a stack to the registry

If a skill needs a stack not yet in `STACK_VERSIONS.md`:

1. Add a row to the appropriate section of `STACK_VERSIONS.md`:
   ```markdown
   | Stack | Pin | Latest | Released | Official docs | Migration / changelog |
   |---|---|---|---|---|---|
   | Astro | `6.x` | 6.30.0 | 2026-05 | https://docs.astro.build | https://astro.build/blog · https://docs.astro.build/en/guides/upgrade-to/v6/ |
   ```

2. Add to `PINS` dict in `~/.claude/scripts/sync_skill_versions.py`:
   ```python
   PINS = {
       ...
       "Astro": "6.x",
   }
   ```

3. Add the skill → stacks mapping in `SKILL_STACKS`:
   ```python
   SKILL_STACKS = {
       ...
       "astro": ["Astro", "TypeScript"],
   }
   ```

4. Run `python3 ~/.claude/scripts/sync_skill_versions.py`

The script injects (or refreshes) the version block right after frontmatter:

```markdown
<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- Astro: `6.x`
- TypeScript: `5.9.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-15

<!-- versions:end -->
```

## When NOT to use version tracking

Some skills are version-agnostic — don't add them to `SKILL_STACKS`:

- Process/methodology: `clean-code`, `karpathy-guidelines`, `code-review-checklist`, `planning-methodology`
- Domain non-tech: `copywriter`, `ui-designer` (style is timeless), `yandex-direct-ads`
- Tool-specific (internal): all `gitnexus-*` skills, `project-actualizer`
- Methodology meta: `lessons-protocol`, `goal-achievement-review`, `roadmap-methodology`

If a skill is half methodology + half tech (e.g., `software-architecture`), pin only the explicit tech bits. For pure methodology, skip.

## Anti-patterns

- ❌ Hardcoding "Node 22" in SKILL.md body — gets stale
- ❌ Hand-editing the `<!-- versions:start -->` block — overwritten on next sync
- ❌ Adding "as of May 2026" prose in body — same problem
- ❌ Listing 10+ pins in version block — pick 3-5 most relevant; the registry has the full list

## Pin policy

From STACK_VERSIONS.md:

- **Stable libs (major ≥ 1)**: pin major version (`X.x`). Patch upgrades auto-accepted.
- **0.x libs (e.g., Anthropic SDK)**: pin minor version (`0.X.x`) — semver treats 0.x minors as breaking.
- **LTS-aware (Node, Python, PostgreSQL, PHP, Ubuntu)**: prefer Active LTS, not Current.
- **Compatibility floor**: optional secondary note for migration skills (e.g., "Node 24.x; compatibility floor: Node 22 LTS").

## How descriptions use versions

The frontmatter description SHOULD include the major version as a trigger term:

```yaml
description: "Vue 3.5 + Nuxt 4 development. ... Use when: vue 3.5, nuxt 4, ..."
```

This helps Claude pick the right skill when the user explicitly says the version. Bare "Vue" in description means it might compete with older Vue 2 skill content.

But NEVER include `.x` patch syntax in description — that's the version block's job:

```yaml
# Bad:
description: "Vue 3.5.34 + Nuxt 4.4.5 ..."

# Good:
description: "Vue 3.5 + Nuxt 4 ..."
```

## Verification

After running the sync script:

```bash
# Should print 1 (one matching block per skill that has it)
grep -c "versions:start" ~/.claude/skills/my-skill/SKILL.md

# Should show your pins
sed -n '/versions:start/,/versions:end/p' ~/.claude/skills/my-skill/SKILL.md
```

If a skill should have a version block but doesn't, confirm:
1. It's in `SKILL_STACKS` dict
2. All referenced stacks exist in `PINS`
3. The script ran without errors
