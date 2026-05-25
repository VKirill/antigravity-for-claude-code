# Graceful Shutdown — Fastify 5 + PM2 + Kubernetes

## Scenario

A Fastify server handling HTTP traffic must shut down cleanly when:
- PM2 sends `SIGTERM` (rolling restart, `pm2 reload`)
- Kubernetes sends `SIGTERM` during pod replacement
- Operator runs `SIGINT` (Ctrl-C in development)

"Clean" means: stop accepting new requests → drain in-flight requests → close DB pool → close Redis → exit 0.

## Why this matters

Skipping graceful shutdown causes:
- **Connection resets** on in-flight requests (visible to users as errors)
- **Database connection leaks** (Postgres complains about abrupt disconnects)
- **Corrupted job state** when BullMQ workers die mid-job
- **Kubernetes readiness flap** when old pods receive traffic after SIGTERM

---

## Step 1 — Register signal handlers once at startup

```ts
// src/app/index.ts
import { buildServer } from './server.js'
import { getDb, closeDb } from '../shared/lib/db.js'
import { getRedis, closeRedis } from '../shared/lib/redis.js'

async function main(): Promise<void> {
  const app = await buildServer()
  const db    = await getDb()
  const redis = await getRedis()

  setupShutdown(app, async () => {
    await closeDb(db)
    await closeRedis(redis)
  })

  await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' })

  // Tell PM2 the process is ready (wait_ready: true in ecosystem.config)
  if (process.send) process.send('ready')
}

main().catch((err) => {
  console.error('Startup failed:', err)
  process.exit(1)
})
```

## Step 2 — Shutdown handler

```ts
// src/app/shutdown.ts
import type { FastifyInstance } from 'fastify'

export function setupShutdown(
  app: FastifyInstance,
  closeExternal: () => Promise<void>,
): void {
  let isShuttingDown = false

  const shutdown = async (signal: string): Promise<void> => {
    // Guard: SIGTERM + SIGINT could fire simultaneously (rare but possible)
    if (isShuttingDown) return
    isShuttingDown = true

    app.log.info({ signal }, 'Received shutdown signal')

    // Deadman timer — kills the process if shutdown takes > 30s
    // .unref() so it doesn't keep the event loop alive on its own
    const deadline = setTimeout(() => {
      app.log.error('Graceful shutdown timed out (30s), forcing exit(1)')
      process.exit(1)
    }, 30_000)
    deadline.unref()

    try {
      // 1. Stop accepting new HTTP connections; drain existing ones
      //    Fastify.close() calls server.close() + runs onClose hooks
      await app.close()
      app.log.info('HTTP server closed')

      // 2. Close external resources in dependency order
      //    (anything that might still have pending queries)
      await closeExternal()
      app.log.info('External resources closed')

      clearTimeout(deadline)
      app.log.info('Shutdown complete — exit(0)')
      process.exit(0)
    } catch (err) {
      app.log.error({ err }, 'Error during shutdown — exit(1)')
      process.exit(1)
    }
  }

  // process.once (not process.on) — prevents double-invocation if both signals fire
  process.once('SIGTERM', () => shutdown('SIGTERM'))
  process.once('SIGINT',  () => shutdown('SIGINT'))

  // Unhandled rejection backstop — Node 24 exits by default, but log it first
  process.on('unhandledRejection', (reason) => {
    app.log.error({ reason }, 'Unhandled promise rejection')
    // Don't call shutdown() here — let Node 24 exit naturally
  })
}
```

## Step 3 — Fastify onClose hooks for plugins

For Fastify plugins that own resources, register cleanup via `onClose`:

```ts
// src/shared/lib/db.ts
import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'

export default fp(async function dbPlugin(app: FastifyInstance) {
  const pool = createDatabasePool()

  app.decorate('db', pool)

  // Runs when app.close() is called
  app.addHook('onClose', async () => {
    await pool.end()
    app.log.info('Database pool closed')
  })
})
```

## Step 4 — PM2 ecosystem config

```js
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: '{{app_name}}',
    script: 'dist/app/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    wait_ready: true,         // wait for process.send('ready') before marking up
    listen_timeout: 10000,    // ms to wait for 'ready' signal
    kill_timeout: 35000,      // ms before PM2 force-kills (> shutdown deadline)
    shutdown_with_message: false,
    env_production: {
      NODE_ENV: 'production',
    },
  }],
}
```

`pm2 reload {{app_name}}` sends SIGTERM to each worker in sequence; new workers start before old ones die — zero downtime rolling restart.

## Step 5 — Kubernetes preStop hook

Kubernetes sends SIGTERM immediately when a pod is being terminated, but the load balancer (kube-proxy iptables rules) may still route traffic to the pod for 1–5 seconds. The `preStop` hook adds a sleep buffer:

```yaml
# k8s/deployment.yaml (relevant section)
spec:
  containers:
  - name: {{app_name}}
    lifecycle:
      preStop:
        exec:
          command: ["/bin/sh", "-c", "sleep 5"]
    # terminationGracePeriodSeconds must be > preStop sleep + app shutdown deadline
    # 5s (preStop) + 30s (app shutdown) + 5s (buffer) = 40s
  terminationGracePeriodSeconds: 40
```

With this config, the sequence is:
1. k8s removes pod from Service endpoints (load balancer stops routing)
2. `preStop` sleeps 5s (in-flight requests from already-routed connections drain)
3. SIGTERM arrives
4. App shutdown runs (up to 30s)
5. Pod exits 0 or k8s force-kills at 40s

## Verification

```bash
# 1. Start the server with PM2
pm2 start ecosystem.config.cjs --env production

# 2. Send load in background (autocannon)
npx autocannon -d 30 -c 50 http://localhost:3000/api/users &

# 3. Trigger reload mid-load — should see zero errors
pm2 reload {{app_name}}

# 4. Check autocannon result — 0 non-2xx responses = success
```

## Rollback discussion

If the shutdown sequence itself fails (closeExternal throws), the deadman timer exits with code 1. PM2 will attempt a restart (respawn_limit controls how many times). To avoid restart loops on a broken DB close:

```js
// In ecosystem.config.cjs — stop restarting after 5 failures
max_restarts: 5,
min_uptime: '10s',
```

For Kubernetes, a pod exiting 1 triggers the deployment's `restartPolicy` (usually `Always`). If the new pod also fails, the deployment rolls back automatically if you used a `RollingUpdate` strategy with `maxUnavailable: 0`.
