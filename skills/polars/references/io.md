# IO

Polars distinguishes **eager** readers (`read_*`) and **lazy** scanners (`scan_*`). Always prefer `scan_*` for files large enough to benefit from pushdown.

## CSV

### Eager
```python
df = pl.read_csv(
    "trades.csv",
    schema_overrides={"price": pl.Float64},
    has_header=True,
    separator=",",
    null_values=["", "NA", "NULL"],
    try_parse_dates=True,
)
```

### Lazy with pushdown
```python
lf = pl.scan_csv(
    "trades.csv",
    schema={
        "ts":     pl.Datetime("us"),
        "symbol": pl.String,
        "price":  pl.Float64,
        "qty":    pl.Int64,
    },
)
out = (
    lf.filter(pl.col("symbol") == "BTC")
      .select("ts", "price")
      .collect()
)
# Predicate + projection pushdown: only rows with symbol=BTC and only two columns
# pass through the CSV parser. Inspect with .explain().
```

### Multiple files / globs
```python
pl.scan_csv("data/*.csv")
pl.scan_csv(["a.csv", "b.csv"])
```

## Parquet — preferred format

Parquet is columnar, compressed, carries its own schema, and supports predicate + projection pushdown natively. Use it as your default storage format.

```python
# Lazy with full pushdown
lf = pl.scan_parquet("events/*.parquet")
out = (
    lf.filter(pl.col("event_date") >= datetime.date(2026, 1, 1))
      .select("user_id", "event_type", "event_date")
      .collect()
)
```

### Hive partitioning
Polars auto-detects `key=value/` directory partitioning:

```python
# events/year=2026/month=05/part-0.parquet
lf = pl.scan_parquet("events/**/*.parquet", hive_partitioning=True)
lf.filter(pl.col("year") == 2026).collect()  # only reads the matching partitions
```

### Streaming write — `sink_parquet`
```python
(
    pl.scan_csv("huge.csv")
      .filter(pl.col("score") > 0)
      .with_columns(pl.col("score").log().alias("log_score"))
      .sink_parquet(
          "out.parquet",
          compression="zstd",
          row_group_size=1_000_000,
      )
)
```

### Cloud storage
`s3://`, `gs://`, `az://` paths work with `storage_options=`:

```python
pl.scan_parquet(
    "s3://bucket/events/*.parquet",
    storage_options={"aws_region": "eu-central-1"},
)
```

## NDJSON / JSON

```python
pl.scan_ndjson("logs/*.ndjson")        # newline-delimited JSON, lazy
pl.read_ndjson("logs.ndjson")          # eager
pl.read_json("doc.json")               # eager, single document
df.write_ndjson("out.ndjson")
df.write_json("out.json")
```

NDJSON is preferred for large logs because each line is independent.

## IPC / Arrow

`.arrow` / `.ipc` files round-trip Polars frames losslessly (full type fidelity, including `Struct`/`List`/`Array`):

```python
pl.scan_ipc("data.arrow")
df.write_ipc("data.arrow", compression="zstd")
lf.sink_ipc("data.arrow")
```

## Databases — `read_database` / `write_database`

Polars uses **ConnectorX** (sync, fast) or **ADBC** (modern, Arrow-native) under the hood.

```python
# ConnectorX — pass a connection string
df = pl.read_database_uri(
    query="SELECT id, ts, amount FROM payments WHERE ts >= '2026-01-01'",
    uri="postgresql://user:pw@localhost:5432/app",
)

# ADBC / SQLAlchemy — pass a connection or engine
from sqlalchemy import create_engine
engine = create_engine("postgresql+psycopg://...")
df = pl.read_database("SELECT * FROM payments LIMIT 1000", connection=engine)

# Write
df.write_database(
    table_name="payments_summary",
    connection="postgresql://user:pw@localhost/app",
    if_table_exists="replace",   # 'append' | 'replace' | 'fail'
)
```

For **lazy** database reads, push the work into SQL (server-side aggregation) and read the smaller result, rather than streaming a huge table.

## Excel

```python
df = pl.read_excel("file.xlsx", sheet_name="Sheet1")
df.write_excel("out.xlsx")
```

Backed by `fastexcel`. Slow for large sheets — convert to Parquet for downstream work.

## `scan_*` vs `read_*` decision

| Use `scan_*` | Use `read_*` |
|---|---|
| File is on disk (or cloud) | Already in memory (`pl.DataFrame({...})`) |
| You will filter / project before consuming | You need the whole frame immediately |
| Want predicate / projection pushdown | One-shot inspection |
| Output goes through `sink_*` or another lazy pipeline | You'll convert to pandas / numpy next |
| Dataset doesn't fit in memory | Always fits comfortably |

## Schema specification — always when known

Lazy scans with no `schema=` argument trigger a sample inference, which is slow on large files and can pick the wrong dtype. If you know the schema, pass it:

```python
pl.scan_csv("trades.csv", schema=trade_schema)
pl.scan_parquet("events.parquet", schema_overrides={"id": pl.Int64})
```

For Parquet, the schema is already in the file footer; use `schema_overrides=` only to upcast/relax.

## Compression hints

| Format | Default | Best for archival |
|---|---|---|
| Parquet | `snappy` | `zstd` (smaller, decompress ~as fast) |
| IPC | `uncompressed` | `zstd` |
| CSV | none | gzip externally; or just stop using CSV |
