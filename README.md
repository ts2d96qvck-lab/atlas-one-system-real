# Atlas One — Pronto para comercializar

Plataforma WhatsApp + CRM + Inbox + Automações com **segurança enterprise**.

## Acesso

**http://app.atlasone.local.gd**

| | |
|---|---|
| Empresa | `atlas-one` |
| Dono | `viniciusseverino0688@icloud.com` / `82468028` |

## Setup comercial seguro (primeira vez)

```powershell
.\scripts\setup-comercial-seguro.ps1
```

Este comando:
- Gera segredos fortes (JWT, webhooks, pagamentos)
- Ativa modo enterprise (`ATLAS_ENTERPRISE_MODE=true`)
- Desabilita cadastro público
- Protege webhooks e mídias
- Agenda backup diário automático (02:00)
- Sobe todo o ambiente

## Reiniciar

```powershell
.\start-atlas-completo.ps1
```

## Segurança implementada

- 2FA SMS obrigatório para dono
- Bloqueio após 5 tentativas de login inválidas
- Webhooks Evolution e pagamentos autenticados
- Socket.io com JWT (isolamento por tenant)
- Mídias protegidas (sem token na URL)
- Sessão validada em tempo real (usuário ativo, tenant não bloqueado)
- WhatsApp admin restrito a dono/admin
- Auditoria de login e ações críticas
- Backup diário com retenção de 30 dias
- Instâncias WhatsApp isoladas por tenant (`{slug}-comercial`)

## Documentação

**Manual mestre (comece aqui):** [docs/MANUAL-OPERACAO-COMPLETO.md](docs/MANUAL-OPERACAO-COMPLETO.md)  
**Índice completo:** [docs/INDICE-DOCUMENTACAO.md](docs/INDICE-DOCUMENTACAO.md)  
**Estabilidade confirmada:** [docs/CONFIRMACAO-ESTABILIDADE.md](docs/CONFIRMACAO-ESTABILIDADE.md)

- [Segurança Enterprise](docs/SEGURANCA-ENTERPRISE.md)
- [Manual do Dono](docs/MANUAL-DONO.md)
- [Kit Comercial](docs/KIT-COMERCIALIZACAO.md)
- [Deploy primeiro cliente](DEPLOY_FIRST_CUSTOMER.md)

## Produção (Twilio SMS + HTTPS)

No `.env` do servidor:
```
SMS_PROVIDER=twilio
SMS_TWILIO_SID=...
SMS_TWILIO_TOKEN=...
SMS_TWILIO_FROM=+55...
NODE_ENV=production
ATLAS_ALLOW_LOCAL_SMS=false
```
