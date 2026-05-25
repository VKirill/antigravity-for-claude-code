# httpx — Troubleshooting

Symptom-indexed. Match the error message to a row, jump to the fix.

## Timeouts

### `httpx.ConnectTimeout`

- TCP/TLS handshake didn't finish in time.
- Likely: DNS slow, host unreachable, firewall drop, wrong port.
- Fix: bump `connect=` in `httpx.Timeout(...)`, or address the network issue. Retry is safe — the request never reached the server.

### `httpx.ReadTimeout`

- Connection established, but the server didn't send (or didn't finish sending) a chunk in time.
- Likely: server is slow, an upstream is hung, a heavy query.
- Fix: bump `read=` for known-slow endpoints (e.g. report exports). For background work, return a job ID instead of holding the connection.
- Retry is safe ONLY for idempotent methods (GET, HEAD, PUT, DELETE) — POST may have been processed.

### `httpx.WriteTimeout`

- Couldn't flush request bytes within the write window.
- Likely: huge upload over slow link, or the server stopped reading.
- Fix: increase `write=`, or use streaming upload with smaller chunks.

### `httpx.PoolTimeout`

- Waited too long for a free connection from the pool.
- Likely: pool too small for fan-out concurrency, or leaked responses holding slots.
- Fix: raise `httpx.Limits(max_connections=...)`, audit for streaming responses not closed, or reduce in-flight concurrency. See `recommended-defaults.md`.

## TLS / SSL

### `ssl.SSLCertVerificationError: ... CERTIFICATE_VERIFY_FAILED`

- The server's certificate is not trusted by the bundle httpx is using.
- Likely: corporate proxy with private CA, expired cert, hostname mismatch.
- Fix: install the correct CA via `verify="/path/to/ca.pem"` or use `truststore` to read the OS store. **Do NOT** set `verify=False` in production.

### `ssl.SSLError: ... unsupported protocol` / `WRONG_VERSION_NUMBER`

- TLS version mismatch, or you tried `https://` against a plain-HTTP port.
- Fix: verify the URL scheme; check the server's minimum TLS version.

## HTTP/2

### `ImportError: Using http2=True, but the 'h2' package is not installed.`

- httpx HTTP/2 support is an optional extra.
- Fix: `pip install httpx[http2]`.

### `response.http_version` says `"HTTP/1.1"` even though `http2=True`

- Server didn't advertise `h2` in ALPN, so httpx fell back to HTTP/1.1. Not an error.
- Verify with `openssl s_client -alpn h2 -connect host:443 < /dev/null`.

## Pool / connection leaks

### `Too many open files`

- Sockets are leaking — clients created without `with` block, or streaming responses not closed.
- Fix: audit for missing context managers. Every `Client` / `AsyncClient` / `client.stream(...)` must be inside a `with` / `async with`.

### Pool exhausted under sustained load

- Concurrent fan-out exceeds `max_connections`.
- Fix: raise `httpx.Limits`, or semaphore-gate concurrency. With HTTP/2, a smaller pool suffices (multiplexing).

## Async issues

### `RuntimeError: Event loop is closed`

- An `AsyncClient` was created in one event loop and is being closed in another (or after the loop exited).
- Fix: bind the client lifecycle to the framework's lifespan; never close manually after the loop ends.

### `RuntimeWarning: coroutine 'AsyncClient.get' was never awaited`

- Missing `await`.
- Fix: `response = await client.get(url)` — not `response = client.get(url)`.

### Sync client called from async context (event loop appears frozen)

- `httpx.Client(...)` inside `async def` blocks the loop.
- Fix: switch to `httpx.AsyncClient` and `await`.

### `httpx.ASGITransport` test hangs

- The ASGI app likely awaits an external resource (DB, lifespan) that isn't initialized in the test.
- Fix: wrap the test in a fixture that runs the app's lifespan. With FastAPI, use `LifespanManager` from `asgi-lifespan`, or `httpx.AsyncClient` plus explicit lifespan handling.

## Body / encoding

### `json.decoder.JSONDecodeError` from `response.json()`

- Response isn't JSON (often an HTML error page from a proxy or a 5xx body).
- Fix: call `response.raise_for_status()` first, then `.json()`. Or check `response.headers["content-type"]`.

### `UnicodeDecodeError` from `response.text`

- Detected encoding is wrong, or bytes truly aren't text.
- Fix: set `response.encoding = "utf-8"` (or the correct value) before reading `.text`. For binary, use `.content`.

## Redirects

### Got a 301/302 status, expected 200

- httpx does not follow redirects by default.
- Fix: pass `follow_redirects=True` per-call or per-client.

### `httpx.TooManyRedirects`

- Server is in a redirect loop, or expecting cookies/auth you aren't sending.
- Fix: inspect `response.history`. Tighten the follow chain via `max_redirects=` on the Client.

## Proxies

### `httpx.ProxyError` — `Tunnel connection failed`

- Proxy refused the CONNECT request (auth missing, host not allowed).
- Fix: confirm credentials embedded in proxy URL; check NO_PROXY.

### Old `proxies=` kwarg breaks

- `requests`-style `proxies={"http": "...", "https": "..."}` is not accepted.
- Fix: use `proxy="..."` (single) or `mounts={"https://": HTTPTransport(proxy=...)}` (per-scheme).

## Status / error handling

### Catching `requests.exceptions.HTTPError` doesn't trigger

- After migration, the exception type changed.
- Fix: catch `httpx.HTTPStatusError` (from `raise_for_status()`) or `httpx.HTTPError` (the base).

### Catching `httpx.HTTPError` swallows network errors AND status errors

- That's the intentional union. Catch the narrower types if you need to distinguish: `httpx.RequestError` vs `httpx.HTTPStatusError`.

## Debug logging

```python
import logging
logging.basicConfig(level="DEBUG")
logging.getLogger("httpx").setLevel("DEBUG")
logging.getLogger("httpcore").setLevel("DEBUG")
```

`httpcore` is httpx's underlying transport — the most useful logger for connection-level problems.
