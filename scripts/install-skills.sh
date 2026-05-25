#!/usr/bin/env bash
#
# install-skills.sh — install the bundled programming skill stack into the agy
# (Antigravity / Gemini) skills directory, so workers dispatched by
# dev-orchestrator-agy can load them via their contract's `skill_hints`.
#
# agy reads skills from ~/.agents/skills/ (the Gemini Antigravity skills dir is a
# symlink to it). Override the target with AGY_SKILLS_DIR=/custom/path.
#
# Usage:
#   ./scripts/install-skills.sh                      # install into ~/.agents/skills
#   AGY_SKILLS_DIR=/path ./scripts/install-skills.sh # custom target
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$REPO_DIR/skills"
DEST="${AGY_SKILLS_DIR:-$HOME/.agents/skills}"

if [ ! -d "$SRC" ]; then
  echo "error: no skills/ directory at $SRC" >&2
  exit 1
fi

mkdir -p "$DEST"

have_rsync=0
if command -v rsync >/dev/null 2>&1; then have_rsync=1; fi

count=0
for path in "$SRC"/*/; do
  [ -d "$path" ] || continue
  name="$(basename "$path")"
  if [ "$have_rsync" -eq 1 ]; then
    rsync -a --exclude='.claude' --exclude='node_modules' --exclude='.git' "$path" "$DEST/$name/"
  else
    cp -R "$path" "$DEST/$name"
  fi
  count=$((count + 1))
done

echo "Installed $count skill(s) into: $DEST"
echo "agy will load any of them when a worker contract lists it in skill_hints."
