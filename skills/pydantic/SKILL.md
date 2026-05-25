---
name: pydantic
description: "Pydantic v2 runtime data validation for Python — BaseModel, Field, validators, JSON Schema, settings. Use when: pydantic, BaseModel, model_validate, model_dump, model_validate_json, field_validator, model_validator, computed_field, Annotated, ConfigDict, ValidationError, AliasChoices, discriminated union, Discriminator, Tag, TypeAdapter, pydantic-settings, BaseSettings, strict mode, model_json_schema, FastAPI body, LLM structured output, v1→v2 migration. SKIP: Zod (TS — →zod), Marshmallow/attrs (legacy), pure dataclasses, pydantic v1 maintenance."
stacks:
  - Pydantic
  - Python
packages:
  - pydantic
  - pydantic-settings
manifests:
  - pyproject.toml
tags:
  - pydantic
  - validation
  - schema
  - python
source: new(pydantic-skill-v1)
risk: medium-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- Pydantic: `2.13.x`
- Python: `3.14.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded automatically when its description matches the active task. Read only the section you need, then follow the link to the relevant reference file for full detail.

## Use this skill when

- Defining a `BaseModel` for an HTTP request/response body, config, or domain object
- Calling `.model_validate()`, `.model_validate_json()`, `.model_dump()`, `.model_dump_json()` and handling `ValidationError`
- Writing `@field_validator` or `@model_validator` with explicit `mode='before' | 'after' | 'wrap'`
- Using `Annotated[T, Field(...), AfterValidator(...)]` to compose constraints, validators, and serializers
- Modeling tagged unions with `Field(discriminator='kind')` or callable `Discriminator` + `Tag`
- Validating non-`BaseModel` types (`list[Item]`, `TypedDict`, dataclasses) with `TypeAdapter`
- Generating JSON Schema for OpenAPI / Claude tool definitions via `model_json_schema()` or `TypeAdapter.json_schema()`
- Loading settings/config from env, `.env`, or secrets via `pydantic-settings` `BaseSettings`
- Defining recursive / self-referential models (tree nodes, comments)
- Producing structured LLM output (FastAPI response models, LangChain tool args, OpenAI structured outputs)
- Migrating Pydantic v1 code (`.parse_obj`, `.dict()`, `class Config`, `@validator`) to v2
- Choosing strict vs lax validation (`strict=True`, `Strict[...]` annotation, `Field(strict=True)`)

## Do not use this skill when

- Task is Zod (TypeScript runtime validation) — `→zod`
- Task is pure Python `dataclasses` with no validation needed — stay in stdlib
- Task is Marshmallow, attrs, or other legacy validators — suggest migrating to Pydantic, don't maintain
- Task is Pydantic v1 maintenance with no v2 migration in sight — note the EOL stance; v1 references in `migration-from-v1.md`
- Task is FastAPI request routing wiring without schema design — `→fastapi`
- Task is general Python typing (mapped types, Protocols) with no runtime validation — `→python`

## Purpose

Pydantic is the dominant Python runtime validation library — the bridge between Python type hints and untrusted data (HTTP bodies, env vars, LLM responses, JSON files). It powers FastAPI request/response validation, LangChain tool argument parsing, settings management, and structured LLM outputs. The Rust core (`pydantic-core`) makes v2 5–50× faster than v1.

Pydantic v2 is a fundamental redesign from v1: methods are prefixed `model_*` (`.model_validate()` not `.parse_obj()`, `.model_dump()` not `.dict()`); the inner `class Config` becomes a `model_config = ConfigDict(...)` mapping; `@validator` becomes `@field_validator` with an explicit `mode=`; constrained types like `constr` / `conint` are replaced by `Annotated[T, Field(...)]`; and `BaseSettings` moves to the separate `pydantic-settings` package. This skill owns the validation layer — the framework skill (`fastapi`) owns request lifecycle wiring around it.

## Capabilities

### BaseModel core

Subclass `BaseModel`, annotate fields with type hints, and Pydantic handles validation and serialization. Construct via `Model(**data)`, `Model.model_validate(data)` (dict / object), or `Model.model_validate_json(bytes_or_str)`. Serialize via `.model_dump()` (dict), `.model_dump_json()` (str), or `.model_copy(update={...})`. Inspect with `Model.model_fields`, `instance.model_fields_set`. Use `Model.model_construct(...)` only for trusted data — it skips validation. `RootModel[list[Item]]` for non-object root types.

> Full reference: [references/basemodel.md](references/basemodel.md)

### Field configuration

`Field(...)` declares per-field metadata: `default`, `default_factory` (mutable defaults and validated-data factories), `alias` / `validation_alias` / `serialization_alias`, `AliasChoices` (multiple input names), `AliasPath` (deep paths), constraints (`gt`, `ge`, `lt`, `le`, `min_length`, `max_length`, `pattern`, `multiple_of`), JSON-schema metadata (`title`, `description`, `examples`, `json_schema_extra`), behavior (`frozen`, `exclude`, `init`, `init_var`, `repr`, `deprecated`, `strict`). Prefer `Annotated[T, Field(...)]` over the bare default form to keep the type hint clean.

> Full reference: [references/fields.md](references/fields.md)

### Types and the Annotated pattern

`Annotated[T, ...]` is the v2 way to combine a Python type with Pydantic metadata. `Annotated[int, Field(gt=0)]` replaces v1's `conint(gt=0)`; `Annotated[str, Field(min_length=1, max_length=64)]` replaces `constr(...)`. Library-provided types: `EmailStr`, `HttpUrl`, `AnyUrl`, `IPvAnyAddress`, `SecretStr`, `Json`, `FilePath`, `DirectoryPath`, `UUID4`. Aware-datetime guard: `Annotated[datetime, AfterValidator(lambda d: d if d.tzinfo else raise_(...))]`. Custom types implement `__get_pydantic_core_schema__`.

> Full reference: [references/types.md](references/types.md)

### Validators

Field-level: `@field_validator('name', mode='before' | 'after' | 'wrap' | 'plain')` — `after` is default and runs on coerced values; `before` runs on raw input; `wrap` wraps the inner validator with a handler. Model-level: `@model_validator(mode='before' | 'after' | 'wrap')` — `after` is an instance method returning `self`. The `Annotated` form (`AfterValidator(fn)`, `BeforeValidator(fn)`, `WrapValidator(fn)`) makes validators reusable across models. `@computed_field` exposes a `@property` as a serialized output. Access other validated fields via `info.data`, runtime context via `info.context`.

> Full reference: [references/validators.md](references/validators.md)

### Serializers

`@field_serializer('name', mode='plain' | 'wrap', when_used='always' | 'json' | 'json-unless-none')` customizes a field's serialized form. `@model_serializer(mode='plain' | 'wrap')` overrides the whole-model output. `PlainSerializer(fn, return_type=...)` and `WrapSerializer(fn)` work via `Annotated`. Dump-time flags: `exclude_unset`, `exclude_defaults`, `exclude_none`, `by_alias`, `include` / `exclude` (deep selection), `mode='json'` (Decimal → str, datetime → ISO).

> Full reference: [references/serializers.md](references/serializers.md)

### Discriminated unions

For tagged unions, `Field(discriminator='kind')` with `Literal['kind']` discriminator fields gives O(1) dispatch and clear errors (`pet.dog.barks`) instead of trying each variant. For variants whose discriminator field has different names, use `Discriminator(callable)` paired with `Annotated[Variant, Tag('name')]` on each member.

> Full reference: [references/discriminated-unions.md](references/discriminated-unions.md)

### Generic models

`class Response[T](BaseModel)` (PEP 695) or `Generic[T]` (3.9+). Parametrize at use site: `Response[User]`. Generic models cache by type-argument tuple. `TypeVar` defaults and bounds are supported.

> Full reference: [references/generics.md](references/generics.md)

### Strict vs lax & TypeAdapter

Default validation is lax: `'123' → 123` (int), `'2020-01-01' → date`. Strict mode rejects coercion: `model_config = ConfigDict(strict=True)`, `Field(strict=True)`, `Annotated[T, Strict()]`, or `Model.model_validate(data, strict=True)`. JSON parsing always coerces strings to dates / UUIDs / decimals — that's the documented exception. `TypeAdapter(T)` validates non-BaseModel types (`list[User]`, `TypedDict`, dataclass, union) and exposes `.validate_python()`, `.validate_json()`, `.dump_python()`, `.dump_json()`, `.json_schema()`. Always instantiate `TypeAdapter` once at module scope — building it on every call is the #1 perf trap.

> Full reference: [references/strict-vs-lax.md](references/strict-vs-lax.md)

### JSON Schema generation

`Model.model_json_schema()` returns a draft 2020-12 schema dict; `TypeAdapter(T).json_schema()` does the same for non-models. `mode='validation'` (default) reflects accepted inputs; `mode='serialization'` reflects output shape. Customize via `Field(json_schema_extra=...)` per field or by subclassing `GenerateJsonSchema`. Used to feed OpenAPI specs (FastAPI auto-wires this) and LLM tool-definition payloads.

> Full reference: [references/json-schema.md](references/json-schema.md)

### Settings management (pydantic-settings)

`pydantic-settings` is a separate package (`pip install pydantic-settings`). `BaseSettings` populates fields from env, `.env`, secrets dir, AWS Secrets Manager, Azure Key Vault, GCP Secret Manager, or CLI args. Configure via `model_config = SettingsConfigDict(env_prefix='APP_', env_nested_delimiter='__', env_file='.env', secrets_dir='/run/secrets')`. Priority: CLI > env > dotenv > secrets > defaults. Validate once at app startup, not per-request.

> Full reference: [references/settings.md](references/settings.md)

### Migration from v1

The most-read reference. Renames: `.parse_obj` → `.model_validate`; `.parse_raw` → `.model_validate_json`; `.dict()` → `.model_dump()`; `.json()` → `.model_dump_json()`; `.schema()` → `.model_json_schema()`; `.copy()` → `.model_copy()`; `.construct()` → `.model_construct()`; `.update_forward_refs()` → `.model_rebuild()`. `class Config` → `model_config = ConfigDict(...)`. `@validator` → `@field_validator` (mode required); `@root_validator` → `@model_validator`. `BaseSettings` moved to `pydantic-settings`. `constr` / `conint` / `confloat` → `Annotated[T, Field(...)]`. `GenericModel` removed — use `Generic[T]` with `BaseModel` directly. Use the `bump-pydantic` codemod for bulk conversion.

> Full reference: [references/migration-from-v1.md](references/migration-from-v1.md)

## Behavioral Traits

- Uses `Model.model_validate(data)` at trust boundaries; reserves bare `Model(**data)` for internal trusted call sites
- Catches `ValidationError` and reads `err.errors()` (list of dicts with `loc`, `msg`, `type`, `input`) — never relies on `str(err)` parsing
- Prefers `Annotated[T, Field(...)]` over `name: T = Field(...)` — keeps the type hint readable and reusable
- Reaches for `TypeAdapter(list[Model])` instead of wrapping into a `RootModel` when the goal is one-off validation of a collection
- Instantiates `TypeAdapter` once at module scope — never inside a hot path
- Sets `model_config = ConfigDict(extra='forbid')` on API-boundary models to catch unknown fields early
- Uses `Field(discriminator='kind')` with `Literal` discriminators instead of bare `Union[A, B, C]` whenever a tag field exists
- Validates env vars with `pydantic-settings` `BaseSettings` at process startup — never reads `os.environ` ad-hoc inside handlers
- Uses `Field(default_factory=...)` for mutable defaults (`list`, `dict`, `datetime.utcnow`) — never `default=[]`
- Adds `model_config = ConfigDict(frozen=True)` for immutable value objects
- Writes `@field_validator('field', mode='after')` even when `'after'` is the default — explicit mode aids review
- Returns `self` from `@model_validator(mode='after')` (it's an instance method) — never a dict
- Picks `@model_validator(mode='before')` for cross-field transforms that need raw input; `mode='after'` for invariants

## Important Constraints

- NEVER use the v1 `@validator` decorator in new code — it's deprecated; use `@field_validator(..., mode=...)`
- NEVER call `.dict()`, `.json()`, `.parse_obj()`, `.parse_raw()`, `.schema()`, `.copy()`, `.construct()` — they're v1 names; use the `model_*` equivalents
- NEVER use `class Config` inside a v2 `BaseModel` — use `model_config = ConfigDict(...)`
- NEVER use `constr(...)`, `conint(...)`, `confloat(...)` — use `Annotated[int, Field(gt=0, le=100)]`
- NEVER import `BaseSettings` from `pydantic` — it's in `pydantic-settings` (separate package)
- NEVER instantiate `TypeAdapter(...)` inside a request handler or loop — build it once at module scope
- NEVER access `values: dict` in a validator — that v1 signature is gone; use `info.data` (`ValidationInfo`)
- NEVER mutate a `frozen=True` model — it raises; use `.model_copy(update=...)`
- NEVER skip `mode=` on `@field_validator` / `@model_validator` — explicit mode prevents subtle ordering bugs
- ALWAYS handle `ValidationError` at trust boundaries and surface `err.errors()` (structured) — not `str(err)`
- ALWAYS use `model_validate_json(raw)` for JSON input — it's faster than `json.loads(raw)` + `model_validate`
- ALWAYS prefer `Field(discriminator=...)` over plain `Union` for tagged variants
- ALWAYS use `Annotated[T, Strict()]` or `Field(strict=True)` when coercion would mask a bug

## Related Skills

**90%-filter applied** — mainstream 2026 choices only.

### Language
- `python` — Python 3.14 (Pydantic is Python-first; PEP 695 generic syntax for `class Foo[T](BaseModel)`)

### Web framework (primary consumer)
- `fastapi` — FastAPI 0.136 (request/response body validation, JSON Schema → OpenAPI auto-wiring)

### Peer-language analog
- `zod` — Zod 4 (TypeScript equivalent; same mental model — runtime schemas with inferred static types)

### Testing
- `pytest` — pytest 9 (assert on `ValidationError.errors()` shape, parametrize over invalid inputs)

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Index + decision map | [references/REFERENCE.md](references/REFERENCE.md) |
| BaseModel API: model_validate / model_dump / model_copy / model_fields / model_config / ConfigDict / aliases / RootModel / model_construct | [references/basemodel.md](references/basemodel.md) |
| Field(...) — default vs default_factory, constraints, aliases, exclude/include, json_schema_extra, init/repr/deprecated | [references/fields.md](references/fields.md) |
| Types — Annotated pattern, EmailStr, HttpUrl, SecretStr, Json, datetime/tz, UUID, Decimal, NewType, custom __get_pydantic_core_schema__ | [references/types.md](references/types.md) |
| Validators — @field_validator / @model_validator / Annotated AfterValidator/BeforeValidator/WrapValidator / computed_field / ValidationInfo | [references/validators.md](references/validators.md) |
| Serializers — @field_serializer / @model_serializer / PlainSerializer / WrapSerializer / when_used / dump flags | [references/serializers.md](references/serializers.md) |
| Discriminated unions — Literal discriminator field, callable Discriminator + Tag, performance, FastAPI integration | [references/discriminated-unions.md](references/discriminated-unions.md) |
| Generic models — Generic[T], PEP 695 syntax, TypeVar bounds and defaults, nested parametrization | [references/generics.md](references/generics.md) |
| Strict vs lax — strict mode, Strict annotation, Field(strict=True), TypeAdapter usage and performance | [references/strict-vs-lax.md](references/strict-vs-lax.md) |
| JSON Schema — model_json_schema, validation vs serialization mode, GenerateJsonSchema, OpenAPI integration | [references/json-schema.md](references/json-schema.md) |
| Settings — pydantic-settings, BaseSettings, SettingsConfigDict, env / dotenv / secrets / cloud secrets / CLI | [references/settings.md](references/settings.md) |
| **Migration from v1 (most-read)** — renames, Config → model_config, @validator → @field_validator, constr → Annotated, bump-pydantic codemod | [references/migration-from-v1.md](references/migration-from-v1.md) |
| **Troubleshooting** — reading ValidationError.errors() loc, perf pitfalls, TypeAdapter rebuild, recursion, tz drift, JSON-vs-dict input confusion | [references/troubleshooting.md](references/troubleshooting.md) |
| **Recommended defaults** — extra='forbid' at boundaries, Annotated over constr, frozen for value objects, validate_default for new code, TypeAdapter once | [references/recommended-defaults.md](references/recommended-defaults.md) |
| **Wrong vs right** — v1 @validator vs v2 @field_validator, .dict() vs .model_dump(), values dict vs info.data, frozen mutation, TypeAdapter in hot path | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases — routing tests | [references/eval-cases.md](references/eval-cases.md) |

**How to use**: navigate to the specific file for the topic you need. Don't read all files — look up only what's relevant to the current task.
