#!/usr/bin/env bash
# Atlas One — enable HTTPS on VPS (Let's Encrypt + Docker nginx)
# Run on the VPS. Keeps EVOLUTION_WEBHOOK_BASE_URL=http://nginx in compose.
#
#   export CERTBOT_EMAIL=admin@atlasone.app.br
#   sudo bash scripts/vps-enable-https.sh

set -euo pipefail

DOMAIN="${ATLAS_TLS_DOMAIN:-app.atlasone.app.br}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

if [[ -z "${CERTBOT_EMAIL:-}" ]]; then
  echo "Set CERTBOT_EMAIL (e.g. export CERTBOT_EMAIL=admin@atlasone.app.br)"
  exit 1
fi

echo "==> Firewall (80/443)"
if command -v ufw >/dev/null 2>&1; then
  ufw allow 80/tcp || true
  ufw allow 443/tcp || true
fi

echo "==> Directories"
mkdir -p infra/certbot/www
mkdir -p /etc/letsencrypt

NGINX_CONF="infra/nginx/atlas-prod.conf"
NGINX_BOOT="infra/nginx/atlas-prod-http-bootstrap.conf"
NGINX_BACKUP="infra/nginx/atlas-prod.conf.pre-tls.bak"

echo "==> Step 1: bootstrap nginx (HTTP + ACME, no HTTPS redirect yet)"
cp "$NGINX_CONF" "$NGINX_BACKUP"
cp "$NGINX_BOOT" "$NGINX_CONF"
docker compose -f "$COMPOSE_FILE" up -d nginx
docker compose -f "$COMPOSE_FILE" exec nginx nginx -t

echo "==> Step 2: obtain certificate (webroot)"
docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v "$REPO_ROOT/infra/certbot/www:/var/www/certbot" \
  certbot/certbot certonly \
  --webroot -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$CERTBOT_EMAIL" \
  --agree-tos \
  --non-interactive \
  --preferred-challenges http

echo "==> Step 3: restore TLS nginx config + publish 443"
cp "$NGINX_BACKUP" "$NGINX_CONF"
docker compose -f "$COMPOSE_FILE" up -d nginx
docker compose -f "$COMPOSE_FILE" exec nginx nginx -t
docker compose -f "$COMPOSE_FILE" restart nginx

echo "==> Step 4: verify"
curl -sI "http://$DOMAIN" | head -5 || true
curl -sS "https://$DOMAIN/api/health" || true
echo ""
echo "Done. Open https://$DOMAIN in Chrome and confirm secure padlock."
echo "Cron renewal example:"
echo "  0 3 * * * certbot renew --quiet && cd $REPO_ROOT && docker compose -f $COMPOSE_FILE exec nginx nginx -s reload"
