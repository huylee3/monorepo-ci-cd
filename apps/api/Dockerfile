# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
RUN npm install -g pnpm@12.4.2
RUN apt-get update \
				&& apt-get install -y --no-install-recommends ca-certificates openssl \
				&& rm -rf /var/lib/apt/lists/*

FROM runtime AS dependencies
RUN chown node:node /app
USER node
COPY --chown=node:node package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY --chown=node:node ./apps/api/package.json /app/apps/api/package.json
COPY --chown=node:node ./apps/api /app/apps/api
COPY --chown=node:node ./scripts /app/scripts/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @todo/api run db:generate

FROM dependencies AS dev
USER node
CMD ["pnpm", "--filter", "@todo/api", "run", "dev"]



