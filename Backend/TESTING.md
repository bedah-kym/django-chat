# Testing guide

## How to run

```bash
cd Backend
python manage.py test --settings=Backend.settings_test          # full suite
python manage.py test signet --settings=Backend.settings_test   # one app
```

CI (`.github/workflows/main.yml`) runs exactly this on every push/PR to
`main`/`master` — Python 3.11, SQLite test DB, a Redis service container.

## Lanes

| Lane | Where | In CI? | Use for |
|---|---|---|---|
| unit / integration | `<app>/tests.py`, `<app>/test_*.py` | ✅ yes | pure logic, branch coverage, DB constraints, view/routing, projector math |
| manual smoke | `Backend/tests/smoke_*.py`, `Backend/tests/verify_*.py`, `<app>/integration_tests.py` | ❌ no | exercising **live** LLM / HF / weather / travel-provider APIs by hand |

Only files matching `test*.py` are discovered by `manage.py test`. Manual scripts
are deliberately named `smoke_*` / `verify_*` / `integration_tests.py` so they
**never block CI** — they make real network calls and are non-deterministic. Run
them directly when you want a live check:

```bash
python tests/smoke_llm_composer.py
```

## The bar (every test must clear it)

- A regression test earns its place only if it **fails when the bug comes back**.
  Reintroduce the bug locally and confirm a specific test goes red before trusting it.
- Assert **outcomes** — persisted state, returned value, emitted event — not that a
  mock was called. `assert_called_with` is a fallback for non-observable side effects.
- Money / durable-state / idempotency / uniqueness paths use the **real DB**
  (`TestCase`), not mocks.
- Every risky path gets ≥1 adverse case: negative, duplicate, stale, malformed,
  unauthorized, concurrent, or out-of-order.
- Deterministic: freeze time, seed randomness, clean up rows; no live network in a
  CI test — stub the provider with a fixture that honours its inputs.
- Run coroutines via a fresh loop (`asyncio.run(...)` or a `new_event_loop()`
  helper) — never `asyncio.get_event_loop()`, which raises on Python 3.12+.

## Settings

`Backend/settings_test.py` overrides only speed/isolation knobs (MD5 password
hasher, in-process cache + email). It changes nothing about behaviour under test.

## Known gap

CI runs on **SQLite**; production is **Postgres**. JSONB containment predicates
(e.g. SIGNET `classifications__tags__contains=[...]`) behave differently between
the two — watch parity on those paths, or add a Postgres CI service for the
SIGNET app if that risk grows.
