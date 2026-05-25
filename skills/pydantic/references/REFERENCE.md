# Pydantic — Reference Index

Slim index for Pydantic v2 references. Open the specific file you need.

## Decision map

| If you're doing... | Open |
|---|---|
| Defining a model, calling `model_validate` / `model_dump`, configuring `model_config` | [basemodel.md](basemodel.md) |
| Adding constraints (`gt`, `min_length`), aliases, mutable defaults, `examples` | [fields.md](fields.md) |
| Picking the right type — `Annotated[int, Field(gt=0)]`, `EmailStr`, `HttpUrl`, custom types | [types.md](types.md) |
| `@field_validator` / `@model_validator`, `AfterValidator`, `computed_field` | [validators.md](validators.md) |
| `@field_serializer` / `@model_serializer`, dump flags, `when_used` | [serializers.md](serializers.md) |
| Tagged unions — `Field(discriminator='kind')`, callable `Discriminator` + `Tag` | [discriminated-unions.md](discriminated-unions.md) |
| `class Response[T](BaseModel)` / `Generic[T]` parametrization | [generics.md](generics.md) |
| Strict vs lax, `TypeAdapter(list[Item])` for non-BaseModel types | [strict-vs-lax.md](strict-vs-lax.md) |
| `model_json_schema()`, OpenAPI / LLM tool definitions | [json-schema.md](json-schema.md) |
| Env, `.env`, secrets via `pydantic-settings` `BaseSettings` | [settings.md](settings.md) |
| **Migrating Pydantic v1 → v2** (most-read) | [migration-from-v1.md](migration-from-v1.md) |
| Reading `ValidationError.errors()`, perf pitfalls, recursion, tz drift | [troubleshooting.md](troubleshooting.md) |
| `extra='forbid'`, `Annotated` over `constr`, `frozen`, single `TypeAdapter` per scope | [recommended-defaults.md](recommended-defaults.md) |
| Contrasted code pairs — what NOT to write | [wrong-vs-right.md](wrong-vs-right.md) |
| Routing eval cases | [eval-cases.md](eval-cases.md) |

## Quick lookups

| Need | Snippet |
|---|---|
| Validate dict | `User.model_validate(data)` |
| Validate JSON bytes/str | `User.model_validate_json(raw)` |
| Dump to dict | `user.model_dump()` |
| Dump to JSON | `user.model_dump_json()` |
| Validate `list[Model]` | `TypeAdapter(list[User]).validate_python(data)` |
| Constrained int | `Annotated[int, Field(gt=0, le=100)]` |
| Tagged union | `Field(discriminator='kind')` with `Literal` discriminators |
| Per-field validator | `@field_validator('name', mode='after')` |
| Cross-field check | `@model_validator(mode='after')` (returns `self`) |
| Computed output | `@computed_field @property def total(self) -> float: ...` |
| Mutable default | `Field(default_factory=list)` |
| Multiple aliases | `Field(validation_alias=AliasChoices('a', 'b'))` |
| Forbid unknown keys | `model_config = ConfigDict(extra='forbid')` |
| Immutable model | `model_config = ConfigDict(frozen=True)` |
| JSON Schema | `User.model_json_schema()` |
| Settings | `from pydantic_settings import BaseSettings, SettingsConfigDict` |
