FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable && apk add --no-cache openssl libc6-compat

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/server/package.json apps/server/package.json
COPY packages/lib/package.json packages/lib/package.json
COPY apps/server/prisma apps/server/prisma
COPY apps/server apps/server
COPY packages/lib packages/lib
COPY scripts/bundle-server.js scripts/bundle-server.js
RUN printf 'node-linker=hoisted\n' > .npmrc
ENV NODE_ENV=development
RUN pnpm install --frozen-lockfile --filter @atlas-one/server...
RUN ./node_modules/.bin/prisma generate --schema=./apps/server/prisma/schema.prisma
RUN ./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit && node scripts/bundle-server.js

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/apps/server/dist/server.mjs ./dist/server.mjs
COPY --from=build /app/apps/server/dist/server.mjs.map ./dist/server.mjs.map
COPY --from=build /app/apps/server/package.json ./package.json
COPY --from=build /app/apps/server/prisma ./prisma
COPY --from=build /app/node_modules ./node_modules

RUN mkdir -p /app/uploads

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/ready || exit 1

COPY apps/server/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

CMD ["./docker-entrypoint.sh"]
