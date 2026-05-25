# Node.js 24 — Streams & Web Streams

> Node.js 24.14.1 · TypeScript 6.0.x · Updated: 2026-05-16

## Web Streams API (stable in Node 21+)

`ReadableStream`, `WritableStream`, `TransformStream` are globals — same API as browsers.

```ts
// ReadableStream from scratch
const readable = new ReadableStream<string>({
  start(controller) {
    controller.enqueue('chunk 1');
    controller.enqueue('chunk 2');
    controller.close();
  },
});

// Consume with async iteration (Node 24 — ReadableStream is AsyncIterable)
for await (const chunk of readable) {
  console.log(chunk); // 'chunk 1', 'chunk 2'
}
```

## TransformStream — pipe-able transforms

```ts
// JSON Lines transformer
const jsonLinesTransform = new TransformStream<string, unknown>({
  transform(chunk, controller) {
    for (const line of chunk.split('\n')) {
      const trimmed = line.trim();
      if (trimmed) controller.enqueue(JSON.parse(trimmed));
    }
  },
});

// Usage: fetch response → transform → consume
const response = await fetch('https://api.example.com/stream');
const stream = response.body!
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(jsonLinesTransform);

for await (const record of stream) {
  await processRecord(record);
}
```

## Bridging Node streams ↔ Web Streams

```ts
import { Readable, Writable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';

// Node Readable → Web ReadableStream
const nodeReadable = createReadStream('file.txt');
const webReadable = Readable.toWeb(nodeReadable);

// Web ReadableStream → Node Readable
const webStream = new ReadableStream({ start(c) { c.enqueue('data'); c.close(); } });
const nodeStream = Readable.fromWeb(webStream);

// Web WritableStream → Node Writable
const webWritable = new WritableStream({ write(chunk) { console.log(chunk); } });
const nodeWritable = Writable.fromWeb(webWritable);
```

## Streaming fetch response

```ts
// Stream large response without buffering entire body
const response = await fetch('https://api.example.com/large-dataset');

if (!response.body) throw new Error('No body');

const reader = response.body
  .pipeThrough(new TextDecoderStream())
  .getReader();

try {
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    await processChunk(value);
  }
} finally {
  reader.releaseLock();
}
```

## Node streams still valid for fs / process

Node's `node:stream` API remains the idiomatic choice for file I/O:

```ts
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

// pipeline() handles backpressure + cleanup automatically
await pipeline(
  createReadStream('input.json'),
  createGzip(),
  createWriteStream('output.json.gz'),
);
```

## Async generators as streams

```ts
async function* generateRecords(ids: number[]) {
  for (const id of ids) {
    yield await fetchRecord(id);
  }
}

// Node 24: Readable.from() wraps async generators
import { Readable } from 'node:stream';
const stream = Readable.from(generateRecords([1, 2, 3]));

for await (const record of stream) {
  console.log(record);
}
```

## Backpressure with WritableStream

```ts
const writable = new WritableStream<Uint8Array>({
  write(chunk, controller) {
    // Return a Promise to signal backpressure
    return writeToDb(chunk);
  },
  abort(reason) {
    console.error('Stream aborted', reason);
  },
});

// Writer respects backpressure automatically
const writer = writable.getWriter();
await writer.write(new TextEncoder().encode('data'));
await writer.close();
```
