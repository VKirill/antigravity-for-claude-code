# Audit Checklist

Use these greps + checks to audit one skill or the entire skills directory. Copy-paste-able.

## Per-skill manual checklist

For each skill SKILL.md:

```
FRONTMATTER
[ ] name field matches directory name
[ ] description present and 150-400 chars
[ ] description has trigger terms (concrete verbs/nouns)
[ ] no version numbers in description (use version block)
[ ] description ends with period and is grammatically complete

BODY STRUCTURE
[ ] ## Use this skill when (concrete bullet points)
[ ] ## Do not use this skill when (concrete bullet points)
[ ] ## Purpose (≥ 2 sentences, not placeholder)
[ ] ## Capabilities (with real subsection bodies, not dash list)
[ ] ## Behavioral Traits (concrete patterns)
[ ] ## Important Constraints (NEVER / ALWAYS rules)
[ ] ## Related Skills (only refs to skills that exist)
[ ] ## API Reference (if references/ exists)

NO PLACEHOLDERS
[ ] No empty ### headings (header followed immediately by another header)
[ ] No "// comment" placeholders in Sharp Edges tables
[ ] No truncated sentences ending mid-word
[ ] No "// TODO" or "[FILL IN]"

PATTERN 2 (if references/ exists)
[ ] SKILL.md ≤ 250 lines (warn) / < 500 lines (hard)
[ ] Every references/*.md < 500 lines
[ ] Every references/*.md is linked from ## API Reference table
[ ] No broken [references/FOO.md](references/FOO.md) links
[ ] Code snippets verified against library docs — no hallucinated imports/APIs (see internal-consistency.md)
[ ] No numeric drift across files for same knob (concurrency, attempts, timeouts — see internal-consistency.md)

HIGH-STAKES (if frontmatter has risk: high-stakes)
[ ] references/troubleshooting.md exists (see troubleshooting-template.md)
[ ] At least one "❌ wrong / ✅ right" code pair in references (see wrong-vs-right-patterns.md)

OPERATIONAL KNOBS (if skill has retry/timeout/concurrency/pool-size)
[ ] references/recommended-defaults.md exists (see recommended-defaults-pattern.md)
[ ] No inline numeric values that duplicate recommended-defaults.md

VERSION TRACKING (if version-sensitive)
[ ] Listed in sync_skill_versions.py SKILL_STACKS dict
[ ] All referenced stacks present in STACK_VERSIONS.md and PINS
[ ] <!-- versions:start -->...<!-- versions:end --> block present
[ ] Block content matches latest sync run

NO TIME-SENSITIVE PROSE
[ ] No "as of <date>" sentences in body
[ ] No "after May 2026" / "by 2027" claims in body
[ ] Version-specific notes go in version block or dated reference files
```

## Automated greps

### Find SKILL.md with empty description
```bash
cd ~/.claude/skills
for s in */; do
  desc=$(awk '/^description:/{print}' "$s/SKILL.md" 2>/dev/null)
  if [ -z "$desc" ] || [ "$desc" = "description:" ] || [ "$desc" = 'description: ""' ]; then
    echo "EMPTY: $s"
  fi
done
```

### Find SKILL.md with description < 80 chars
```bash
cd ~/.claude/skills
for s in */; do
  [ ! -f "$s/SKILL.md" ] && continue
  desc=$(awk '/^description:/{flag=1; sub("description:", ""); printf "%s", $0; next} flag && /^[a-z]+:/ {flag=0} flag {printf " %s", $0}' "$s/SKILL.md" | sed 's/^[ "]*//; s/["]*$//')
  len=${#desc}
  if [ "$len" -lt 80 ]; then
    echo "SHORT ($len): $s"
  fi
done
```

### Find SKILL.md without "use when" trigger phrasing
```bash
cd ~/.claude/skills
for s in */; do
  [ ! -f "$s/SKILL.md" ] && continue
  desc=$(awk '/^description:/{flag=1} flag {print} flag && /^[a-z]+:/ && !/^description:/ {flag=0; exit}' "$s/SKILL.md")
  if ! echo "$desc" | grep -qiE 'use when|use proactively|trigger|activate|use for|when:|when the user'; then
    echo "NO TRIGGER: $s"
  fi
done
```

