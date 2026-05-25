#!/bin/bash
# Safe disk cleanup — logs what it would free, then asks for confirmation.
# Does NOT delete application data, databases, or volumes.
# Usage: bash disk-cleanup.sh [--dry-run] [--yes]

set -euo pipefail

DRY_RUN=false
AUTO_YES=false
for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=true ;;
        --yes)     AUTO_YES=true ;;
    esac
done

FREED=0
declare -a ACTIONS=()

human() {
    local bytes="$1"
    if (( bytes > 1073741824 )); then echo "$(( bytes / 1073741824 ))G"
    elif (( bytes > 1048576 )); then echo "$(( bytes / 1048576 ))M"
    elif (( bytes > 1024 )); then echo "$(( bytes / 1024 ))K"
    else echo "${bytes}B"
    fi
}

plan() {
    local desc="$1"
    local size_bytes="${2:-0}"
    local cmd="$3"
    ACTIONS+=("${desc}|${size_bytes}|${cmd}")
    FREED=$(( FREED + size_bytes ))
}

disk_size() {
    # Returns size in bytes for a path (0 if not found)
    du -sb "$1" 2>/dev/null | awk '{print $1}' || echo 0
}

echo "Scanning for safe cleanup targets..."

# 1. systemd journal
JOURNAL_SIZE=$(journalctl --disk-usage 2>/dev/null | grep -oE '[0-9.]+[MGK]?' | head -1 || echo "0")
JOURNAL_BYTES=$(du -sb /var/log/journal 2>/dev/null | awk '{print $1}' || echo 0)
KEEP_BYTES=$(( 200 * 1024 * 1024 ))   # keep 200MB
if (( JOURNAL_BYTES > KEEP_BYTES )); then
    plan "Vacuum systemd journal (keep 200MB, current $(human $JOURNAL_BYTES))" \
         $(( JOURNAL_BYTES - KEEP_BYTES )) \
         "journalctl --vacuum-size=200M"
fi

# 2. Old rotated logs (compressed, older than 14 days)
OLD_LOGS=$(find /var/log -name "*.gz" -mtime +14 -type f 2>/dev/null)
OLD_LOG_SIZE=0
for f in $OLD_LOGS; do
    sz=$(stat -c%s "$f" 2>/dev/null || echo 0)
    OLD_LOG_SIZE=$(( OLD_LOG_SIZE + sz ))
done
if (( OLD_LOG_SIZE > 1024 * 1024 )); then
    plan "Delete rotated logs older than 14 days ($(human $OLD_LOG_SIZE))" \
         "$OLD_LOG_SIZE" \
         "find /var/log -name '*.gz' -mtime +14 -type f -delete"
fi

# 3. Docker cleanup (only if docker is installed)
if command -v docker &>/dev/null && systemctl is-active --quiet docker; then
    DOCKER_SIZE=$(docker system df --format '{{.ReclaimableSize}}' 2>/dev/null | head -1 || echo "0")
    DOCKER_BYTES=$(docker system df 2>/dev/null | awk 'NR>1 {sum += $4} END {print sum * 1024 * 1024}' || echo 0)
    plan "Docker: prune stopped containers, dangling images, build cache" \
         "$DOCKER_BYTES" \
         "docker container prune -f && docker image prune -f && docker buildx prune -f"
fi

# 4. APT cache
APT_SIZE=$(disk_size /var/cache/apt/archives)
if (( APT_SIZE > 50 * 1024 * 1024 )); then
    plan "Clean APT package cache ($(human $APT_SIZE))" \
         "$APT_SIZE" \
         "apt-get clean"
fi

# 5. Old kernels (Ubuntu accumulates them)
OLD_KERNELS=$(dpkg -l 'linux-image-*' 2>/dev/null | grep '^ii' | grep -v "$(uname -r)" | grep -v "generic$" | awk '{print $2}' || true)
KERNEL_SIZE=0
for pkg in $OLD_KERNELS; do
    sz=$(apt-cache show "$pkg" 2>/dev/null | grep "^Installed-Size:" | awk '{print $2 * 1024}' || echo 0)
    KERNEL_SIZE=$(( KERNEL_SIZE + sz ))
done
if [[ -n "$OLD_KERNELS" ]] && (( KERNEL_SIZE > 0 )); then
    plan "Remove old kernels ($(echo $OLD_KERNELS | wc -w) packages, ~$(human $KERNEL_SIZE))" \
         "$KERNEL_SIZE" \
         "apt-get autoremove --purge -y"
fi

# 6. /tmp files older than 3 days
TMP_SIZE=$(find /tmp -mtime +3 -type f 2>/dev/null | xargs du -sb 2>/dev/null | awk '{s+=$1} END {print s+0}')
if (( TMP_SIZE > 50 * 1024 * 1024 )); then
    plan "Delete /tmp files older than 3 days ($(human $TMP_SIZE))" \
         "$TMP_SIZE" \
         "find /tmp -mtime +3 -type f -delete 2>/dev/null || true"
fi

# ---- Report ----
echo ""
echo "================================================"
echo " Disk Cleanup Plan — $(date '+%Y-%m-%d %H:%M:%S')"
echo "================================================"

if (( ${#ACTIONS[@]} == 0 )); then
    echo " Nothing significant to clean up."
    exit 0
fi

printf " %-55s  %s\n" "Action" "Reclaim"
echo " -------------------------------------------------------"
for action in "${ACTIONS[@]}"; do
    desc=$(echo "$action" | cut -d'|' -f1)
    sz=$(echo "$action" | cut -d'|' -f2)
    printf " %-55s  %s\n" "$desc" "$(human $sz)"
done
echo " -------------------------------------------------------"
echo " Total estimated reclaim: $(human $FREED)"
echo "================================================"

if $DRY_RUN; then
    echo " DRY RUN — no changes made."
    exit 0
fi

if ! $AUTO_YES; then
    read -rp "Proceed with cleanup? [y/N] " confirm
    [[ "${confirm}" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
fi

echo ""
echo "Running cleanup..."
for action in "${ACTIONS[@]}"; do
    desc=$(echo "$action" | cut -d'|' -f1)
    cmd=$(echo "$action" | cut -d'|' -f3)
    echo " -> ${desc}"
    eval "$cmd" 2>&1 | sed 's/^/    /'
done

echo ""
echo "Done. Disk state after cleanup:"
df -h | grep -v "tmpfs\|udev"
