# Reproduction — making the bug happen on demand

If you can't reproduce, you can't diagnose. This is the highest-leverage step.

## The minimum repro

Smallest possible input + smallest possible code path that triggers the bug.

Why minimum:
- Less surface = fewer variables = easier diagnosis
- Easier to share (bug report, issue tracker)
- Easier to write the regression test from

How to minimise (delta-debugging):

1. Start with the failing scenario (large, real)
2. Remove half. Still fails? Keep the simplified version.
3. Repeat. Each iteration halves the input.
4. Stop when removing any more makes the bug disappear → minimum repro.

For data inputs: `delta` or `creduce` tools automate this. For interactions: do it manually.

## Environment differences

"Works on my machine" usually means one of:

- **Different versions** — Node 18 vs 24, Python 3.11 vs 3.14. Run `node --version` / `python --version` in both envs.
- **Different env vars** — local has `.env`, prod has different values. `git diff` env templates; compare with prod (use 1Password / vault to inspect, not the chat).
- **Different OS** — case sensitivity (Linux vs macOS for file paths), line endings (CRLF vs LF), default encodings.
- **Different timezone** — local in MSK, server in UTC, CI in something else.
- **Different DB** — local SQLite/Postgres-15, prod Postgres-18. SQL syntax / index / collation differs.
- **Different data** — local 100 rows, prod 10M rows. Some bugs only emerge at scale.
- **Different concurrency** — local 1 user, prod 1000 RPS. Race conditions surface.

Checklist when staging "works", prod doesn't:

| Check | Command |
|---|---|
| Node/Python version | `node --version` / `python --version` |
| OS | `uname -a` |
| Env var values (mask secrets) | compare env templates |
| DB version | `psql -c 'select version();'` |
| Locale | `locale` |
| Timezone | `date`, `timedatectl` |
| Data volume | `SELECT count(*) FROM <table>` |
| Concurrency level | check Pino logs / metrics for request rate |

## Intermittent bugs — the worst class

"Sometimes it fails."

Almost always one of:

- **Race condition** — order-dependent state mutation. See [common-bug-classes.md](common-bug-classes.md#race-conditions).
- **Time-dependent** — DST transition, leap second, weekday-specific logic.
- **Memory pressure** — leak slowly fills heap; gc storms; OOM.
- **External dependency flakiness** — 3rd-party API rate-limit, DNS, network blip.
- **Cache state** — bug only when cache cold; or only when cache warm; or only at cache eviction.
- **Date/time arithmetic** — `Date.now()` differs each run; tests that depend on "now" are flaky.

Strategies:

1. **Add high-resolution timing to logs** — what was the time gap between events when it failed vs succeeded?
2. **Run in a loop** — `for i in $(seq 1 100); do <command>; done` — does it fail consistently at some rate?
3. **Increase concurrency** — `seq 1 50 | xargs -P 50 -I {} <command>` triggers races faster
4. **Pin time** — use a time-mocking library (`@vitest/utils` fake timers, `freezegun` in Python) to test "now" deterministically
5. **Pin random seeds** — if logic uses randomness, fix seed; flakiness disappears = it WAS the random
6. **Disable cache** — does the bug always reproduce with cold cache? Then it's not concurrency, it's first-write logic

## Hostile reproduction conditions

Sometimes you need to simulate adversarial conditions to repro:

- **Slow disk** — `dd` while running; or use `cgroups` to throttle I/O
- **Slow network** — `tc qdisc` (Linux) or browser DevTools throttle
- **High latency** — `tc qdisc add dev eth0 root netem delay 200ms`
- **Packet loss** — `tc qdisc add dev eth0 root netem loss 5%`
- **High CPU** — `stress-ng --cpu 4` in background

These often expose timeout bugs, retry bugs, missing AbortController bugs.

## Production-only bugs

You can't reproduce locally because the bug needs prod data / scale / concurrency.

**Don't debug in production.** Instead:

1. **Copy a subset of prod data to staging** (with PII redacted), reproduce there
2. **Use feature flags** to enable extra logging just for affected users, just for a window
3. **Add observability** — distributed tracing (OpenTelemetry) shows you the failure path even if you can't run it locally
4. **Coredump-style snapshot** — if Node, capture a heapdump (`v8.writeHeapSnapshot`) at the moment of failure
5. **Read existing logs** — see [log-driven-debugging.md](log-driven-debugging.md)

## CI-only bugs

Test passes locally, fails in CI. Common causes:

- **Different versions** — pin via `package-lock.json` / lockfile + `node:engines` field; CI should use `npm ci` not `npm install`
- **Path case sensitivity** — `Components/Button` vs `components/button` (case-insensitive on macOS, case-sensitive on Linux)
- **Hidden test ordering dependency** — test A leaves state that test B depends on; CI runs in different order. Add `randomize` to test config to force this surface locally.
- **CI has fewer CPU cores → race ordering differs** — tighter timing surfaces races
- **Missing env vars** — CI lacks `.env.local`; check CI secrets / env config
- **Headless browser differences** — Playwright in CI vs local browser differences

Run CI environment locally:
- GitHub Actions: `act` (https://github.com/nektos/act)
- GitLab CI: `gitlab-runner exec`

## Anti-patterns in reproduction

- **"I'll just try the fix and see"** — without reproducing, you can't verify
- **"It worked when I tested manually"** — manual ≠ regression-safe; write a test
- **"Add retry, problem solved"** — retry hides intermittent bugs; bug WILL be back at scale
- **"Mark test as `.skip` for now"** — accumulates technical debt; one skipped test becomes ten

## When all else fails

If you cannot reproduce despite all the above:

1. **Increase observability** — add more logging at boundaries; deploy; wait for the bug; read logs
2. **Get a coredump / heapdump from when it next fails** — analyse offline
3. **Bisect against a known-good version** — see [bisection.md](bisection.md). Bisection often surfaces a reproduction.
4. **Pair with someone who's seen it** — sometimes a fresh pair of eyes spots the trigger
5. **Document what you've tried** — so the next person doesn't repeat work
