# Seguranca Enterprise — Atlas One

Documento para comercializacao com exigencia de protecao de dados (LGPD, multi-empresa, operacao comercial).

## O que o sistema garante

| Controle | Implementacao |
|----------|----------------|
| Isolamento multi-empresa | Todas as consultas filtram por `tenantId`; FKs validadas antes de gravar |
| Midias privadas | `/media/*` exige token de sessao — URLs publicas nao funcionam |
| Webhooks protegidos | Evolution e pagamentos exigem chave/secreto |
| Webhook por empresa | URL `/webhook/evolution/{slug-da-empresa}` evita vazamento entre clientes |
| Socket em tempo real | Conexao exige JWT; sala limitada ao tenant do usuario |
| WhatsApp admin | Conectar QR, excluir instancia — apenas dono/admin |
| Plataforma vs cliente | Onboarding de clientes e billing — apenas `PLATFORM_ADMIN_EMAILS` |
| 2FA dono | SMS obrigatorio para conta dona; codigo nunca exposto em producao |
| Rate limit login | 30 tentativas / 15 min nos endpoints de autenticacao |
| Auditoria | Admin → Monitor de acessos (login, reset, alteracoes) |
| Backup | `scripts/backup-atlas.ps1` — banco + midias |

## Variaveis obrigatorias em producao

```env
NODE_ENV=production
JWT_SECRET=<minimo 32 caracteres aleatorios>
EVOLUTION_API_KEY=<chave evolution>
WEBHOOK_SECRET=<secreto webhook>
PAYMENTS_WEBHOOK_SECRET=<secreto pagamentos>
PLATFORM_ADMIN_EMAILS=admin@empresa.com,ops@empresa.com
CORS_ORIGINS=https://app.seudominio.com.br
SMS_PROVIDER=twilio
ALLOW_PUBLIC_BOOTSTRAP=false
```

## Checklist antes de vender para um cliente

1. HTTPS ativo no dominio (Cloudflare ou certificado Let's Encrypt)
2. Backup diario agendado (`scripts/backup-atlas.ps1`)
3. Twilio configurado para 2FA real
4. `ALLOW_PUBLIC_BOOTSTRAP=false`
5. Dono do cliente criado via Admin (nao seed publico)
6. Evolution com webhook apontando para `/webhook/evolution/{slug}`
7. Teste: atendente de empresa A nao ve conversas de empresa B

## Backup e recuperacao

```powershell
# Backup manual
.\scripts\backup-atlas.ps1

# Restaurar banco (exemplo)
docker cp backups\DATA\database.dump atlas_one_postgres:/tmp/restore.dump
docker exec atlas_one_postgres pg_restore -U atlas -d atlas_one -c /tmp/restore.dump
```

Agende o backup no **Agendador de Tarefas do Windows** (diario, horario de baixo uso).

## Posicionamento comercial

- **Pronto para:** empresas comerciais, call centers, imobiliarias, revenda SaaS multi-cliente
- **Requer hardening adicional para:** bancos regulados (SOC2, HSM, SSO corporativo) — consultoria de infra separada

## Suporte a LGPD

- Dados por tenant isolados
- Auditoria de acoes sensiveis
- Exclusao de contato/conversa pelo Admin
- Backup criptografado recomendado no storage offsite (Azure Blob, S3)

*Atlas One — Plataforma comercial segura para operacao WhatsApp + CRM.*
