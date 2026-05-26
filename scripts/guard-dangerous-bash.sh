#!/usr/bin/env bash
# PreToolUse hook for Bash. Blocks 4 dangerous patterns:
#   1. SQL DROP TABLE/DATABASE/SCHEMA/INDEX/VIEW
#   2. SQL TRUNCATE
#   3. SQL unconstrained delete-from (без WHERE)
#   4. git push --force (но НЕ --force-with-lease)
#
# Uses only bash `case` glob matching — zero regex.
# Whitelists read-only / editor commands so SQL keywords inside args don't false-trigger.

set -e

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // ""')

# Empty payload → allow (not a Bash call with command field)
[ -z "$CMD" ] && exit 0

# --- Segment-aware whitelist --------------------------------------------
# Tokenize CMD with shlex (quote-aware), split by shell operators
# (&&, ||, ;, |), and check the first token of every segment. If ALL
# segments start with a known-safe command (read-only / editor /
# navigation), exit 0 — SQL keywords inside quoted arguments are harmless.
# If any segment starts with something else (bash, eval, psql, node, npm,
# python, …) — or shlex fails on unbalanced quotes — fall through to
# dangerous-pattern scanning on the full CMD.
SAFE=$(CMD="$CMD" python3 - <<'PYEOF'
import os, shlex, sys
cmd = os.environ.get("CMD", "")
try:
    toks = shlex.split(cmd, posix=True)
except ValueError:
    print("0"); sys.exit(0)
OPS = {"&&", "||", ";", "|"}
SAFE_CMDS = {
    "cd","pwd","mkdir","true","false",":",
    "grep","rg","ag","cat","head","tail","less","more","awk","sed","echo","printf",
    "jq","ls","find","wc","sort","uniq","diff","file","stat","tree",
    "vim","nvim","nano","emacs","code","micro","hexyl","bat",
}
segs = [[]]
for t in toks:
    if t in OPS:
        segs.append([])
    else:
        segs[-1].append(t)
non_empty = [s for s in segs if s]
ok = bool(non_empty) and all(s[0] in SAFE_CMDS for s in non_empty)
print("1" if ok else "0")
PYEOF
)
[ "$SAFE" = "1" ] && exit 0

# --- Helper: emit deny JSON and exit 2 -----------------------------------
block() {
  jq -n --arg r "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $r
    }
  }'
  exit 2
}

RESULT=$(CMD="$CMD" python3 - <<'PYEOF'
import os, shlex, sys

def strip_heredocs(cmd_str):
    lines = cmd_str.split('\n')
    clean_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]
        clean_lines.append(line)
        try:
            tokens = shlex.split(line, posix=True)
        except Exception:
            tokens = []
        delims = []
        j = 0
        while j < len(tokens):
            tok = tokens[j]
            if tok.startswith("<<-"):
                delim = tok[3:]
                if not delim and j + 1 < len(tokens):
                    delim = tokens[j+1]
                    j += 1
                if delim:
                    delims.append(delim)
            elif tok.startswith("<<"):
                delim = tok[2:]
                if not delim and j + 1 < len(tokens):
                    delim = tokens[j+1]
                    j += 1
                if delim:
                    delims.append(delim)
            j += 1
        for delim in delims:
            i += 1
            while i < len(lines):
                if lines[i].strip() == delim:
                    break
                i += 1
        i += 1
    return '\n'.join(clean_lines)

cmd = os.environ.get("CMD", "")
try:
    cleaned_cmd = strip_heredocs(cmd)
    toks = shlex.split(cleaned_cmd, posix=True)
except Exception:
    print("OK")
    sys.exit(0)

OPS = {"&&", "||", ";", "|"}
segs = [[]]
for t in toks:
    if t in OPS:
        segs.append([])
    else:
        segs[-1].append(t)

