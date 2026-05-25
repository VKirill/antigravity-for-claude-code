# PostgreSQL — Extensions

Postgres ships with `contrib` extensions (`pg_stat_statements`, `pg_trgm`, `pgcrypto`, `hstore`, `citext`, `ltree`, `uuid-ossp`). Third-party extensions (`pgvector`, `pg_partman`, `postgis`) install separately.

## Listing & enabling

```sql
-- What's available
SELECT * FROM pg_available_extensions;

-- What's installed
SELECT * FROM pg_extension;

-- Install
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA public;
```

Some extensions require `shared_preload_libraries` in `postgresql.conf` and a restart:

```conf
shared_preload_libraries = 'pg_stat_statements,pg_partman_bgw'
```

## Essential extensions

### `pg_stat_statements` — top-N slow queries

```sql
CREATE EXTENSION pg_stat_statements;
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 20;
```

Slow-query log of normalized statements (`$1`, `$2` placeholders). Cheap to leave on in production.

### `pg_trgm` — fuzzy text search

```sql
CREATE EXTENSION pg_trgm;
CREATE INDEX users_email_trgm ON users USING GIN (email gin_trgm_ops);
SELECT * FROM users WHERE email % 'sample';   -- similarity > threshold
SELECT * FROM users WHERE email ILIKE '%sample%';   -- now indexable
```

Trigram similarity. Indexable `ILIKE '%foo%'`. Best when full-text search is overkill.

### `pgcrypto` — encryption & hashing

```sql
CREATE EXTENSION pgcrypto;
INSERT INTO users (id, password_hash) VALUES (uuidv7(), crypt('secret', gen_salt('bf', 10)));
SELECT id FROM users WHERE password_hash = crypt('secret', password_hash);
```

`gen_salt('bf', 10)` = bcrypt cost 10. Prefer argon2 in application code; use pgcrypto only when hashing must happen DB-side.

`pgp_sym_encrypt(data, key)` / `pgp_sym_decrypt(...)` for column-level encryption at rest.

### `citext` — case-insensitive text

```sql
CREATE EXTENSION citext;
CREATE TABLE users (id uuid PRIMARY KEY, email citext UNIQUE);
INSERT INTO users VALUES (uuidv7(), 'Foo@Example.COM');
SELECT * FROM users WHERE email = 'foo@example.com';   -- matches
```

Alternative to `LOWER(email)` everywhere.

### `uuid-ossp` (legacy)

In PG18 prefer built-in `uuidv7()`. Pre-PG18: `CREATE EXTENSION "uuid-ossp"; SELECT uuid_generate_v4();`.

### `ltree` — hierarchical paths

```sql
CREATE EXTENSION ltree;
CREATE TABLE categories (id uuid PRIMARY KEY, path ltree);
CREATE INDEX cats_path_gist ON categories USING GIST (path);
SELECT * FROM categories WHERE path <@ 'electronics.phones';
```

Better than self-joining a parent_id forest when queries are tree-rooted.

### `hstore` — key/value (legacy; use jsonb)

Pre-`jsonb`. Don't pick for new tables.

## High-value third-party

### `pgvector` — vector similarity

```sql
CREATE EXTENSION vector;
CREATE TABLE embeddings (
  id     uuid PRIMARY KEY DEFAULT uuidv7(),
  text   text NOT NULL,
  emb    vector(1536) NOT NULL
);
CREATE INDEX emb_idx ON embeddings USING hnsw (emb vector_cosine_ops);

SELECT id, text, emb <=> $1::vector AS distance
FROM embeddings ORDER BY emb <=> $1::vector LIMIT 5;
```

Operators: `<->` (L2), `<=>` (cosine), `<#>` (inner product). HNSW or IVFFlat index. Built-in alternative to Pinecone / Weaviate for small-to-medium scale.

### `pg_partman` — partition management

```sql
CREATE EXTENSION pg_partman;
SELECT partman.create_parent(
  p_parent_table => 'public.events',
  p_control      => 'created_at',
  p_type         => 'range',
  p_interval     => '1 month'
);
```

Creates child partitions automatically. Drop old partitions with retention policy. Best for time-series / event logs.

### `postgis` — geospatial

```sql
CREATE EXTENSION postgis;
CREATE TABLE places (id uuid PRIMARY KEY, name text, geom geometry(Point, 4326));
CREATE INDEX places_geom ON places USING GIST (geom);
SELECT name, ST_Distance(geom, ST_MakePoint($1, $2)::geography) AS m
FROM places ORDER BY geom <-> ST_MakePoint($1, $2) LIMIT 10;
```

Points, lines, polygons, distance, contains, intersect. `geometry` (planar) vs `geography` (spherical) — use geography for lat/lon distance in meters.

### `pgaudit` — DB-level audit log

Logs every statement (or selected actions) with role + session metadata. Required for SOC2/HIPAA-style audits.

### `timescaledb` — time-series (separate project)

If you need real time-series at scale (continuous aggregates, automatic chunking), TimescaleDB is a Postgres extension that adds chunking + columnar compression. Caveat: licensed under TSL, not pure OSS for some features.

## Installing on Ubuntu

```bash
# pgvector
sudo apt install postgresql-18-pgvector

# postgis
sudo apt install postgresql-18-postgis

# pg_partman
sudo apt install postgresql-18-partman
```

Each PG major version has its own packages (`postgresql-18-*` for PG18).

## Removing safely

```sql
DROP EXTENSION pgvector CASCADE;   -- drops dependent objects too
```

`CASCADE` is dangerous — review what depends on the extension first via `\dx+ pgvector` in `psql`.

## Anti-patterns

- ❌ Enabling extensions only on the primary, forgetting standby (replication still works, but standby misses functions)
- ❌ Mixing `uuid-ossp.uuid_generate_v4()` and native `gen_random_uuid()` — pick one
- ❌ Using `hstore` for new code — `jsonb` is strictly better
- ❌ Loading `pg_stat_statements` without sizing `pg_stat_statements.max` (default 5000, may be too low for high-cardinality workloads)
