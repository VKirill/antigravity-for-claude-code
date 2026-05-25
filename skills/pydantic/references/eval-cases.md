# Eval Cases

Routing tests for the `pydantic` skill. Each case is a user prompt and the expected behavior — does the skill load, and which reference is the right entry point?

## Positive routing — skill SHOULD load

| Prompt | Expected entry |
|---|---|
| "Define a Pydantic model for the user signup body" | basemodel.md |
| "How do I add validators in Pydantic v2?" | validators.md |
| "Replace `@validator` with `@field_validator`" | migration-from-v1.md, validators.md |
| "My BaseModel rejects extra keys — how do I allow them?" | basemodel.md (extra='allow') |
| "Field with min_length and max_length using Annotated" | fields.md, types.md |
| "Pydantic ValidationError shape — how do I read it?" | troubleshooting.md |
| "model_dump vs dict — which is v2?" | migration-from-v1.md, wrong-vs-right.md |
| "Cross-field check in Pydantic — password and confirm_password" | validators.md (model_validator after) |
| "Pydantic discriminated union with Literal type field" | discriminated-unions.md |
| "Load settings from .env with pydantic-settings" | settings.md |
| "TypeAdapter for validating a list of TypedDicts" | strict-vs-lax.md |
| "Generate JSON Schema from Pydantic for OpenAPI" | json-schema.md |
| "Pydantic generic Response[T] model" | generics.md |
| "constr / conint replacement in v2" | types.md, migration-from-v1.md |
| "Custom serializer to format datetime as epoch in JSON" | serializers.md |
| "Pydantic model with EmailStr and HttpUrl" | types.md |
| "Strict mode — reject string-to-int coercion" | strict-vs-lax.md |
| "AliasChoices to accept email or e_mail or mail" | basemodel.md (aliases), fields.md |
| "Pydantic recursive tree model with forward ref" | troubleshooting.md (recursion section) |
| "Migrate parse_obj to model_validate" | migration-from-v1.md |
| "FastAPI body validation — Pydantic model shapes the request" | basemodel.md (with cross-link to fastapi skill) |
| "Validate LLM tool args with Pydantic before invoking" | strict-vs-lax.md (TypeAdapter), basemodel.md |
| "computed_field that derives total from items" | validators.md (computed_field section) |
| "Pydantic settings priority — env vs .env vs CLI" | settings.md |
| "model_validate_json for parsing a webhook payload" | basemodel.md |
| "Why is my Pydantic model 50× slower than expected?" | troubleshooting.md (TypeAdapter hoisting) |
| "frozen Pydantic model for value objects" | basemodel.md, recommended-defaults.md |
| "v2 way to set orm_mode" | migration-from-v1.md (from_attributes) |

## Negative routing — skill should NOT load (or should defer)

| Prompt | Why skip |
|---|---|
| "Zod schema for the same shape" | TypeScript — →zod |
| "Marshmallow Schema for a Flask form" | Legacy lib — suggest Pydantic migration, don't maintain |
| "Pydantic 1.10 patch" | Legacy — point at migration-from-v1.md but discourage staying on v1 |
| "Python dataclass with no validation needed" | Stdlib — →python |
| "FastAPI Depends and OAuth2PasswordBearer" | →fastapi (we own the schema, fastapi owns the wiring) |
| "SQLAlchemy column types" | →sqlalchemy (when that skill exists) |
| "TypedDict with NotRequired in pure typing terms" | →python |
| "JSON Schema validation in JS with AJV" | Different stack |
| "Convert Pydantic schema to TS types via OpenAPI generator" | Out of scope — generation tooling, not Pydantic itself |

## Behavioral checks

Beyond routing, verify the agent:

- Uses `model_validate` / `model_dump` in code samples (not v1 names)
- Adds explicit `mode=` on every `@field_validator` / `@model_validator`
- Uses `Annotated[T, Field(...)]` for constraints, not `constr` / `conint`
- Hoists `TypeAdapter` to module scope in any example with one
- Imports `BaseSettings` from `pydantic_settings` (not `pydantic`)
- Returns `self` from `@model_validator(mode='after')`
- Uses `Field(default_factory=list)` for mutable defaults
- Adds `mode='json'` to `model_dump()` when output needs to be JSON-compatible (Decimal, datetime)
- Adds `discriminator='kind'` to tagged unions
- Suggests `extra='forbid'` on API-boundary models

If any of those slip, the corresponding reference (`wrong-vs-right.md`, `recommended-defaults.md`, `migration-from-v1.md`) should be consulted.
