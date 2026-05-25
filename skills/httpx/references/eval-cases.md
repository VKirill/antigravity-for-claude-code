# httpx — Eval cases (routing tests)

Lightweight prompt set to verify the skill loads on the right queries and does NOT load on the wrong ones.

## Positive — should load `httpx`

1. "How do I make a POST request with JSON in Python using httpx?"
2. "Migrate this `requests.Session` code to httpx async."
3. "Why does my httpx call return a 301 instead of following the redirect?"
4. "How do I test a FastAPI route with `httpx.AsyncClient` and `ASGITransport`?"
5. "Add retry with exponential backoff around an httpx call."
6. "Enable HTTP/2 in my httpx client and verify it actually negotiated."
7. "Stream a large file download with httpx without loading it all into memory."
8. "Write a custom `httpx.Auth` for bearer tokens with refresh."
9. "I'm getting `httpx.PoolTimeout` under load — what tunes that?"
10. "Configure mTLS client certificate in httpx."
11. "How do I mock httpx in pytest? Should I use `respx` or `pytest-httpx`?"
12. "Why does `data=` give me a deprecation warning in httpx?"
13. "httpx says `'h2' package not installed` — fix?"
14. "What's the difference between `httpx.RequestError` and `httpx.HTTPStatusError`?"
15. "Set a SOCKS5 proxy in httpx."

## Negative — should NOT load `httpx`

1. "Build a FastAPI endpoint that returns paginated items." → `fastapi`
2. "Write a Pydantic schema for an order." → `pydantic`
3. "How do I configure pytest fixtures with session scope?" → `pytest`
4. "Use `fetch` to call my API from a React component." → `react`
5. "Set up an aiohttp client session." → not httpx (different library)
6. "Add `node-fetch` to my Express server." → `nodejs`
7. "Migrate a Django view to async." → `django`
8. "Configure `urllib3` retry policy." → not httpx

## Ambiguous — context-dependent

- "Replace `requests` in this project." — load `httpx` (the canonical replacement). If the user explicitly wants `aiohttp`, they will say so.
- "Async HTTP client in Python." — load `httpx` (the de facto choice). `aiohttp` is the alternative but `httpx` is preferred for new code that needs sync + async parity.
- "Test my FastAPI app's HTTP layer." — load `httpx` AND `fastapi`. The transport (`ASGITransport`) lives in httpx; the app under test lives in FastAPI.

## Routing failure signals

If the agent answers an httpx question without consulting this skill, the description likely lacks the right trigger term. Common gaps:
- "AsyncClient" missing → add to description triggers
- "ASGITransport" missing → add to description triggers
- "follow_redirects" missing → add to description triggers
- "raise_for_status" missing → add to description triggers

The current SKILL.md description covers all of the above.
