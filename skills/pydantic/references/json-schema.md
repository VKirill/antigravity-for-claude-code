# JSON Schema

Generate JSON Schema (Draft 2020-12) from Pydantic models or any `TypeAdapter`. Used by FastAPI for OpenAPI, by Claude / OpenAI for tool definitions, and by external validators.

## Basic generation

```python
from pydantic import BaseModel, Field

class User(BaseModel):
    id: int
    name: str = Field(min_length=1, max_length=64, description='Display name')

User.model_json_schema()
# {
#   'properties': {
#     'id': {'title': 'Id', 'type': 'integer'},
#     'name': {'description': 'Display name', 'maxLength': 64, 'minLength': 1,
#              'title': 'Name', 'type': 'string'}
#   },
#   'required': ['id', 'name'],
#   'title': 'User',
#   'type': 'object',
# }
```

For non-models, use `TypeAdapter`:

```python
from pydantic import TypeAdapter
TypeAdapter(list[int]).json_schema()
# {'items': {'type': 'integer'}, 'type': 'array'}
```

## mode: validation vs serialization

```python
from decimal import Decimal

class M(BaseModel):
    a: Decimal = Decimal('12.34')

M.model_json_schema(mode='validation')   # accepts number OR string
M.model_json_schema(mode='serialization')  # always string (Pydantic dumps Decimal as str)
```

`mode='validation'` (default) describes ACCEPTED inputs. `mode='serialization'` describes EMITTED output. Different for fields where Pydantic serializes differently than it accepts — `Decimal`, `datetime`, custom serializers.

When emitting OpenAPI for a request body, use `validation`. For a response body, use `serialization`. FastAPI auto-picks the right mode per direction.

## Field metadata → JSON Schema

```python
class Account(BaseModel):
    email: Annotated[str, Field(
        title='Email',
        description='Contact email',
        examples=['ada@example.com'],
        json_schema_extra={'format': 'email', 'x-internal': True},
    )]
```

Output:

```json
{
  "properties": {
    "email": {
      "description": "Contact email",
      "examples": ["ada@example.com"],
      "format": "email",
      "title": "Email",
      "type": "string",
      "x-internal": true
    }
  },
  ...
}
```

`json_schema_extra` can be a dict (merged) or a callable `(schema: dict) -> None` (mutates the field's sub-schema in place).

## Discriminated unions → JSON Schema

```python
class Cat(BaseModel):
    kind: Literal['cat']
    meows: int

class Dog(BaseModel):
    kind: Literal['dog']
    barks: float

class Pet(BaseModel):
    animal: Cat | Dog = Field(discriminator='kind')

Pet.model_json_schema()
# {
#   '$defs': {'Cat': {...}, 'Dog': {...}},
#   'properties': {
#     'animal': {
#       'discriminator': {'mapping': {'cat': '#/$defs/Cat', 'dog': '#/$defs/Dog'},
#                          'propertyName': 'kind'},
#       'oneOf': [{'$ref': '#/$defs/Cat'}, {'$ref': '#/$defs/Dog'}]
#     }
#   },
#   ...
# }
```

The `discriminator.propertyName` + `mapping` are part of OpenAPI 3.1 — clients route correctly without trial-and-error.

## Customize via GenerateJsonSchema

```python
from pydantic.json_schema import GenerateJsonSchema

class CustomSchema(GenerateJsonSchema):
    def generate(self, schema, mode='validation'):
        out = super().generate(schema, mode=mode)
        out['$schema'] = self.schema_dialect
        out.setdefault('x-generated-by', 'my-app')
        return out

User.model_json_schema(schema_generator=CustomSchema)
```

Hook points for: custom `$schema` dialect, custom `$defs` URI templates, output draft selection, default value handling, `nullable` vs `type: ['T', 'null']`.

### ref_template

```python
User.model_json_schema(ref_template='#/components/schemas/{model}')
# Refs become OpenAPI-style instead of #/$defs/...
```

For OpenAPI integration, the standard template is `#/components/schemas/{model}`. FastAPI uses this internally.

## TypeAdapter.json_schema

```python
from pydantic import TypeAdapter

UserAdapter = TypeAdapter(list[User])
UserAdapter.json_schema()
# Works the same — $defs at top level, items: {$ref: ...}
```

Cache the adapter at module scope. The schema build is one-time.

## Use case: Claude / OpenAI tool definitions

```python
class GetWeatherArgs(BaseModel):
    location: str = Field(description='City name, e.g. "Paris"')
    units: Literal['celsius', 'fahrenheit'] = 'celsius'

tool_def = {
    'name': 'get_weather',
    'description': 'Look up current weather',
    'input_schema': GetWeatherArgs.model_json_schema(),
}
```

The LLM sees field descriptions, enum constraints, required vs optional. Drop `'title'` if your tool format objects to it — `GenerateJsonSchema` subclass or post-processing.

## by_alias

```python
class User(BaseModel):
    user_id: int = Field(alias='userId')

User.model_json_schema()                # uses 'user_id'
User.model_json_schema(by_alias=True)   # uses 'userId'
```

For OpenAPI specs serving external clients that expect camelCase, set `by_alias=True`.
