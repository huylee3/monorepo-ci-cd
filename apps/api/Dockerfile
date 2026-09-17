# syntax=docker/dockerfile:1

# Keep build/runtime OS and Node versions aligned for native dependencies.
# runtime
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
RUN npm install --global pnpm@12.4.2
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

# dependencies
FROM runtime AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json

RUN --mount=type=cache,id=todo-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir=/pnpm/store

# api build

FROM dependencies AS api-build

WORKDIR /app

COPY tsconfig.base.json ./
COPY apps/api ./apps/api

RUN pnpm db:generate
RUN pnpm --filter @todo/api build

RUN pnpm --filter @todo/api deploy --prod /out/api \
				&& pnpm --filter @todo/api deploy /out/migrate
RUN ls -la /out/api/node_modules/@prisma
RUN cd /out/api \
    && node /app/apps/api/node_modules/prisma/build/index.js generate --schema=prisma/schema.prisma
RUN cd /out/migrate \
    && node node_modules/prisma/build/index.js generate --schema=prisma/schema.prisma

# run migration

FROM runtime AS migration
COPY --from=api-build --chown=node:node /out/migrate ./
USER node
ENV NODE_ENV=production
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]

# api release image

FROM runtime AS api
COPY --from=api-build --chown=node:node /out/api ./
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
EXPOSE 3001
CMD ["node", "dist/server.js"]



