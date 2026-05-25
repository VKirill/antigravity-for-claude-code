# Common bug classes — match-and-diagnose

When you can name the bug class quickly, you skip half the diagnosis. Catalogue of recurring bug families with telltale signs + first-line fixes.

## Race conditions

**Signs:** intermittent failures; "sometimes" works; reproduces only under concurrency / load; tests pass in isolation but fail in parallel.

**Common variants:**
- TOCTOU (check balance → spend; balance changed in between)
- Idempotency window (retry double-processes)
- Token reuse (OTP used twice)
- Cache write race (read → modify → write; two writers lose one update)

**First-line diagnosis:**
- Run the test 100× in parallel: `for i in {1..100}; do <cmd> & done; wait`
- Add timing logs at the suspected sequence
- Reduce to single thread → does it still happen? No → confirmed race

**Fix patterns:** atomic operations (DB `UPDATE ... WHERE current = expected`), row locks, idempotency keys, single-writer pattern.

See [`cybersecurity-audit/references/race-conditions.md`](../../cybersecurity-audit/references/race-conditions.md) for deep dive.

## Off-by-one

**Signs:** index out of bounds; last item missed; double-counted boundary value.

**Common locations:**
- Loops: `i < n` vs `i <= n`
- Pagination: `LIMIT 10 OFFSET 10` (skips item 10?)
- Date ranges: inclusive vs exclusive end
- Slicing: `arr[0:n]` (exclusive) vs `arr[0..n]` (range syntax differs by language)

**First-line diagnosis:** print N (or N±1) of expected outputs; compare to actual.

**Fix pattern:** name the boundary semantics explicitly. Use half-open intervals consistently `[start, end)`. Add a test with N=0, N=1, N=2 cases — they catch most off-by-ones.

## NaN propagation

**Signs:** unexpected `NaN` in output; cascade of `NaN` from one bad value.

**Causes:**
- `0/0`, `Infinity - Infinity`, `Number(undefined)`, `parseInt("abc")`, `JSON.parse("undefined")`
- Math op with `null` (in JS, `null` → 0 in numeric context, except for some ops)
- Missing field treated as number

**First-line diagnosis:** trace backward. `NaN` propagates through every arithmetic op — find the FIRST `NaN` in your data flow.

**Fix:** validate at boundary. `z.number().finite()` (Zod), Pydantic `confloat(allow_inf_nan=False)`, runtime check `Number.isFinite(x)`.

## Type coercion

**Signs:** equality bug, sort bug, truthy/falsy unexpected.

**JS classic:**
- `'5' == 5` → true; `'5' === 5` → false
- `[] == false` → true; `null == undefined` → true; `NaN == NaN` → FALSE
- Sort numerically: `arr.sort((a,b) => a - b)`, NOT `arr.sort()` (lexicographic by default)

**Python classic:**
- `'5' + 5` → TypeError (good); but `True + 5` → 6 (bool is int subclass)
- `0 == False` → True; `'' == False` → False
- `1 == True` → True; `2 == True` → False (only 1 equals True)

**Fix:** always use `===` / `is` in JS; explicit casts in Python; check for nullishness explicitly (`x ?? default`, not `x || default`).

## Timezone / locale

**Signs:** times off by hours; dates off by one day; sorting by date gives wrong order; works in dev (your timezone) fails in CI (UTC) or vice versa.

**Causes:**
- Mixing UTC and local: `new Date()` in JS uses local; `new Date('2026-05-16')` parses as UTC
- DST transitions (March/November in northern hemisphere)
- Locale parsing: `'5,000.00'` vs `'5.000,00'` (decimal separator)

**Fix patterns:**
- Store timestamps as UTC (Postgres `timestamptz`, ISO 8601 strings)
- Format only at display boundary using user's timezone preference
- Use a date library (`luxon`, `date-fns-tz`, Python `zoneinfo`); never DIY date math
- In tests: mock timezone (`TZ=UTC vitest`)
- Don't compare dates as strings unless format guarantees lexicographic match (ISO 8601 does; "5/16/2026" does NOT)

## Encoding

**Signs:** `Ã©` instead of `é`; questions marks `???` in output; cyrillic shows as `Ð\x9aÐ¸Ñ\x80Ð¸Ð»Ð»`; emoji broken.

**Causes:**
- File read with wrong encoding (`latin-1` for `utf-8` content, or v.v.)
- DB column type / collation mismatch
- HTTP response missing `Content-Type: ...; charset=utf-8`
- Mongo / older MySQL with latin-1 default

**Fix:** UTF-8 everywhere. Explicit `encoding="utf-8"` on file reads; `Content-Type` header with charset; DB `CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`.

## Async ordering

**Signs:** "happens before" relationship violated; promise/async result arrives after the next step assumed it was done.

