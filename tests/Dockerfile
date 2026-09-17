# syntax=docker/dockerfile:1

# Keep build/runtime OS and Node versions aligned for native dependencies.
FROM node:24-bookworm-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM runtime AS dependencies
# Match package.json's packageManager, rather than using a different major.
RUN npm install --global pnpm@10.32.1
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN --mount=type=cache,id=todo-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir=/pnpm/store

# Unit/API/WireMock test tools stay out of the release images.
# API and mock suites require external PostgreSQL/WireMock services.
FROM dependencies AS test
COPY . .
RUN pnpm db:generate && chown -R node:node /app
USER node
ENV NODE_ENV=test
CMD ["pnpm", "test"]

