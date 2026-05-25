#!/usr/bin/env bash
# Wraps osv-scanner CLI; falls back to direct REST queries to api.osv.dev
# when osv-scanner is not installed. Prints JSON findings to stdout.
#
# Usage:
#   bash run-osv-scan.sh                  # scan current dir recursively
#   bash run-osv-scan.sh -L lockfile.lock # scan specific lockfile
#   bash run-osv-scan.sh --summary        # human-readable summary instead of JSON

set -e

MODE="${1:-recursive}"
DIR="$(pwd)"

# --- Path 1: osv-scanner installed ---
if command -v osv-scanner >/dev/null 2>&1; then
  case "$MODE" in
    --summary)
      osv-scanner --recursive --format=table "$DIR"
      ;;
    -L)
      osv-scanner --format=json "$@" 2>/dev/null
      ;;
    *)
      osv-scanner --recursive --format=json "$DIR" 2>/dev/null
      ;;
  esac
  exit $?
fi

# --- Path 2: fallback to REST API for npm ---
echo "WARN: osv-scanner not installed. Install with:" >&2
echo "  go install github.com/google/osv-scanner/cmd/osv-scanner@latest" >&2
echo "  # or: brew install osv-scanner" >&2
echo "Falling back to REST API for package-lock.json only." >&2
echo "" >&2

LOCKFILE=""
[ -f "$DIR/package-lock.json" ] && LOCKFILE="$DIR/package-lock.json"
[ -f "$DIR/pnpm-lock.yaml" ] && LOCKFILE="$DIR/pnpm-lock.yaml"

if [ -z "$LOCKFILE" ]; then
  echo "ERROR: No package-lock.json or pnpm-lock.yaml found for REST fallback." >&2
  echo "Install osv-scanner to scan other ecosystems." >&2
  exit 1
fi

# Extract package@version pairs from npm lockfile (v3 schema)
if [[ "$LOCKFILE" == *"package-lock.json" ]]; then
  PAIRS=$(jq -r '
    .packages
    | to_entries
    | map(select(.key != ""))
    | .[]
    | (.key | sub("^node_modules/"; "")) + "@" + .value.version
  ' "$LOCKFILE")
else
  echo "ERROR: pnpm-lock REST fallback not implemented. Install osv-scanner." >&2
  exit 1
fi

# Build batch query for OSV.dev
echo "Querying OSV.dev for $(echo "$PAIRS" | wc -l) packages..." >&2

QUERIES=$(echo "$PAIRS" | jq -R 'split("@") | {package: {name: .[0], ecosystem: "npm"}, version: .[1]}' | jq -s '{queries: .}')

RESPONSE=$(curl -s -X POST https://api.osv.dev/v1/querybatch \
  -H "Content-Type: application/json" \
  -d "$QUERIES")

# Pair package names with their vulnerabilities
echo "$PAIRS" | jq -R . | jq -s --argjson r "$RESPONSE" '
  to_entries
  | map({
      package: .value,
      vulns: ($r.results[.key].vulns // [])
    })
  | map(select(.vulns | length > 0))
'
