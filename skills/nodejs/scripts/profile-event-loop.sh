#!/usr/bin/env bash
# scripts/profile-event-loop.sh
# Purpose: Profile a Node.js application's event loop and CPU usage using clinic.js.
#          Runs the app with `clinic doctor` (event loop health) or `clinic flame` (CPU flamegraph).
#          Opens the resulting HTML report in the browser when done.
#
# Usage:
#   ./scripts/profile-event-loop.sh [--mode doctor|flame|bubbleprof] [--duration 30] \
#                                    [--output ./profiles] [--cmd "node dist/app/index.js"]
#
# Requirements:
#   npm install -g clinic autocannon
#   (or: npx clinic / npx autocannon — slower but no global install needed)
#
# Exit codes:
#   0 — profile completed, HTML report opened
#   1 — invalid arguments or missing tools

set -euo pipefail

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
MODE="doctor"          # doctor | flame | bubbleprof
DURATION=30            # seconds to run load
OUTPUT_DIR="./profiles"
NODE_CMD="node dist/app/index.js"
LOAD_URL=""            # e.g. "http://localhost:3000/api/users"
PORT=3000
CONNECTIONS=50

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)       MODE="$2"       ; shift 2 ;;
    --duration)   DURATION="$2"   ; shift 2 ;;
    --output)     OUTPUT_DIR="$2" ; shift 2 ;;
    --cmd)        NODE_CMD="$2"   ; shift 2 ;;
    --url)        LOAD_URL="$2"   ; shift 2 ;;
    --port)       PORT="$2"       ; shift 2 ;;
    --connections) CONNECTIONS="$2" ; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--mode doctor|flame|bubbleprof] [--duration 30] [--url http://...] [--cmd 'node ...']"
      exit 0
      ;;
    *) echo "Unknown argument: $1" >&2 ; exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# Validate mode
# ---------------------------------------------------------------------------
case "$MODE" in
  doctor|flame|bubbleprof) ;;
  *) echo "Invalid mode: $MODE. Must be doctor, flame, or bubbleprof." >&2 ; exit 1 ;;
esac

# ---------------------------------------------------------------------------
# Check tool availability
# ---------------------------------------------------------------------------
CLINIC_CMD=""
if command -v clinic &>/dev/null; then
  CLINIC_CMD="clinic"
elif command -v npx &>/dev/null; then
  CLINIC_CMD="npx clinic"
else
  echo "clinic.js not found. Install with: npm install -g clinic" >&2
  exit 1
fi

AUTOCANNON_CMD=""
if command -v autocannon &>/dev/null; then
  AUTOCANNON_CMD="autocannon"
elif command -v npx &>/dev/null; then
  AUTOCANNON_CMD="npx autocannon"
fi

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC}  $*" ; }
log_warn() { echo -e "${YELLOW}[WARN]${NC}  $*" ; }

mkdir -p "$OUTPUT_DIR"

# ---------------------------------------------------------------------------
# Print plan
# ---------------------------------------------------------------------------
log_info "Mode:       $MODE"
log_info "Command:    $NODE_CMD"
log_info "Duration:   ${DURATION}s"
log_info "Output dir: $OUTPUT_DIR"
[[ -n "$LOAD_URL" ]] && log_info "Load URL:   $LOAD_URL (${CONNECTIONS} connections)"

# ---------------------------------------------------------------------------
# Run profiler
# ---------------------------------------------------------------------------
log_info "Starting profiler — run load against the server, then Ctrl-C (or wait ${DURATION}s)"

if [[ -n "$LOAD_URL" && -n "$AUTOCANNON_CMD" ]]; then
  # Auto-generate load while the server is running
  # Run clinic in background, autocannon sends load, then kill clinic
  log_info "Auto-load via autocannon: $LOAD_URL"

  $CLINIC_CMD "$MODE" --dest "$OUTPUT_DIR" -- $NODE_CMD &
  CLINIC_PID=$!

  # Wait for server to start
  log_info "Waiting for server on port $PORT ..."
  for i in $(seq 1 20); do
    if nc -z localhost "$PORT" 2>/dev/null; then
      break
    fi
    sleep 1
  done

  log_info "Server up — running load for ${DURATION}s ..."
  $AUTOCANNON_CMD \
    --duration "$DURATION" \
    --connections "$CONNECTIONS" \
    "$LOAD_URL" || true

  log_info "Load complete — stopping clinic process ..."
  kill -SIGINT "$CLINIC_PID" 2>/dev/null || true
  wait "$CLINIC_PID" 2>/dev/null || true
else
  # Manual mode — user generates load themselves
  log_warn "No --url provided. Start the app, generate load manually, then Ctrl-C."
  $CLINIC_CMD "$MODE" --dest "$OUTPUT_DIR" -- $NODE_CMD
fi

# ---------------------------------------------------------------------------
# Find and open report
# ---------------------------------------------------------------------------
REPORT=$(find "$OUTPUT_DIR" -name "*.html" -newer "$OUTPUT_DIR" 2>/dev/null | head -1)

if [[ -z "$REPORT" ]]; then
  # Fallback: newest HTML in output dir
  REPORT=$(find "$OUTPUT_DIR" -name "*.html" | sort -t_ -k2 -n | tail -1)
fi

if [[ -n "$REPORT" ]]; then
  log_info "Report generated: $REPORT"

  # Open browser (Linux/macOS)
  if command -v xdg-open &>/dev/null; then
    xdg-open "$REPORT" &
  elif command -v open &>/dev/null; then
    open "$REPORT"
  else
    log_warn "Cannot open browser automatically. Open manually: $REPORT"
  fi
else
  log_warn "No HTML report found in $OUTPUT_DIR. Check clinic output above."
fi

# ---------------------------------------------------------------------------
# Interpretation hints
# ---------------------------------------------------------------------------
cat <<'HINTS'

--- clinic doctor interpretation ---
  Red bars in "I/O" → disk or network bound (not event loop)
  Red bars in "Event Loop" → sync blocking code, long-running callbacks
  Red bars in "Memory" → possible leak, check heap growth trend
  "Detected issues" summary at top — read each recommendation

--- clinic flame interpretation ---
  Wide bars at top = most CPU time spent here
  Look for: synchronous JSON.parse/stringify on large objects, sync crypto,
            blocking regex, synchronous fs calls, tight loops in middleware

--- clinic bubbleprof interpretation ---
  Shows async operation graph — useful for finding unexpected awaits,
  identifying where the event loop waits longest between tasks

HINTS

log_info "Profile complete."
