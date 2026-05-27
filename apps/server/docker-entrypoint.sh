#!/bin/sh
set -e

if [ -f ./prisma/schema.prisma ]; then
  echo "[entrypoint] prisma migrate deploy"
  npx prisma migrate deploy
fi

exec node dist/server.mjs
