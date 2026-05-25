#!/bin/bash
# Composite server health check — outputs a scored report.
# Usage: bash health-check.sh [--json]
# Requires: no external dependencies beyond standard Ubuntu 24.04 tools.

set -euo pipefail

JSON_MODE=false
[[ "${1:-}" == "--json" ]] && JSON_MODE=true

SCORE=100
declare -a ISSUES=()

add_issue() {
    local severity="$1"   # CRITICAL WARNING INFO
    local deduction="$2"  # numeric
    local message="$3"
    ISSUES+=("${severity}|${deduction}|${message}")
    SCORE=$(( SCORE - deduction ))
}

# ---- System resources ----

# Load average
LOAD=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | tr -d ',')
CPUS=$(nproc)
LOAD_INT=$(echo "$LOAD * 10" | bc | cut -d. -f1 2>/dev/null || echo "0")
CPU_INT=$(( CPUS * 10 ))
if (( LOAD_INT > CPU_INT * 2 )); then
    add_issue CRITICAL 20 "Load average ${LOAD} >> ${CPUS} CPUs (severe saturation)"
elif (( LOAD_INT > CPU_INT )); then
    add_issue WARNING 10 "Load average ${LOAD} > ${CPUS} CPUs"
fi

# Memory
MEM_AVAIL_KB=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
MEM_TOTAL_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
MEM_PCT=$(( (MEM_TOTAL_KB - MEM_AVAIL_KB) * 100 / MEM_TOTAL_KB ))
if (( MEM_PCT > 95 )); then
    add_issue CRITICAL 20 "Memory usage ${MEM_PCT}% (near OOM)"
elif (( MEM_PCT > 80 )); then
    add_issue WARNING 10 "Memory usage ${MEM_PCT}%"
fi

# Swap
SWAP_TOTAL=$(grep SwapTotal /proc/meminfo | awk '{print $2}')
SWAP_FREE=$(grep SwapFree /proc/meminfo | awk '{print $2}')
if (( SWAP_TOTAL > 0 )); then
    SWAP_PCT=$(( (SWAP_TOTAL - SWAP_FREE) * 100 / SWAP_TOTAL ))
    if (( SWAP_PCT > 50 )); then
        add_issue WARNING 10 "Swap usage ${SWAP_PCT}% — memory pressure"
    fi
fi

# Disk
while IFS= read -r line; do
    PCT=$(echo "$line" | awk '{print $5}' | tr -d '%')
    MNT=$(echo "$line" | awk '{print $6}')
    [[ "$MNT" == /proc* || "$MNT" == /sys* || "$MNT" == /dev* ]] && continue
    if (( PCT > 95 )); then
        add_issue CRITICAL 20 "Disk ${MNT} at ${PCT}% (critically full)"
    elif (( PCT > 80 )); then
        add_issue WARNING 10 "Disk ${MNT} at ${PCT}%"
    fi
done < <(df -h | tail -n +2 | grep -v "tmpfs\|udev")

# ---- Services ----

check_service() {
    local name="$1"
    local display="${2:-$1}"
    if ! systemctl is-active --quiet "$name" 2>/dev/null; then
        add_issue CRITICAL 20 "Service ${display} is NOT running"
    fi
}

# Core services (check if installed)
systemctl list-units --type=service --all 2>/dev/null | grep -q "angie" && check_service angie "Angie web server"
systemctl list-units --type=service --all 2>/dev/null | grep -q "nginx" && check_service nginx "nginx web server"
systemctl list-units --type=service --all 2>/dev/null | grep -q "postgresql" && check_service "postgresql" "PostgreSQL"
systemctl list-units --type=service --all 2>/dev/null | grep -q "redis-server" && check_service redis-server "Redis"
systemctl list-units --type=service --all 2>/dev/null | grep -q "docker" && check_service docker "Docker"

# Failed systemd units
FAILED=$(systemctl list-units --failed --no-legend 2>/dev/null | grep -c "failed" || true)
if (( FAILED > 0 )); then
    add_issue WARNING 10 "${FAILED} failed systemd unit(s): $(systemctl list-units --failed --no-legend 2>/dev/null | awk '{print $1}' | tr '\n' ' ')"
