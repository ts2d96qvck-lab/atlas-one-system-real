# Atlas One — Security Overview

Documento para revisao de TI, procurement e due diligence tecnica.  
Complementa [SECURITY_BASELINE.md](./SECURITY_BASELINE.md) (checklist operacional).

**Nao substitui assessoria juridica, pentest formal ou certificacao.**

---

## 1. Arquitetura de seguranca

| Camada | Controle |
|--------|----------|
| Transporte | HTTPS obrigatorio em producao |
| Autenticacao | JWT (12h) + revogacao via tokenVersion + bcrypt + 2FA owner |
| Autorizacao | RBAC + permissoes granulares por rota |
| Multi-tenant | `tenantId` do JWT em todas as queries |
| API externa | Chaves `atlas_live_*` com escopos read/write |
| Webhooks entrada | Secret por tenant / Evolution apikey |
| Webhooks saida | HMAC-SHA256 assinado |
| Rate limiting | Global + auth + export + API v1 + webhooks (Redis quando disponivel) |

---

## 2. Controles de acesso

### Papeis

| Papel | Escopo tipico |
|-------|---------------|
| owner | Acesso total + 2FA obrigatorio |
| admin | Gestao usuarios, integracoes, config |
| supervisor | Operacao + takeover conversas |
| agent | Inbox e CRM proprio |

Permissoes enforced no **backend** (`requirePermission`, `requireRole`).

### Rotas sensiveis (todas exigem auth)

| Area | Guard |
|------|-------|
| `/admin/*` | admin/owner + `admin:read` |
| `/ops/export/*` | `dashboard:read` + rate limit 20/15min |
| `/v1/*` | API key + escopo |
| `/media/*` | JWT + match tenant |
| `/webhook/evolution/:slug` | webhook secret |

Rotas publicas limitadas: `/auth/login`, `/health`, `/webhook/*` (com verificacao).

---

## 3. Auditoria

Eventos registrados em `AuditLog`:

| Categoria | Eventos |
|-----------|---------|
| Auth | login, logout, 2FA, reset senha |
| Usuarios | criacao, edicao, exclusao, permissoes |
| Dados | exportacao CSV, exclusao |
| Integracoes | API keys, webhooks |
| Operacao | CRM, inbox, automacoes |

**Admin → Monitor de acessos** — filtros por acao/entidade, ate 200 registros.

API: `GET /admin/audit-logs?action=&entity=&limit=`

---

## 4. Dados e retencao

| Dado | Local | Backup |
|------|-------|--------|
| Usuarios, CRM, conversas | PostgreSQL | Ver BACKUP_RESTORE.md |
| Midia WhatsApp | Disco local / uploads | Incluir no backup de volumes |
| Logs auditoria | PostgreSQL | Retencao configuravel (padrao ilimitado) |
| Sessoes | JWT + tokenVersion (revogacao imediata no logout) | Expira em 12h ou revogacao |

Exportacao e exclusao de dados auditadas. Ver [PRIVACY.md](./PRIVACY.md) e [LGPD_CHECKLIST.md](./LGPD_CHECKLIST.md).

---

## 5. SSO

Implementado: Google e Microsoft Entra via OIDC + PKCE.  
Detalhes: [SSO_PLAN.md](./SSO_PLAN.md).

Endpoint: `GET /auth/providers`, `GET /auth/oidc/:provider/start`

---

## 6. Resposta a incidentes (resumo)

1. Isolar tenant afetado (bloquear billing / revogar API keys)
2. Rotacionar `JWT_SECRET`, webhooks secrets
3. Consultar audit logs + logs JSON (`app-log`)
4. Restaurar backup se necessario (BACKUP_RESTORE.md)
5. Notificar clientes conforme LGPD se houver vazamento

---

## 7. Documentos relacionados

| Documento | Conteudo |
|-----------|----------|
| SECURITY_BASELINE.md | Checklist pre-producao |
| PRIVACY.md | Estrutura politica de privacidade |
| LGPD_CHECKLIST.md | Conformidade LGPD tecnica |
| DPA_TEMPLATE.md | Rascunho DPA B2B |
| SSO_PLAN.md | Roadmap SSO OIDC |
| BACKUP_RESTORE.md | Backup e restore |
| API.md / WEBHOOKS.md | Integracoes |
| ENTERPRISE_READINESS.md | Checklist procurement enterprise |
| SLA_TEMPLATE.md | Modelo SLA contratual |
| OPERATIONS_RUNBOOK.md | Runbook operacao 24/7 |

---

*Atlas One — Security Overview v1 (Phase 7)*
