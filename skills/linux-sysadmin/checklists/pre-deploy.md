# Pre-Deploy Checklist

Run before deploying any change to a production server. The goal is to prevent
downtime caused by missing verification steps.

## Before You Start

- [ ] **Backup made** — config + DB dump before any structural change:
  ```bash
  # Config backup
  cp /etc/angie/sites-enabled/domain.conf /etc/angie/sites-enabled/domain.conf.bak.$(date +%s)
  # DB backup
  pg_dump -U postgres -Fc mydb > /var/backups/mydb_$(date +%Y%m%d_%H%M).dump
  ```
- [ ] **Rollback plan documented** — know exactly how to undo this change
- [ ] **Maintenance window communicated** (if downtime possible)
- [ ] **Health baseline captured**:
  ```bash
  uptime && free -h && df -h
  pm2 status
  curl -sI https://your-domain.com | head -3
  ```

## Application Code Deploy

- [ ] Dependencies updated? `npm ci --omit=dev` or `pip install -r requirements.txt`
- [ ] Build succeeded? `npm run build` / `tsc --noEmit`
- [ ] Tests passed? `npm test` (in staging first)
- [ ] Environment variables set? `diff .env.example .env`
- [ ] Database migrations run? (if applicable)
- [ ] PM2 uses reload not restart for zero-downtime? `pm2 reload APP`
- [ ] Post-deploy health check: `curl -s http://localhost:PORT/healthz`

## Web Server Config Change (Angie / nginx)

- [ ] Config tested: `angie -t` → `test is successful`
- [ ] Backup taken before edit (see above)
- [ ] Reload, not restart: `systemctl reload angie`
- [ ] Verify site loads: `curl -I https://your-domain.com`
- [ ] Check error log for new errors: `tail -20 /var/log/angie/error.log`

## Database Migration

- [ ] Backup taken immediately before:
  ```bash
  pg_dump -U postgres -Fc mydb > /var/backups/mydb_pre_migration_$(date +%Y%m%d_%H%M).dump
  ```
- [ ] Migration is additive (no column drops or renames that break running code)?
- [ ] Test rollback script exists?
- [ ] Connection count normal before starting:
  ```bash
  psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"
  ```
- [ ] Migration completed without errors?
- [ ] Post-migration: `VACUUM ANALYZE table_name;` (for large tables)

## SSL Certificate

- [ ] Cert valid and not near expiry:
  ```bash
  certbot certificates
  # or
  openssl x509 -in /etc/letsencrypt/live/domain/cert.pem -noout -dates
  ```
- [ ] certbot timer active: `systemctl status certbot.timer`
- [ ] Deploy hook in place: `ls /etc/letsencrypt/renewal-hooks/deploy/`

## Firewall Change

- [ ] Current rules documented: `ufw status verbose`
- [ ] **SSH port verified BEFORE adding deny rules**: `grep "^Port" /etc/ssh/sshd_config`
- [ ] New rule added correctly: `ufw allow PORT/tcp`
- [ ] Tested from a second session (don't close first until confirmed)
- [ ] Docker bypass considered: bound to 127.0.0.1 not 0.0.0.0?

## systemd Service

- [ ] Unit file syntax valid: `systemd-analyze verify /etc/systemd/system/myapp.service`
- [ ] `systemctl daemon-reload` run after unit file change
- [ ] Service started/restarted: `systemctl restart myapp`
- [ ] Status clean: `systemctl status myapp` → `active (running)`
- [ ] Logs clean: `journalctl -u myapp -n 20 --no-pager`
- [ ] Enabled for boot: `systemctl is-enabled myapp` → `enabled`

## Docker Change

- [ ] Compose config valid: `docker compose config`
- [ ] New image pulled: `docker compose pull`
- [ ] Old container stopped gracefully before replacing:
  ```bash
  docker compose up -d --no-deps app   # replace only the 'app' service
  ```
- [ ] Health check passes: `docker inspect --format='{{.State.Health.Status}}' CTR`
- [ ] Logs clean: `docker logs --tail 50 CTR`

## Post-Deploy Verification (ALL deploy types)

- [ ] `curl -sI https://your-domain.com | head -3` → `200 OK`
- [ ] `pm2 status` / `docker ps` → all running, 0 unexpected restarts
- [ ] `journalctl -p err --since "5 minutes ago" --no-pager` → no new errors
- [ ] `df -h` → disk still has headroom
- [ ] `free -h` → memory usage normal
- [ ] `tail -20 /var/log/angie/error.log` → no upstream errors
