# Decisao Go-Live — Plataforma WhatsApp Atlas One

Status geral: **READY WITH CONDITIONS**

| # | Pergunta | Status |
|---|---|---|
| 1 | Pronto para vender ao primeiro SMB? | READY WITH CONDITIONS |
| 2 | Inbox WhatsApp production-usavel? | PARTIAL |
| 3 | Robo seguro para clientes reais? | PARTIAL |
| 4 | Selects profissionais? | PARTIAL |
| 5 | Mensagens enviadas como digitadas? | PASS |
| 6 | Autoria interna funciona? | PASS |
| 7 | Cliente ve nome do agente quando habilitado? | PASS (via assinatura no corpo) |
| 8 | Status sent/delivered/read? | PARTIAL (depende Evolution/Meta) |
| 9 | Apagar mensagens? | PASS (interno) |
| 10 | Editar mensagens? | PASS (interno) |
| 11 | Transcrever audio? | EXTERNAL DEPENDENCY |
| 12 | Relatorios uteis? | PARTIAL |
| 13 | API/webhooks usaveis? | PASS |
| 14 | Billing enforceable? | PARTIAL |
| 15 | Isolamento tenant seguro? | PASS |

## Condicoes antes de cobrar cliente real

1. WhatsApp conectado e testado (Evolution QR ou Meta Cloud credenciais)
2. Validar audio no dispositivo do cliente
3. Configurar assinatura do agente no Admin → Empresa
4. Configurar robo URA se usar automacao
5. Redis em producao (recomendado)
6. Asaas producao se cobrar self-service

## Nao prometer em vendas

- Apagar/editar mensagem no celular do cliente (PROVIDER LIMITATION)
- Read receipt garantido (PROVIDER LIMITATION)
- Transcricao automatica sem provedor configurado
- Pagamento automatico sem Asaas producao
