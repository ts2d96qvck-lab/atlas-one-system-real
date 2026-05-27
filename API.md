# Atlas One — Public API

API REST versionada para integrar CRM, conversas e exportacoes com sistemas externos.

**Base URL:** `https://app.atlasone.com.br/v1` (local: `http://localhost:4000/v1`)

**OpenAPI:** `GET /v1/openapi.json`

---

## Autenticacao

Toda requisicao exige uma **API key** por tenant:

```
Authorization: Bearer atlas_live_xxxxxxxx
```

ou

```
X-Api-Key: atlas_live_xxxxxxxx
```

Chaves sao criadas em **Admin → Integracoes (API e Webhooks)**. O valor completo so e exibido uma vez na criacao.

### Escopos

| Escopo | Permite |
|--------|---------|
| `read` | GET (listar, exportar) |
| `write` | POST, PATCH (criar/atualizar) |
| `*` | Tudo |

Rate limit: **120 req/min** por IP.

---

## Endpoints

### CRM — Leads

| Metodo | Path | Descricao |
|--------|------|-----------|
| GET | `/v1/leads` | Listar leads |
| POST | `/v1/leads` | Criar lead |
| PATCH | `/v1/leads/:id` | Atualizar lead (status, dados) |

**Exemplo criar lead:**

```bash
curl -X POST https://app.atlasone.com.br/v1/leads \
  -H "Authorization: Bearer atlas_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "company": "Acme Ltda",
    "contact": "Maria Silva",
    "phone": "5511999999999",
    "email": "maria@acme.com",
    "origin": "Site",
    "status": "Novos leads",
    "value": 5000
  }'
```

### Inbox — Conversas

| Metodo | Path | Descricao |
|--------|------|-----------|
| GET | `/v1/conversations` | Listar conversas (`?status=open&limit=50`) |
| GET | `/v1/conversations/:id` | Detalhe da conversa |
| GET | `/v1/conversations/:id/messages` | Mensagens (`?limit=50&cursor=`) |

### Eventos comerciais

| Metodo | Path | Descricao |
|--------|------|-----------|
| POST | `/v1/events` | Registrar evento comercial customizado |
| GET | `/v1/events/catalog` | Catalogo de eventos de webhook |

**Exemplo:**

```json
POST /v1/events
{
  "event": "proposal.sent",
  "entityType": "lead",
  "entityId": "cmpl...",
  "data": { "amount": 12000, "channel": "email" }
}
```

Dispara webhook `commercial.event` e grava auditoria.

### Exportacao

| Metodo | Path | Arquivo |
|--------|------|---------|
| GET | `/v1/export/leads.csv` | atlas-leads.csv |
| GET | `/v1/export/conversations.csv` | atlas-conversas.csv |
| GET | `/v1/export/messages.csv?from=&to=` | atlas-mensagens.csv |

---

## Respostas

Sucesso JSON:

```json
{ "data": { ... } }
```

Erro:

```json
{ "error": "Mensagem", "message": "Detalhe opcional" }
```

Codigos: `401` (key invalida), `403` (escopo), `404`, `400`.

---

## Integracoes futuras

A API foi desenhada para conectar com:

- HubSpot, Salesforce, Pipedrive (via middleware ou Zapier/Make)
- Zapier / Make — use webhooks de saida + POST `/v1/leads`
- BI interno — export CSV + GET leads/conversas

---

## Arquivos

| Area | Caminho |
|------|---------|
| Rotas v1 | `apps/server/src/routes/v1.routes.ts` |
| Auth API key | `apps/server/src/plugins/api-key-auth.ts` |
| Gestao admin | `apps/server/src/routes/integrations-admin.routes.ts` |
| OpenAPI | `apps/server/src/openapi/v1-spec.ts` |

---

*Phase 6 — camada de plataforma integravel.*
