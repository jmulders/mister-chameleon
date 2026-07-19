# Integration tests — opt-in, out of the gate

These tests talk to real systems: a live database, live Stripe, a live AI model.
They are **not** part of `npm run verify` and never block a push or a deploy.
That is deliberate — the whole point of the gate (`docs/testing.md`) is that it is
fast, deterministic, and readable. A test that needs a network, a secret, or a
browser is none of those, and one flaky integration test in the gate teaches
everyone to ignore red.

So they live here, run on their own scripts, and **self-skip** when the thing they
need is absent. A run with no secrets set is all green skips, not failures.

## The layers

| Layer | File / dir | Needs | Script |
|---|---|---|---|
| Unit + logic (the gate) | `tests/**/*.test.ts` | nothing | `npm test` / `npm run verify` |
| DB integration | `tests/integration/db.itest.ts` | `TEST_SUPABASE_URL` + `TEST_SUPABASE_SERVICE_ROLE_KEY` | `npm run test:integration` |
| Stripe integration | `tests/integration/stripe.itest.ts` | `STRIPE_TEST_SECRET_KEY` | `npm run test:integration` |
| AI integration | `tests/integration/ai.itest.ts` | `ANTHROPIC_API_KEY` | `npm run test:integration` |
| Browser / E2E | `e2e/*.spec.ts` | Playwright + a running site | `npm run test:e2e` |

Note the extension: `*.itest.ts`, not `*.test.ts`. The gate globs `tests/**/*.test.ts`,
so these are invisible to it by name — they cannot sneak into the blocking run.

## Running them

```
# All integration tests (each skips itself without its secret):
npm run test:integration

# With the secrets, e.g. from .env.vercel or a scratch test project:
TEST_SUPABASE_URL=... TEST_SUPABASE_SERVICE_ROLE_KEY=... \
STRIPE_TEST_SECRET_KEY=... ANTHROPIC_API_KEY=... \
  npm run test:integration

# Browser E2E (installs browsers once, then runs):
npm i -D @playwright/test && npx playwright install
BASE_URL=https://www.misterchameleon.nl npm run test:e2e
```

## Honesty note

These files were written on 2026-07-19 but could not be executed in the
environment they were written in (no outbound network to Supabase/Stripe/Anthropic,
no browser). They are correct by construction and self-skipping, but the first real
run is yours — treat a first-run failure as "the fixture needs a tweak", not "the
harness is wrong". They are kept deliberately small for exactly that reason.
