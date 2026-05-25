# Internal consistency — cross-file audit

A skill's value drops fast when SKILL.md says one thing and a reference file says another. Opus's bullmq review caught this in the wild: SKILL.md claimed `concurrency: I/O-bound 20-50, CPU-bound 1-4` while `production-patterns.md` recommended `typical SaaS concurrency 10-20`.

This file defines the **pre-merge audit** that catches such drift.

## What to check

For every skill change that touches SKILL.md or any references/*.md:

### 1. Numeric values
Same knob, different number across files. Common offenders:
- `concurrency`, `attempts`, `backoff.delay`, `lockDuration`, `maxRetriesPerRequest`
- TTL / `removeOnComplete.age`, `removeOnComplete.count`
- Pool sizes, timeouts, worker counts, replicas

### 2. API names and imports
- An import that doesn't exist in the library (the `RateLimiterPg` from bullmq case).
- A class or method that was renamed/removed in the pinned version (e.g., `QueueScheduler` in BullMQ 5).
- A type signature that doesn't match the SDK.

### 3. Version pins
- Inline `<!-- versions:start -->` block disagrees with claims in the body ("Fastify 5" in description but body shows Fastify 4 patterns).
- A reference file pinning a newer version than SKILL.md.

### 4. Cross-references between files
- SKILL.md links `[refs](references/X.md)` — file must exist.
- Reference file says "see X.md" — X.md must exist in the same skill.
- A cited URL must resolve (sample-check during audit).

### 5. SKIP rules vs Related Skills
- SKIP says "use `foo`" — `foo` must either exist as an active skill or be marked as cascade marker.
- Related Skills entries must agree with SKIP rules: if SKIP says "→bar", then `bar` should appear in Related Skills.

## Pre-merge audit script

```bash
#!/usr/bin/env bash
# scripts/audit-skill-consistency.sh <skill-name>
set -euo pipefail
skill="${1:?skill name required}"
dir="/home/ubuntu/.claude/skills/$skill"
[ -d "$dir" ] || { echo "no such skill: $skill"; exit 1; }

echo "=== Broken file links in SKILL.md ==="
grep -oE '\[(references|templates|examples|scripts|checklists)/[^]]+\]' "$dir/SKILL.md" 2>/dev/null | tr -d '[]' | while read -r relpath; do
  [ -e "$dir/$relpath" ] || echo "  MISSING: $relpath"
done

echo "=== Same numeric knob with different values ==="
# Tunable: list of knobs that commonly drift
for knob in concurrency attempts lockDuration maxRetriesPerRequest; do
  vals=$(grep -rhoE "${knob}[: =]+['\"]?[0-9]+" "$dir" 2>/dev/null | grep -oE '[0-9]+' | sort -u)
  count=$(echo "$vals" | wc -w)
  if [ "$count" -gt 2 ]; then
    echo "  DRIFT: $knob appears with values: $(echo "$vals" | tr '\n' ' ')"
  fi
done

echo "=== SKIP rules that point to missing skills ==="
grep -oE '→[a-z][a-z0-9-]+' "$dir/SKILL.md" 2>/dev/null | sed 's/→//' | sort -u | while read -r ref; do
  if [ ! -d "/home/ubuntu/.claude/skills/$ref" ]; then
    # not active — should be marked cascade marker; check Related Skills
    if ! grep -q "\`$ref\`" "$dir/SKILL.md"; then
      echo "  ORPHAN SKIP: →$ref appears nowhere in Related Skills"
    fi
  fi
done

echo "=== Fabricated imports (heuristic) ==="
# For each `import { X, Y } from 'pkg'`, the named imports should appear somewhere else (in docs/url)
grep -rhoE "from ['\"][a-z@/-]+['\"]" "$dir" 2>/dev/null | sort -u | head
# This step is not fully automatable — see "Fabricated APIs" section below.
```

## Fabricated APIs — manual verification rule

LLMs occasionally hallucinate API surfaces. The `RateLimiterPg` from bullmq case is canonical: the agent invented a class name that doesn't exist in the package.

For every code snippet introduced by a generation pass:

1. **Identify** the imports and method calls that look library-specific.
2. **Verify** via Context7 (`mcp__context7__query-docs`) or the library's docs.md.
3. If you can't find it in 30 seconds, **suspect a hallucination** — flag it for human review or rewrite using documented surfaces.

This is part of the audit-checklist and should run on every cascade-generation agent's output before the skill is considered complete.

## Integration into the lifecycle

- **Pre-merge** for any skill PR — run the audit script.
- **Post-cascade** for newly-generated skills — run the script and the manual import check.
- **Quarterly** for all active skills — run a sweep to catch drift accumulated by partial edits.

## Common drift patterns (priority list)

| Pattern | Detection | Fix |
|---|---|---|
| Inline numeric drift between SKILL.md and references/ | `audit-skill-consistency.sh` | Move values to `recommended-defaults.md`; cite |
| Stale API after major version bump | Manual + Context7 | Re-pull docs via Context7, update snippets |
| Broken links to renamed/missing files | `audit-skill-consistency.sh` | Either restore file or remove the link |
| SKIP rule pointing to a marker without Related Skills mention | `audit-skill-consistency.sh` | Add the marker to Related Skills section |
| Version block disagrees with body ("Fastify 5" + Fastify 4 code) | Manual diff | Re-run `sync_skill_versions.py` and update body |
