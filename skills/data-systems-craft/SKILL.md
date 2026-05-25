---
name: data-systems-craft
description: "Data-systems design discipline from Kleppmann (DDIA). Use when: choosing storage engine, designing replication/sharding, picking transaction isolation level, evaluating consistency models. Trigger terms: LSM-tree, B-tree, quorum, linearizability, snapshot isolation, MVCC, write skew, CAP, eventual consistency, partitioning. SKIP: pure frontend, simple CRUD on stock RDBMS defaults."
stacks:
  - stack-agnostic
tags:
  - distributed-systems
  - replication
  - partitioning
  - transactions
  - consistency
  - storage-engines
  - cap-theorem
source: "Kleppmann — Designing Data-Intensive Applications (2017)"
---

## Use this skill when

- project-architect or worker-refactor-architect designs the data layer of a new system.
- Choosing between SQL / document / KV / time-series / graph / column-family stores.
- Deciding replication topology: single-leader / multi-leader / leaderless.
- Picking transaction isolation level (Read Committed / Snapshot / Serializable).
- Evaluating whether the system needs linearizability vs. eventual consistency.
- Planning a partitioning / sharding strategy as data grows beyond a single node.
- Auditing existing data layer for hidden anomalies (lost updates, write skew).

## Do not use this skill when

- Pure frontend / single-file edit / config tweak.
- Simple CRUD on a single-node RDBMS where defaults are fine.
- Tactical query tuning — use stack skills (postgresql, sqlalchemy, prisma).
- The system is compute-bound, not data-bound.

## Purpose

Translate Kleppmann's canonical reference into one decision-making discipline for data-layer design. Three lenses on every question: reliability (does it survive faults?), scalability (does it grow with load?), maintainability (can it evolve over years?). Each rule cites the source chapter so the agent has both the *rule* and the *why*.

## Capabilities

### Storage engine selection

Choose between log-structured (LSM-tree) and update-in-place (B-tree) storage based on workload (Kleppmann, Ch. 3):

- **B-tree** (PostgreSQL, MySQL, most RDBMS) — stable read performance, breaks DB into fixed-size pages, in-place update. Standard for read-heavy workloads (p. 80).
- **LSM-tree** (Cassandra, LevelDB/RocksDB, Scylla) — turns random writes into sequential via memtable + SSTables; high write throughput; periodic background compaction cost (p. 78).

Apply when:
- Time-series ingestion / event log / write-heavy analytics → LSM (Cassandra, ClickHouse).
- OLTP with mixed read/write → B-tree (PostgreSQL).
- Both support range queries, but layout / cost differs.

### Replication topology

Choose replication based on availability + write throughput needs (Ch. 5):

- **Single-leader** (default for PostgreSQL, MySQL, MongoDB replica sets) — simple, all writes go to leader; risk = write bottleneck + failover lag.
- **Multi-leader** (active-active across data centers) — higher write throughput, geographically distributed; cost = conflict resolution (LWW, CRDT, or app-level merge).
- **Leaderless** / Dynamo-style (Cassandra, Riak, Scylla) — any replica accepts writes; quorum read/write `w + r > n` ensures latest value (p. 179); needs read repair + anti-entropy.

Apply when:
- Single region, simple writes → single-leader async replication.
- Multi-region writes required → multi-leader (accept conflict resolution complexity) or leaderless.
- High availability over strong consistency → leaderless quorum.

### Concurrency control + isolation

Pick isolation based on what anomalies you can tolerate (Ch. 7):

| Level | Prevents | Allows |
|---|---|---|
| Read Committed | dirty read, dirty write | non-repeatable read, lost update, write skew, phantoms |
| Snapshot Isolation (MVCC) | + non-repeatable read | lost update, write skew |
| Serializable Snapshot Isolation (SSI) / 2PL | everything | (perf cost) |

Apply when:
- Simple reads / writes, low conflict → Read Committed (default).
- Reports + concurrent writes → Snapshot Isolation (default in PostgreSQL).
- Booking system / inventory / financial transfers → SSI or 2PL — must prevent write skew (e.g., double-booking same meeting room or overdrawing the same account from two threads).

### Linearizability vs eventual consistency

Linearizability is a recency guarantee: once a write completes, all subsequent reads MUST see that value — the illusion of a single copy with atomic operations (Ch. 9, p. 324). Required for:

- Distributed locks / leader election.
- Uniqueness constraints (unique username, idempotency tokens).
- Cross-channel timing dependencies (write to DB, then send email — email must see write).

Cost: high latency, reduced availability during network partitions (CAP theorem — pick C+P, sacrifice A).

Eventual consistency: writes eventually propagate, but readers may see stale data temporarily. Acceptable for: feed timelines, view counts, "last seen" timestamps, recommendation features.

Apply when:
- A unique-constraint requirement appears → must be linearizable; consider Postgres `UNIQUE` index + serializable transaction, or Redis SET NX with TTL.
- A counter / aggregate / metric → eventual consistency fine; use HyperLogLog, CRDTs, or periodic re-compute.

### Partitioning + sharding strategy

When data grows beyond one node (Ch. 6):

- **Key-range partitioning** — ordered, good for range queries, risk of hot spots (e.g., partitioning by timestamp = all writes go to "today" partition).
- **Hash-range partitioning** — even distribution, no range queries possible across partitions.
- **Compound key** — hash on first part (distribution), range on second (locality). Cassandra's clustering key pattern.