### Find SKILL.md > 250 lines (warn) and > 500 (hard violation)
```bash
cd ~/.claude/skills
for s in */; do
  [ ! -f "$s/SKILL.md" ] && continue
  lines=$(wc -l < "$s/SKILL.md")
  if [ "$lines" -gt 500 ]; then
    echo "HARD ($lines): $s/SKILL.md"
  elif [ "$lines" -gt 250 ]; then
    echo "WARN ($lines): $s/SKILL.md"
  fi
done
```

### Find high-stakes skills missing troubleshooting.md
```bash
cd ~/.claude/skills
for s in */; do
  [ ! -f "$s/SKILL.md" ] && continue
  if grep -q "risk: high-stakes" "$s/SKILL.md" && [ ! -f "$s/references/troubleshooting.md" ]; then
    echo "MISSING troubleshooting: $s"
  fi
done
```

### Find numeric-knob drift across files within a skill
```bash
cd ~/.claude/skills
# For each skill, look at single-skill drift on common knobs
for s in */; do
  for knob in concurrency attempts lockDuration maxRetriesPerRequest; do
    vals=$(grep -rhoE "${knob}[: =]+['\"]?[0-9]+" "$s" 2>/dev/null | grep -oE '[0-9]+' | sort -u)
    count=$(echo "$vals" | wc -w)
    if [ "$count" -gt 2 ]; then
      echo "DRIFT in $s: $knob = $(echo $vals | tr '\n' ',')"
    fi
  done
done
```

### Find suspicious imports (possibly hallucinated APIs)
```bash
cd ~/.claude/skills
# For high-stakes skills, list all `import { X } from 'lib'` lines.
# Cross-check each via Context7 (mcp__context7__query-docs) for the named lib.
for s in */; do
  [ ! -f "$s/SKILL.md" ] && continue
  if grep -q "risk: high-stakes" "$s/SKILL.md" 2>/dev/null; then
    echo "=== $s ==="
    grep -rohE "import \{[^}]+\} from ['\"][^'\"]+['\"]" "$s" 2>/dev/null | sort -u
  fi
done
# Then manually verify each named import via Context7.
```

### Find references/*.md > 500 lines
```bash
cd ~/.claude/skills
find . -type f \( -path "*/reference/*.md" -o -path "*/references/*.md" \) \
  -exec wc -l {} \; | awk '$1 > 500 { print }'
```

### Find broken [references/...](references/...) links
```bash
cd ~/.claude/skills
for s in */; do
  [ ! -f "$s/SKILL.md" ] && continue
  grep -oE '\[[^]]*\]\((reference/[^)]+|references/[^)]+)\)' "$s/SKILL.md" | while read link; do
    path=$(echo "$link" | sed -E 's/.*\(([^)]+)\).*/\1/')
    [ ! -f "$s$path" ] && echo "BROKEN: $s$path"
  done
done
```

### Find references files not linked from their SKILL.md (orphans)
```bash
cd ~/.claude/skills
for s in */; do
  [ ! -f "$s/SKILL.md" ] && continue
  for ref in $(find "$s/references" "$s/reference" -maxdepth 1 -name '*.md' 2>/dev/null); do
    name=$(basename "$ref")
    if ! grep -q "$name" "$s/SKILL.md"; then
      echo "ORPHAN: $ref"
    fi
  done
done
```

### Find SKILL.md with empty section bodies
```bash
cd ~/.claude/skills
for s in */; do
  [ ! -f "$s/SKILL.md" ] && continue
  awk '
    /^### / { title=$0; expecting=1; next }
    expecting && /^$/ { blanks++; next }
    expecting && /^### / { print FILENAME ": " title; expecting=0 }
    expecting && /^## / { print FILENAME ": " title; expecting=0 }
    expecting && /./ { expecting=0; blanks=0 }
  ' "$s/SKILL.md"
done
```

