FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable && apk add --no-cache libc6-compat

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/lib/package.json packages/lib/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
ARG NEXT_PUBLIC_API_URL=https://app.atlasone.com.br
ARG NEXT_PUBLIC_WS_URL=https://app.atlasone.com.br
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NODE_ENV=production
ENV DOCKER_BUILD=true

COPY apps/web apps/web
COPY packages/ui packages/ui
COPY packages/lib packages/lib
WORKDIR /app/apps/web
RUN pnpm exec next build

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
