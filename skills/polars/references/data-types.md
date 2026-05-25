# Data Types

Polars dtypes are **Arrow-native**. They are not pandas dtypes with a different name — semantics differ (especially around `Null`).

## Type catalogue

| Polars dtype | Arrow type | Python literal | Notes |
|---|---|---|---|
| `pl.Int8` / `Int16` / `Int32` / `Int64` | int8 / int16 / int32 / int64 | `1` | `Int64` is default for Python `int` |
| `pl.UInt8` / `UInt16` / `UInt32` / `UInt64` | uint variants | — | Used for counts, hashes |
| `pl.Float32` / `Float64` | float32 / float64 | `1.0` | `Float64` is default for Python `float` |
| `pl.Boolean` | bool | `True` | |
| `pl.String` | large_string | `"x"` | Was `Utf8` in 0.x; both names accepted, `String` preferred |
| `pl.Binary` | binary | `b"x"` | |
| `pl.Date` | date32 | `datetime.date` | Days since epoch |
| `pl.Datetime(time_unit, time_zone)` | timestamp | `datetime.datetime` | `time_unit` ∈ `{"ms","us","ns"}`; tz-aware supported |
| `pl.Duration(time_unit)` | duration | `datetime.timedelta` | |
| `pl.Time` | time64 | `datetime.time` | |
| `pl.Categorical(ordering)` | dictionary | — | Lexical or physical ordering |
| `pl.Enum(categories)` | dictionary | — | Fixed-vocabulary categorical, faster than `Categorical` |
| `pl.List(inner)` | list | `[...]` | Variable-length list per row |
| `pl.Array(inner, shape)` | fixed_size_list | `[...]` | Fixed-length list per row; ML-friendly |
| `pl.Struct(fields)` | struct | `{...}` | Nested record |
| `pl.Object` | — | any Python object | Last-resort, no parallelism |
| `pl.Null` | null | `None` | All-null column |

## Null semantics — pandas vs Polars

| Concept | pandas | Polars |
|---|---|---|
| Missing in int col | NaN forces float upcast (legacy) / pd.NA in Arrow-backed | `Null` — int stays int |
| Missing in string col | `None` or `NaN` mixed | `Null` always |
| Test for missing | `s.isna()` (catches NaN + NA + None) | `s.is_null()` |
| Test for NaN (float only) | `s.isna()` | `s.is_nan()` — float-only |
| Drop missing rows | `df.dropna()` | `df.drop_nulls()` |
| Fill missing | `df.fillna(0)` | `df.fill_null(0)` |
| Replace NaN with Null | n/a | `df.fill_nan(None)` |

**Key insight**: `Null` is a separate sentinel from float `NaN`. A `Float64` column may contain both. `is_null()` ignores NaN; `is_nan()` ignores Null.

## Schema and casting

```python
import polars as pl

# Inspect schema
df.schema           # OrderedDict[str, DataType]
df.dtypes           # list[DataType]

# Cast a single column
df = df.with_columns(pl.col("price").cast(pl.Float64))

# Strict vs non-strict
df.with_columns(pl.col("x").cast(pl.Int32, strict=False))   # silently nullify failures

# Multi-column cast
df = df.cast({"a": pl.Int32, "b": pl.Float32})
```

## Schema on IO — always specify when known

```python
# Lazy CSV scan with explicit dtypes — avoids inference round-trip
lf = pl.scan_csv(
    "trades.csv",
    schema={
        "ts":     pl.Datetime("us"),
        "symbol": pl.String,
        "price":  pl.Float64,
        "qty":    pl.Int64,
    },
)

# Override only some columns, infer the rest
lf = pl.scan_csv("trades.csv", schema_overrides={"price": pl.Float64})
```

For Parquet, the schema is in the file footer — no inference needed. `schema_overrides` still lets you override (e.g., upcast `Int32` → `Int64`).

## Categorical vs Enum

| | `Categorical` | `Enum` |
|---|---|---|
| Vocabulary | Built lazily as values arrive | Fixed at construction |
| Cross-frame compatibility | Must use `StringCache` context | Always compatible |
| Performance | Slightly slower at construct | Fastest |
| Best for | Open-ended categories | Known closed set (e.g., status enums) |

```python
status_dt = pl.Enum(["pending", "ok", "failed"])
df = df.with_columns(pl.col("status").cast(status_dt))
```

## Struct / List / Array

```python
# Struct — group columns into a nested record
df.with_columns(
    pl.struct(["first_name", "last_name"]).alias("name")
)

# List — variable-length per row
df.with_columns(pl.col("tags").str.split(","))   # List[String]

# Array — fixed-length, ML-friendly (Arrow FixedSizeList)
df.with_columns(pl.col("embedding").cast(pl.Array(pl.Float32, 768)))
```

Access fields via `pl.col("name").struct.field("first_name")`, list elements via `pl.col("tags").list.get(0)`.

## Common gotchas

- `pl.Utf8` and `pl.String` are aliases — prefer `pl.String` in new code.
- Mixing `Int32` and `Int64` in `pl.concat` raises a schema mismatch. Cast first or pass `how="diagonal_relaxed"`.
- `pl.Object` defeats parallelism; avoid unless wrapping a Python-only type at a boundary.
- `Datetime` without explicit tz is **naive**; mixing tz-aware and tz-naive in joins raises.