fi

# ---- PM2 ----
if command -v pm2 &>/dev/null; then
    ERRORED=$(pm2 jlist 2>/dev/null | python3 -c "
import sys, json
apps = json.load(sys.stdin)
bad = [a['name'] for a in apps if a['pm2_env']['status'] not in ('online','stopping')]
print(len(bad), ' '.join(bad))
" 2>/dev/null || echo "0 ")
    COUNT=$(echo "$ERRORED" | awk '{print $1}')
    NAMES=$(echo "$ERRORED" | cut -d' ' -f2-)
    if (( COUNT > 0 )); then
        add_issue CRITICAL 20 "PM2 apps not online: ${NAMES}"
    fi
fi

# ---- SSL certificates ----
if command -v certbot &>/dev/null; then
    while IFS= read -r cert_dir; do
        domain=$(basename "$cert_dir")
        cert_file="${cert_dir}/cert.pem"
        [ -f "$cert_file" ] || continue
        expiry=$(openssl x509 -enddate -noout -in "$cert_file" 2>/dev/null | cut -d= -f2)
        expiry_epoch=$(date -d "$expiry" +%s 2>/dev/null || echo "0")
        now=$(date +%s)
        days=$(( (expiry_epoch - now) / 86400 ))
        if (( days < 0 )); then
            add_issue CRITICAL 20 "SSL cert for ${domain} EXPIRED ${days#-} days ago"
        elif (( days < 7 )); then
            add_issue CRITICAL 20 "SSL cert for ${domain} expires in ${days} days"
        elif (( days < 30 )); then
            add_issue WARNING 5 "SSL cert for ${domain} expires in ${days} days"
        fi
    done < <(find /etc/letsencrypt/live -maxdepth 1 -mindepth 1 -type d 2>/dev/null)
fi

# ---- Security ----
UFW_STATUS=$(ufw status 2>/dev/null | head -1)
if [[ "$UFW_STATUS" != *"active"* ]]; then
    add_issue WARNING 10 "UFW firewall is not active"
fi

if command -v fail2ban-client &>/dev/null; then
    if ! systemctl is-active --quiet fail2ban; then
        add_issue WARNING 5 "fail2ban is not running"
    fi
fi

# OOM events in last 24h
OOM_COUNT=$(dmesg -T 2>/dev/null | grep -ci "oom-killer\|killed process" || true)
if (( OOM_COUNT > 0 )); then
    add_issue WARNING 10 "OOM killer fired ${OOM_COUNT} time(s) since last boot"
fi

# ---- Score ----
(( SCORE < 0 )) && SCORE=0

if (( SCORE >= 90 )); then STATUS="EXCELLENT"
elif (( SCORE >= 70 )); then STATUS="GOOD"
elif (( SCORE >= 50 )); then STATUS="FAIR"
elif (( SCORE >= 30 )); then STATUS="POOR"
else STATUS="CRITICAL"
fi

# ---- Output ----
if $JSON_MODE; then
    python3 -c "
import json, sys
issues = []
for line in sys.argv[1:]:
    parts = line.split('|', 2)
    issues.append({'severity': parts[0], 'deduction': int(parts[1]), 'message': parts[2]})
print(json.dumps({'score': ${SCORE}, 'status': '${STATUS}', 'issues': issues}, indent=2))
" "${ISSUES[@]+"${ISSUES[@]}"}"
else
    echo "============================================"
    echo " Server Health Check — $(date '+%Y-%m-%d %H:%M:%S')"
    echo "============================================"
    echo " Score: ${SCORE}/100  [${STATUS}]"
    echo "============================================"
    if (( ${#ISSUES[@]} == 0 )); then
        echo " No issues found."
    else
        for issue in "${ISSUES[@]}"; do
            sev=$(echo "$issue" | cut -d'|' -f1)
            ded=$(echo "$issue" | cut -d'|' -f2)
            msg=$(echo "$issue" | cut -d'|' -f3)
            printf " [%-8s] -%s  %s\n" "$sev" "$ded" "$msg"
        done
    fi
    echo "============================================"
fi
