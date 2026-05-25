# Array IO

NumPy ships fast binary formats for arrays (`.npy`, `.npz`) plus text loaders and memory-mapped files. For real tabular data, delegate to **pandas** or **polars** parquet IO — NumPy text loaders exist but aren't competitive.

## Binary — `.npy` and `.npz`

`.npy` is the canonical single-array binary format: a small header (shape, dtype, byte order) then the raw buffer. It is the fastest way to persist a single array round-trip with full dtype fidelity.

```python
import numpy as np

# Single array
np.save('data.npy', arr)
loaded = np.load('data.npy')

# allow_pickle defaults to False — object dtype arrays will fail without explicit opt-in
np.save('obj.npy', obj_arr, allow_pickle=True)
loaded = np.load('obj.npy', allow_pickle=True)    # security risk, see below

# Multi-array archive
np.savez('archive.npz', x=x, y=y, labels=labels)
data = np.load('archive.npz')
data['x'], data['y'], data['labels']

# Compressed archive (slower to read/write, smaller on disk)
np.savez_compressed('archive.npz', x=x, y=y)
```

`.npz` is just a zip file containing `.npy` entries — you can inspect with `unzip -l`.

### Security

`np.load(..., allow_pickle=True)` deserializes arbitrary Python objects and is equivalent to `pickle.load` — **never load untrusted `.npy` / `.npz` files with pickle enabled**. Plain numeric dtypes are safe; the pickle path is only triggered for `object` dtype.

## Text — `loadtxt` and `genfromtxt`

```python
# Fast, strict — for clean numeric text
arr = np.loadtxt('data.csv', delimiter=',', skiprows=1, dtype=np.float64)
arr = np.loadtxt('data.csv', delimiter=',', usecols=(0, 2, 5))
arr = np.loadtxt('data.csv', delimiter=',', max_rows=10000)

# Forgiving — handles missing values, mixed dtypes, names
arr = np.genfromtxt(
    'data.csv',
    delimiter=',',
    names=True,               # use header row as field names → structured array
    dtype=None,                # infer per-column dtype
    encoding='utf-8',
    missing_values='NA',
    filling_values=np.nan,
)
```

**Performance reality**: `np.loadtxt` is fine for small / clean files. `np.genfromtxt` is significantly slower. For any non-trivial tabular IO (especially > 100 MB), use pandas / polars parquet or CSV readers — they're 10–100× faster and produce labelled output.

## Memory-mapped arrays — `np.memmap`

For arrays larger than RAM, `np.memmap` is a file-backed `ndarray`. The OS pages segments in on demand.

```python
# Create a fresh memmap
mm = np.memmap('big.dat', dtype=np.float32, mode='w+', shape=(10_000, 10_000))
mm[:] = 0.0
mm.flush()      # force write-through

# Open an existing memmap
mm = np.memmap('big.dat', dtype=np.float32, mode='r', shape=(10_000, 10_000))
mm[0, :100]     # only this slice is paged in

# Close — let the GC do it, or:
del mm
```

Modes: `'r'` (read-only), `'r+'` (read/write), `'w+'` (create/overwrite), `'c'` (copy-on-write — writes don't persist).

Memmap arrays are real `ndarray` subclasses — all NumPy ops work, but be aware that operations producing new arrays (`mm + 1`, `mm.copy()`) materialize in RAM. To process in chunks, slice + process.

## Structured arrays from binary

```python
dt = np.dtype([('id', 'i4'), ('x', 'f8'), ('y', 'f8')])
arr = np.fromfile('records.bin', dtype=dt)        # raw, no header — fragile on dtype change
```

`np.fromfile` is fast but offers **zero schema safety** — there is no recorded dtype, byte order, or shape. Prefer `.npy` for anything you control end-to-end.

## When to delegate to pandas / polars

| Use case | Tool |
|---|---|
| Single homogeneous numeric array, internal-only | `.npy` / `.npz` |
| Many arrays sharing a context | `.npz` |
| Files larger than RAM, partial random access | `np.memmap` |
| Real-world CSV / Parquet / Excel / Arrow with mixed types and labels | **pandas** `read_parquet` / **polars** `scan_parquet` |
| Cross-language exchange | **parquet** (read via pandas/polars), or **Arrow IPC** |

The rough rule: NumPy IO is for arrays as **arrays**; pandas/polars IO is for tables as **tables**.

## Loading from existing arrays

```python
np.frombuffer(byte_buf, dtype=np.int32, count=1000)    # wrap bytes as ndarray (no copy)
np.fromiter(iterable, dtype=np.float64, count=N)        # consume an iterator
np.fromstring(...)                                       # deprecated; use np.frombuffer
```

`np.frombuffer` is the bridge from `bytes` / `bytearray` / `mmap.mmap` objects into NumPy without a copy — useful when receiving raw binary from a socket or shared memory.

## Behavioral notes

- `.npy` headers store NumPy version and full dtype info — files written by 2.x load in 2.x; loading 2.x `.npy` in 1.x may work for simple dtypes but fails for newer ones (e.g. `StringDType`)
- `np.save` does NOT add an `.npy` extension automatically if your filename has another suffix; it does add it if the filename has no suffix
- `np.savez_compressed` uses Deflate — for large floats, parquet with snappy/zstd compresses better and is queryable
- `loadtxt(comments='#')` skips lines starting with `#`; this is the lightest-weight way to handle commented headers
