# Redis — ACL & Security

## ACL — fine-grained users

Since Redis 6. Each connection is bound to a user with command/key permissions.

### Creating users

```
ACL SETUSER app on >secret-password ~cache:* ~session:* +get +set +del +expire +exists +ttl +scan
ACL SETUSER reporter on >reporter-pass ~analytics:* +@read
ACL SETUSER ci on >ci-pass ~* +@all -DEBUG -FLUSHDB -FLUSHALL -CONFIG
```

### Syntax pieces

| Prefix | Meaning |
|---|---|
| `on` / `off` | enable / disable login |
| `>password` | add password |
| `<password` | remove password |
| `nopass` | password-less (NOT for production) |
| `resetpass` | clear all passwords |
| `~pattern` | allow key pattern (glob: `*`, `?`, `[ab]`) |
| `&pattern` | allow Pub/Sub channel pattern |
| `+command` | allow command |
| `-command` | deny command |
| `+@category` | allow ACL category (`@read`, `@write`, `@admin`, `@dangerous`, `@all`) |
| `-@category` | deny category |
| `+command|subcommand` | allow only a subcommand (e.g., `+config\|get`) |
| `reset` | start fresh (no perms) |

### Categories

```
ACL CAT          -- list all categories
ACL CAT @write   -- commands in the @write category
```

Common: `@read`, `@write`, `@admin`, `@dangerous`, `@connection`, `@pubsub`, `@scripting`, `@hash`, `@set`, `@sortedset`, `@geo`, `@stream`, `@bitmap`, `@hyperloglog`.

### Inspecting

```
ACL LIST
ACL GETUSER app
ACL WHOAMI            -- who am I right now
```

### Persisting ACLs

```conf
# /etc/redis/redis.conf
aclfile /etc/redis/users.acl
```

Then:

```
ACL SAVE              -- writes current ACLs to aclfile
ACL LOAD              -- reload from aclfile
```

Or inline in `redis.conf`:

```conf
user default off
user app on >secret ~cache:* +@read +@write
```

### Typical role split

```
ACL SETUSER default off                                 # disable the default user
ACL SETUSER app      on >$APP_PASS  ~app:* ~cache:* +@read +@write -FLUSHDB -FLUSHALL -CONFIG -DEBUG -SHUTDOWN
ACL SETUSER worker   on >$WORK_PASS ~queue:* ~app:* +@all -FLUSHDB -FLUSHALL -CONFIG
ACL SETUSER reporter on >$REP_PASS  ~*       +@read
ACL SETUSER admin    on >$ADM_PASS  ~*       +@all
```

## TLS

```conf
tls-port 6379
port 0                                                  # disable plaintext
tls-cert-file /etc/redis/redis.crt
tls-key-file  /etc/redis/redis.key
tls-ca-cert-file /etc/redis/ca.crt
tls-auth-clients yes
tls-protocols "TLSv1.2 TLSv1.3"
tls-ciphers TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384
tls-ciphersuites TLS_CHACHA20_POLY1305_SHA256
```

Generate certs with your CA. `tls-auth-clients yes` requires clients to present a cert (mTLS).

### Client

```ts
new Redis({
  host: 'redis.internal',
  port: 6379,
  tls: {
    ca: fs.readFileSync('ca.crt'),
    cert: fs.readFileSync('client.crt'),
    key: fs.readFileSync('client.key'),
    rejectUnauthorized: true,
    servername: 'redis.internal',
  },
});
```

## Command renaming (defense in depth)

```conf
rename-command FLUSHDB ""           # disable
rename-command FLUSHALL ""
rename-command CONFIG "CONFIG_x9k2zP"   # rename to a secret string
rename-command DEBUG ""
rename-command KEYS ""              # if you want to ban it
```

Use `""` to disable; rename to a secret to allow only admins who know the secret.

## Bind & protected mode

```conf
bind 127.0.0.1 ::1                 # only loopback
# or
bind 192.168.1.10 ::1               # private interface

protected-mode yes                  # refuse external conns without password / bind
requirepass <fallback-password>     # legacy single-password (pre-ACL); set in addition to ACLs
```

Never expose Redis to the public internet without auth + TLS.

## Firewall

UFW (Ubuntu):

```bash
sudo ufw allow from 10.0.0.0/24 to any port 6379 proto tcp
sudo ufw deny 6379
```

Pair with VPC peering / private subnets so Redis ports are never publicly routable.

## Slow-log monitoring

```
CONFIG SET slowlog-log-slower-than 10000      -- microseconds (10ms)
SLOWLOG GET 20
SLOWLOG RESET
```

Spot expensive commands (`KEYS`, big `HGETALL`, expensive Lua).

## Latency monitoring

```
CONFIG SET latency-monitor-threshold 100
LATENCY LATEST
LATENCY HISTORY event
LATENCY GRAPH event
LATENCY DOCTOR
```

## Audit log

Redis has no built-in audit log of all commands. Workarounds:
- `MONITOR` — streams ALL commands (massive perf hit; debug only)
- Wrap clients in app code with structured logging
- Use `pgaudit`-style external proxies

## Common pitfalls

- ❌ `requirepass` with a short password — try `>` (passes are hashed but a weak pass is still bruteable)
- ❌ Leaving `default` user enabled with `nopass`
- ❌ Allowing `+@all` to the app user — blast-radius lock-in
- ❌ Renaming dangerous commands but logging the new name in chat
- ❌ TLS without `rejectUnauthorized: true` → MitM possible
- ❌ Mixing ACL config in `redis.conf` and via `ACL SETUSER` at runtime → `ACL SAVE` overwrites the file
- ❌ Forgetting to firewall the cluster bus port (`16379` when port is 6379) → cluster vulnerable
