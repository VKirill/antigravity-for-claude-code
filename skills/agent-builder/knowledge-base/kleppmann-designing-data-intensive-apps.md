# Kleppmann, *Designing Data-Intensive Applications*

**Source type:** book
**Date / edition:** 2017
**Epistemic status:** distilled principles, not direct quotes

## Core thesis

Three forces shape every data-intensive system: **reliability** (the system works correctly even when things go wrong), **scalability** (the system can grow to handle increased load), **maintainability** (people can productively work with it over time). Most "bugs" in distributed systems are not coding mistakes — they're missing nuance about consistency, partitioning, replication, or failure modes.

## Key principles

1. **Reliability, scalability, maintainability are forces, not features.** You can't bolt them on later. Architectural decisions early-on either preserve or destroy them.

2. **Latency vs throughput vs response-time distributions.** Averages lie. P50, P95, P99, P999 tell different stories. Tail latencies (P99+) are what users actually experience when "the site is slow".

3. **CAP is real but oversimplified.** In a network partition, you choose between consistency and availability. But the more useful framing is the **PACELC** extension: Partition → A or C, Else → Latency or Consistency. Most systems are tunable along this axis.

4. **Consistency is plural.** "Eventually consistent", "strong consistency", "linearizable", "causal", "read-your-writes", "monotonic reads" — these are distinct guarantees. Saying a system is "consistent" without specifying which means everyone's wrong about what they're getting.

5. **Replication has three patterns:** single-leader (simple, single point of failure), multi-leader (conflict resolution needed), leaderless (Dynamo-style, with quorums). Each has different consistency and availability properties.

6. **Partitioning by key range vs by hash.** Key range gives efficient range queries but creates hot spots. Hash gives balanced load but kills range queries. Most systems pick one and live with the consequences.

7. **Two generals problem.** You can never know for sure whether a remote operation succeeded if the response was lost. All distributed systems live with this. Idempotency, deduplication, and at-least-once-with-dedup are the practical answers.

8. **The unbundled database.** Modern data systems are pipelines of specialized components (log + index + cache + search + analytics), often connected by a change-data-capture stream. The "database" is no longer a single product.

9. **Schemas are forever.** Data outlives code. Schema migrations are the most common operational headache in long-lived systems. Design for schema evolution from day one (Avro, Protobuf, careful JSON conventions).

10. **Batch vs stream is a false dichotomy.** Streaming = unbounded batch. Batch = bounded stream. Lambda/Kappa architectures emerged from trying to unify them; modern systems (Flink, Kafka Streams) blur the line.

## How to apply in code-design decisions

- **When picking a database:** what consistency guarantees do you actually need? Strong consistency is expensive — don't pay for it if eventual works.
- **When designing an API that calls remote services:** assume responses can be lost. Add idempotency keys to retryable operations.
- **When sizing capacity:** don't reason about averages. Look at P99 latency under realistic load; that's the experience users get.
- **When planning a data migration:** rolling deploys + dual-writing + backfill + read-from-both + cutover. Big-bang migrations of large datasets are how you have outages.
- **When choosing between RDBMS and "noSQL":** the choice is rarely between SQL and not-SQL — it's between strong transactional guarantees (RDBMS) and other axes (scale, flexibility, replication patterns).
- **When adding a queue / event bus to your architecture:** what are the delivery guarantees (at-most-once / at-least-once / effectively-once)? Most systems are at-least-once-with-dedup in practice.

## When this source is WRONG / dated

- **2017 vintage.** Several systems mentioned (especially proprietary ones) have evolved or been deprecated. The book is best treated as principles + dated examples.
- **Light on observability.** Modern data systems demand strong observability (tracing, structured logging, metrics). The book treats this lightly.
- **Pre-AI-data-pipelines.** Doesn't cover vector databases, embeddings, ML feature stores in depth — major gaps for 2026 systems.
- **The "right" answer for many specific tools has shifted.** "Use Kafka" was advice in 2017; in 2026 it's "use Kafka or Redpanda or one of the cloud equivalents depending on operational tolerance".

## Cross-references

- **Pairs well with:** Martin, *Clean Architecture* (Kleppmann: what database to pick; Martin: how that database connects to your business logic without coupling)
- **Pairs well with:** Anthropic's *Effective Harnesses* (both are about engineering for long-running, partial-failure systems)
- **Conflicts with:** "just use Postgres for everything" — Kleppmann would say this is right *more often than people think*, but wrong when scale or specific access patterns demand otherwise

## Use in agent system prompts

Standing rules to embed (compressed):

```
- Latency: distributions, not averages. P95/P99 tail matters more than mean.
- Remote calls can fail silently — design for idempotency on retry.
- Consistency model is plural; specify which guarantee, not just "consistent".
- Schemas outlive code. Plan migrations from day one (additive changes preferred).
- For at-least-once messaging, add idempotency keys at the consumer.
```

Relevant for **backend / data-layer subagents**. Skip for pure-frontend or pure-CLI work.
