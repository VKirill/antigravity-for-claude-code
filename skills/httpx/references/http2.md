# httpx — HTTP/2

HTTP/2 brings multiplexing (many concurrent streams over one TCP connection), header compression (HPACK), and server-push. For high-concurrency clients hitting a single host, HTTP/2 dramatically reduces TCP/TLS handshake cost and lets fan-out requests share a connection.

## Enabling HTTP/2

Two steps:

```bash
pip install httpx[http2]    # installs the optional `h2` dependency
```

```python
client = httpx.AsyncClient(http2=True)
# or
client = httpx.Client(http2=True)
```

If you pass `http2=True` without installing `h2`, httpx raises `ImportError` on the first request. The `httpx[http2]` extra is the supported install path.

## Verifying the protocol actually used

`http2=True` is a hint, not a guarantee — both the client and server must agree via ALPN during the TLS handshake. Check the response:

```python
response = await client.get(url)
print(response.http_version)  # "HTTP/1.0", "HTTP/1.1", or "HTTP/2"
```

If the server doesn't advertise `h2` in ALPN, httpx falls back to HTTP/1.1. The client doesn't error.

## When HTTP/2 actually helps

| Workload | HTTP/2 wins? |
|---|---|
| Many concurrent requests to ONE host | Yes — multiplexing reuses one connection |
| Many requests to MANY hosts | No real win — each host needs its own connection anyway |
| Single sequential request | Tie — slightly more frame overhead, slightly less handshake cost |
| HTTPS over high-latency link | Yes — header compression + multiplexing offset RTT |
| Long-running streaming uploads/downloads | Mixed — HTTP/1.1 streams cleanly too |

For an outbound API client that fans out 50 requests to the same host with `asyncio.gather`, HTTP/2 cuts socket and TLS handshake count from 50 to 1.

## Multiplexing pitfalls

- **Head-of-line blocking at the TCP layer**: HTTP/2 fixes HOL blocking at the application layer, but TCP still serializes packets. On lossy networks the benefit shrinks.
- **`max_connections=1` is fine** under HTTP/2 because of multiplexing — but only if every request goes to the same origin. Mixed origins still need multiple sockets.
- **Concurrent streams limit**: servers advertise `SETTINGS_MAX_CONCURRENT_STREAMS` (often 100). httpx queues requests beyond the limit.
- **Server push**: some HTTP/2 servers push extra resources. httpx ignores pushes (it's the documented behavior).

## ALPN required for HTTPS HTTP/2

HTTP/2 over TLS requires ALPN negotiation. Older Python builds without OpenSSL ALPN support fall back to HTTP/1.1 silently. CPython on supported platforms includes ALPN by default.

## h2c (HTTP/2 cleartext)

HTTP/2 over plain HTTP (no TLS, no ALPN) is rare in production. httpx's HTTP/2 path is targeted at HTTPS. For h2c (e.g. service mesh internal traffic), most setups use a sidecar that terminates HTTP/2 and speaks HTTP/1.1 to the application — which means the httpx client never sees h2c at all.

## Inspecting and debugging

Enable httpx debug logging to see the protocol upgrade:

```python
import logging
logging.basicConfig(level="DEBUG")
logging.getLogger("httpx").setLevel("DEBUG")
logging.getLogger("hpack").setLevel("INFO")  # h2's header compression is noisy
```

## When NOT to bother

- Talking to a server that doesn't speak HTTP/2 — pure overhead.
- Single-request scripts — handshake cost is the same.
- Clients that only need ~1 outbound request per second — HTTP/1.1 keep-alive is fine.

## Constraints

- `http2=True` requires `httpx[http2]` — the `h2` package is NOT a default install.
- Mixing HTTP/2 and HTTP/1.1 across requests on one client is automatic — httpx picks per-origin based on what the server agreed to.
- A `client.stream(...)` over HTTP/2 still consumes one stream; close it to free the slot.
