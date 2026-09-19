# Testing

## Test layers

| Command          | Scope                                                                   | External dependencies                       |
| ---------------- | ----------------------------------------------------------------------- | ------------------------------------------- |
| `pnpm test`      | Services, environment safety, origin rules, HTTP middleware, web client | None; HTTP tests bind ephemeral local ports |
| `pnpm test:api`  | Real controllers, authentication, Prisma and PostgreSQL                 | Dedicated PostgreSQL database               |
| `pnpm test:mock` | Web client over real HTTP, including token renewal                      | Dedicated WireMock instance                 |
| `pnpm test:e2e`  | Registration and the complete todo browser workflow                     | PostgreSQL and Chromium                     |

`pnpm typecheck` includes test files and test-runner configuration. `pnpm check` is the service-free verification gate. Generate the Prisma client after installing dependencies or changing the schema.

## Database isolation

Create a dedicated database, then set `TEST_DATABASE_URL` in `apps/api/.env` or the shell:

```sh
export TEST_DATABASE_URL='postgresql://todo:password@127.0.0.1:55432/todo_test'
pnpm db:migrate:test
pnpm test:api
```

There is no fallback to the development database. The environment loader also rejects a test URL that identifies the configured development database, ignoring credentials and query parameters. This catches common mistakes, including `localhost`/`127.0.0.1` aliases; it cannot resolve arbitrary DNS aliases, so use separate database credentials and a clearly named test database.

Integration tests create unique users and remove only those users after each test; cascading foreign keys remove their todos and sessions. Browser fixtures use the same ownership-scoped cleanup, including on failure. Do not point tests at shared or production databases. Run database-backed suites serially to avoid sharing the process-local authentication rate limit.

## WireMock

Run a dedicated WireMock 3 instance, then set its address if it is not on the default port:

```sh
WIREMOCK_URL=http://127.0.0.1:8080 pnpm test:mock
```

The suite resets WireMock mappings and request history before every test. Do not share that instance with other test runs or applications.

## Browser tests

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

Playwright starts both development servers, refuses to reuse existing servers, and runs one Chromium worker. Ports 3000 and 3001 must be free. CI forbids focused tests and retries once. Traces are retained on failure; the HTML report is written to `playwright-report/`.

The browser suite checks the user journey. Keep detailed validation, ownership, and session edge cases in the lower test layers so failures remain easy to diagnose.

## Adding coverage

Use one behavior per unit or API test, with local arrange/act/assert steps. Avoid coupling tests through shared users or previous test outcomes. Prefer observable responses and persisted state over call-count assertions, except where calls themselves establish a guarantee (such as not retrying a failed mutation). Use factories or fixtures for lifecycle and cleanup; avoid helpers that hide the behavior under test.
