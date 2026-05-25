# TLS / Certificates Reference (Ubuntu 24.04)

## Certbot (Let's Encrypt)

### Install

```bash
apt install -y certbot python3-certbot-nginx   # nginx plugin
# or for manual / webroot
apt install -y certbot
```

### Obtain certificate

```bash
# Webroot method (requires nginx/Angie serving port 80)
certbot certonly --webroot \
  -w /var/www/html \
  -d example.com -d www.example.com \
  --email admin@example.com --agree-tos --no-eff-email

# Nginx plugin (modifies nginx config automatically)
certbot --nginx -d example.com -d www.example.com

# Standalone (stops nginx, binds port 80 itself)
systemctl stop nginx
certbot certonly --standalone -d example.com
systemctl start nginx

# Wildcard (DNS challenge — requires DNS API hook)
certbot certonly --manual --preferred-challenges dns \
  -d example.com -d "*.example.com"
```

### Certificate paths

```
/etc/letsencrypt/
├── live/example.com/
│   ├── fullchain.pem   # cert + intermediates → use in ssl_certificate
│   ├── privkey.pem     # private key → use in ssl_certificate_key
│   ├── cert.pem        # leaf cert only
│   └── chain.pem       # intermediates only
├── archive/            # actual files (live/ symlinks here)
├── renewal/            # renewal configs
└── accounts/           # ACME account keys
```

### Auto-renewal

```bash
# Timer (Ubuntu installs this automatically)
systemctl status certbot.timer
systemctl list-timers certbot*

# Test dry run
certbot renew --dry-run

# Force renew (even if cert not near expiry)
certbot renew --force-renewal --cert-name example.com

# Reload web server after renewal
# Add to /etc/letsencrypt/renewal/example.com.conf:
# [renewalparams]
# renew_hook = systemctl reload nginx
```

### Deploy hooks

```bash
# /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
#!/bin/bash
systemctl reload nginx   # or: systemctl reload angie
```

```bash
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

Hooks run after each successful renewal. Use `deploy/` for post-renewal actions.

### List / inspect

```bash
certbot certificates                   # all managed certs + expiry
openssl x509 -in /etc/letsencrypt/live/example.com/cert.pem -noout -dates
openssl s_client -connect example.com:443 -servername example.com </dev/null 2>/dev/null \
  | openssl x509 -noout -dates
```

---

## acme.sh (alternative to Certbot)

acme.sh is a pure-shell ACME client. Preferred when you need DNS-provider hooks
without Python dependencies or when using EAB credentials.

```bash
curl -fsSL https://get.acme.sh | sh -s email=admin@example.com
# Installs to ~/.acme.sh/, adds cron for renewal

# Issue via webroot
~/.acme.sh/acme.sh --issue -d example.com -w /var/www/html

# Issue via DNS (Cloudflare example)
export CF_Key="..." CF_Email="..."
~/.acme.sh/acme.sh --issue --dns dns_cf -d "*.example.com" -d example.com

# Install to target directory
~/.acme.sh/acme.sh --install-cert -d example.com \
  --cert-file      /etc/nginx/ssl/example.com.crt \
  --key-file       /etc/nginx/ssl/example.com.key \
  --fullchain-file /etc/nginx/ssl/example.com.fullchain.crt \
  --reloadcmd      "systemctl reload nginx"

# List
~/.acme.sh/acme.sh --list

# Renew all (also runs automatically via cron)
~/.acme.sh/acme.sh --renew-all
```

---

## Angie Built-in ACME

See `angie.md` for full coverage. Short summary:

```nginx
http {
    resolver 127.0.0.53;
    acme_client letsencrypt https://acme-v02.api.letsencrypt.org/directory;

    server {
        listen 80;
        listen 443 ssl;
        server_name example.com;

        acme letsencrypt;
        ssl_certificate     $acme_cert_letsencrypt;
        ssl_certificate_key $acme_cert_key_letsencrypt;
    }
}
```

Storage: `/var/lib/angie/acme/`. No cron, no hooks needed — Angie renews
automatically.

---

## TLS Best Practices (nginx / Angie)

```nginx
# Modern TLS — TLSv1.2 + TLSv1.3 only (drop TLSv1.0/1.1)
ssl_protocols TLSv1.2 TLSv1.3;

# Strong cipher suite (ECDHE priority, no weak ciphers)
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
ssl_prefer_server_ciphers off;   # TLSv1.3 ignores this; let client pick

# Session resumption
ssl_session_cache   shared:SSL:10m;
ssl_session_timeout 1d;
ssl_session_tickets off;   # disable if using multiple workers without ticket rotation

# OCSP stapling
ssl_stapling        on;
ssl_stapling_verify on;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;

# HSTS (only add once you're sure HTTPS works)
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
```

## OCSP Stapling Explained

OCSP stapling: the server fetches and caches the certificate revocation status
from the CA, then includes it in the TLS handshake. This avoids the client
making a separate OCSP request (privacy + speed improvement).

Requirements:
- `ssl_stapling on;` + `ssl_stapling_verify on;`
- `ssl_trusted_certificate` must point to the chain file if using self-obtained certs
- A working resolver (e.g. `resolver 8.8.8.8;`)

Verify stapling: `openssl s_client -connect example.com:443 -status -servername example.com`
Look for: `OCSP Response Status: successful`

## HSTS Preload

1. Set long max-age: `max-age=31536000` minimum (1 year)
2. Include `includeSubDomains` only if ALL subdomains serve HTTPS
3. Add `preload` directive
4. Submit at https://hstspreload.org

**Warning**: adding `preload` to HSTS is near-irreversible. The domain stays in
browser preload lists for months after removal.

## Certificate Expiry Monitoring

```bash
# Check expiry of all certbot-managed certs
certbot certificates | grep "Expiry Date"

# Check remote endpoint
echo | openssl s_client -connect example.com:443 -servername example.com 2>/dev/null \
  | openssl x509 -noout -enddate

# Script to alert on certs expiring within 14 days
for domain in /etc/letsencrypt/live/*/cert.pem; do
  expiry=$(openssl x509 -enddate -noout -in "$domain" | cut -d= -f2)
  expiry_epoch=$(date -d "$expiry" +%s)
  now=$(date +%s)
  days_left=$(( (expiry_epoch - now) / 86400 ))
  name=$(echo "$domain" | cut -d/ -f6)
  [ $days_left -lt 14 ] && echo "WARN: $name expires in $days_left days"
done
```

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `OCSP stapling not enabled` | Missing resolver | Add `resolver 8.8.8.8;` |
| `certbot renew` fails | Port 80 blocked | Check UFW, check Angie config for `/.well-known/acme-challenge` |
| `SSL_ERROR_RX_RECORD_TOO_LONG` | HTTP on HTTPS port | Connecting to port 80 instead of 443 |
| Cert renewed but old cert served | Web server not reloaded | Add deploy hook or `systemctl reload nginx` |
| `Chain issues` on SSL checker | Using `cert.pem` not `fullchain.pem` | Use `fullchain.pem` for `ssl_certificate` |
