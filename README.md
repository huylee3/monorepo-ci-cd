# Daybook

A TypeScript todo app for practicing CI/CD. The API uses Express, Prisma, and PostgreSQL; the web app uses TanStack Start.

## Run locally

Requires Node.js 22.12+, pnpm 12.4.2, and Java 17+.

```sh
pnpm install --frozen-lockfile
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# Set JWT_SECRET in apps/api/.env to a random value of at least 32 characters.
pnpm db:generate
pnpm services
```

Leave `pnpm services` running. In another terminal:

```sh
pnpm db:migrate
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The API listens on port 3001. Local PostgreSQL and WireMock use ports 55432 and 8080. Generated data is stored in `.local/`.

## Test and build

```sh
pnpm test                 # Unit tests
pnpm db:migrate:test      # Prepare the separate test database
pnpm test:api             # API integration tests; requires pnpm services
pnpm test:mock            # WireMock tests; requires pnpm services
pnpm exec playwright install chromium
pnpm test:e2e             # Browser tests
pnpm typecheck
pnpm build
```

Use only an isolated test database for integration and browser tests. `TEST_DATABASE_URL` can point to one; otherwise tests use the local `todo_test` database.

## Docker

Build from the repository root because the apps share a pnpm workspace and lockfile:

```sh
docker build -f apps/api/Dockerfile --target api -t todo-api:local .
docker build -f apps/api/Dockerfile --target migrate -t todo-migrate:local .
docker build -f apps/web/Dockerfile --target web -t todo-web:local .
```

The API image runs compiled code on port 3001. The migration image applies committed Prisma migrations. Supply `DATABASE_URL`, `JWT_SECRET`, and `APP_ORIGIN` to the API, and `DATABASE_URL` and `DIRECT_URL` to migrations. Keep credentials out of the images.

Source lives in `apps/api` and `apps/web`; tests live in `tests`. Only `.env.example` files should be committed.
