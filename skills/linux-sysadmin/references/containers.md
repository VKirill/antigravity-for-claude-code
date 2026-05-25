# Containers Reference — Docker Engine 29 + Podman (Ubuntu 24.04)

## Docker Engine 29

Docker Engine 29 raises the minimum API version to 1.44. The containerd image
store is the default for new installs. Go import path moved to `github.com/moby/moby`.

### Install (Ubuntu 24.04)

```bash
# Official Docker repo (not the Ubuntu snap)
apt remove -y docker.io docker-compose containerd runc 2>/dev/null
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu noble stable" \
  > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

systemctl enable --now docker
docker version
```

### Daemon configuration

```json
// /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "3"
  },
  "default-address-pools": [
    {"base": "172.20.0.0/16", "size": 24}
  ],
  "iptables": true,
  "live-restore": true
}
```

Apply: `systemctl reload docker` (or `restart` if live-restore is being enabled).

### Key discovery commands

```bash
docker version                               # Engine + API version
docker info                                  # detailed info: storage driver, etc.
docker ps                                    # running containers
docker ps -a                                 # all (including stopped)
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
docker stats --no-stream                     # current CPU/RAM per container
docker system df                             # disk usage (images/containers/volumes)
docker network ls
docker volume ls
```

### Container lifecycle

```bash
docker run -d --name myapp \
  --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \     # bind to localhost only (Angie proxies it)
  -v /opt/myapp/data:/app/data \
  -e NODE_ENV=production \
  myapp:latest

docker stop myapp        # SIGTERM → wait 10s → SIGKILL
docker start myapp
docker restart myapp
docker rm myapp          # remove (must be stopped)
docker rm -f myapp       # force remove (even if running)

# Exec into container
docker exec -it myapp /bin/sh   # or /bin/bash
docker exec myapp cat /etc/resolv.conf

# Logs
docker logs --tail 200 --timestamps myapp
docker logs -f myapp             # follow
docker logs --since 1h myapp
```

### Compose v2

Always `docker compose` (space), never `docker-compose` (removed).

```yaml
# docker-compose.yml
version: "3.9"

services:
  app:
    image: myapp:latest
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"   # localhost only
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    volumes:
      - app-data:/app/data
    depends_on:
      db:
        condition: service_healthy
    networks:
      - backend
    logging:
      driver: json-file
      options:
        max-size: "50m"
        max-file: "3"

  db:
    image: postgres:18
    restart: unless-stopped
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: myapp
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    volumes:
      - pg-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U myapp"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - backend

volumes:
  app-data:
  pg-data:

networks:
  backend:
    driver: bridge
```

```bash
# Validate config
docker compose config

# Start
docker compose up -d

# Stop and remove containers (volumes preserved)
docker compose down

# Stop + remove volumes (destructive — ask user first)
docker compose down -v

# Update images + restart
docker compose pull && docker compose up -d

# Logs
docker compose logs --tail 50 app
docker compose logs -f

# Scale
docker compose up -d --scale app=3

# Status
docker compose ps --format json
```

### Cleanup (safe)

```bash
docker container prune -f        # stopped containers
docker image prune -f            # dangling images (no tag)
docker image prune -a -f         # all unused images (be careful)
docker network prune -f
docker buildx prune -f           # build cache

# NEVER auto-delete volumes — check first
docker volume ls -f dangling=true
# docker volume prune -f   ← only after confirming contents are recoverable
```

### Security

```bash
# Run as non-root inside container (Dockerfile)
# RUN adduser --disabled-password --gecos '' appuser
# USER appuser

# Read-only filesystem
docker run --read-only --tmpfs /tmp myapp:latest

# Drop capabilities
docker run --cap-drop ALL --cap-add NET_BIND_SERVICE myapp:latest

# No privilege escalation
docker run --security-opt no-new-privileges myapp:latest

# Check what a container is doing
docker exec myapp cat /proc/1/status
docker inspect myapp | jq '.[].HostConfig.SecurityOpt'

# Audit: containers running as root
docker inspect $(docker ps -q) --format '{{.Name}} user={{.Config.User}}' | grep "user=$"
```

### UFW + Docker interaction

Docker writes iptables rules that bypass UFW. This means `ufw deny 5432` will
NOT block a container exposing port 5432 via `-p 5432:5432`. Mitigations:
1. Bind to localhost: `-p 127.0.0.1:5432:5432` (only processes on host can connect)
2. Use `"iptables": false` in daemon.json + manage rules manually
3. Use `ufw-docker` utility

### Engine 29 gotchas

- Tooling parsing `docker version --format json`: top-level keys changed — update parsers
- Old Portainer / Ansible `docker_compose_v2` versions: `KeyError: 'ApiVersion'` → update
- Default containerd snapshotter on new installs: to keep overlay2, set
  `"features": {"containerd-snapshotter": false}` in daemon.json before first start

---

## Podman (alternative)

Podman is a daemonless container runtime that is OCI-compatible with Docker.
No root daemon — containers run as the user who starts them (rootless mode).

```bash
# Install
apt install -y podman podman-compose

# Mostly Docker-compatible CLI
podman run -d --name myapp -p 3000:3000 myapp:latest
podman ps
podman logs myapp
podman stop myapp

# Rootless (run as ubuntu user, not root)
# Containers use user namespace mapping, no root required
podman run --rm busybox id    # shows uid=0(root) inside, but maps to ubuntu outside

# Compose compatibility
podman-compose up -d

# System service for rootless container (systemd user unit)
podman generate systemd --new --name myapp > ~/.config/systemd/user/myapp.service
systemctl --user enable --now myapp

# Differences from Docker:
# - No daemon (start/stop/crash of podman has no effect on containers)
# - No docker.sock by default
# - podman-compose not as mature as docker compose
# - Use for dev environments or security-sensitive setups

# Kubernetes YAML generation (from running containers)
podman generate kube myapp > myapp.yaml
```

## Kubernetes (cascade marker — out of single-host scope)

Kubernetes (k8s) is a container orchestration platform for managing clusters.
It is out of scope for this single-host Linux admin skill. On a single Ubuntu
server, use Docker Compose (or plain Docker) managed by systemd. Consider k8s
(via k3s for edge, or managed GKE/EKS/AKS for production) when you need:
horizontal pod scaling, rolling deployments across multiple nodes, service mesh,
or a full control plane. Key tools: `kubectl`, `helm`, `k3s`, `kubeadm`.
