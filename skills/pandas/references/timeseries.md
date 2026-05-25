# Time Series

## DatetimeIndex

```python
import pandas as pd

idx = pd.date_range('2026-01-01', periods=10, freq='1D', tz='UTC')
# DatetimeIndex(['2026-01-01', ..., '2026-01-10'], dtype='datetime64[us, UTC]', freq='D')

df = pd.DataFrame({'value': range(10)}, index=idx)
```

Frequency strings (3.0 normalizes case): `'D'` day, `'h'` hour, `'min'` minute, `'s'` second, `'ms'`/`'us'`/`'ns'`, `'B'` business day, `'W'` week, `'ME'` month-end, `'QE'` quarter-end, `'YE'` year-end.

**3.0 change**: lowercase `'d'`/`'b'`/`'w'` aliases are deprecated — use uppercase.

## Parsing datetimes

```python
# Single string
pd.to_datetime('2026-05-16 12:30')
# Timestamp('2026-05-16 12:30:00')

# Whole column (specify format for speed and to avoid silent parsing failures)
df['ts'] = pd.to_datetime(df['ts'], format='%Y-%m-%d %H:%M:%S')
df['ts'] = pd.to_datetime(df['ts'], format='ISO8601')   # auto-detect ISO

# Errors handling
pd.to_datetime(s, errors='raise')    # default — fail on bad value
pd.to_datetime(s, errors='coerce')   # bad → NaT
pd.to_datetime(s, errors='ignore')   # bad → return original
```

**3.0 resolution inference**:
```python
pd.to_datetime('2024-01-01 10:30').dtype           # datetime64[us]
pd.to_datetime(0, unit='s').dtype                   # datetime64[s]
pd.to_datetime('2024-01-01 10:30:00.000000001').dtype  # datetime64[ns]
```

Concatenating mixed resolutions promotes to the finest — keep your time columns consistent.

## Timezones (3.0 uses stdlib `zoneinfo`)

```python
# tz-aware from naive
df['ts'] = df['ts'].dt.tz_localize('America/New_York')
# DatetimeIndex(..., tz='America/New_York')

# Convert to another tz (always do tz_convert, not subtract offsets)
df['ts_utc'] = df['ts'].dt.tz_convert('UTC')

# Strip tz (back to naive — usually a bad idea)
df['ts_naive'] = df['ts'].dt.tz_localize(None)
```

**3.0 behavior**: `Timestamp('2024-01-01').tz_localize('US/Pacific').tz` returns a `zoneinfo.ZoneInfo` object, not `pytz`. If your code does `isinstance(tz, pytz.tzinfo.BaseTzInfo)`, it breaks. Use stdlib types.

### DST gotchas

Ambiguous (fall-back) and non-existent (spring-forward) local times need explicit handling:

```python
df['ts'].dt.tz_localize('America/New_York', ambiguous='infer', nonexistent='shift_forward')
# Options:
#   ambiguous: 'raise' (default), 'infer', 'NaT', or array of bools
#   nonexistent: 'raise' (default), 'NaT', 'shift_forward', 'shift_backward', or Timedelta
```

### `pd.offsets.Day` (3.0 change)

`Day` is now **calendar-day** (preserves time-of-day across DST), not 24h fixed:

```python
ts = pd.Timestamp('2025-03-08 08:00', tz='US/Eastern')
ts + pd.offsets.Day(1)
# 3.0: Timestamp('2025-03-09 08:00:00-0400')   ← same wall-clock time
# 2.x: Timestamp('2025-03-09 09:00:00-0400')   ← 24h after, 1h shift

# For fixed 24-hour duration, use Timedelta:
ts + pd.Timedelta(days=1)   # always 24 hours
```

## resample — time-based groupby

```python
df = df.set_index('ts')

df.resample('1D').agg(daily_total=('value', 'sum'))
df.resample('1h').mean()
df.resample('1W').agg(weekly=('value', 'sum'))

# Origin alignment — start buckets at midnight UTC
df.resample('1D', origin='start_day').sum()

# Closed/label sides
df.resample('1h', closed='left', label='left').sum()
```

`resample('1D')` is equivalent to `groupby(pd.Grouper(freq='1D'))` — both work.

## asfreq — change frequency without aggregation

```python
df.asfreq('1h', method='ffill')   # upsample, forward-fill
df.asfreq('1D')                    # downsample, NaN where missing
```

## Rolling and expanding windows

```python
# Trailing 7-day mean
df['ma7'] = df['value'].rolling(window='7D').mean()

# Fixed-row window (last 30 observations regardless of time gaps)
df['ma30'] = df['value'].rolling(window=30, min_periods=1).mean()

# Multiple aggregations
df['value'].rolling('7D').agg(['mean', 'std', 'min', 'max'])

# Expanding (cumulative)
df['cum_mean'] = df['value'].expanding(min_periods=1).mean()

# Custom function
df['value'].rolling(7).apply(lambda x: x.max() - x.min(), raw=True)  # raw=True for ndarray (faster)
```

## Shifting and differences

```python
df['lag_1'] = df['value'].shift(1)                    # previous row
df['lead_1'] = df['value'].shift(-1)                  # next row
df['lag_1d'] = df['value'].shift(freq='1D')           # time-aware shift (uses index)
df['diff'] = df['value'].diff()                       # current - previous
df['pct_change'] = df['value'].pct_change()           # relative change
```

## Period vs Timestamp

- `Timestamp` — point in time (datetime64)
- `Period` — span of time (e.g., "January 2026" — quarter, year, month)

```python
pd.Period('2026-01', freq='M')           # the month of January 2026
pd.period_range('2026-01', periods=12, freq='M')

# Convert Timestamp ↔ Period
ts.to_period('M')      # Timestamp → Period
p.to_timestamp(how='start')  # Period → Timestamp at start of period
```

Use `Period` when granularity matters semantically (monthly reports, fiscal quarters). Use `Timestamp` for all instant-in-time data.

## Holiday and business-day calendars

```python
from pandas.tseries.offsets import BDay, CustomBusinessDay
from pandas.tseries.holiday import USFederalHolidayCalendar

bday_us = CustomBusinessDay(calendar=USFederalHolidayCalendar())
pd.date_range('2026-01-01', '2026-01-31', freq=bday_us)
# Skips weekends and US federal holidays
```

## .dt accessor — extract components

```python
df['ts'].dt.year
df['ts'].dt.month
df['ts'].dt.day
df['ts'].dt.dayofweek          # Monday=0, Sunday=6
df['ts'].dt.day_name()         # 'Monday', ...
df['ts'].dt.quarter
df['ts'].dt.is_month_end
df['ts'].dt.to_period('M')
df['ts'].dt.floor('1h')        # round down to hour
df['ts'].dt.ceil('1D')         # round up to day
df['ts'].dt.round('15min')
```

## Common pitfalls

- **Naive ↔ aware** comparison raises — always set tz before merging or filtering
- **Mixed resolutions** silently promote — keep ETL stages at one resolution
- **`set_index('ts').sort_index()`** before resample/rolling for time-aware windows
- **`pd.Grouper(freq='1D', dropna=False)`** to keep empty days in resample output
