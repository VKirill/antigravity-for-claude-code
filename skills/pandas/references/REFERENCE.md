# pandas — Reference Index

Slim decision map. Open the file matching the task. SKILL.md owns the routing; this file is the second-level index.

## Decision map

| If you're doing… | Open |
|---|---|
| Picking dtypes, designing the Index, modeling a DataFrame | [data-structures.md](data-structures.md) |
| `.loc`, `.iloc`, boolean masks, `query`, MultiIndex slicing | [indexing-and-selection.md](indexing-and-selection.md) |
| `groupby` + aggregations, named aggs, transform vs apply | [groupby.md](groupby.md) |
| `merge` / `join` / `concat` / `merge_asof` / `merge_ordered` | [merge-join-concat.md](merge-join-concat.md) |
| Datetimes, resample, rolling, tz, DST | [timeseries.md](timeseries.md) |
| Reading/writing Parquet/CSV/Excel/JSON/SQL | [io.md](io.md) |
| Refactoring 2.x code for CoW | [copy-on-write.md](copy-on-write.md) |
| Arrow-backed strings, `ArrowDtype`, performance | [arrow-backend.md](arrow-backend.md) |
| `NaN` vs `pd.NA`, fillna, dropna, nullable dtypes | [missing-data.md](missing-data.md) |
| Categorical dtype for memory / groupby speed | [categorical.md](categorical.md) |
| Debugging SettingWithCopy, dtype drift, slow apply | [troubleshooting.md](troubleshooting.md) |
| Picking sensible defaults | [recommended-defaults.md](recommended-defaults.md) |
| Wrong vs right code patterns | [wrong-vs-right.md](wrong-vs-right.md) |
| Routing eval cases | [eval-cases.md](eval-cases.md) |

## pandas 3.0 highlights (cheat sheet)

- **String dtype default**: `pd.Series(['a','b']).dtype` → `str` (PyArrow-backed), not `object`
- **Copy-on-Write default**: every indexer returns a copy; chained assignment silently no-ops
- **Datetime resolution inference**: `pd.to_datetime('2024-01-01').dtype` → `datetime64[us]` (not `[ns]`)
- **Timezone via stdlib `zoneinfo`** (not `pytz`); `pytz` no longer a required dep
- **`pd.col()` expressions** in `.assign()` instead of lambdas
- **Anti-joins**: `merge(how='left_anti')` / `'right_anti'`
- **`pd.offsets.Day`** is now calendar-day across DST (was 24h fixed)
- **Minimum Python**: 3.11+; **NumPy**: 1.26+; **PyArrow**: required
