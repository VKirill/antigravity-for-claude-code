---
name: httpx
description: "httpx — modern Python HTTP client with sync + async APIs, HTTP/2, strict timeouts, and a broadly requests-compatible surface. Use when: httpx, python httpx, AsyncClient, Client, httpx.get, async http client, requests replacement, HTTP/2 python, follow_redirects, raise_for_status, MockTransport, respx, pytest-httpx, ASGITransport, requests migration, async aiohttp alternative, BasicAuth, DigestAuth, custom Auth flow, streaming download, http2=True, connection pool. SKIP: requests (legacy sync-only, →requests-legacy); aiohttp (different ecosystem); urllib3 low-level; Node fetch (→nodejs)."
stacks:
  - httpx
  - python
tags:
  - http-client
  - python
  - async
  - networking
packages:
  - httpx
  - h2
  - respx
  - pytest-httpx
manifests:
  - pyproject.toml
source: vechkasov-global-skills
risk: medium-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- httpx: `0.28.x`
- Python: `3.14.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->



## Usage

Loaded automatically when its description matches the active task. Read only the section you need.

## Use this skill when

- Calling external HTTP APIs from Python — REST, JSON, multipart, streaming
- Replacing `requests` in a project — `Session → Client`, `allow_redirects → follow_redirects`, exception hierarchy changes
- Writing async code that talks to multiple upstreams concurrently with `AsyncClient` + `asyncio.gather`
- Sharing a long-lived HTTP client across a FastAPI / Starlette / worker process (connection pooling)
- Testing a FastAPI app via `httpx.AsyncClient(transport=ASGITransport(app=app))` — in-memory, no port
- Mocking HTTP in tests — `MockTransport`, `respx`, or `pytest-httpx`
- Enabling HTTP/2 multiplexing for high-concurrency clients (`http2=True` + `h2` extra)
- Tuning timeouts (`connect`, `read`, `write`, `pool`), proxies, mTLS, custom SSL context
- Building custom auth — bearer tokens, OAuth2 refresh, request-signing — via the `httpx.Auth` flow API
- Adding retry/backoff around an httpx call (via `tenacity` or `stamina` — httpx itself has no built-in retry)
- Streaming large downloads or uploads — `iter_bytes`, `iter_lines`, `aiter_*`, file-like upload, SSE

## Do not use this skill when

- Project still uses `requests` and you only want a one-off fix — use `requests-legacy` (cascade)
- Project is on `aiohttp` and not migrating — different ecosystem
- Task is low-level connection / TLS work below `httpx` — use `urllib3` or `node:tls` directly
- The HTTP call is inside a Node service — use `fastify`, `hono`, or `nodejs` skills
- The task is FastAPI server design (not client) — use `fastapi`; this skill is the **client** side
- The task is general async-Python design — use `python` for language patterns, this skill for HTTP

## Purpose

`httpx` is the de facto modern Python HTTP client. It exposes a broadly `requests`-compatible API plus a first-class async surface (`AsyncClient`), strict per-phase timeouts, HTTP/2 over the same code, pluggable transports (real network, ASGI/WSGI in-memory, mock), and a typed `Auth` flow protocol. It binds cleanly to FastAPI testing (`ASGITransport`) and to mock libraries (`respx`, `pytest-httpx`).

This skill covers everything the agent needs to write correct httpx code: request basics; the difference between one-shot `httpx.get(...)` and a context-managed `Client` / `AsyncClient`; async patterns and lifecycle; auth flows; the (absence of) built-in retry and how to layer one with `tenacity`; streaming I/O; HTTP/2; proxies and TLS; testing transports; migration from `requests`; troubleshooting; recommended defaults; and a paired "wrong vs right" set so the agent does not regress to anti-patterns.

What this skill does NOT cover: server-side FastAPI design (`fastapi`), Pydantic schema authoring (`pydantic`), pytest fundamentals (`pytest`), or HTTP semantics in general — only the client library and its correct use.

## Capabilities

Each line points to the canonical reference. The reference owns code, edge cases, and gotchas — do not duplicate them here.

- **Basics** — top-level `httpx.get/post/put/patch/delete`, `params=`, `headers=`, `json=` vs `data=` vs `content=`, `files=` multipart, response `.status_code` / `.text` / `.json()` / `.content` / `.headers`. → [basics.md](references/basics.md)
- **Client and AsyncClient** — context-manager lifecycle, connection pooling, `base_url`, default headers/cookies/auth, custom `transport`, `limits=`. → [client-and-asyncclient.md](references/client-and-asyncclient.md)
- **Async usage** — `await client.get`, `asyncio.gather` for concurrent fan-out, lifecycle inside FastAPI lifespan, when to share vs per-request. → [async-usage.md](references/async-usage.md)
- **Auth** — `BasicAuth`, `DigestAuth`, `NetRCAuth`, custom `httpx.Auth` subclass with `auth_flow`, bearer tokens, header-based auth, OAuth2 pattern. → [auth.md](references/auth.md)
- **Retries and resilience** — httpx has NO built-in HTTP-level retry; `HTTPTransport(retries=N)` only retries connect errors; layer `tenacity` or `stamina`; timeout knobs; exception hierarchy (`RequestError` vs `HTTPStatusError`); `raise_for_status()`. → [retries-and-resilience.md](references/retries-and-resilience.md)
- **Streaming** — `client.stream("GET", url)` context manager, `iter_bytes` / `iter_text` / `iter_lines` (sync) and `aiter_*` (async), streaming upload via generators, SSE via `httpx-sse`. → [streaming.md](references/streaming.md)
- **HTTP/2** — `http2=True` opt-in, `httpx[http2]` extra installs `h2`, multiplexing benefit, `response.http_version` to inspect, ALPN behavior. → [http2.md](references/http2.md)
- **Proxies and TLS** — `proxy=` (single proxy), `mounts=` (per-scheme transports), SOCKS via `httpx[socks]`, `verify=` cert bundle, custom `ssl.SSLContext`, mTLS client cert, `truststore` for system trust. → [proxies-and-tls.md](references/proxies-and-tls.md)
- **Testing** — `MockTransport(handler)`, `ASGITransport(app=app)` for FastAPI/Starlette in-memory tests, `WSGITransport` for Flask/Django, `respx`, `pytest-httpx`. → [testing.md](references/testing.md)
- **Migration from requests** — cheatsheet: `Session → Client`, `allow_redirects → follow_redirects` (default flipped to False), `ConnectionError → ConnectError`, no built-in retry, `response.url` is a URL object, mounts replace `proxies=`. → [migration-from-requests.md](references/migration-from-requests.md)
- **Troubleshooting** — symptom-indexed: `ConnectTimeout` vs `ReadTimeout`, `SSL: CERTIFICATE_VERIFY_FAILED`, missing `h2` package, pool exhaustion, leaked async response, "event loop is closed", sync client called from async context. → [troubleshooting.md](references/troubleshooting.md)
- **Recommended defaults** — always use `Client` / `AsyncClient` as context manager, set `timeout=` explicitly, opt in to `follow_redirects=True` only where appropriate, reuse one `AsyncClient` per process, call `raise_for_status()` unless you handle status manually. → [recommended-defaults.md](references/recommended-defaults.md)
- **Wrong vs Right** — one client per request, missing timeout, missing follow_redirects, blocking sync client inside async, missing context manager, manual `while` retry without backoff. → [wrong-vs-right.md](references/wrong-vs-right.md)
- **Eval cases** — routing tests, positive/negative prompts. → [eval-cases.md](references/eval-cases.md)

## Behavioral Traits

- Always uses `Client` or `AsyncClient` as a context manager — never bare module-level `httpx.get(...)` inside loops or long-lived code
- Reuses a single `AsyncClient` per process for connection pooling; binds its lifecycle to FastAPI `lifespan`, not per-request
- Sets `timeout=` explicitly on every long-lived client — never relies on "no timeout" or surprise default
- Treats `follow_redirects=False` as the default and opts in per-call or per-client only when redirects are expected
- Calls `response.raise_for_status()` immediately after the request unless the code explicitly handles non-2xx status
- Distinguishes `httpx.RequestError` (network/transport failure) from `httpx.HTTPStatusError` (4xx/5xx) — catches the narrower one
- Implements custom auth by subclassing `httpx.Auth` and yielding the request from `auth_flow`, never by mutating headers ad-hoc
- Layers retry/backoff via `tenacity` or `stamina` — never via a hand-rolled `while True` loop without jitter
- Uses `ASGITransport` to test FastAPI/Starlette apps in-memory — never spins up a real port for unit tests
- Picks `MockTransport` / `respx` / `pytest-httpx` for HTTP mocking instead of monkey-patching the network
- Enables HTTP/2 only after installing `httpx[http2]` (the `h2` package) and confirms via `response.http_version`
- Defers numeric knob defaults (timeouts, pool limits, retry counts) to [recommended-defaults.md](references/recommended-defaults.md) — no inline magic numbers

## Important Constraints

- NEVER call a sync `httpx.Client` from inside `async def` code — it blocks the event loop; use `AsyncClient` (see [wrong-vs-right.md](references/wrong-vs-right.md))
- NEVER instantiate a new `Client` / `AsyncClient` per request inside a hot loop — connection pool is wasted and FD usage explodes
- NEVER skip the context manager (`with httpx.Client() as c:` / `async with httpx.AsyncClient() as c:`) — leaked transports keep sockets open until GC
- NEVER assume httpx will retry HTTP errors — it does not; only `HTTPTransport(retries=N)` covers connect failures; use `tenacity` / `stamina` for status-based retry
- NEVER set `verify=False` in production — disables certificate validation entirely; use a custom `ssl.SSLContext` with the right CA bundle instead
- NEVER mix `data=` and `json=` in the same call — `data=` is form-encoded, `json=` is JSON-serialized; picking the wrong one corrupts the body
- NEVER use `data=` with text or bytes — that path is deprecated; use `content=` for raw bodies
- NEVER assume `follow_redirects=True` — it's `False` by default in httpx (opposite of `requests`); APIs that 301 will silently return the redirect response
- NEVER call `response.json()` without first checking `response.status_code` or calling `raise_for_status()` — error responses are rarely valid JSON
- NEVER open a streaming response without the `with` / `async with` block — you must close it to release the connection
- NEVER pass `proxies={...}` (requests-style) — use `proxy=` for a single proxy or `mounts=` per scheme
- ALWAYS call `raise_for_status()` on responses you do not explicitly status-check
- ALWAYS install the `http2` extra (`pip install httpx[http2]`) before passing `http2=True` — otherwise httpx silently falls back to HTTP/1.1
- ALWAYS catch `httpx.RequestError` for network issues and `httpx.HTTPStatusError` for 4xx/5xx — they are siblings of `httpx.HTTPError`
- ALWAYS pin numeric defaults in [recommended-defaults.md](references/recommended-defaults.md), not inline in code samples

## Related Skills

**90%-filter applied** — mainstream 2026 client-side Python HTTP tooling.

### Parent / sibling stacks
- ✓ `python` — Python 3.14 baseline (async, type hints)
- ✓ `pydantic` — Pydantic v2 (often used to parse `response.json()`)

### Downstream consumer (this skill's main testing target)
- ✓ `fastapi` — FastAPI testing via `httpx.AsyncClient(transport=ASGITransport(app))`

### Testing
- ✓ `pytest` — pytest 9 (used by `pytest-httpx` fixture)

### Code discipline
- ✓ `karpathy-guidelines` — simplicity, surgical changes
- ✓ `skill-evaluation` — meta

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Index — decision map, reading order | [references/REFERENCE.md](references/REFERENCE.md) |
| Basics — get/post/put/patch/delete, params, headers, json vs data vs content, files, response attrs | [references/basics.md](references/basics.md) |
| Client and AsyncClient — context manager, pooling, base_url, default headers/cookies/auth, transport, limits | [references/client-and-asyncclient.md](references/client-and-asyncclient.md) |
| Async usage — await client.get, asyncio.gather, FastAPI lifespan integration, share vs per-request | [references/async-usage.md](references/async-usage.md) |
| Auth — BasicAuth, DigestAuth, NetRCAuth, custom Auth flow class, bearer/OAuth2 patterns | [references/auth.md](references/auth.md) |
| Retries and resilience — no built-in retry, tenacity / stamina, timeout knobs, exception hierarchy, raise_for_status | [references/retries-and-resilience.md](references/retries-and-resilience.md) |
| Streaming — stream() context, iter_bytes / aiter_*, streaming upload, SSE via httpx-sse | [references/streaming.md](references/streaming.md) |
| HTTP/2 — http2=True, h2 dependency, multiplexing, response.http_version, ALPN | [references/http2.md](references/http2.md) |
| Proxies and TLS — proxy=, mounts=, SOCKS, verify=, custom SSLContext, mTLS, truststore | [references/proxies-and-tls.md](references/proxies-and-tls.md) |
| Testing — MockTransport, ASGITransport, WSGITransport, respx, pytest-httpx | [references/testing.md](references/testing.md) |
| Migration from requests — Session→Client, allow_redirects→follow_redirects, exceptions, no retry, mounts | [references/migration-from-requests.md](references/migration-from-requests.md) |
| **Troubleshooting** — ConnectTimeout vs ReadTimeout, CERTIFICATE_VERIFY_FAILED, missing h2, pool exhaustion, leaked async response | [references/troubleshooting.md](references/troubleshooting.md) |
| **Recommended defaults** — context manager, explicit timeout, follow_redirects opt-in, shared AsyncClient, raise_for_status | [references/recommended-defaults.md](references/recommended-defaults.md) |
| **Wrong vs Right** — one client per request, missing timeout, blocking sync in async, manual retry loop | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases | [references/eval-cases.md](references/eval-cases.md) |

**How to use**: open the specific topic file. New client code → `basics.md` + `client-and-asyncclient.md` + `recommended-defaults.md`. Testing a FastAPI app → `testing.md`. Migrating from requests → `migration-from-requests.md` + `wrong-vs-right.md`. Adding retry → `retries-and-resilience.md`. Production hardening → `recommended-defaults.md` + `troubleshooting.md`.
