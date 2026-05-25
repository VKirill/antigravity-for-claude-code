# Changelog

All notable changes to the `httpx` skill.

## [1.0.0] — initial release

### Added

- `SKILL.md` — navigator with frontmatter (name, description, stacks, tags, packages, manifests, risk=medium-stakes), version-block injection placeholder, Use/Do-not-use sections, Purpose, Capabilities outline, Behavioral Traits, Important Constraints, Related Skills (parent `python`, downstream `fastapi`, testing `pytest`), and a full API Reference table.
- `references/REFERENCE.md` — decision map and reading order.
- `references/basics.md` — top-level `httpx.get/post/...`, `params=`, `headers=`, `json=`/`data=`/`content=`/`files=`, response inspection.
- `references/client-and-asyncclient.md` — context manager, `base_url`, default headers/cookies/auth, custom transport, `limits=`, event hooks.
- `references/async-usage.md` — `AsyncClient`, `asyncio.gather`, FastAPI lifespan integration, sharing vs per-request.
- `references/auth.md` — `BasicAuth`, `DigestAuth`, `NetRCAuth`, custom `httpx.Auth` with `auth_flow` / `async_auth_flow`, bearer, OAuth2 refresh, request signing.
- `references/retries-and-resilience.md` — no built-in retry; `HTTPTransport(retries=N)` only retries connect errors; layering `tenacity` / `stamina`; timeout phases; exception hierarchy; `raise_for_status()`.
- `references/streaming.md` — `client.stream(...)`, `iter_bytes` / `aiter_*`, streaming uploads via generators, SSE via `httpx-sse`.
- `references/http2.md` — `http2=True`, `httpx[http2]` install, ALPN, `response.http_version`, multiplexing pitfalls.
- `references/proxies-and-tls.md` — `proxy=` (single), `mounts=` (per-scheme), SOCKS via `httpx[socks]`, `verify=` cert bundle, custom `ssl.SSLContext`, mTLS via `cert=` / `load_cert_chain`, `truststore` for system trust.
- `references/testing.md` — `MockTransport`, `ASGITransport` (FastAPI/Starlette), `WSGITransport` (Flask/Django), `respx`, `pytest-httpx`.
- `references/migration-from-requests.md` — cheatsheet covering `Session→Client`, default-flipped `follow_redirects`, exception renames, `proxies=`→`proxy=`/`mounts=`, no built-in retry, `response.url` is a URL object.
- `references/troubleshooting.md` — symptom-indexed: ConnectTimeout/ReadTimeout, CERTIFICATE_VERIFY_FAILED, missing `h2`, pool exhaustion, leaked async response, "event loop is closed", sync client in async context.
- `references/recommended-defaults.md` — single source of truth for client lifecycle, timeouts, redirects, pool limits, HTTP/2, TLS, auth, retries, status checks, streaming, testing, logging.
- `references/wrong-vs-right.md` — 12 paired snippets (client-per-request, missing context manager, sync-in-async, no timeout, missing `follow_redirects`, manual retry loop without backoff, missing `with` on stream, wrong body param, `verify=False`, monkey-patching tests, missing `raise_for_status()`, requests-style `proxies=` kwarg).
- `references/eval-cases.md` — positive/negative/ambiguous routing prompts.

### Conventions

- No hardcoded version numbers in body — version pin lives in the registry-managed block (sync-script-owned).
- No time-sensitive prose ("as of <date>", "after <month>").
- Numeric defaults centralized in `references/recommended-defaults.md` to avoid drift.
- All reference files linked from the SKILL.md `## API Reference` table.
