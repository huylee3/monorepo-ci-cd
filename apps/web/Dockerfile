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

FROM dependencies AS web-build
COPY tsconfig.base.json ./
COPY apps/web ./apps/web
RUN pnpm --filter @todo/web build

FROM runtime AS web
COPY --from=web-build --chown=node:node /app/apps/web/.output ./.output
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]