for segment in segs:
    if not segment:
        continue

    # Per segment, find the index of the first token starting with "<<" or "<<-"
    idx = None
    for i, t in enumerate(segment):
        if t.startswith("<<") or t.startswith("<<-"):
            idx = i
            break

    if idx is not None:
        argv = segment[1:idx]
        scanned_segment = segment[:idx]
    else:
        argv = segment[1:]
        scanned_segment = segment

    SCANNED = ' '.join(argv).upper()
    seg_str = ' '.join(scanned_segment)
    seg_upper = seg_str.upper()

    # Rule 1: SQL DROP
    if any(x in SCANNED for x in ["DROP TABLE", "DROP DATABASE", "DROP SCHEMA", "DROP INDEX", "DROP VIEW", "DROP SEQUENCE"]):
        print("DROP")
        sys.exit(0)

    # Rule 2: SQL TRUNCATE
    if "TRUNCATE TABLE " in SCANNED or "TRUNCATE " in SCANNED:
        print("TRUNCATE")
        sys.exit(0)

    # Rule 3: SQL unconstrained delete-from
    if "DELETE FROM " in SCANNED:
        idx_del = SCANNED.find("DELETE FROM ")
        if "WHERE" not in SCANNED[idx_del:]:
            print("DELETE")
            sys.exit(0)

    # Rule 5: rm -rf
    if any(x in seg_upper for x in ["RM -RF ", "RM -FR ", "RM -RFV ", "RM -RFI "]):
        whitelist = [
            "rm -rf /tmp/", "rm -rf node_modules", "rm -rf ./node_modules",
            "rm -rf dist", "rm -rf ./dist", "rm -rf .next", "rm -rf ./.next",
            "rm -rf build", "rm -rf ./build", "rm -rf .cache", "rm -rf ./.cache",
            "rm -rf .turbo", "rm -rf coverage", "rm -rf .nuxt", "rm -rf .output"
        ]
        if not any(pat in cmd for pat in whitelist):
            print("RM")
            sys.exit(0)

    # Rule 4: git push --force
    if "git push" in seg_str:
        if "--force-with-lease" in seg_str:
            pass
        elif "--force" in seg_str:
            print("GITPUSH")
            sys.exit(0)
        elif " -f " in seg_str or seg_str.endswith(" -f"):
            print("GITPUSH")
            sys.exit(0)

print("OK")
sys.exit(0)
PYEOF
)

case "$RESULT" in
  DROP)
    block "SQL DROP blocked — irreversible structural deletion (table/db/schema/index/view/sequence). Before running manually: (1) confirm environment is NOT production (check DATABASE_URL host); (2) take backup — 'pg_dump -h 127.0.0.1 -U <user> <db> -Fc -f /tmp/backup-\$(date +%F).dump' for full DB, or 'pg_dump ... -t <table>' for one table; (3) safer alternatives — for tables: 'ALTER TABLE x RENAME TO x_archived_YYYYMMDD' (soft-drop, reversible); for indexes: 'DROP INDEX CONCURRENTLY' to avoid lock; for migrations: use Prisma/Alembic migration files so the drop is reviewable in git. Run manually after these steps."
    ;;
  TRUNCATE)
    block "SQL TRUNCATE blocked — empties entire table, faster than DELETE but no WHERE clause, no per-row triggers, and resets sequences with RESTART IDENTITY. Safe alternatives: (1) 'DELETE FROM <table> WHERE <condition>' for partial cleanup; (2) 'BEGIN; DELETE FROM <table>; -- inspect counts -- ROLLBACK;' to dry-run; (3) for full reset in dev: rename to *_old, recreate, drop old after verification. If truncate is genuinely needed (test fixtures, staging reset), run manually after confirming environment."
    ;;
  DELETE)
    block "Unconstrained DELETE blocked — would wipe the entire table. Required steps: (1) run 'SELECT COUNT(*) FROM <table> WHERE <condition>' first to see scope; (2) add the WHERE clause to the DELETE; (3) wrap in transaction for safety — 'BEGIN; DELETE FROM <table> WHERE ...; -- verify row count -- COMMIT;' (or ROLLBACK if unexpected). If you genuinely want to empty the table, prefer 'DELETE FROM <table> WHERE TRUE' so it's explicit, or rename-and-recreate."
    ;;
  RM)
    block "rm -rf blocked — irreversible deletion. Prefer 'gio trash <path>' (installed at /usr/bin/gio) which moves to ~/.local/share/Trash and is recoverable. To restore: 'gio trash --list' and 'gio trash --restore <path>'. If you truly need permanent deletion (build artefacts, /tmp/*, node_modules, dist, .next, build, .cache, .turbo, coverage), the hook auto-whitelists those paths; otherwise switch to gio trash or run the rm manually after confirming the path."
    ;;
  GITPUSH)
    # Distinguish between --force and -f using CMD to select the correct message verbatim
    case "$CMD" in
      *"git push"*"--force"*)
        block "git push --force blocked — overwrites remote history blindly, can destroy teammates' commits if anyone pushed since your last fetch. Safe alternative: 'git push --force-with-lease' refuses to push if the remote moved (i.e. someone else pushed). For extra safety: 'git fetch && git push --force-with-lease=<branch>:<expected-sha>'. NEVER force-push to main/master/release branches. If you must (rebased local branch, amended commit on your own feature branch), use --force-with-lease or run the push manually after confirming you're on the right branch."
        ;;
      *)
        block "git push -f blocked (short for --force) — overwrites remote history blindly. Use 'git push --force-with-lease' instead: it refuses to push if remote moved since your last fetch, protecting against losing teammates' commits. Never force-push to shared branches (main/master/release). Run manually with --force-with-lease after 'git fetch'."
        ;;
    esac
    ;;
esac

exit 0
