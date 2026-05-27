# Operacoes — SLA e Exportacoes

Atlas One Phase 5: metricas de atendimento e exportacao CSV para vendas/suporte.

---

## Metricas SLA

Calculadas sobre conversas dos **ultimos 30 dias** (ate 500 conversas mais recentes).

| Metrica | Descricao |
|---------|-----------|
| Tempo medio 1a resposta | Minutos entre 1a mensagem do cliente e 1a resposta do time |
| % dentro SLA (1a resposta) | Conversas respondidas dentro do limite configurado |
| Tempo medio resolucao | Horas entre abertura e fechamento (`closed` / `resolved`) |
| Abertas fora do SLA | Conversas abertas que estouraram 1a resposta ou resolucao |
| Performance por agente | Ranking por conversas + % SLA |

### Configurar metas SLA

**Admin → Configuracoes da empresa:**

- **SLA 1a resposta (min)** — padrao 15
- **SLA resolucao (horas)** — padrao 24

Valores ficam em `tenant.settings`:

```json
{
  "slaFirstResponseMinutes": 15,
  "slaResolutionHours": 24
}
```

### API

```
GET /ops/sla?days=30
Authorization: Bearer {token}
```

Resposta incluida tambem em `GET /dashboard` no campo `sla`.

---

## Exportacoes CSV

Arquivos UTF-8 com BOM (compativel Excel). Limite: 5.000 leads/conversas, 10.000 mensagens.

| Endpoint | Arquivo | Conteudo |
|----------|---------|----------|
| `GET /ops/export/leads.csv` | atlas-leads.csv | CRM completo |
| `GET /ops/export/conversations.csv` | atlas-conversas.csv | Inbox resumido |
| `GET /ops/export/messages.csv` | atlas-mensagens.csv | Historico de mensagens |

Filtro opcional de mensagens:

```
GET /ops/export/messages.csv?from=2026-05-01&to=2026-05-31
```

### Permissao

Requer `dashboard:read` (mesmo acesso ao Dashboard).

Gerentes (`manager` / `team_manager`) veem apenas dados do proprio time.

### UI

**Dashboard → Performance Cockpit** — botoes no topo:

- Leads CSV
- Conversas CSV
- Mensagens CSV

---

## Arquivos

| Area | Caminho |
|------|---------|
| SLA service | `apps/server/src/services/ops/sla.service.ts` |
| Export service | `apps/server/src/services/ops/export.service.ts` |
| Rotas | `apps/server/src/routes/ops.routes.ts` |
| Dashboard UI | `apps/web/src/components/dashboard-view.tsx` |

---

*Phase 5 — operacoes comerciais e suporte.*
