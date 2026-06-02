# HTTPS — VPS runbook (`app.atlasone.app.br`)

## Diagnosis (confirmed)

| Check | Result |
|-------|--------|
| DNS A | `2.25.137.139` (direct VPS, not Cloudflare edge IP) |
| HTTP :80 | Works (`nginx/1.27.5`) |
| HTTPS :443 | Timeout (not listening) |
| Chrome | "Inseguro" on `http://` |

## Cloudflare (optional)

Current DNS points **directly** to the VPS. Two valid strategies:

| Strategy | When | SSL mode |
|----------|------|----------|
| **A — Origin TLS (recommended)** | DNS grey cloud or orange cloud | **Full (strict)** after Let's Encrypt on VPS |
| **B — Edge TLS only** | Orange cloud ON, origin HTTP | **Flexible** (padlock at edge, not ideal) |

If you enable orange cloud **before** origin has port 443, use **Full (strict)** only after certs exist on the VPS.

**Do not change** `EVOLUTION_WEBHOOK_BASE_URL` — keep `http://nginx` in `docker-compose.prod.yml`.

## VPS commands (after git pull on server)

```bash
cd /path/to/atlas-one
export CERTBOT_EMAIL=admin@atlasone.app.br
sudo bash scripts/vps-enable-https.sh
```

Manual alternative — inspect only:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml port nginx
sudo ss -tlnp | grep -E ':80|:443'
sudo certbot certificates 2>/dev/null || true
```

## `.env` on VPS (no schema changes)

Ensure public URLs use HTTPS; keep internal Evolution on HTTP:

```env
APP_PUBLIC_URL=https://app.atlasone.app.br
WEBHOOK_PUBLIC_URL=https://app.atlasone.app.br
CORS_ORIGINS=https://app.atlasone.app.br
NEXT_PUBLIC_API_URL=https://app.atlasone.app.br
NEXT_PUBLIC_WS_URL=https://app.atlasone.app.br
EVOLUTION_WEBHOOK_BASE_URL=http://nginx
WEBHOOK_USE_HTTPS=true
```

Rebuild web container after `next.config.mjs` header change:

```bash
docker compose -f docker-compose.prod.yml up -d --build atlas-web nginx
```

## Post-fix validation

```bash
curl -sI http://app.atlasone.app.br | grep -i location
curl -sS https://app.atlasone.app.br/api/health
echo | openssl s_client -connect app.atlasone.app.br:443 -servername app.atlasone.app.br 2>/dev/null | openssl x509 -noout -dates
```

Browser: padlock on `https://app.atlasone.app.br`, test mic (inbox audio) and notifications permission prompt.

## Rollback

```bash
git checkout infra/nginx/atlas-prod.conf docker-compose.prod.yml
docker compose -f docker-compose.prod.yml up -d nginx
```
