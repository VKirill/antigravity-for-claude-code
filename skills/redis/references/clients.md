# Redis — Clients (Node.js)

## ioredis (Node default)

```ts
import Redis from 'ioredis';

const redis = new Redis({
  host: '127.0.0.1',
  port: 6379,
  password: process.env.REDIS_PASSWORD,
  db: 0,
  tls: process.env.REDIS_TLS === '1' ? {} : undefined,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  enableReadyCheck: true,
  enableOfflineQueue: true,
});

redis.on('error', (err) => console.error('redis error', err));
redis.on('ready',  () => console.log('redis ready'));
```

Most BullMQ / Bull-board / Fastify ecosystem assumes `ioredis`. Stable, battle-tested.

### Cluster

```ts
const cluster = new Redis.Cluster([
  { host: 'node1', port: 6379 },
  { host: 'node2', port: 6379 },
], {
  redisOptions: { password: '...' },
  scaleReads: 'slave',
});
```

### Sentinel

```ts
const sentinel = new Redis({
  sentinels: [{ host: 's1', port: 26379 }, { host: 's2', port: 26379 }],
  name: 'mymaster',
  password: '...',
});
```

### Pipelining

```ts
const results = await redis.pipeline()
  .set('k1', 'v1')
  .incr('counter')
  .expire('counter', 60)
  .exec();
// results: [[null, 'OK'], [null, 42], [null, 1]]
```

### Transactions

```ts
const results = await redis.multi()
  .set('k', 'v')
  .incr('c')
  .exec();
```

For WATCH:

```ts
await redis.watch('mykey');
const val = await redis.get('mykey');
const txn = redis.multi().set('mykey', String(Number(val) + 1));
const exec = await txn.exec();   // null if mykey changed since WATCH
```

### Pub/Sub

`SUBSCRIBE` blocks the connection. Use a separate client:

```ts
const pub = new Redis();
const sub = new Redis();

await sub.subscribe('events');
sub.on('message', (channel, message) => console.log(channel, message));

await pub.publish('events', JSON.stringify({ type: 'hi' }));
```

### Streams

```ts
// producer
await redis.xadd('events', '*', 'type', 'order_paid', 'orderId', '42');

// consumer
const results = await redis.xread(
  'COUNT', 10,
  'BLOCK', 5000,
  'STREAMS', 'events', '$',
);
```

## node-redis (`redis`)

```ts
import { createClient } from 'redis';

const client = createClient({
  url: 'redis://user:password@127.0.0.1:6379/0',
  socket: { tls: true, reconnectStrategy: (retries) => Math.min(retries * 50, 2000) },
});

client.on('error', (err) => console.error(err));
await client.connect();
```

Modern, promise-first API. RESP3 support. Official client maintained by Redis Inc.

```ts
// Modern command syntax
await client.set('k', 'v', { EX: 60, NX: true });
const val = await client.get('k');

// Pipeline / transaction
const results = await client.multi()
  .set('k1', 'v1')
  .incr('counter')
  .exec();
```

### Picking between `ioredis` and `node-redis`

| Factor | ioredis | node-redis (v5+) |
|---|---|---|
| Stability | Battle-tested at scale | Stable since v4 |
| Ecosystem | BullMQ, Bull-board, @fastify/redis assume it | Increasing |
| RESP3 | Yes | Yes (default) |
| TypeScript | Decent | Excellent |
| API style | Mongo-like options object | Modern, promise-first |
| Cluster | Built-in | Built-in (different API) |
| Maintenance | Community + Redis Inc | Official Redis Inc |

Default to **ioredis** unless you have a specific reason for the official client. Switch is mechanical.

## redis-om — Object Mapper

```ts
import { Repository, Schema } from 'redis-om';
import { createClient } from 'redis';

const userSchema = new Schema('user', {
  email: { type: 'string', indexed: true },
  name:  { type: 'text' },
  age:   { type: 'number', sortable: true },
});

const client = await createClient().connect();
const users = new Repository(userSchema, client);

await users.createIndex();
const user = await users.save({ email: 'a@b.c', name: 'A', age: 30 });
const found = await users.search().where('email').eq('a@b.c').return.first();
```

Builds on **RediSearch** (Redis Stack module). Best when you want Redis as a document store with FT.SEARCH-backed queries.

Tradeoffs: ties you to Redis Stack (not vanilla Redis), more memory, slower than direct HSET / ZADD for primitives. Use when the document-store ergonomics are worth it.

## Connection lifecycle

```ts
// Graceful shutdown
process.on('SIGTERM', async () => {
  await redis.quit();    // graceful close — sends QUIT
  process.exit(0);
});
```

`quit()` waits for in-flight commands. `disconnect()` is hard-close.

In Fastify:

```ts
import fp from 'fastify-plugin';
import Redis from 'ioredis';

export default fp(async (app) => {
  const redis = new Redis(process.env.REDIS_URL);
  app.decorate('redis', redis);
  app.addHook('onClose', async () => { await redis.quit(); });
}, { name: 'redis' });
```

## Cluster `MULTI`/`EXEC` caveats

Cluster splits keys across nodes. `MULTI`/`EXEC` only works if all keys hash to the same slot. Use hash tags:

```
SET {user:42}:profile "..."
SET {user:42}:settings "..."
```

The `{user:42}` segment is hashed; the keys go to the same slot, so `MULTI`/`EXEC` works.

## Anti-patterns

- ❌ Sharing one client between Pub/Sub subscribe and regular commands → subscribe blocks the conn
- ❌ Default `maxRetriesPerRequest: 20` causing request storms on Redis outage — set to 3 or null (BullMQ requires null)
- ❌ Not calling `quit()` on shutdown → connection leaks
- ❌ Calling `HGETALL` on a hash with millions of fields — blocks the server
- ❌ Using `KEYS pattern` in any handler — production-destroying
- ❌ Letting `enableOfflineQueue` queue forever during an outage — set timeout
