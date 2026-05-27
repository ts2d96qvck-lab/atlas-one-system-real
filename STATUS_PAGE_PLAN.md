# Atlas One — Status Page Plan

Plano para página pública de status (`status.atlasone.com.br` ou similar), comunicação de incidentes e transparência operacional para clientes Enterprise.

**Status:** MVP implementado — `/api/status` + pagina `/status` + `infra/status/incidents.json`.

---

## 1. Objetivos

| Objetivo | Benefício |
|----------|-----------|
| Transparência de uptime | Atende checklist procurement + SLA |
| Reduzir tickets “está fora?” | Cliente verifica antes de abrir P1 |
| Histórico de incidentes | Evidência para SLA e post-mortem |
| Comunicação proativa | E-mail/webhook a assinantes |

---

## 2. Componentes a monitorar

| Componente | Check | Endpoint / método |
|------------|-------|-------------------|
| **Web app** | HTTP 200 | `GET https://app.atlasone.com.br/` |
| **API liveness** | JSON `ok: true` | `GET https://app.atlasone.com.br/api/health` |
| **API readiness** | DB + deps | `GET https://app.atlasone.com.br/api/ready` |
| **WhatsApp inbound** | Webhook recebendo | Monitor sintético ou alerta ops |
| **Evolution API** | Health interno | Docker health / proxy |
| **PostgreSQL** | Via `/api/ready` | Indireto |
| **Meta Cloud API** | Quando ativo | Provider health + webhook |

Não expor endpoints internos (Evolution direto, Postgres) publicamente.

---

## 3. Opções de implementação

### Opção A — SaaS gerenciado (recomendado para início)

| Ferramenta | Prós | Contras |
|------------|------|---------|
| [Better Stack](https://betterstack.com/) | Uptime + status page + incidentes | Custo mensal |
| [Statuspage (Atlassian)](https://www.atlassian.com/software/statuspage) | Padrão mercado | Custo |
| [UptimeRobot](https://uptimerobot.com/) | Grátis tier uptime | Status page limitada |

**Recomendação inicial:** Better Stack ou UptimeRobot (monitors) + Statuspage quando volume Enterprise justificar.

### Opção B — Self-hosted

- [Cachet](https://cachethq.io/) ou [Gatus](https://github.com/TwiN/gatus) + nginx
- Maior controle; exige manutenção e HA da própria status page

### Opção C — Mínimo viável (MVP)

1. UptimeRobot monitorando `/api/health`
2. Página estática `status.atlasone.com.br` com iframe ou link para dashboard público do monitor
3. Incidentes manuais via template (e-mail + atualização manual)

---

## 4. Arquitetura alvo

```
                    ┌─────────────────────┐
  Clientes ────────►│ status.atlasone.com │
                    │  (Statuspage SaaS)  │
                    └──────────┬──────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
   Monitor Web            Monitor API           Monitor /ready
   app.atlasone...        /api/health           (5 min interval)
```

### DNS

```
status.atlasone.com.br  CNAME  → [provider status page]
```

### Assinantes

- E-mail dos `owner`/`admin` de tenants Enterprise (opt-in)
- Webhook interno Slack/Discord para equipe Atlas

---

## 5. Estados e comunicação

| Estado | Cor | Quando usar |
|--------|-----|-------------|
| **Operational** | Verde | Todos checks OK |
| **Degraded performance** | Amarelo | Latência alta, WA parcial |
| **Partial outage** | Laranja | Módulo afetado (ex.: só automações) |
| **Major outage** | Vermelho | Login ou inbox indisponível |
| **Maintenance** | Azul | Janela programada |

### Template de incidente (P1)

1. **Identified** — “Investigando indisponibilidade na API”
2. **Update** — causa provável (sem expor dados de clientes)
3. **Monitoring** — fix aplicado, observando
4. **Resolved** — duração, impacto, próximos passos

Alinhar com [SLA_TEMPLATE.md](./SLA_TEMPLATE.md) §9.

---

## 6. Integração com ops interna

| Evento interno | Ação status page |
|----------------|------------------|
| Deploy produção | Maintenance scheduled (se downtime) |
| Falha `/api/ready` | Auto-incident ou alerta on-call |
| Provider WA down | Component “WhatsApp messaging” degraded |
| Backup falhou | **Não** publicar — incidente interno |

Logs: correlacionar incident ID com `app-log` e audit.

---

## 7. SLA e métricas públicas

Exibir na status page (90 dias):

- Uptime API (`/api/health`)
- Uptime Web
- Incidentes resolvidos (título + duração)

Não publicar: nomes de clientes, dados de conversas, stack traces.

---

## 8. Cronograma sugerido

| Fase | Entrega | Esforço |
|------|---------|---------|
| **9.1** | Monitors externos + alertas e-mail/Slack | 0,5 dia |
| **9.2** | Subdomínio + status page SaaS básica | 1 dia |
| **9.3** | Runbook incidente + templates | 1 dia |
| **9.4** | Assinantes Enterprise + webhook | 0,5 dia |

---

## 9. Checklist de go-live

- [ ] Monitors em 3 regiões (EU/US/SA se possível)
- [ ] Alertas para on-call (telefone/pager opcional)
- [ ] Página pública acessível sem login
- [ ] Histórico 90 dias habilitado
- [ ] Runbook linkado em [DEPLOY.md](./DEPLOY.md)
- [ ] Teste de comunicação (simular incidente)

---

## 10. Documentos relacionados

- [SLA_TEMPLATE.md](./SLA_TEMPLATE.md) — metas de disponibilidade
- [DEPLOY.md](./DEPLOY.md) — health endpoints
- [ENTERPRISE_READINESS.md](./ENTERPRISE_READINESS.md) — checklist procurement

---

*Status Page Plan v1 — Phase 9.*
