# Troubleshooting reference — required for high-stakes skills

Both reviewers (ChatGPT and Opus) flagged the absence of a dedicated `troubleshooting.md` as a quality gap. Anti-patterns and failure modes were scattered across other files instead of being indexed by symptom.

## Rule

**Every skill with `risk: high-stakes`** in frontmatter MUST ship a `references/troubleshooting.md`. The file is symptom-indexed: the reader knows the user-visible failure ("worker не стартует", "jobs застряли в waiting", "OOM в Redis") and finds the diagnosis and fix.

Optional for:
- Pure language/type skills (typescript, zod)
- Pure UI skills (shadcn, react-hook-form)
- Process skills (git, karpathy-guidelines)

## Anatomy

```md
# Troubleshooting — <skill name>

Symptom-indexed. Find your symptom, follow the diagnosis steps, apply the fix.

---

## Workers don't start (silent exit, no logs)

**Symptoms**
- `node worker.js` exits with code 0 immediately
- No structured logs appear
- `pm2 list` shows the process as `online` but no work happens

**Diagnose**
\`\`\`bash
# 1. Confirm Redis is reachable
redis-cli -h <host> -p <port> PING

# 2. Confirm BullMQ can authenticate
node -e "const {Worker} = require('bullmq'); new Worker('test', async () => {}, {connection:{host:'<host>'}}).on('ready', () => console.log('ok'))"

# 3. Check for swallowed exceptions in the processor
\`\`\`

**Common causes**
- Missing `maxRetriesPerRequest: null` on the ioredis connection (BullMQ requires this).
- Top-level `await` failing before any `Worker` is constructed — uncaught rejection, process exits silently.
- DNS resolution failure inside Docker — `localhost` from container points to container.

**Fix**
\`\`\`ts
const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,  // required
});
\`\`\`

---

## Jobs stuck in `waiting` (queue grows, never drains)

**Symptoms**
- `queue.getJobCounts('waiting')` keeps rising
- No `active` jobs
- Workers are running, logs show no work

**Diagnose**
\`\`\`bash
# 1. Confirm workers connected to same queue name
# 2. Confirm Redis keyspace prefix matches
redis-cli -h <host> KEYS 'bull:myqueue:*' | head
\`\`\`

**Common causes**
- Queue name typo (`emails` vs `email`).
- `prefix` option mismatch between Queue and Worker.
- Worker exited and was never restarted (pm2/systemd misconfig).

**Fix**
- Align queue name and prefix between producer and worker.
- Add `pm2 startup` + `pm2 save` to survive reboot.

---

## OOM in Redis

**Symptoms**
- Redis logs: `OOM command not allowed when used memory > 'maxmemory'`
- Jobs stop being created
- `removeOnComplete` evidently not cleaning up

**Common causes**
- `removeOnComplete: false` or never set
- Large payloads stored directly in job data
- DLQ accumulating without bounded TTL

**Fix**
\`\`\`ts
new Queue('emails', {
  defaultJobOptions: {
    removeOnComplete: { age: 86400, count: 1000 },  // 24h or last 1000
    removeOnFail: { age: 604800 },                  // 7d
  },
});
\`\`\`
Plus: store large payloads in S3/blob, pass references in `job.data`.

---

(...more symptoms...)
```

Each entry has four blocks: **Symptoms** (what the user sees) → **Diagnose** (commands to run) → **Common causes** → **Fix** (paste-runnable).

## Minimum symptoms to cover

For any high-stakes skill, the troubleshooting file should cover at least:

| Domain | Minimum coverage |
|---|---|
| Webhook receivers (payments, telegram-bot) | HMAC mismatch, raw-body lost, IP allowlist failure, idempotency dedup miss, 5xx loop |
| Queues (bullmq) | Workers silent-exit, jobs stuck in `waiting`, stalled-job spam, OOM Redis, slow shutdown, retry storm |
| Databases (postgresql, prisma) | Connection pool exhausted, slow query EXPLAIN, deadlock, replication lag, vacuum bloat |
| Caches (redis) | OOM, replication lag, AOF growth, cluster slot move, client timeout |
| Reverse proxy (linux-sysadmin/nginx/Angie) | 502 upstream, 504 timeout, SSL cert expired, port collision, fd exhaustion |
| ORMs (prisma) | Connection leak, migration drift, generated client missing, transaction timeout |

## Pitfalls

- ❌ Symptom-indexed by API surface (`getJobCounts not working`) instead of user-visible failure (`metrics endpoint returns zeros`). Users don't think in API surfaces when something is broken.
- ❌ Long prose explanations without paste-runnable commands. Troubleshooting is when the user least wants to read.
- ❌ Mixing "wrong vs right" code into troubleshooting — keep them separate; wrong-vs-right is preventive, troubleshooting is reactive.

## Audit grep

```bash
# High-stakes skills missing troubleshooting
for skill_dir in /home/ubuntu/.claude/skills/*/; do
  skill=$(basename "$skill_dir")
  if grep -q "risk: high-stakes" "$skill_dir/SKILL.md" 2>/dev/null; then
    if [ ! -f "$skill_dir/references/troubleshooting.md" ]; then
      echo "MISSING: $skill (high-stakes, no troubleshooting.md)"
    fi
  fi
done
```

Run as part of quarterly review for all `risk: high-stakes` skills.
