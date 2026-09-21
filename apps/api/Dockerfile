# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS base
WORKDIR /app

RUN chown node:node /app
RUN npm install -g pnpm@12.4.2
COPY --chown=node:node package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY --chown=node:node ./apps/api/package.json /app/apps/api/package.json
COPY --chown=node:node ./apps/api /app/apps/api
COPY --chown=node:node ./tsconfig.base.json /app/tsconfig.base.json
RUN apt-get update \
				&& apt-get install -y --no-install-recommends ca-certificates openssl \
				&& rm -rf /var/lib/apt/lists/*


FROM base AS dependencies
WORKDIR /app

COPY --chown=node:node ./scripts /app/scripts/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @todo/api db:generate

# dev runtime
FROM dependencies AS dev
USER node

CMD ["pnpm", "--filter", "@todo/api", "run", "dev"]

# Production build
FROM base AS prod-build
WORKDIR /app

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @todo/api db:generate
RUN pnpm --filter @todo/api build
RUN pnpm --filter @todo/api --prod deploy /app/output

# Production runtime
FROM node:24-bookworm-slim AS prod
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY --from=prod-build /app/output .

USER node

EXPOSE 3001

CMD ["node", "dist/server.js"]




