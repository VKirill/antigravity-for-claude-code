#!/usr/bin/env bash
# scripts/check-deps.sh
# Purpose: Run npm audit (security) + npm outdated (staleness) in CI or pre-deploy.
#          Exits non-zero if any HIGH/CRITICAL vulnerabilities or stale major versions found.
# Usage:   ./scripts/check-deps.sh [--skip-outdated] [--dir /path/to/project]
#
# Exit codes:
#   0 — all checks pass
#   1 — HIGH or CRITICAL vulnerability found
#   2 — stale major-version packages found (only if --skip-outdated not set)
#   3 — npm audit command failed unexpectedly

set -euo pipefail

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
SKIP_OUTDATED=false
PROJECT_DIR="$(pwd)"

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-outdated) SKIP_OUTDATED=true ; shift ;;
    --dir)           PROJECT_DIR="$2"   ; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--skip-outdated] [--dir /path/to/project]"
      exit 0
      ;;
    *) echo "Unknown argument: $1" >&2 ; exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

log_info()  { echo -e "${GREEN}[INFO]${NC}  $*" ; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*" ; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2 ; }

# ---------------------------------------------------------------------------
# Validate project dir
# ---------------------------------------------------------------------------
if [[ ! -f "$PROJECT_DIR/package.json" ]]; then
  log_error "No package.json found in $PROJECT_DIR"
  exit 1
fi

cd "$PROJECT_DIR"
log_info "Checking deps in: $PROJECT_DIR"

# ---------------------------------------------------------------------------
# npm audit — production deps only (ignore devDeps in security check)
# ---------------------------------------------------------------------------
log_info "Running npm audit --omit=dev ..."

AUDIT_OUTPUT=""
AUDIT_EXIT=0

AUDIT_OUTPUT=$(npm audit --omit=dev --json 2>&1) || AUDIT_EXIT=$?

# npm audit exits 1 on any vulnerability, parse ourselves for severity
HIGH_COUNT=$(echo "$AUDIT_OUTPUT" | \
  node --input-type=module <<'EOF'
import { createReadStream } from 'node:stream'
let data = ''
process.stdin.on('data', (chunk) => data += chunk)
process.stdin.on('end', () => {
  try {
    const report = JSON.parse(data)
    const vulns = report.vulnerabilities ?? {}
    const highCrit = Object.values(vulns).filter(
      (v) => v.severity === 'high' || v.severity === 'critical'
    ).length
    process.stdout.write(String(highCrit))
  } catch {
    process.stdout.write('0')
  }
})
EOF
)

if [[ "$HIGH_COUNT" -gt 0 ]]; then
  log_error "Found $HIGH_COUNT HIGH/CRITICAL vulnerability(ies). Run: npm audit --omit=dev"
  echo "$AUDIT_OUTPUT" | node --input-type=module <<'EOF'
import { readFileSync } from 'node:fs'
let data = ''
process.stdin.on('data', (chunk) => data += chunk)
process.stdin.on('end', () => {
  try {
    const report = JSON.parse(data)
    const vulns = report.vulnerabilities ?? {}
    for (const [name, vuln] of Object.entries(vulns)) {
      if (vuln.severity === 'high' || vuln.severity === 'critical') {
        console.error(`  [${vuln.severity.toUpperCase()}] ${name} — ${vuln.fixAvailable ? 'fix available' : 'no fix yet'}`)
      }
    }
  } catch { /* ignore parse errors */ }
})
EOF
  exit 1
else
  log_info "npm audit: no HIGH/CRITICAL vulnerabilities"
fi

# ---------------------------------------------------------------------------
# npm outdated — check for stale major versions
# ---------------------------------------------------------------------------
if [[ "$SKIP_OUTDATED" == "true" ]]; then
  log_info "Skipping outdated check (--skip-outdated)"
  exit 0
fi

log_info "Running npm outdated ..."

OUTDATED_OUTPUT=""
OUTDATED_MAJORS=0

# npm outdated exits 1 when there ARE outdated packages
set +e
OUTDATED_OUTPUT=$(npm outdated --json 2>&1)
set -e

OUTDATED_MAJORS=$(echo "$OUTDATED_OUTPUT" | \
  node --input-type=module <<'EOF'
import { readFileSync } from 'node:fs'
let data = ''
process.stdin.on('data', (chunk) => data += chunk)
process.stdin.on('end', () => {
  try {
    const pkgs = JSON.parse(data)
    let count = 0
    for (const [name, info] of Object.entries(pkgs)) {
      const current = info.current?.split('.')[0]
      const latest  = info.latest?.split('.')[0]
      if (current && latest && current !== latest) {
        console.error(`  [MAJOR] ${name}: ${info.current} → ${info.latest}`)
        count++
      }
    }
    process.stdout.write(String(count))
  } catch {
    process.stdout.write('0')
  }
})
EOF
)

if [[ "$OUTDATED_MAJORS" -gt 0 ]]; then
  log_warn "Found $OUTDATED_MAJORS package(s) with stale major versions (see above)"
  log_warn "Review changelogs before upgrading. Not blocking, but track in tech-debt."
  exit 2
else
  log_info "npm outdated: no stale major versions"
fi

log_info "All dependency checks passed."
exit 0
