# Daybook

A TypeScript todo app for practicing CI/CD. Express 5 + Prisma + PostgreSQL backend, TanStack Start React frontend, Vitest, WireMock, and Playwright. Separate app Dockerfiles and a local Compose stack are included; CI/CD pipeline configuration is left for you to implement.

## Quick start (without Docker)

Prerequisites: Node.js 22.12+, pnpm 10.32.1, Java 17+. Install pnpm with `npm install --global pnpm@10.32.1` if needed. Run as a regular user; PostgreSQL cannot run as root.

```sh
pnpm install --frozen-lockfile
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# Set JWT_SECRET in apps/api/.env to a random value before starting the API.
pnpm db:generate
pnpm services
```

Keep services running. On first start, this downloads WireMock 3.13.2 from Maven Central and verifies its SHA-256 checksum. PostgreSQL binaries come from the pinned `embedded-postgres` dependency. Data and downloads live in ignored `.local/`; Ctrl+C stops both services and preserves database data. Local ports: PostgreSQL 55432, WireMock 8080. Local credentials are for development only. Run one services terminal per workspace. Startup checks both ports before starting PostgreSQL and reports readiness only after WireMock responds. If a port is occupied, stop the previous services terminal with Ctrl+C; inspect port 8080 with `ss -ltnp 'sport = :8080'` to identify an existing listener.

In a second terminal:

```sh
pnpm db:migrate
pnpm db:migrate:test
pnpm dev
```

To run the apps separately (with the same automatic local environment settings):

```sh
pnpm dev:api  # backend only, http://127.0.0.1:3001
pnpm dev:web  # frontend only, http://localhost:3000
```

`pnpm dev` still starts both apps. Start the database with `pnpm services` and apply migrations before using todo endpoints.

Open http://localhost:3000. Register a username (3–32 letters, digits or underscores) and a password/passphrase (15–128 characters). Usernames are case-insensitive. The API runs on 127.0.0.1:3001. Stop development servers before running Playwright.

