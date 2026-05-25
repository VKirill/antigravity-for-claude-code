# nginx — Configuration Reference (Ubuntu 24.04)

nginx 1.26.x (stable) / 1.28.x (mainline) as of 2026. The Angie fork is 100%
config-compatible — every directive here works in Angie too. Use `nginx -t` or
`angie -t` before reload. See `angie.md` for Angie-specific features (ACME,
REST API, HTTP/3, Prometheus).

## Installation

```bash
# Ubuntu 24.04 ships nginx 1.24 — use the official nginx repo for 1.26+
curl -fsSL https://nginx.org/keys/nginx_signing.key | gpg --dearmor \
  -o /usr/share/keyrings/nginx.gpg
echo "deb [signed-by=/usr/share/keyrings/nginx.gpg] \
  http://nginx.org/packages/ubuntu noble nginx" \
  > /etc/apt/sources.list.d/nginx.list
apt update && apt install -y nginx
systemctl enable --now nginx
nginx -v  # nginx/1.26.x
```

## File Layout

```
/etc/nginx/
├── nginx.conf              # Global config
├── conf.d/                 # Drop-in config files (loaded via include)
├── sites-available/        # Vhost definitions
├── sites-enabled/          # Symlinks to active vhosts
├── modules-enabled/        # Dynamic modules
├── mime.types
├── fastcgi_params
└── snippets/               # Reusable config snippets
```

Logs: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`

## Core nginx.conf

```nginx
user www-data;
worker_processes auto;
worker_rlimit_nofile 65535;
pid /run/nginx.pid;
error_log /var/log/nginx/error.log warn;

events {
    worker_connections 8192;
    multi_accept on;
    use epoll;
}

http {
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 4096;
    server_tokens off;
    client_max_body_size 100m;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" $request_time';
    access_log /var/log/nginx/access.log main;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 4;
    gzip_min_length 1000;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml text/javascript image/svg+xml;

    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
```

## Reverse Proxy Template

```nginx
upstream app_backend {
    server 127.0.0.1:3000;
    keepalive 32;
}

map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;                       # nginx 1.25.1+ — separate directive
    server_name example.com;

    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_stapling        on;
    ssl_stapling_verify on;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass         http://app_backend;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection $connection_upgrade;
        proxy_set_header   Host       $host;
        proxy_set_header   X-Real-IP  $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_cache_bypass $http_upgrade;
    }

    location /healthz {
        proxy_pass http://app_backend;
        access_log off;
    }

    access_log /var/log/nginx/example.com.access.log main;
    error_log  /var/log/nginx/example.com.error.log;
}
```

## Static Site (nginx / Angie)

```nginx
server {
    listen 443 ssl;
    http2 on;
    server_name static.example.com;

    root /var/www/static.example.com;
    index index.html;

    ssl_certificate     /etc/letsencrypt/live/static.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/static.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache immutable assets
    location ~* \.(js|css|woff2?|ico|png|jpg|svg|gif|webp)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # No caching for HTML
    location ~* \.html$ {
        add_header Cache-Control "no-cache";
    }

    gzip_static on;   # serve pre-gzipped .gz files if available
}
```

## Rate Limiting

```nginx
# Define zones in http {} block
limit_req_zone $binary_remote_addr zone=general:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=api:10m      rate=10r/s;
limit_req_zone $binary_remote_addr zone=login:10m    rate=5r/m;

# Apply in server or location block
location /api/ {
    limit_req zone=api burst=20 nodelay;
    limit_req_status 429;
    proxy_pass http://app_backend;
}

location /auth/login {
    limit_req zone=login burst=3 nodelay;
    proxy_pass http://app_backend;
}
```

## HTTP/3 (nginx 1.25+ with QUIC support)

```nginx
server {
    listen 443 ssl;
    listen 443 quic reuseport;  # HTTP/3
    http2 on;
    http3 on;

    add_header Alt-Svc 'h3=":443"; ma=86400' always;

    # ... SSL config ...
}
```

Note: QUIC requires UDP port 443 in UFW: `ufw allow 443/udp`

## Log Rotation

nginx logs are handled by logrotate. Default config at
`/etc/logrotate.d/nginx`. To customize:

```
/var/log/nginx/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        nginx -s reopen 2>/dev/null || true
    endscript
}
```

Test rotation: `logrotate -d /etc/logrotate.d/nginx`
Force rotation: `logrotate -f /etc/logrotate.d/nginx`

## Key Operations

```bash
# Test config (ALWAYS before reload)
nginx -t

# Reload (graceful — no connection drop)
systemctl reload nginx

# Full restart (drops connections)
systemctl restart nginx

# Status
systemctl status nginx
nginx -V   # compiled modules and flags

# Add new site
cp /etc/nginx/sites-available/example.conf /etc/nginx/sites-available/newsite.conf
ln -s /etc/nginx/sites-available/newsite.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Remove site
rm /etc/nginx/sites-enabled/newsite.conf
nginx -t && systemctl reload nginx

# Debug upstream errors
tail -f /var/log/nginx/error.log | grep upstream
```

## Common Error Patterns

| Error | Cause | Fix |
|-------|-------|-----|
| `connect() failed (111)` | App not listening on port | Start the app, check port |
| `upstream timed out` | App too slow | Increase `proxy_read_timeout` |
| `no live upstreams` | All backends down | Check all app instances |
| `SSL_CTX_use_certificate` | Bad cert path | Verify cert file exists |
| `bind() to 0.0.0.0:80 failed` | Port in use or no permission | `ss -tlnp \| grep :80` |
| `open() "/var/log/nginx/" failed` | Permission error | `chown www-data /var/log/nginx` |

## Caddy (cascade marker — out of scope)

Caddy v2 provides automatic HTTPS via Let's Encrypt/ZeroSSL with zero config.
Its `Caddyfile` is simpler than nginx syntax. Use Caddy for new small projects
where ease trumps control; use nginx/Angie for production stacks that need
fine-grained control, rate limiting, and custom modules.

## Traefik (cascade marker — out of scope)

Traefik v3 is a cloud-native reverse proxy designed for dynamic environments
(Docker labels, Kubernetes ingress). On a single Ubuntu host it adds operational
overhead vs nginx/Angie. Prefer Traefik when containers define their own routing
via labels and the number of services changes frequently.