### Find SKILL.md with placeholder "// comment" in Sharp Edges or anywhere
```bash
cd ~/.claude/skills
grep -rn "| // [A-Z]" */SKILL.md 2>/dev/null
```

### Find SKILL.md with time-sensitive prose
```bash
cd ~/.claude/skills
grep -rn -iE "as of (20|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|after (20[0-9]{2}|may 2026)|current version|currently the latest" */SKILL.md 2>/dev/null | \
  grep -v "versions:start\|versions:end"
```

### Find SKILL.md with stale version mentions in description
```bash
cd ~/.claude/skills
grep -l -iE "Vue 3 \+ Nuxt 3|React 18|Next\.js 14|Next\.js 15|Node 22|Python 3\.12|Python 3\.13|Prisma 6|PostgreSQL 17|Redis 7\+|Jest 29|Vitest 3|ESLint 9|PHP 8\.3|PHP 8\.4|Laravel 11|Laravel 12|Django 5" */SKILL.md 2>/dev/null
```

## Full audit one-liner

Run this to scan everything:

```bash
cd ~/.claude/skills
echo "=== EMPTY DESCRIPTIONS ===" && \
  for s in */; do d=$(awk '/^description:/' "$s/SKILL.md" 2>/dev/null); [ -z "$d" ] && echo "  $s"; done

echo "=== SHORT (<80) DESCRIPTIONS ===" && \
  for s in */; do d=$(awk '/^description:/{flag=1; sub("description:", ""); printf "%s", $0; next} flag && /^[a-z]+:/ {flag=0} flag {printf " %s", $0}' "$s/SKILL.md" 2>/dev/null | sed 's/^[ "]*//; s/["]*$//'); [ ${#d} -lt 80 ] && echo "  $s ($((${#d})))"; done

echo "=== SKILL.md > 500 LINES ===" && \
  for s in */; do l=$(wc -l < "$s/SKILL.md" 2>/dev/null); [ "$l" -gt 500 ] 2>/dev/null && echo "  $s ($l lines)"; done

echo "=== REFERENCES > 500 LINES ===" && \
  find . -type f \( -path "*/reference/*.md" -o -path "*/references/*.md" \) -exec wc -l {} \; 2>/dev/null | awk '$1 > 500'

echo "=== BROKEN reference LINKS ===" && \
  for s in */; do grep -oE '\[[^]]*\]\((reference/[^)]+|references/[^)]+)\)' "$s/SKILL.md" 2>/dev/null | while read link; do p=$(echo "$link" | sed -E 's/.*\(([^)]+)\).*/\1/'); [ ! -f "$s$p" ] && echo "  $s$p"; done; done

echo "=== ORPHAN reference FILES ===" && \
  for s in */; do for ref in $(find "$s/references" "$s/reference" -maxdepth 1 -name '*.md' 2>/dev/null); do name=$(basename "$ref"); grep -q "$name" "$s/SKILL.md" 2>/dev/null || echo "  $ref"; done; done

echo "=== PLACEHOLDER COMMENTS ===" && \
  grep -rln "| // [A-Z]" */SKILL.md 2>/dev/null | sed 's/^/  /'
```

Save this as `~/.claude/scripts/audit-skills.sh` to run later.

## What to do with audit findings

For each finding:

1. **Empty/short description** — rewrite using `description-best-practices.md`
2. **SKILL.md too long** — split with Pattern 2 (`pattern-2-structure.md`)
3. **Orphan references** — add to SKILL.md API Reference table
4. **Broken links** — fix path or create the missing file
5. **Placeholder bodies** — read `common-anti-patterns.md` for the rewrite pattern
6. **Stale versions in description** — update description, run sync script

Don't fix everything at once. Triage by **how often the skill is actually loaded**. A weak description on a never-used skill is lower priority than a broken link in a frequently-loaded skill.
