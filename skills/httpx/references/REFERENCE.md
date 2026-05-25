# httpx — Decision Map

Pick the right file before reading.

## By task

| You're doing... | Open |
|---|---|
| First-ever httpx call, want syntax | [basics.md](basics.md) |
| Building a long-lived client / API integration class | [client-and-asyncclient.md](client-and-asyncclient.md) |
| Writing async code with concurrent fan-out | [async-usage.md](async-usage.md) |
| Adding auth (Bearer, Basic, OAuth, custom signing) | [auth.md](auth.md) |
| Need retry, hit a timeout, exception confusion | [retries-and-resilience.md](retries-and-resilience.md) |
| Downloading large files, SSE, chunked upload | [streaming.md](streaming.md) |
| Enabling HTTP/2 | [http2.md](http2.md) |
| Configuring a proxy, mTLS, custom CA bundle | [proxies-and-tls.md](proxies-and-tls.md) |
| Mocking httpx in tests / testing a FastAPI app | [testing.md](testing.md) |
| Porting old `requests` code | [migration-from-requests.md](migration-from-requests.md) |
| Something is failing — error message lookup | [troubleshooting.md](troubleshooting.md) |
| Picking sensible numeric defaults | [recommended-defaults.md](recommended-defaults.md) |
| Reviewing code for bad patterns | [wrong-vs-right.md](wrong-vs-right.md) |
| Testing skill routing | [eval-cases.md](eval-cases.md) |

## Reading order for new code

1. `basics.md` — vocabulary
2. `client-and-asyncclient.md` — production-shape client
3. `recommended-defaults.md` — numbers to pin
4. `auth.md` / `streaming.md` / `http2.md` — only if relevant
5. `testing.md` — before merge
6. `troubleshooting.md` — when something breaks

## Conventions used in references

- `Client` examples use `with httpx.Client() as client:` — never bare module functions for production code.
- `AsyncClient` examples use `async with httpx.AsyncClient() as client:` and `await`.
- Numeric defaults (timeouts, pool size, retry counts) are pinned in `recommended-defaults.md` and referenced by name elsewhere — do NOT inline numbers in other reference files.
- Exception names use the `httpx.` prefix (`httpx.ConnectError`, not bare `ConnectError`).
