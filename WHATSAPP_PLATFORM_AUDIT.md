# Atlas One — Auditoria da Plataforma WhatsApp

Data: 2026-05-22

| Area | Feature | Exists? | Quality | Bugs | Missing | Priority | Status |
|---|---|---|---|---|---|---|---|
| Inbox | Multi-agent inbox | Sim | Boa | Filtro Novos dependia de agentes | — | Alta | PARTIAL→PASS |
| Inbox | Atribuicao/transferencia | Sim | Boa | — | Historico de transferencia | Media | PARTIAL |
| Mensagens | Envio texto | Sim | Boa | Trim removia paragrafos | — | Critica | FIXED |
| Mensagens | Formato pre-wrap | Sim | Boa | — | — | Alta | PASS |
| Mensagens | Autoria interna | Parcial | Media | UI nao mostrava sentBy | — | Alta | FIXED |
| Mensagens | Assinatura ao cliente | Nao | — | — | Config tenant | Alta | FIXED |
| Mensagens | Status sent/delivered/read | Sim | Media | Evolution failed nao mapeado | Retry UI | Alta | PARTIAL |
| Mensagens | Apagar interno | Nao | — | — | API + UI | Alta | FIXED |
| Mensagens | Editar interno | Nao | — | — | API + UI | Alta | FIXED |
| Mensagens | Transcricao audio | Estrutura | Baixa | — | Provedor real | Media | EXTERNAL DEPENDENCY |
| Bot | Menu URA | Sim | Boa | — | Handoff avancado | Media | PARTIAL |
| UI | Selects nativos | Sim | Ruim | UX feia | Componentes premium | Alta | PARTIAL |
| CRM | Leads/pipeline | Sim | Media | — | CPF/CNPJ formal | Media | PARTIAL |
| Billing | Planos/limites | Sim | Boa | — | Asaas prod | Alta | EXTERNAL DEPENDENCY |
| API | Chaves + v1 | Sim | Boa | — | — | Media | PASS |
| Webhooks | Outbound HMAC | Sim | Boa | — | message.status event | Media | PARTIAL |
| Seguranca | RBAC + tenant | Sim | Boa | — | — | Critica | PASS |
| Realtime | Socket inbox | Sim | Boa | — | Status push dedicado | Media | PARTIAL |
| WhatsApp | Evolution | Sim | Boa | Audio no cliente | — | Critica | PROVIDER LIMITATION |
| WhatsApp | Meta Cloud | Estrutura | Media | Credenciais | Producao | Alta | EXTERNAL DEPENDENCY |

## Proximas prioridades

1. Substituir `<select>` restantes no Admin/CRM por `AppSelect`
2. Evento webhook `message.status_changed`
3. Retry seguro de mensagens falhas
4. Provedor real de transcricao (Whisper/OpenAI via env)
5. Teste E2E de formatação multilinha com provider mock
