FROM node:24-bookworm-slim AS runtime

WORKDIR /app
RUN npm install -g pnpm@12.4.2

FROM runtime AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
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
