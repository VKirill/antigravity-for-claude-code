# Routing Eval Cases

Sample prompts to verify the pytest skill routes correctly. Positive cases should load `pytest`; negative cases should NOT load it.

## Positive — should load `pytest`

| Prompt | Expected hit |
|---|---|
| "Set up pytest in this project with coverage and async support" | ✅ |
| "Write a parametrize for these 5 test cases" | ✅ |
| "Why does my fixture say 'not found' in conftest.py?" | ✅ |
| "Mock `requests.get` in a pytest test using mocker" | ✅ |
| "How do I share a fixture across module-scoped tests?" | ✅ |
| "Run pytest with xdist parallel and randomized order" | ✅ |
| "Set up pytest-asyncio strict mode" | ✅ |
| "What's new in pytest 9 vs pytest 8?" | ✅ |
| "Use Hypothesis @given with a pytest fixture" | ✅ |
| "pytest-cov branch coverage in pyproject.toml" | ✅ |
| "How do I patch where it's imported, not defined?" | ✅ |
| "Why is my async pytest test hanging?" | ✅ |
| "Migrate this unittest.TestCase to pytest" | ✅ |
| "Configure markers and --strict-markers" | ✅ |
| "Snapshot test with syrupy" | ✅ |
| "MagicMock vs AsyncMock for async code" | ✅ |
| "Convert this Jest-style test to pytest" | ✅ (pytest is the target) |

## Negative — should NOT load `pytest`

| Prompt | Expected route |
|---|---|
| "Write a Vitest test for this React component" | `vitest` |
| "Playwright E2E for the checkout flow" | `playwright` |
| "Mock fetch in a Vitest unit test" | `vitest` |
| "Set up Jest in a JS monorepo" | `vitest` or jest (NOT pytest) |
| "Run Django's built-in TestCase" | `django` |
| "How do I write a unittest.TestCase subclass?" | stdlib unittest (not pytest exclusively) |

## Edge cases

| Prompt | Route |
|---|---|
| "Test my FastAPI endpoint" | `pytest` + `fastapi` (both load) |
| "Test Pydantic schemas" | `pytest` + `pydantic` |
| "Integration test with PostgreSQL" | `pytest` + `postgresql` |
| "Run tests on Python 3.14" | `pytest` + `python` |
| "Set up CI pipeline for Python tests" | `pytest` (test layer) + CI skill (orchestration) |

## How to verify

1. Pick a prompt from the positive list.
2. Start a fresh Claude Code session.
3. Issue the prompt.
4. Check whether `pytest` skill loads (debug logs / SKILL.md content shows up in responses).
5. If a positive case doesn't route — strengthen the description with the missing trigger term.
6. If a negative case routes — add a `SKIP:` clause for that pattern.
