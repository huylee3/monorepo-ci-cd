# Daybook

A TypeScript todo app for practicing CI/CD. The API uses Express, Prisma, and PostgreSQL; the web app uses TanStack Start.

## Run locally

Requires Node.js 22.12+, pnpm 12.4.2, and Docker Compose.

```sh
pnpm install --frozen-lockfile
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# Set JWT_SECRET in apps/api/.env to a random value of at least 32 characters.
pnpm db:generate
pnpm services
```

If `.env` sets `POSTGRES_PASSWORD`, use the same password in the database URLs in `apps/api/.env`. Without it, Compose uses the local development password shown in `apps/api/.env.example`.

The `db` and `wiremock` services in `docker-compose.yml` keep running in the background. Then run:

```sh
pnpm db:migrate
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The API listens on port 3001. Local PostgreSQL and WireMock use ports 55432 and 8080. Run `pnpm services:stop` when done; the PostgreSQL data remains in a Docker volume.

## Test and build

```sh
pnpm test                 # Unit tests
pnpm db:migrate:test      # Apply migrations to the shared local database
pnpm test:api             # API integration tests; requires pnpm services
pnpm test:mock            # WireMock tests; requires pnpm services
pnpm exec playwright install chromium
pnpm test:e2e             # Browser tests
pnpm typecheck
pnpm build
```

Integration and browser tests use the same local `todo` database as development. They may change or delete development data. Set `TEST_DATABASE_URL` if you need a separate test database.

## CI

GitHub Actions runs on pull requests and pushes to `main`. It checks formatting and types, runs unit, API integration, WireMock, and browser tests against isolated local services, then builds the API, migration, and production web images. Successful runs on `main` publish the images to Docker Hub as `todo-api`, `todo-migrate`, and `todo-web`, each tagged `latest` and `sha-<commit SHA>`. Pull requests build the images without publishing them. See [the CI workflow](.github/workflows/ci.yml).

Before the first publish, create those three repositories under your Docker Hub account. In the GitHub repository, set the Actions variable `DOCKERHUB_USERNAME` to your Docker Hub username and the Actions secret `DOCKERHUB_TOKEN` to a Docker Hub personal access token with write access. A push to `main`, or a manual run of the workflow on `main`, then publishes the images.

## Docker

Build from the repository root because the apps share a pnpm workspace and lockfile:

```sh
docker build -f apps/api/Dockerfile --target api -t todo-api:local .
docker build -f apps/api/Dockerfile --target migration -t todo-migrate:local .
docker build -f apps/web/Dockerfile --target web -t todo-web:local .
```

The API image runs compiled code on port 3001. The migration image applies committed Prisma migrations. Supply `DATABASE_URL`, `JWT_SECRET`, and `APP_ORIGIN` to the API, and `DATABASE_URL` and `DIRECT_URL` to migrations. Keep credentials out of the images.

Source lives in `apps/api` and `apps/web`; tests live in `tests`. Only `.env.example` files should be committed.
