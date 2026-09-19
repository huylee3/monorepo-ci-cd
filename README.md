# Daybook

A TypeScript todo app with an Express API, Prisma/PostgreSQL persistence, and a TanStack Start web app.

## Development

Requires Node.js 22.12+, pnpm 12.4.2, and a running PostgreSQL database.

```sh
pnpm install --frozen-lockfile
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Set `DATABASE_URL` and `DIRECT_URL` to your development database, and set `JWT_SECRET` to a random value of at least 32 characters. Provision the database before applying migrations.

```sh
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The API listens on port 3001. The web server proxies `/api` to `API_URL`; browser requests use same-origin cookies. Shell variables override each app's `.env` file. Keep credentials out of source control.

## Structure

- `apps/api/src/app.ts`: HTTP app factory, security middleware, routes, and health endpoints.
- `apps/api/src/bootstrap.ts`: production wiring for controllers, configuration, and PostgreSQL.
- `apps/api/src/controllers`: request validation and response handling.
- `apps/api/src/services`: business rules and authentication.
- `apps/api/src/repositories`: database operations, including ownership checks and atomic refresh-token rotation.
- `apps/web/src`: routes, UI, and the HTTP client.
- `tests/unit`, `tests/integration`, `tests/mock`, `tests/e2e`: separate test layers.
- `scripts`: environment loading and migration commands.

Services should keep business logic separate from HTTP concerns. The todo service takes its repository explicitly. HTTP tests use the app factory with stub handlers; production dependencies are assembled only by the bootstrap module.

## Verification

```sh
pnpm check               # Formatting, application/test types, unit and HTTP-boundary tests
pnpm build               # Compile API and build production web output
```

For tests that use external services, see [the testing guide](tests/README.md). `pnpm test` needs no running database or WireMock instance.

```sh
pnpm db:migrate:test     # Requires an explicit TEST_DATABASE_URL
pnpm test:api            # Real API + dedicated PostgreSQL database
pnpm test:mock           # WireMock HTTP scenarios
pnpm test:e2e            # Chromium + both applications + dedicated PostgreSQL
pnpm test:all            # All four test layers; services must already be running
```

## Deployment boundaries

Run committed migrations before starting a new API version. Production requires `NODE_ENV=production`, a strong `JWT_SECRET`, `DATABASE_URL`, and an exact `APP_ORIGIN`. Set `HOST` for the deployment network and terminate HTTPS at the ingress. `/health/live` checks process liveness; `/health/ready` returns 503 when PostgreSQL is unavailable. API responses disable caching, authentication cookies are HTTP-only, and production cookies require HTTPS.

Container files have been removed from this checkout. Existing GitHub workflows still reference them and need a separate CI/container update before those workflows can pass. This refactor does not restore or redesign that setup. Multi-instance deployments also need a shared rate-limit store; the current limiter keeps state in each API process.
