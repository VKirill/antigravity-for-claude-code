# Incident Response Checklist

Use this checklist during active incidents. Work top-down — don't skip steps
unless you're certain a category is irrelevant.

## 1. Triage (First 5 minutes)

- [ ] **What is the impact?** (site down / slow / data issue / security breach)
- [ ] **When did it start?** (approximate timestamp — check monitoring, access logs)
- [ ] **What changed recently?** (deployment, config change, cron job, traffic spike)
- [ ] **Who is affected?** (all users / specific region / specific feature)

```bash
# Quick state snapshot
uptime && free -h && df -h && systemctl list-units --failed
pm2 status
docker ps --format "table {{.Names}}\t{{.Status}}"
```

## 2. Service Status

- [ ] Is the web server responding?
  ```bash
  curl -I https://your-domain.com
  systemctl status angie    # or nginx
  ```
- [ ] Is the app running?
  ```bash
  pm2 status
  docker ps
  ss -tlnp | grep :PORT
  ```
- [ ] Is the database healthy?
  ```bash
  pg_isready
  redis-cli ping
  ```
- [ ] Any failed systemd units?
  ```bash
  systemctl list-units --failed
  ```

## 3. Logs (First Pass)

- [ ] Web server error log:
  ```bash
  tail -100 /var/log/angie/error.log
  journalctl -u angie -n 100 --no-pager
  ```
- [ ] App log:
  ```bash
  pm2 logs APP_NAME --err --lines 100 --nostream
  docker logs --tail 100 CONTAINER
  ```
- [ ] System errors:
  ```bash
  journalctl -p err --since "2h ago" --no-pager
  dmesg -T | grep -iE "oom|killed|error" | tail -20
  ```

## 4. Resources

- [ ] CPU:
  ```bash
  top -bn1 | head -20
  ps aux --sort=-%cpu | head -10
  ```
- [ ] Memory / OOM:
  ```bash
  free -h
  dmesg -T | grep -iE "oom|killed"
  ```
- [ ] Disk:
  ```bash
  df -h
  df -ih    # inodes
  ```
- [ ] I/O saturation:
  ```bash
  iostat -x 1 3
  ```

## 5. Network

- [ ] Firewall blocking?
  ```bash
  ufw status verbose
  curl -I localhost:PORT    # test from server itself
  ```
- [ ] DNS issue?
  ```bash
  dig your-domain.com @8.8.8.8
  curl -I https://your-domain.com --resolve your-domain.com:443:SERVER_IP
  ```
- [ ] fail2ban blocking legit traffic?
  ```bash
  fail2ban-client status sshd
  fail2ban-client status nginx-limit-req
  ```

## 6. Database

- [ ] Long-running queries locking things?
  ```bash
  psql -U postgres -c "
  SELECT pid, now()-query_start AS dur, state, left(query,80)
  FROM pg_stat_activity WHERE state!='idle' ORDER BY dur DESC LIMIT 10;"
  ```
- [ ] Kill stuck query if identified:
  ```bash
  psql -U postgres -c "SELECT pg_terminate_backend(PID);"
  ```
- [ ] Connection pool exhausted?
  ```bash
  psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"
  # Compare to max_connections in postgresql.conf
  ```

## 7. Immediate Mitigations

Depending on cause:

| Cause | Action |
|-------|--------|
| App crashed | `pm2 restart APP` or `docker restart CTR` |
| Config bad | Restore backup: `cp file.bak.TIMESTAMP file` + reload |
| Disk full | `journalctl --vacuum-time=3d` / `docker system prune -f` / `find /tmp -mtime +1 -delete` |
| OOM | Restart app, add swap, scale RAM |
| DDoS / flood | `ufw deny from IP` / `fail2ban-client set jail banip IP` |
| SSL cert expired | `certbot renew --force-renewal && systemctl reload angie` |
| DB connection fail | Check `pg_isready`, check pg_hba.conf, restart postgres |

## 8. Rollback

- [ ] Identify what changed last (git log, systemctl show --property ExecStart, PM2 describe)
- [ ] Rollback: `git checkout PREVIOUS_SHA && npm run build && pm2 reload APP`
- [ ] Config rollback: `cp /etc/angie/file.bak.TIMESTAMP /etc/angie/file && angie -t && systemctl reload angie`
- [ ] Document rollback in incident ticket

## 9. Verification

- [ ] Service responds: `curl -I https://your-domain.com` → `200 OK`
- [ ] Error rate back to normal: check Angie error log, PM2 logs
- [ ] Resources stable: `watch -n5 'free -h && df -h && uptime'`
- [ ] No further OOM/kill events: `dmesg -T | grep -iE "oom|killed" | tail -5`

## 10. Post-Incident

- [ ] **Timeline**: when detected, when resolved, duration
- [ ] **Root cause**: one sentence
- [ ] **Impact**: users affected, services down, data loss (if any)
- [ ] **Mitigations applied**: what fixed it
- [ ] **Action items**: to prevent recurrence
  - Alert/monitoring gaps?
  - Config that should have been validated?
  - Dependency that should have been health-checked?
