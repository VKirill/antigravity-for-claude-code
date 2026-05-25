# httpx — Streaming

Use streaming for: large downloads, server-sent events (SSE), chunked uploads, anything where buffering the entire body in memory is unacceptable.

## Streaming response (sync)

```python
import httpx

with httpx.Client() as client:
    with client.stream("GET", "https://example.com/big.bin") as response:
        response.raise_for_status()
        with open("big.bin", "wb") as f:
            for chunk in response.iter_bytes():
                f.write(chunk)
```

Both `with` blocks are required — the inner `with client.stream(...)` closes the underlying connection.

### Iteration methods

| Method | Yields |
|---|---|
| `response.iter_bytes(chunk_size=None)` | `bytes` chunks |
| `response.iter_text(chunk_size=None)` | decoded `str` chunks |
| `response.iter_lines()` | one `str` per line (decoded) |
| `response.iter_raw(chunk_size=None)` | raw (pre-decompression) `bytes` chunks |

Default `chunk_size` is httpx's internal default; pass an int (e.g. 65536) for tuning. Smaller chunks → more event-loop hops; larger chunks → more memory per buffer.

## Streaming response (async)

```python
async with httpx.AsyncClient() as client:
    async with client.stream("GET", "https://example.com/big.bin") as response:
        response.raise_for_status()
        async for chunk in response.aiter_bytes():
            ...
```

Async iteration methods: `aiter_bytes`, `aiter_text`, `aiter_lines`, `aiter_raw`. Also `await response.aread()` to materialize the body after streaming inspection.

## Manual lifecycle (advanced)

For frameworks that hold the response across function boundaries:

```python
req = client.build_request("GET", url)
r = await client.send(req, stream=True)
try:
    async for chunk in r.aiter_bytes():
        ...
finally:
    await r.aclose()
```

You MUST call `r.aclose()` (or `.close()` for sync). Otherwise the connection stays held until GC.

## Streaming upload

Pass a generator or async generator as `content=`:

```python
def chunks():
    for i in range(100):
        yield f"chunk {i}\n".encode()

client.post("https://example.com/upload", content=chunks())
```

```python
async def achunks():
    for i in range(100):
        yield f"chunk {i}\n".encode()

await client.post("https://example.com/upload", content=achunks())
```

For a file-like, pass the open binary file handle as `content=open(path, "rb")` — httpx will stream it. For multipart uploads with files, use `files=` and pass an open binary file (`open(path, "rb")`).

## Server-Sent Events (SSE)

httpx does not parse SSE itself. Use the **`httpx-sse`** companion:

```python
import httpx
from httpx_sse import connect_sse

with httpx.Client() as client:
    with connect_sse(client, "GET", "https://example.com/events") as event_source:
        for sse in event_source.iter_sse():
            print(sse.event, sse.data)
```

Async version: `aconnect_sse` + `async for sse in event_source.aiter_sse()`.

## Common streaming mistakes

- Calling `response.text` or `response.json()` after entering a `stream(...)` context but before iterating — these consume the body in one shot and defeat streaming.
- Leaving the `stream(...)` block open across `await` of unrelated work — the pool slot stays busy. Iterate to completion (or close early) inside the `with` block.
- Forgetting `raise_for_status()` before streaming — you may stream an error page as the body.
- Mixing `iter_bytes` and `iter_text` — you can only iterate the body once.

## Closing early

To abort a streaming response mid-way, exit the `with` block. httpx closes the connection cleanly. For manual lifecycle, call `response.close()` / `await response.aclose()`.
