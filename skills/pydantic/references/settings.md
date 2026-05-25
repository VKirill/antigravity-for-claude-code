# Settings Management (pydantic-settings)

Configuration loading via the separate `pydantic-settings` package. `BaseSettings` populates fields from env vars, `.env` files, secrets dirs, cloud secret managers, or CLI args.

## Install

```bash
pip install pydantic-settings
```

`BaseSettings` is NOT in `pydantic` itself anymore — that's a v1→v2 break.

## Basic usage

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix='APP_', case_sensitive=False)

    database_url: str
    redis_url: str = 'redis://localhost:6379/0'
    debug: bool = False
    max_workers: int = 4

settings = AppSettings()
# Reads APP_DATABASE_URL, APP_REDIS_URL, APP_DEBUG, APP_MAX_WORKERS from os.environ
```

Construct ONCE at app startup (or in a `@lru_cache`d factory). Don't reload per-request.

## SettingsConfigDict — common options

```python
SettingsConfigDict(
    env_prefix='APP_',
    env_file='.env',
    env_file_encoding='utf-8',
    env_nested_delimiter='__',       # APP_DB__HOST → settings.db.host
    env_ignore_empty=True,           # empty env vars use defaults instead of failing
    secrets_dir='/run/secrets',
    case_sensitive=False,
    extra='ignore',                  # 'forbid' catches typos in .env
    populate_by_name=True,
)
```

## .env files

```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8')
    api_key: str
    timeout: int = 30
```

`.env`:
```
API_KEY=sk-...
TIMEOUT=60
```

Multiple files (later overrides earlier):

```python
env_file=('.env', '.env.local', '.env.prod')
```

Real env vars always win over `.env` (priority: CLI > env > dotenv > secrets > defaults).

## Nested models

```python
class DatabaseSettings(BaseModel):
    host: str
    port: int = 5432
    user: str

class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(env_nested_delimiter='__')
    db: DatabaseSettings

# APP_DB__HOST=...  →  settings.db.host
# APP_DB__PORT=...  →  settings.db.port
```

## Secrets directory

For Docker secrets, Kubernetes mounted secrets, systemd `LoadCredential`:

```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(secrets_dir='/run/secrets')
    database_password: str         # reads /run/secrets/database_password
    api_token: str                 # reads /run/secrets/api_token
```

Each file's contents are stripped and assigned. Use for credentials that shouldn't be in env.

## Cloud secret sources

```python
# AWS
from pydantic_settings.sources.providers.aws import AWSSecretsManagerSettingsSource

class Settings(BaseSettings):
    api_key: str
    db_password: str

    @classmethod
    def settings_customise_sources(cls, settings_cls, init_settings,
                                    env_settings, dotenv_settings, file_secret_settings):
        aws = AWSSecretsManagerSettingsSource(settings_cls, 'prod/myapp')
        return (init_settings, env_settings, aws, dotenv_settings, file_secret_settings)
```

Sources also exist for Azure Key Vault and GCP Secret Manager. Order in the tuple = priority.

## CLI integration

```python
class CliSettings(BaseSettings, cli_parse_args=True):
    model_config = SettingsConfigDict(
        cli_implicit_flags=True,    # bool fields become --flag / --no-flag
        cli_kebab_case=True,        # snake_case → --kebab-case
        cli_enforce_required=True,
    )
    api_key: str
    verbose: bool = False
    output: Path = Path('out.json')

# python myapp.py --api-key=sk-... --verbose
```

`CliPositionalArg[str]` and `CliSubCommand[SomeSettings]` annotate positional args and subcommands.

## Source priority

Default order (highest first):

1. Initialization kwargs (`Settings(...)`)
2. CLI args (if `cli_parse_args=True`)
3. Environment variables
4. `.env` file(s)
5. Secrets directory files
6. Field defaults

Override via `settings_customise_sources`:

```python
@classmethod
def settings_customise_sources(cls, settings_cls, init_settings,
                                env_settings, dotenv_settings, file_secret_settings):
    return (init_settings, dotenv_settings, env_settings, file_secret_settings)
    # Now dotenv beats env
```

## Validation behavior

`BaseSettings` validates defaults by default (the opposite of `BaseModel`). Disable:

```python
SettingsConfigDict(validate_default=False)
```

`ValidationError` at startup is a feature — fail fast on misconfiguration.

## JSON parsing in env vars

```python
class Settings(BaseSettings):
    allowed_origins: list[str]      # APP_ALLOWED_ORIGINS='["a", "b"]' → ['a', 'b']
    numbers: list[int]              # APP_NUMBERS='[1,2,3]'
```

Complex env values are JSON-parsed by default. Opt out per-field:

```python
from typing import Annotated
from pydantic_settings import NoDecode

class Settings(BaseSettings):
    items: Annotated[list[str], NoDecode]   # raw string, you handle parsing
```

Or force JSON when Pydantic wouldn't:

```python
from pydantic_settings import ForceDecode
items: Annotated[list[str], ForceDecode]
```

## Pattern: cached singleton

```python
from functools import lru_cache

@lru_cache
def get_settings() -> AppSettings:
    return AppSettings()

# In FastAPI:
from fastapi import Depends
@app.get('/info')
def info(settings: AppSettings = Depends(get_settings)):
    return {'db': settings.db.host}
```

`lru_cache` ensures a single instance; FastAPI's `Depends` injects it. Pydantic validates at first call — startup-time errors instead of first-request errors.
