# BullMQ — Flows & Children

`FlowProducer` lets you enqueue a tree of jobs where the parent waits for its children before processing.

## Basic flow

```ts
import { FlowProducer } from 'bullmq';

const flow = new FlowProducer({ connection });

const tree = await flow.add({
  name: 'send-report',
  queueName: 'reports',
  data: { reportId: 'r_1' },
  children: [
    { name: 'fetch-orders',  queueName: 'data',    data: { reportId: 'r_1' } },
    { name: 'fetch-users',   queueName: 'data',    data: { reportId: 'r_1' } },
    { name: 'compute-stats', queueName: 'compute', data: { reportId: 'r_1' } },
  ],
});
```

Behavior:
1. Three children added to `data` and `compute` queues.
2. Parent `send-report` enters `waiting-children` state — NOT processable.
3. As each child completes, the parent's pending-child count drops.
4. When all children complete, parent moves to `waiting` → processed.

## Nested flows

```ts
await flow.add({
  name: 'monthly-report',
  queueName: 'reports',
  data: { month: '2026-05' },
  children: [
    {
      name: 'weekly-report',
      queueName: 'reports',
      data: { week: '2026-W18' },
      children: [
        { name: 'fetch', queueName: 'data', data: { week: '2026-W18' } },
      ],
    },
    {
      name: 'weekly-report',
      queueName: 'reports',
      data: { week: '2026-W19' },
      children: [
        { name: 'fetch', queueName: 'data', data: { week: '2026-W19' } },
      ],
    },
  ],
});
```

Depth is unlimited. Inner-most jobs run first; results bubble up.

## Reading children's results in the parent

```ts
new Worker('reports', async (job) => {
  // job.getChildrenValues() returns { '<childId>': returnValue, ... }
  const childResults = await job.getChildrenValues();
  const dataResults = Object.values(childResults).filter((v) => v?.type === 'data');
  // ... compose final result
  return { ok: true, ...summarize(dataResults) };
}, { connection });
```

In the **child** handler, just `return result` — BullMQ stores it for the parent.

## Per-child options

```ts
await flow.add({
  name: 'parent',
  queueName: 'reports',
  data: { id },
  opts: { attempts: 3 },                  // parent options
  children: [
    {
      name: 'fetch',
      queueName: 'data',
      data: {},
      opts: { attempts: 5, backoff: { type: 'exponential', delay: 1000 } },
    },
  ],
});
```

## Failure semantics

By default, if a child **fails permanently** (exhausts attempts), the parent goes to `failed` automatically with `ChildJobFailedError`.

Override via `failParentOnFailure: false`:

```ts
children: [
  { name: 'optional-step', queueName: 'data', data: {}, opts: { failParentOnFailure: false } },
],
```

Parent proceeds even if this child failed.

## Removing children when parent removed

```ts
{
  name: 'parent',
  queueName: 'q',
  data: {},
  opts: { removeOnComplete: true, removeDependencyOnFailure: true },
}
```

Without `removeDependencyOnFailure`, a failed child blocks the parent forever in `waiting-children` (until the child is manually retried or removed).

## Inspecting flow tree

```ts
const node = await flow.getFlow({ id: tree.job!.id!, queueName: 'reports' });
// node.children = [{ job, children: [...] }, ...]
```

Or via `Job.getDependencies()`:

```ts
const job = await reportsQueue.getJob('parent-id');
const deps = await job.getDependencies();
// deps.processed = { [queue:id]: returnvalue }
// deps.unprocessed = [...job ids still pending]
```

## Manually adding child to existing parent

```ts
import { FlowProducer } from 'bullmq';

const flow = new FlowProducer({ connection });

await flow.addBulk([
  {
    name: 'extra-step',
    queueName: 'data',
    data: {},
    opts: {
      parent: { id: 'parent-id', queue: 'bull:reports' },   // note 'bull:' prefix
    },
  },
]);
```

Then the parent stays in `waiting-children` until this new child completes too.

## Waiting children inside a handler

A worker can pause its job to wait for newly-created children:

```ts
new Worker('reports', async (job, token) => {
  // Spawn additional dynamic children based on intermediate state
  await flow.add({
    name: 'dynamic-child',
    queueName: 'data',
    data: { ... },
    opts: { parent: { id: job.id!, queue: 'bull:reports' } },
  });

  // Tell BullMQ to put this job back to waiting-children
  const shouldWait = await job.moveToWaitingChildren(token);
  if (shouldWait) {
    // Job will be picked up again once dynamic children finish
    return;
  }
  // ... continue with final aggregation
}, { connection });
```

`moveToWaitingChildren` returns `true` if there are unprocessed children to wait for, `false` if all done. The handler can return after that — BullMQ will re-invoke when ready.

## When to use flows

| Pattern | Use flow? |
|---|---|
| Single job | No |
| 2-3 sequential steps | No — chain by enqueuing the next from the previous's handler |
| Parallel fan-out + join | YES — flows do this naturally |
| Multi-step pipeline with retries per step | YES |
| Long-running orchestration with branching | YES (or consider Temporal / Inngest if very complex) |

## Anti-patterns

- ❌ Forgetting to set `attempts` on children — they don't inherit from the parent
- ❌ Building 1000-child flows for batch processing — Redis memory + zset cost; use a single worker with concurrency instead
- ❌ Mixing flows with `repeat` patterns — repeating jobs can't have children
- ❌ Using flows for sequential steps when a single handler with awaited calls is simpler
- ❌ Forgetting `removeOnComplete` on children — parent's `getChildrenValues` works post-completion only if children are still in Redis