Development commands load `apps/api/.env` and `apps/web/.env` separately. Fill in `JWT_SECRET` in the API file with a strong random secret (at least 32 characters). Generate one with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`. There is no automatic secret-file fallback; `.local/jwt-secret` is no longer used.

Shell/CI environment variables override `.env` values. Missing `.env` files are allowed when the environment supplies the required configuration. App-level `dev` and `start` commands also load their own `.env` files. Only `.env.example` files are committed. Do not put backend secrets in the web file or expose them with a `VITE_` prefix.

Database migration commands read the API `.env`. Tests use its optional `TEST_DATABASE_URL` (or an injected override), always overriding both runtime and migration URLs to target the test database. They use a dedicated test JWT secret; they do not require your development JWT secret.

## Architecture

- `apps/api`: controllers parse HTTP input; services enforce business rules; repositories own Prisma operations. Express serves authentication and todos.
- `apps/web`: TanStack Start renders the page and proxies `/api/*` to Express on the server. The browser uses same-origin cookies and never receives database credentials or JWT secrets.
- `apps/api/prisma`: schema and committed SQL migrations for users, sessions, and privately owned todos.
- `tests`: service unit tests, real PostgreSQL API integration tests, WireMock HTTP client tests, and browser E2E tests.

### API

All writes require `Content-Type: application/json` and `Origin` matching `APP_ORIGIN` (development also accepts the `localhost`/`127.0.0.1` alias with the same scheme and port), including logout and delete (send `{}`). Responses use `{user}`, `{todo}`, `{todos}` or `{error}` envelopes. Delete/logout return 204. Errors use 400 validation, 401 authentication, 403 origin, 404 missing/foreign resource, 409 username conflict, and 429 rate limit.

| Method | Path                 | Input                               |
| ------ | -------------------- | ----------------------------------- |
| POST   | `/api/auth/register` | username, password                  |
| POST   | `/api/auth/login`    | username, password                  |
| POST   | `/api/auth/refresh`  | `{}`; refresh cookie                |
| POST   | `/api/auth/logout`   | `{}`; authenticated session         |
| GET    | `/api/auth/me`       | —                                   |
| GET    | `/api/todos`         | —                                   |
| POST   | `/api/todos`         | title, optional description         |
| PATCH  | `/api/todos/:id`     | title, description and/or completed |
| DELETE | `/api/todos/:id`     | `{}`                                |
| GET    | `/health/live`       | process health                      |
| GET    | `/health/ready`      | database readiness                  |

### Authentication

Passwords use Argon2id (19 MiB memory, two iterations, one lane). Access tokens are signed JWTs with a 15-minute lifetime, explicit algorithm, issuer, and audience checks. Seven-day refresh sessions use cryptographically random tokens stored only as SHA-256 hashes in PostgreSQL. Refresh rotates the token atomically; reuse revokes the session. Access checks also verify session status, so logout/revocation takes effect immediately. Parallel refresh in different tabs can cause a safe logout; users can log in again.

Tokens are HttpOnly, SameSite=Strict cookies, with Secure enabled in production. No tokens are stored in browser localStorage. Same-origin request checks and JSON-only writes provide CSRF protection. Login errors do not distinguish missing users from wrong passwords, and both paths perform a password hash check. Auth endpoints are rate-limited. Todo mutations always filter by authenticated owner. Responses are not cached.

The included rate limiter is per-process and the frontend proxy means requests share its source IP. For a public multi-instance deployment, implement a shared rate-limit store and a trusted proxy/client-IP policy in your infrastructure. Set HTTPS, a unique strong `JWT_SECRET` per environment, and the exact public `APP_ORIGIN`. The API binds to loopback by default; configure `HOST` when packaging it for another network environment. Email recovery and verification are outside this version's scope.

## Testing

The unit suite has 73 tests: 30 for authentication/session security, 18 for frontend HTTP handling and renewal, 5 for todo ownership and failure handling, 4 for environment loading and test database isolation, and 16 for origin validation. Unit tests mock database, password-hashing, and HTTP boundaries; JWT signature validation uses real cryptography. PostgreSQL and WireMock are not required for `pnpm test`.

Start `pnpm services` and run `pnpm db:migrate:test` first for database/browser tests. WireMock tests reset the local mock server, so use a dedicated instance.

```sh
pnpm test                 # Vitest unit tests; no running services
pnpm test:api             # Express + real PostgreSQL, ownership and auth checks
pnpm test:mock            # frontend HTTP client against WireMock
pnpm exec playwright install chromium
pnpm test:e2e             # starts app servers itself against todo_test
pnpm test:all
pnpm typecheck
pnpm format:check
pnpm build
```

Integration and E2E tests default to a separate `todo_test` database. Set `TEST_DATABASE_URL` to an isolated Neon test branch to test online instead. Do not point tests at staging or production data. Integration tests clean up their own users; browser tests create uniquely named accounts in the test database. Playwright retains failure traces and generates an HTML report.

## Neon: test, staging, production

The same schema works on local PostgreSQL and Neon. No Neon account or branch is created by this project.

- Use separate persistent production and staging branches with separate application secrets.
- Use a temporary branch per CI run for isolated tests; delete it after the run. Prefer schema-only branches or synthetic seed data.
- Apply committed migrations to each branch; database branches are not Git merges, and test data is not promoted into production.
- Use `DATABASE_URL` for Neon's pooled runtime URL and `DIRECT_URL` for the direct migration URL, including Neon's required SSL parameters. Locally, these can be identical.
- Set `TEST_DATABASE_URL` to the test branch's direct connection URL for integration/E2E tests and `pnpm db:migrate:test`.

```sh
# Export these through your shell or deployment secret manager.
DATABASE_URL='postgresql://...pooled-neon-host.../neondb?sslmode=require'
DIRECT_URL='postgresql://...direct-neon-host.../neondb?sslmode=require'
JWT_SECRET='<unique random secret, at least 32 characters>'
APP_ORIGIN='https://your-app.example'
NODE_ENV='production'
```

The above is illustrative: shell assignments must be exported to child processes, or supplied by your deployment environment. Never commit real credentials.

For a new migration during development, use Prisma `migrate dev --name <name>` in `apps/api`, with `DATABASE_URL` and `DIRECT_URL` pointing to your development database. Commit the resulting migration. Deployment uses `pnpm db:migrate` (Prisma migrate deploy), never `db push`.

## Build and runtime contract

`pnpm build` creates API output in `apps/api/dist` and frontend output in `apps/web/.output`. Run `pnpm --filter @todo/api start` with database/auth environment variables; run `pnpm --filter @todo/web start` with `API_URL` pointing to Express. Provide separate listening ports (API 3001, frontend 3000). Generate Prisma Client before building. Frontend uses the pinned Nitro Node server preset.

Suggested future pipeline stages: frozen dependency install → Prisma generation → format/type checks → unit tests → isolated database migrations → integration/WireMock/E2E tests → production build → your deployment steps. This repository supplies build/test commands and Docker targets; it does not configure a CI/CD pipeline.

### Local registration returns 403

Use `http://localhost:3000` or `http://127.0.0.1:3000` consistently. In development, both loopback names are accepted on the configured origin’s scheme and port; production requires the exact `APP_ORIGIN`. Cookies are host-specific, so switching names requires logging in again. HttpOnly works on local HTTP. A rejected registration does not issue cookies.

## Docker: separate app Dockerfiles

Each app has its own multi-stage Dockerfile: `apps/api/Dockerfile` builds the API and migration images, and `apps/web/Dockerfile` builds the frontend. Shared test tooling has a separate `tests/Dockerfile`. All runtime targets run as the unprivileged `node` user. Local `.env` files, host dependencies, and database files are excluded by `.dockerignore`.

| Target    | Local image          | Contents / default command                                           |
| --------- | -------------------- | -------------------------------------------------------------------- |
| `api`     | `todo-api:local`     | Compiled API and production dependencies; starts Express             |
| `web`     | `todo-web:local`     | Standalone TanStack Start/Nitro output; starts the web server        |
| `migrate` | `todo-migrate:local` | API package, Prisma CLI and migrations; runs `prisma migrate deploy` |
| `test`    | `todo-test:local`    | Source and development dependencies; runs Vitest unit tests          |

The default target in the API Dockerfile is `api`; the frontend defaults to `web`. Compose explicitly selects each Dockerfile and target. All build contexts remain the repository root so both apps can access the shared workspace manifests and lockfile. `COPY` paths are relative to that context, not to the Dockerfile’s directory. Node 24 is used consistently in build and runtime stages; pnpm is pinned to the workspace's 10.32.1 version. Frontend source is not shipped in the API image; API code and Prisma are not shipped in the frontend image.

Create a root `.env` from `.env.example` if one does not exist, then supply random `POSTGRES_PASSWORD` and `JWT_SECRET` values. This root file supplies Compose substitutions; app-specific `.env` files are for running outside Docker. Credentials are injected at runtime, never during the build.

```sh
docker compose build api web migrate
docker compose up -d --no-build
docker compose ps
docker compose logs -f api web
```

Open http://localhost:3000. Stop any local frontend already using port 3000 first. PostgreSQL uses an independent named volume. Startup waits for PostgreSQL readiness, successful migrations, then API database readiness. The API uses development cookie/origin settings for this local HTTP stack; real deployments should use production mode, HTTPS, and their exact public origin.

Run unit tests in a disposable container without starting the app:

```sh
docker compose build test
docker compose --profile testing run --rm --no-deps test
```

The test target also contains API integration and WireMock tests. Running those suites requires an isolated database and WireMock, with `TEST_DATABASE_URL` and `WIREMOCK_URL` pointing to hostnames reachable from the container. Playwright browsers/system dependencies are not included in this target; containerized E2E execution needs a browser-enabled test target or an external runner. The existing host Playwright command remains available.

Rebuild the affected targets after changing source. `docker compose down` preserves the named database volume. Do not use `down -v` unless you intend to delete that database. Changing `POSTGRES_PASSWORD` does not change the password inside an already initialized volume.

For CI, build each release target once, publish it, and record its image digest. Deploy those same digests to staging and production with environment-specific runtime configuration. Use the migration target from the same commit.

Build individual images from the repository root without Compose:

```sh
docker build -f apps/api/Dockerfile --target api -t todo-api:local .
docker build -f apps/api/Dockerfile --target migrate -t todo-migrate:local .
docker build -f apps/web/Dockerfile --target web -t todo-web:local .
docker build -f tests/Dockerfile --target test -t todo-test:local .
```

Keep the Node base image and pnpm version aligned across these Dockerfiles when upgrading tooling. There is no root Dockerfile; use Compose or pass `-f` explicitly.
