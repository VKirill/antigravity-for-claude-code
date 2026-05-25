# Streaming Engine

For datasets that don't fit in memory. Operates on chunks; pipeline runs in stages without materializing intermediates.

## Two ways to invoke

### `.collect(engine="streaming")`
Returns a `DataFrame` — the final result must still fit in memory, but intermediates do not.

```python
out = (
    pl.scan_parquet("events/*.parquet")
      .filter(pl.col("ts").dt.year() == 2026)
      .group_by("user_id")
      .agg(pl.col("amount").sum())
      .collect(engine="streaming")
)
```

### `sink_*` — never materialize at all
Streams from input to output; nothing held in memory at the end.

```python
(
    pl.scan_csv("huge.csv")
      .filter(pl.col("score") > 0)
      .with_columns(pl.col("score").log().alias("log_score"))
      .sink_parquet("out.parquet", compression="zstd", row_group_size=1_000_000)
)
```

Available sinks: `sink_parquet`, `sink_csv`, `sink_ipc`, `sink_ndjson`.

## What's streamable

| Operation | Streamable | Notes |
|---|---|---|
| `scan_csv` / `scan_parquet` / `scan_ndjson` | Yes | The whole point |
| `filter` | Yes | |
| `select` / `with_columns` (scalar/elementwise expressions) | Yes | |
| `group_by` + aggregations | Yes (most) | Some complex aggregations fall back |
| `join` (inner, left, semi, anti) | Yes | Hash-based; right side built first |
| `join_asof` | Yes (from 1.39+) | Including grouped asof |
| `sort` | Yes | Partial / external sort |
| `unique` | Yes | |
| Window expressions (`.over()`) | Partial | Simple cases stream; complex `mapping_strategy` may fall back |
| Pivots with unknown columns | No | Falls back to in-memory |
| `map_elements` (Python UDF) | No | Always blocks the pipeline |

To verify, run `.explain(streaming=True)` — nodes that aren't streamable show up as in-memory fallbacks.

## Monitoring

Polars logs streaming progress when `POLARS_VERBOSE=1`:

```bash
POLARS_VERBOSE=1 python pipeline.py
```

For programmatic memory tracking, wrap the call and sample RSS externally (`psutil.Process().memory_info().rss`) — Polars does not expose internal memory metrics.

## Chunk size and parallelism

`POLARS_STREAMING_CHUNK_SIZE` env var sets the chunk size in rows (default is engine-tuned). Increase for higher throughput on machines with abundant RAM; decrease if you OOM.

`POLARS_MAX_THREADS` caps the thread pool. Default = physical core count.

## Limitations to know

- **Final `.collect(streaming=True)` still returns a DataFrame** — the **result** must fit in memory. For truly unbounded output, use `sink_*`.
- **Some `group_by` paths require seeing all data once** (e.g., distinct counts with very high cardinality). These run in chunks but peak memory may approach the cardinality of the key set.
- **Sort + streaming** uses external on-disk sort. Make sure your tmp dir (set with `POLARS_TEMP_DIR`) has space.
- **`map_elements` / `map_batches` with Python callable** is a hard barrier — the engine has to materialize at that point.

## Streaming-friendly pipeline anatomy

```
scan_*  --[pushdown filter/projection]-->  with_columns/filter  -->  group_by/agg  -->  sink_*
```

Linear, no Python UDFs, no unsupported `over` patterns — this streams end-to-end with bounded memory regardless of input size.

## When streaming is the wrong tool

- Dataset fits in RAM with headroom — eager engine is faster (no chunk overhead).
- Final output also wouldn't fit — you need a multi-step pipeline that writes intermediate `sink_parquet` files and re-scans them.
- Heavy Python UDF logic — streaming buys nothing; refactor to expressions first.

## Practical tuning checklist

1. Run `.explain(streaming=True)` and confirm all major nodes are streamable.
2. Set `POLARS_STREAMING_CHUNK_SIZE` if you OOM (try halving until stable).
3. Move filters and projections as early as possible — pushdown already does this for scans, but not always for joins.
4. Prefer Parquet over CSV — Parquet's columnar format and metadata enable real pushdown.
5. For sort-heavy pipelines, ensure `POLARS_TEMP_DIR` points to fast local disk.
