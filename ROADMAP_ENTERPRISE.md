# Atlas One — Enterprise Roadmap

**Última revisão:** Phase 10 — Enterprise hardening (May 2026)

---

## Status geral: PRONTO PARA ENTERPRISE INICIAL

O sistema atende due diligence técnica de empresas mid-market e Enterprise inicial.  
Itens abaixo são **melhorias de escala** ou **compliance externo**, não bloqueadores de venda.

---

## ✅ Concluído (Phase 1–10)

- Deploy Docker prod + DEPLOY.md + OPERATIONS_RUNBOOK.md
- SSO Google/Microsoft OIDC
- Meta WhatsApp Cloud (inbound + outbound)
- Redis queue webhooks + fallback inline
- JWT revogável (`tokenVersion`)
- Bootstrap bloqueado em prod (`SETUP_TOKEN`)
- Política de senha forte (12+ chars)
- Meta webhook HMAC
- Graceful shutdown + trustProxy + request ID
- Status page `/status`
- Audit export CSV
- Security headers (API + Web + nginx)
- Prisma migrate deploy no container
- CI + dependency audit

---

## ⚠️ Parcial / próximo passo

| Item | Notas |
|------|-------|
| Gateway Asaas | MVP código pronto — falta cliente em produção |
| Redis local dev | Subir `docker compose up redis` ou remover `REDIS_URL` do `.env` dev |
| Pentest externo | Escopo em PENTEST_SCOPE.md — contratar fornecedor |

---

## ❌ Longo prazo (Fortune 500 / Google-scale)

| Item | Descrição |
|------|-----------|
| HA multi-AZ | 2+ replicas API + Postgres managed HA |
| SOC 2 Type II | Programa de compliance 12–18 meses |
| ISO 27001 | Certificação formal |
| APM integrado | Datadog/Sentry agent no host |
| Dedicated VPC | Single-tenant por cliente Enterprise |

---

## Critérios Enterprise ready v2

- [x] SSO OIDC em produção
- [x] Meta Cloud implementado
- [x] Status page operacional
- [x] Sessão revogável
- [x] Bootstrap seguro
- [x] Audit export
- [ ] Pentest sem Critical aberto
- [ ] Gateway pagamento recorrente em cliente real
- [ ] HA multi-instância

---

*Enterprise Roadmap v2 — Phase 10.*