**JS patterns:**
- `arr.forEach(async i => await x(i))` — forEach doesn't await; all promises fire in parallel, function returns before any complete. Use `for...of` with `await` or `Promise.all(arr.map(...))`.
- Missing `await` — the next line runs with a Promise object, not a value
- Race between two awaits when both modify shared state

**Python patterns:**
- `asyncio.gather` vs sequential `await` — gather is parallel, sometimes you need sequential
- Forgetting `await` on a coroutine — returns coroutine object, not result

**Fix:** read the code and ask "what's the order of execution here?" — if unclear, you have a bug brewing. Use TypeScript `async/await` strict checks; Python `RuntimeWarning: coroutine was never awaited`.

## Memory leaks

**Signs:** memory keeps growing; eventual OOM; performance degrades over time.

**Common in Node:**
- Event listeners not removed (`emitter.on(...)` without matching `.off()`)
- Closures holding large references (function defined inside loop captures iterator state)
- Maps / Sets that grow without bound (use `WeakMap` / `WeakSet` where applicable)
- Streams not destroyed on error

**Common in Python:**
- Circular references with `__del__` (gc can't collect)
- Caches without bound (LRU with maxsize=None)
- Pandas DataFrame copies held in lists

**First-line diagnosis:** heapdump before + heapdump after load; compare; find growing object type. See [runtime-debugging.md](runtime-debugging.md#memory-leak-hunting).

## Retry storms / cascading failures

**Signs:** one service slow → another retries → first gets more load → slower → more retries → outage.

**Causes:**
- No exponential backoff
- Retry on errors that should NOT be retried (4xx, validation errors)
- Aggressive timeouts trigger retry before original request completes

**Fix:** exponential backoff with jitter; circuit breaker (after N failures, stop retrying for cooldown); idempotency keys so retries don't double-write; timeout > expected p99 latency.

## Default values surprise

**Signs:** behaviour differs in dev vs prod; "I set X but it acted like default."

**Causes:**
- Env var missing → falsy → default kicks in. Specifically: `process.env.FLAG === 'true'` requires the string "true"; if env is unset → undefined → defaults to off (often unintended).
- Config merge order — overrides applied wrong way
- Function default param re-evaluated only at definition (Python mutable default antipattern: `def f(x, items=[])`)

**Fix:** explicit defaults at boundary; validate env at startup with Zod / Pydantic; never use mutable defaults in Python (`items=None` then `if items is None: items = []`).

## Hidden state in closures / modules

**Signs:** "fresh" test fails after another test ran; module-level state persists across requests in a long-lived process.

**Causes:**
- `let cache = {}` at module top-level — persists across requests
- Hoisted variable initialized once, mutated by handlers
- Singleton DB connection holding stale auth context

**Fix:** scope state to request/session, not module. For caches, explicit TTL + invalidation.

## File system case sensitivity

**Signs:** works on macOS / Windows, fails on Linux (or vice versa); import error after pulling case-change commit.

**Cause:** macOS HFS+ and APFS are case-insensitive by default; Linux ext4 is case-sensitive. `import './Foo'` matches both `Foo.ts` and `foo.ts` on mac; fails on Linux if file is `foo.ts`.

**Fix:** enforce case via `tsconfig.json: forceConsistentCasingInFileNames: true`; same for `pyproject` linter. Pre-commit hook to detect case-only renames in git.

## Floating point comparison

**Signs:** `0.1 + 0.2 !== 0.3` (it's `0.30000000000000004`).

**Fix:** never `===` floats. Use `Math.abs(a - b) < EPSILON` or fixed-precision libraries (`decimal.js`, Python `Decimal`).

For money: store integer cents/копейки, not floats.

## Premature optimisation hides bug

**Signs:** complex caching layer broke after a refactor; the bug is in cache invalidation, not the original logic.

**Diagnosis:** disable the cache → does the bug go away? Yes → bug is in cache logic.

**Fix:** correct cache invalidation OR just remove the premature optimisation if the perf gain wasn't critical.

## Recognition shortcuts

| Quick signal | Likely class |
|---|---|
| `NaN`, `Infinity` in output | NaN propagation |
| Time off by exactly N hours | Timezone |
| Time off by 1 hour (twice a year) | DST |
| Rejected unicode characters / mojibake | Encoding |
| "Sometimes works" | Race / time-dependent / cache state |
| Off by exactly 1 | Off-by-one |
| Sort gives lexicographic order on numbers | Type coercion (string sort on numbers) |
| Memory keeps growing in monitoring | Memory leak |
| One service slow → everything slow | Retry storm / no circuit breaker |
| Works on macOS, fails on Linux | Case sensitivity |
| `'5' == 5` returning true unexpectedly | Type coercion |
| Two tests fail together but pass individually | Hidden state / test pollution |
