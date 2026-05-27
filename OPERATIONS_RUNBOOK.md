# Atlas One — Production Operations Runbook

Guia operacional para ambientes **enterprise-grade** (SLA 99,9%+, due diligence Google/Fortune 500).

---

## 1. Checklist pré-go-live

| # | Item | Comando / verificação |
|---|------|----------------------|
| 1 | Secrets fortes (32+ chars) | `JWT_SECRET`, `WEBHOOK_SECRET`, `PAYMENTS_WEBHOOK_SECRET`, `REDIS_PASSWORD`, `SETUP_TOKEN` |
| 2 | `ALLOW_PUBLIC_BOOTSTRAP=false` | `.env` produção |
| 3 | `CORS_ORIGINS` explícito | Apenas domínios do cliente |
| 4 | HTTPS em `APP_PUBLIC_URL` e `WEBHOOK_PUBLIC_URL` | Cloudflare ou certbot |
| 5 | Postgres senha forte | `POSTGRES_PASSWORD` |
| 6 | Redis com senha | `REDIS_PASSWORD` + `REDIS_URL=redis://:senha@redis:6379` |
| 7 | Meta webhook | `META_WHATSAPP_APP_SECRET` para assinatura HMAC |
| 8 | Migrações | `docker-entrypoint.sh` roda `prisma migrate deploy` |
| 9 | Backup agendado | Ver BACKUP_RESTORE.md |
| 10 | Monitor externo | `/api/ready` a cada 60s |

---

## 2. Health checks

| Endpoint | Uso | Esperado |
|----------|-----|----------|
| `GET /api/health` | Liveness — processo vivo | `200` sempre |
| `GET /api/ready` | Readiness — DB + Redis | `200` ou `503` |
| `GET /api/status` | Status page pública | JSON com componentes |

**Importante:** Load balancers e Docker healthcheck devem usar `/api/ready`, não `/api/health`.

---

## 3. Segurança em produção

### Sessões JWT
- Tokens invalidados no logout (`tokenVersion` incrementado)
- Senha alterada → todas as sessões revogadas
- Validacao DB em cada request autenticado

### Bootstrap
- `POST /auth/bootstrap-owner` bloqueado sem header `X-Setup-Token: $SETUP_TOKEN`
- Usar apenas na implantação inicial; depois rotacionar ou remover token

### Webhooks
- Evolution: secret/apikey
- Meta: `X-Hub-Signature-256` verificado com `META_WHATSAPP_APP_SECRET`
- Rate limit dedicado: 120 req/min em `/webhook/*`

### Headers
- API: Helmet
- Web: CSP, X-Frame-Options, nosniff (Next.js + nginx)
- Socket.IO: CORS alinhado com `CORS_ORIGINS`

---

## 4. Deploy (Docker)

```bash
cp .env.production.example .env
# Editar secrets

docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f atlas-server
curl -s https://app.seudominio.com.br/api/ready | jq
```

### Primeiro tenant (setup inicial)

```bash
curl -X POST https://app.seudominio.com.br/auth/bootstrap-owner \
  -H "Content-Type: application/json" \
  -H "X-Setup-Token: SEU_SETUP_TOKEN" \
  -d '{"companyName":"Acme","tenantSlug":"acme","ownerName":"Admin","ownerEmail":"admin@acme.com","ownerPassword":"SenhaForte!2026","ownerPhone":"5511999999999"}'
```

---

## 5. Graceful shutdown

O servidor trata `SIGTERM`/`SIGINT`:
1. Para workers de webhook queue
2. Fecha conexões Fastify
3. Desconecta Prisma e Redis

Configure `stop_grace_period: 30s` no Docker Compose.

---

## 6. Observabilidade

### Logs estruturados (JSON stdout)
- `http_request` — cada request com `requestId`, duração, status
- `request_failed` — erros 5xx
- `shutdown_started` / `shutdown_complete`

### Correlacao
- Header `X-Request-Id` propagado nas respostas
- Enviar logs para Datadog/CloudWatch/Loki via agente Docker

### Auditoria
- Admin → Monitor de acessos
- Export CSV: `GET /admin/audit-logs/export.csv`

---

## 7. Incident response

1. Verificar `/api/status` e `/api/ready`
2. Consultar logs JSON (`docker logs atlas_prod_api`)
3. Isolar tenant: bloquear billing, revogar API keys
4. Rotacionar secrets se comprometimento
5. Restore backup se necessário (BACKUP_RESTORE.md)
6. Atualizar `infra/status/incidents.json` + status page

---

## 8. O que ainda requer ação externa

| Item | Responsável |
|------|-------------|
| Pentest formal | Fornecedor externo (PENTEST_SCOPE.md) |
| SOC 2 / ISO 27001 | Programa de compliance longo prazo |
| HA multi-AZ | Infra cloud (2+ replicas API + Postgres managed) |
| APM (Datadog/Sentry) | Configurar agente no host |

---

*Operations Runbook v1 — Enterprise hardening Phase 10.*
