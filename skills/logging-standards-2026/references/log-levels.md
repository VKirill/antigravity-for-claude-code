# Log levels

## The six levels

| Level | When to use | Example |
|---|---|---|
| **TRACE** | Ultra-verbose, only when actively debugging a specific function | Function entry/exit with args, every iteration of a loop |
| **DEBUG** | Developer-useful but not interesting in normal operation | "Cache hit", "Retry attempt 2", parsed config values |
| **INFO** | Business / operational events someone might want to review | "User logged in", "Job completed", "Payment charged" |
| **WARN** | Something unexpected but recoverable | "Cache miss took 3s", "External API returned 429", "Slow query 1.8s" |
| **ERROR** | An operation failed; user / system saw the failure | "Order creation failed", "External webhook 5xx" |
| **FATAL** | Application is in an unrecoverable state; will likely shut down | "Cannot connect to database after N retries", "Required env var missing at startup" |

## Per-environment defaults

| Environment | Default level | Why |
|---|---|---|
| **Local dev** | DEBUG | You want to see what's happening |
| **Test** | WARN (or silenced) | Test output should be clean unless something's wrong |
| **CI** | WARN | Same — clean unless failures |
| **Staging** | INFO | Production-like, but easier to inspect |
| **Production** | INFO | Catches operational + security events; not noisy |

Drop to DEBUG in production **only temporarily** when actively debugging an incident. Never DEBUG default in prod — volume explosion + cost.

## Set via env var

Always allow override:

```bash
LOG_LEVEL=debug npm start              # for one-off debug
```

In code:

```ts
const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
```

```py
import logging, os
logging.basicConfig(level=os.environ.get('LOG_LEVEL', 'INFO').upper())
```

## Per-component override

Sometimes you want INFO for most code but DEBUG for the auth module you're debugging:

### Pino

```ts
const log = pino({ level: 'info' });
const authLog = log.child({ component: 'auth' }, { level: 'debug' });
```

### Python logging

```python
logging.getLogger().setLevel(logging.INFO)
logging.getLogger('myapp.auth').setLevel(logging.DEBUG)
```

Use sparingly — easy to forget the override and ship verbose prod logs.

## Choosing the right level — the test

For each potential log statement, ask:

| Question | If yes → level |
|---|---|
| Could this fire 1000+ times per minute in normal operation? | DEBUG (or sampled) |
| Useful for incident response 6 months from now? | INFO+ |
| Did something fail that the user noticed? | ERROR |
| Did something fail that's recovered (retry, fallback)? | WARN |
| Is the application in an unrecoverable state? | FATAL |
| Hmm, maybe... | DEBUG (defaults less is more) |

## INFO vs WARN — common confusion

INFO = expected event happened (normal operation):
- User logged in
- Job completed
- Cache refreshed
- External API returned 200

WARN = something unexpected, but it's handled:
- Cache miss after expecting hit
- External API returned 429, retrying
- Slow query (>1s)
- Payment retry succeeded after initial fail

If you set up an alert "errors > N/min", **WARN should NOT trigger the alert**; ERROR should. Misclassifying WARN as INFO = silent issues; misclassifying as ERROR = alert fatigue.

## ERROR vs FATAL

Most apps don't need FATAL. The distinction matters for orchestrators / supervisors (PM2, systemd, Kubernetes):

- **ERROR** = log the error, recover, continue serving requests
- **FATAL** = log + immediately exit the process so supervisor can restart it

```ts
// ERROR — request failed, continue
try { await processPayment(...); } catch (e) { log.error({err: e}); return res.status(500).json(...); }

// FATAL — can't even start
if (!process.env.DATABASE_URL) {
  log.fatal('DATABASE_URL not set — cannot start');
  process.exit(1);
}
```

## Anti-patterns

### Logging everything at INFO

You can't see what matters. Symptom: incident review pulls 50k INFO lines from one hour.

Fix: lower verbosity ones to DEBUG; only INFO things you'd want during an incident review.

### Logging errors at WARN to "avoid alert noise"

If it's a real error → ERROR. Tune the alert (rate, severity-by-class) instead of misclassifying the log.

### Using level as documentation

```ts
log.warn('This function is deprecated');
```

That's a code comment, not a log. If you must emit it at runtime, level should reflect runtime risk (deprecated still works → INFO; deprecated will break → WARN).

### Log spam at TRACE in production

Some libs log at TRACE by default for "diagnostics". Audit:

```bash
grep -rnE "trace\(|setLevel.*TRACE" config/ src/
```

Turn off unless actively diagnosing.

### Same event at different levels in different places

Pick one. Consistency matters more than precision.

## Cheat sheet

```
TRACE  ─ noise; locally for one hour during deep diagnosis
DEBUG  ─ developer detail; dev env default
INFO   ─ business event; staging/prod default
WARN   ─ unexpected, recovered
ERROR  ─ failed, user-visible impact
FATAL  ─ cannot continue; supervisor will restart
```