Rebalancing — never use `hash mod N` (every node count change re-shuffles all data); use consistent hashing or fixed-partition count larger than max-ever-nodes.

Apply when:
- Single-node hitting CPU / disk limits → time to partition.
- Choosing key — first ensure no hot spot risk (avoid timestamps, monotonic IDs, popular celebrity user_id).

### Encoding + schema evolution

Data outlives any single version of the code (Ch. 4). Plan for forward + backward compatibility:

- JSON / XML — human-readable, no schema enforcement, no compatibility guarantees.
- Avro — schema-required, supports schema evolution natively, great for streaming.
- Protocol Buffers / Thrift — schema-required, field numbers carry identity (NEVER reuse a field number after delete).
- Always make new fields **optional with sensible default**; never make required without migration path.

Apply when:
- Designing event payload for queue / streaming → Avro or Protobuf, not JSON.
- Adding field to existing schema — optional + default, version producers before consumers.

## Behavioral Traits

- Always assume the network is unreliable; packets WILL be delayed or lost.
- Never rely on synchronized wall-clock time for ordering events across nodes; use monotonic clocks for elapsed time, logical clocks / version vectors for causality.
- Design for partial failure — some nodes up, some down — never "all or nothing".
- Always include a version number or fencing token in writes to shared resources.
- Treat "eventual consistency" as a liveness property (will converge) not a safety guarantee (might be wrong now).
- Default to Snapshot Isolation; reach for Serializable only when write skew is a real risk.

## Important Constraints

- NEVER use Last-Write-Wins (LWW) if data loss is unacceptable — pick CRDT or app-level merge.
- ALWAYS ensure `w + r > n` for strict quorum consistency in leaderless systems.
- NEVER assume a node is dead just because a timeout occurred — it may be in a GC pause.
- ALWAYS include a fencing token in writes to shared resources to prevent zombie nodes corrupting data.
- NEVER use timestamp ordering across nodes for correctness — clock drift WILL bite.
- NEVER partition by timestamp or any monotonic key alone — hot-spot guaranteed.
- NEVER reuse a Protobuf field number after deleting a field — silent data corruption.
- ALWAYS verify "Repeatable Read" in your specific DB actually prevents lost updates (MySQL ≠ PostgreSQL semantics under the same name).

## Anti-patterns

### ❌ The Free Lunch (CAP denial)

**Source:** Ch. 9. **Why wrong:** Assuming a distributed system can deliver high performance + high availability + strong consistency simultaneously.

**Fix:** Acknowledge CAP — pick the trade-off that matches business. Document in ADR.

### ❌ Wall-Clock Ordering

**Source:** Ch. 8. **Why wrong:** Ordering writes by `NOW()` across nodes — clock drift / NTP resets cause data loss and silent reorder.

**Fix:** Logical clocks (Lamport), version vectors, or single-leader for ordering.

### ❌ Ignoring Partial Failure

**Source:** Ch. 8. **Why wrong:** Treating distributed RPC like local function call — "either succeeds or throws". Reality: succeeds-but-response-lost is a real state.

**Fix:** Idempotency keys, retry with deduplication, explicit timeouts.

### ❌ Hot Partition

**Source:** Ch. 6. **Why wrong:** Partition key has skewed distribution (timestamps, celebrity user IDs, status='active') → one node hits 100% while others idle.

**Fix:** Compound key with random salt, or hash partitioning, or separate "hot" entities into own shard.

### ❌ Schema-less Drift

**Source:** Ch. 4. **Why wrong:** "JSON is flexible" — until 5 services emit slightly different shapes and a 2-year-old document breaks a consumer.

**Fix:** Schema-required encoding (Avro / Protobuf) at boundaries; schema registry; CI gate on breaking changes.

## Related Skills

### Sibling architecture skills
- `architecture-craft` — overall system design; this skill is the data-layer chapter of it
- `refactor-hotspots-craft` — find which data structures actually need redesign first

### Stack-specific data skills (load via skill_hints)
- `postgresql` — production PostgreSQL operations + advanced features
- `redis` — in-memory KV / pub-sub / streams / vector
- `prisma` / `sqlalchemy` — ORM-level patterns
- `polars` / `pandas` — analytics-side data processing

### Adjacent
- `bullmq` — queue patterns for event-driven decomposition
- `cybersecurity-audit` — secrets in transit, RBAC at data layer

## Citations from source

> A fault is usually defined as one component of the system deviating from its spec, whereas a failure is when the system as a whole stops providing the required service to the user.
> — *Kleppmann, Ch. 1, p. 7*

> Linearizability is a recency guarantee on reads and writes of a register (an individual object).
> — *Kleppmann, Ch. 9, p. 329*

> In a linearizable system, as soon as one client successfully completes a write, all clients reading from the database must be able to see the value just written.
> — *Kleppmann, Ch. 9, p. 324*

> The defining feature of ACID atomicity is: the ability to abort a transaction on error and have all writes from that transaction discarded.
> — *Kleppmann, Ch. 7, p. 224*

> An asynchronous network has unbounded delays... and most server implementations cannot guarantee that they can handle requests within some maximum time.
> — *Kleppmann, Ch. 8, p. 282*

## Sources

- Martin Kleppmann — *Designing Data-Intensive Applications: The Big Ideas Behind Reliable, Scalable, and Maintainable Systems* (2017)
