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

EXPOSE 3000

CMD ["pnpm", "--filter", "@todo/web", "run", "dev"]


