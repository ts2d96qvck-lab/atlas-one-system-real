# Kit de Comercialização — Atlas One

Guia para revender, implantar e monetizar o sistema.

---

## 1. Modelo de negócio

### Opção A — Uso próprio
Sua empresa usa Atlas One na operação comercial interna.

### Opção B — Revenda SaaS
Você vende assinatura mensal para clientes, cada um com tenant isolado.

### Opção C — Implantação + mensalidade
Cobra setup (implantação) + recorrência (suporte + hospedagem).

---

## 2. Estrutura de precificação sugerida

| Item | Faixa sugerida (BRL) | Observação |
|------|----------------------|------------|
| Setup / implantação | R$ 1.500 – R$ 5.000 | Conexão WhatsApp, departamentos, treinamento |
| Mensalidade Starter | R$ 297 – R$ 497 | até 3 usuários |
| Mensalidade Pro | R$ 697 – R$ 997 | até 15 usuários |
| Mensalidade Enterprise | Sob consulta | ilimitado + revenda |
| Usuário adicional | R$ 49 – R$ 97/mês | acima do plano |
| Número WhatsApp extra | R$ 97 – R$ 197/mês | por instância |

*Ajuste conforme seu mercado, CAC e custo de infra.*

---

## 3. Onboarding de novo cliente (revenda)

### Dia 0 — Contrato
- [ ] Definir plano e SLA
- [ ] Coletar CNPJ (opcional), responsável, e-mail dono
- [ ] Criar tenant no Admin → Onboarding

### Dia 1 — Implantação técnica
- [ ] Cliente cria conta dona no slug dele
- [ ] Conectar WhatsApp (QR)
- [ ] Criar departamentos
- [ ] Importar/criar atendentes
- [ ] Configurar atalhos padrão

### Dia 2 — Treinamento
- [ ] 60 min com dono/supervisor (MANUAL-DONO)
- [ ] 60 min com equipe (MANUAL-EQUIPE + GUIA-RAPIDO)
- [ ] Simular 3 atendimentos reais

### Dia 3 — Go-live
- [ ] Executar GO-LIVE-CHECKLIST.md
- [ ] Liberar acessos
- [ ] Monitorar 2h com suporte ativo

---

## 4. Materiais de venda (entregar ao cliente)

| Material | Arquivo |
|----------|---------|
| Manual do dono | docs/MANUAL-DONO.md |
| Manual da equipe | docs/MANUAL-EQUIPE.md |
| Guia rápido atendente | docs/GUIA-RAPIDO-ATENDENTE.md |
| Checklist go-live | GO-LIVE-CHECKLIST.md |
| Apresentação | docs/APRESENTACAO-COMERCIAL.md |
| FAQ | docs/FAQ-SUPORTE.md |

---

## 5. Proposta comercial (template)

```
PROPOSTA COMERCIAL — ATLAS ONE

Cliente: [NOME DA EMPRESA]
Plano: [Starter / Pro / Enterprise]
Usuários: [N]
Números WhatsApp: [N]

Investimento:
- Implantação: R$ [valor] (único)
- Mensalidade: R$ [valor]/mês

Incluso:
✓ Inbox WhatsApp multi-atendente
✓ CRM Kanban integrado
✓ Dashboard comercial
✓ Automações
✓ Treinamento [X] horas
✓ Suporte [canal/SLA]

Prazo de implantação: [X] dias úteis
Validade da proposta: 15 dias
```

---

## 6. SLA sugerido (contrato)

| Severidade | Exemplo | Tempo resposta |
|------------|---------|----------------|
| P1 — Crítico | Sistema fora, WhatsApp parado | 2 horas |
| P2 — Alto | Envio falhando, login bloqueado | 8 horas |
| P3 — Médio | Dúvida operacional, ajuste config | 24 horas |
| P4 — Baixo | Melhoria, feature request | 5 dias úteis |

---

## 7. Infraestrutura para produção

Para clientes pagantes em produção (não local):

| Componente | Recomendação |
|------------|--------------|
| Domínio | `app.suaempresa.com.br` com HTTPS |
| Servidor | VPS 4GB+ RAM ou cloud |
| Banco | PostgreSQL gerenciado + backup diário |
| WhatsApp | Evolution API dedicada |
| SMS 2FA | Twilio ou provedor nacional |
| Monitoramento | Uptime + alertas |

Variáveis críticas:
```
WEBHOOK_PUBLIC_URL=https://app.seudominio.com.br
JWT_SECRET=[segredo forte]
SMS_PROVIDER=twilio
```

---

## 8. Multi-tenant (revenda)

Cada cliente = 1 tenant isolado:
- Dados separados (usuários, conversas, leads)
- Slug único (ex.: `empresa-abc`)
- Dono cria conta no primeiro acesso
- Você (owner master) faz onboarding pelo Admin

---

## 9. Argumentos de fechamento

- "Sua equipe para de perder lead no WhatsApp."
- "Você vê em tempo real quem está atendendo e quem está parado."
- "CRM e chat no mesmo lugar — zero retrabalho."
- "Escala de 3 para 30 atendentes sem trocar de ferramenta."

---

## 10. Pós-venda

| Período | Ação |
|---------|------|
| Semana 1 | Check-in diário |
| Semana 2-4 | Check-in semanal |
| Mensal | Revisão de métricas no Dashboard |
| Trimestral | Renovação + upsell (automações, usuários) |

---

*Kit de Comercialização v1.0 — Atlas One*
