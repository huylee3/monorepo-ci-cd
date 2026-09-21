FROM node:24-bookworm-slim AS runner

WORKDIR /app
RUN chown node:node /app

RUN npm install -g pnpm@12.4.2

FROM runner AS dependencies
USER node

COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=node:node ./apps/web/ /app/apps/web/
COPY --chown=node:node tsconfig.base.json /app/tsconfig.base.json

RUN pnpm install --frozen-lockfile

FROM dependencies AS dev
EXPOSE 3000

CMD ["pnpm", "--filter", "@todo/web", "run", "dev"]

FROM dependencies AS prod-build
WORKDIR /app

RUN pnpm --filter @todo/web build
RUN pnpm --filter @todo/web --prod deploy /app/output


# production

FROM node:24-bookworm-slim AS prod 
WORKDIR /app
COPY --from=prod-build /app/output /app

USER node

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]

