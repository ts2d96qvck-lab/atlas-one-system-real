# Atlas One — SLA Template (rascunho comercial)

Modelo de **Service Level Agreement** para anexar ao contrato SaaS B2B.  
**AVISO:** Rascunho técnico-comercial. Revisar com jurídico e financeiro antes de assinar.

Complementa métricas operacionais já disponíveis no produto ([OPS_EXPORTS.md](./OPS_EXPORTS.md)).

---

## 1. Partes e vigência

- **Prestador:** [RAZÃO SOCIAL ATLAS ONE], CNPJ [___]
- **Cliente:** [NOME EMPRESA], CNPJ [___]
- **Vigência:** igual ao contrato master de serviços (MSA)
- **Plano contratado:** [ ] Starter  [ ] Pro  [ ] Enterprise

---

## 2. Definições

| Termo | Definição |
|-------|-----------|
| **Disponibilidade** | Percentual mensal em que a aplicação web e API respondem HTTP 2xx/3xx em `/api/health`, excluindo janelas de manutenção comunicadas |
| **Tempo de inatividade** | Minutos consecutivos ou somados em que Disponibilidade não é atendida |
| **Incidente crítico (P1)** | Plataforma indisponível para todos os usuários do Cliente ou perda de mensagens WhatsApp inbound |
| **Incidente alto (P2)** | Degradação severa (login, inbox ou envio WA indisponível para subset significativo) |
| **Incidente médio (P3)** | Funcionalidade secundária afetada (export, automação, dashboard) |
| **Incidente baixo (P4)** | Dúvida, melhoria, bug cosmético |
| **Manutenção programada** | Janela pré-comunicada com ≥ 72h de antecedência |

---

## 3. Metas de disponibilidade (sugeridas)

Ajustar por plano e negociação Enterprise.

| Plano | Meta mensal | Crédito máximo/mês* |
|-------|-------------|---------------------|
| Starter | 99,0% | 5% da mensalidade |
| Pro | 99,5% | 10% da mensalidade |
| Enterprise | 99,9% | 15% da mensalidade (negociável) |

\* Crédito aplicado na fatura seguinte, não reembolso em dinheiro, salvo acordo diverso.

### Cálculo

```
Disponibilidade (%) = ((Minutos no mês − Minutos de inatividade excluída) / Minutos no mês) × 100
```

Monitor externo recomendado: `GET https://app.atlasone.app.br/api/health` a cada 1–5 min.

---

## 4. Tempos de resposta do suporte

Horário comercial sugerido: seg–sex, 9h–18h (America/Sao_Paulo), exceto feriados nacionais.

| Prioridade | Primeira resposta | Atualização | Resolução alvo** |
|------------|-------------------|-------------|------------------|
| P1 | 1 hora | A cada 2h | 8 horas |
| P2 | 4 horas | A cada 8h | 24 horas |
| P3 | 8 horas | Diária | 5 dias úteis |
| P4 | 24 horas | Conforme necessário | Best effort |

** Metas alvo, não garantia absoluta. Enterprise pode contratar suporte 24×7.

### Canais de suporte

| Canal | Disponibilidade |
|-------|-----------------|
| E-mail | suporte@[dominio] |
| Portal / ticket | [URL] |
| Telefone / WhatsApp dedicado | Enterprise opcional |

---

## 5. Escopo coberto pelo SLA

Incluído:

- Aplicação web Atlas One (UI)
- API Atlas One (`/api/*`, `/v1/*` conforme plano)
- Autenticação e multi-tenant do Cliente
- Entrega de mensagens via provider configurado (Evolution ou Meta Cloud)

Excluído (sem crédito de SLA):

- Indisponibilidade causada pelo Cliente (credenciais, configuração WA)
- Meta / WhatsApp / Evolution fora do controle do Prestador
- Internet, DNS ou IdP do Cliente (SSO)
- Força maior
- Uso acima dos limites do plano (seats, canais, rate limit API)
- Ambientes sandbox / trial não pagos
- Integrações de terceiros (Zapier, ERP) fora da API documentada

---

## 6. Manutenção programada

- Máximo sugerido: **4 horas/mês** acumuladas
- Comunicação: e-mail admin + status page (quando ativa — [STATUS_PAGE_PLAN.md](./STATUS_PAGE_PLAN.md))
- Preferência: janelas domingo 02:00–06:00 BRT

---

## 7. Créditos de serviço

| Disponibilidade mensal | Crédito (% mensalidade) |
|------------------------|-------------------------|
| ≥ meta contratada | 0% |
| Meta − 0,1% a − 0,5% | 5% |
| Meta − 0,5% a − 1,0% | 10% |
| Abaixo meta − 1,0% | 15% (teto negociado) |

**Condições para crédito:**

1. Cliente abrir ticket dentro de **5 dias úteis** após o mês calendário
2. Incidente confirmado por logs/monitor do Prestador
3. Cliente em dia com pagamentos
4. Crédito é único remédio por indisponibilidade (limitação de responsabilidade conforme MSA)

---

## 8. Métricas operacionais do produto (não contratuais por padrão)

O Atlas One expõe métricas de **atendimento** (SLA de 1ª resposta e resolução) configuráveis por tenant — distintas do SLA de **plataforma** acima.

| Métrica | Onde | Doc |
|---------|------|-----|
| SLA 1ª resposta / resolução | Dashboard, Admin | OPS_EXPORTS.md |
| Export CSV | Dashboard | OPS_EXPORTS.md |
| Health API | `/api/health`, `/api/ready` | DEPLOY.md |

Incluir no anexo Enterprise se o cliente exigir KPIs de atendimento contratuais (custom).

---

## 9. Processo de incidente

1. **Detecção** — monitor externo, equipe ops ou reporte Cliente
2. **Classificação** — P1–P4
3. **Comunicação** — status page + e-mail contatos admin do tenant
4. **Mitigação** — rollback, failover manual, provider WA
5. **Post-mortem** — P1/P2 Enterprise: RCA escrito em até 10 dias úteis (sem dados de outros tenants)

Referência técnica: [SECURITY.md](./SECURITY.md) §6.

---

## 10. Anexos sugeridos ao contrato

- [ENTERPRISE_READINESS.md](./ENTERPRISE_READINESS.md)
- [DPA_TEMPLATE.md](./DPA_TEMPLATE.md)
- [BACKUP_RESTORE.md](./BACKUP_RESTORE.md) (resumo RPO/RTO)
- Lista de contatos técnicos e administrativos do Cliente

### RPO / RTO sugeridos (informar no anexo técnico)

| Métrica | Target sugerido | Nota |
|---------|-----------------|------|
| **RPO** (perda máx. de dados) | 24h (backup diário) | Backup horário Enterprise negociável |
| **RTO** (tempo de restore) | 4–8h | Depende de restore testado |

---

*SLA Template v1 — Phase 9. Personalizar placeholders antes de uso comercial.*
