FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable && apk add --no-cache libc6-compat

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/lib/package.json packages/lib/package.json
COPY apps/web apps/web
COPY packages/ui packages/ui
COPY packages/lib packages/lib
ARG NEXT_PUBLIC_API_URL=https://app.atlasone.app.br
ARG NEXT_PUBLIC_WS_URL=https://app.atlasone.app.br
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV DOCKER_BUILD=true
RUN printf 'node-linker=hoisted\n' > .npmrc
ENV NODE_ENV=development
RUN pnpm install --frozen-lockfile --filter @atlas-one/web...
WORKDIR /app/apps/web
ENV NODE_ENV=production
RUN ../../node_modules/.bin/next build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/ || exit 1

CMD ["node", "apps/web/server.js"]
