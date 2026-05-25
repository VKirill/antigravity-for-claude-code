# PostgreSQL — Replication & Backup

## Replication modes

| Mode | Granularity | Use |
|---|---|---|
| **Streaming (binary)** | Whole cluster | HA failover, read replicas |
| **Logical** | Per table, per row | CDC, cross-version upgrade, selective replication |

## Streaming replication

Primary streams WAL records to standbys. Standbys can be:
- **Hot standby** — read-only queries
- **Sync** — primary waits for standby ack (zero data loss, higher latency)
- **Async** — primary doesn't wait (default; lower latency, potential data loss on crash)

### Primary `postgresql.conf`

```conf
wal_level = replica          # or 'logical' for logical replication
max_wal_senders = 10
wal_keep_size = 1GB
hot_standby = on
synchronous_commit = on
# synchronous_standby_names = 'replica1'    # uncomment for sync repl
```

### `pg_hba.conf`

```
host replication repluser 10.0.0.0/24 scram-sha-256
```

### Standby setup

```bash
pg_basebackup -h primary -D /var/lib/postgresql/18/main \
  -U repluser -W -P -X stream -S replica_slot_1

# /var/lib/postgresql/18/main/postgresql.auto.conf
primary_conninfo = 'host=primary user=repluser password=... application_name=replica1'
primary_slot_name = 'replica_slot_1'

touch /var/lib/postgresql/18/main/standby.signal
systemctl start postgresql@18-main
```

`standby.signal` (PG12+) tells Postgres to start in standby mode. Use `pg_ctl promote` to fail over.

### Monitoring replication

```sql
-- On primary
SELECT client_addr, state, sync_state, write_lag, flush_lag, replay_lag
FROM pg_stat_replication;

-- On standby
SELECT pg_is_in_recovery();          -- t
SELECT pg_last_wal_receive_lsn(), pg_last_wal_replay_lsn();
```

## Logical replication

Per-table CDC via publications + subscriptions. Set `wal_level = logical` first.

### Publisher

```sql
CREATE PUBLICATION my_pub FOR TABLE users, orders;
-- or FOR ALL TABLES
```

### Subscriber (separate cluster)

```sql
CREATE SUBSCRIPTION my_sub
CONNECTION 'host=primary user=repluser password=... dbname=mydb'
PUBLICATION my_pub;
```

Subscription performs initial sync, then keeps streaming WAL. Use for:
- Major-version upgrade (logical replicate from PG17 → PG18, then cut over)
- Cross-cluster CDC for analytics
- Selective sharding

### Replication slots

A slot holds WAL until the consumer is caught up. Without a slot, WAL is recycled and a lagging consumer breaks.

```sql
SELECT * FROM pg_replication_slots;
SELECT pg_drop_replication_slot('orphaned_slot');
```

Orphaned slots are the #1 cause of unbounded WAL growth → out-of-disk → primary down. Monitor `pg_replication_slots.confirmed_flush_lsn` lag vs `pg_current_wal_lsn()`.

## `pg_basebackup` — physical backup

```bash
pg_basebackup -h primary -D /backups/$(date +%F) -U repluser -W -P -X stream -Ft -z
```

`-F t` = tar format, `-z` = gzip, `-X stream` = include WAL needed for consistent restore.

Restore = unpack to `data` dir, set `primary_conninfo` (if recovering as standby) or `recovery_target_*` for PITR.

## PITR (point-in-time recovery)

1. Enable WAL archiving:

   ```conf
   archive_mode = on
   archive_command = 'rsync %p backup-host:/wal_archive/%f'
   ```

2. Take a baseline `pg_basebackup`.

3. To restore to a specific time:

   ```bash
   # restore baseline
   tar xf base.tar.gz -C /var/lib/postgresql/18/main

   # postgresql.auto.conf:
   restore_command = 'rsync backup-host:/wal_archive/%f %p'
   recovery_target_time = '2026-05-15 10:00:00 MSK'
   recovery_target_action = 'promote'

   # signal:
   touch /var/lib/postgresql/18/main/recovery.signal
   ```

4. Start Postgres; it replays WAL until the target, then promotes.

## `pg_dump` — logical backup

```bash
# Custom format — preferred (parallel restore, selective)
pg_dump -F c -j 4 -Z 6 -f mydb.dump mydb

# Restore
pg_restore -d mydb -j 4 mydb.dump

# Selective restore of one table
pg_restore -d mydb -t users mydb.dump
```

`-F c` (custom) supports parallel restore via `-j`. `-F p` (plain SQL) is human-readable but no parallelism.

`pg_dump` is logical — slower for huge DBs, but version-independent. PITR (physical) is faster but same-version only.

## Backup strategy by size

| DB size | Strategy |
|---|---|
| < 10 GB | Daily `pg_dump -F c` to S3; restore by `pg_restore` |
| 10 GB – 1 TB | Weekly `pg_basebackup` + continuous WAL archiving |
| > 1 TB | `pgBackRest` (compression, incremental, parallel) |

`pgBackRest` is the industry standard for big DBs — incremental backups, automatic retention, encryption.

## Verifying backups

```bash
# Standalone restore drill on a separate host
pg_restore -d test_restore mydb.dump
psql test_restore -c "SELECT count(*) FROM users;"
```

Schedule monthly restore drills. A backup you've never restored is a backup that doesn't exist.

## Anti-patterns

- ❌ Replication slot without a monitor → unbounded WAL → out-of-disk
- ❌ `pg_dump` on a hot OLTP primary without `--no-synchronized-snapshots` consideration
- ❌ Storing backups on the same host as the DB
- ❌ Plain-text WAL archive shipping without encryption
- ❌ Skipping `wal_keep_size` on small primaries — standbys lose WAL during temporary disconnects
- ❌ Failing to test promotion — promote a standby quarterly in a drill
