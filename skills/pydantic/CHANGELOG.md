# Changelog

All notable changes to the `pydantic` skill.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this skill adheres to SemVer at the skill level.

## [1.0.0] — Initial release

### Added
- SKILL.md navigator with description, trigger terms, use/skip guidance
- Pattern 2 reference layout under `references/`:
  - `REFERENCE.md` — index + decision map + quick-lookup
  - `basemodel.md` — `BaseModel` API, `ConfigDict`, aliases, `RootModel`, `model_construct`, private attrs
  - `fields.md` — `Field(...)` constraints, `default_factory`, `Annotated` form, JSON-schema metadata
  - `types.md` — `Annotated` pattern, `EmailStr`/`HttpUrl`/`SecretStr`/`Json`, datetime tz, custom types
  - `validators.md` — `@field_validator` / `@model_validator` / `Annotated` validators / `computed_field` / `ValidationInfo`
  - `serializers.md` — `@field_serializer` / `@model_serializer` / dump flags / `when_used`
  - `discriminated-unions.md` — `Field(discriminator=...)`, callable `Discriminator` + `Tag`
  - `generics.md` — `Generic[T]` and PEP 695 syntax for parametrized models
  - `strict-vs-lax.md` — strict mode + `TypeAdapter` with hot-path caveats
  - `json-schema.md` — `model_json_schema` / `GenerateJsonSchema` / OpenAPI integration
  - `settings.md` — `pydantic-settings`, env / dotenv / secrets / cloud / CLI
  - `migration-from-v1.md` — full v1→v2 rename table, `Config` → `model_config`, codemod guidance
  - `troubleshooting.md` — `ValidationError.errors()`, perf pitfalls, recursion, tz drift
  - `recommended-defaults.md` — `extra='forbid'`, `Annotated` form, `frozen` value objects, TypeAdapter hoisting
  - `wrong-vs-right.md` — contrasted code pairs for top v1→v2 mistakes
  - `eval-cases.md` — routing tests (positive + negative)
- Stack pin via central `STACK_VERSIONS.md` (Pydantic 2.13.x)
- Related-skills cross-links: `python`, `fastapi`, `zod`, `pytest`
