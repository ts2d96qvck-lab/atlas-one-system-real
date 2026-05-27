# Go Live Checklist — Atlas One

Checklist para liberar operação comercial (servidor de teste ou produção).

**Deploy recomendado:** Docker — ver [TEST_SERVER_GO_LIVE.md](./TEST_SERVER_GO_LIVE.md) e [DEPLOY.md](./DEPLOY.md)  
**URL:** `https://app.seudominio.com.br` (substitua pelo seu domínio)

---

## 1) Infraestrutura e segurança

- [ ] VPS Linux com Docker Compose (`docker-compose.prod.yml`)
- [ ] DNS A record → IP do VPS + HTTPS (Cloudflare ou certbot)
- [ ] `.env` gerado (`node scripts/generate-staging-env.mjs SEU_DOMINIO`)
- [ ] API respondendo: `/api/health` e `/api/ready`
- [ ] `JWT_SECRET`, senhas Postgres/Redis fortes (32+ chars)
- [ ] 2FA ativo para conta owner
- [ ] Robô URA **desligado** até homologação (Admin → Robô de atendimento)

## 2) WhatsApp e mensageria

- [ ] Número conectado via QR (Admin → Instâncias)
- [ ] Webhook sincronizado (Admin → Sync webhook)
- [ ] URL webhook: `https://SEU_DOMINIO/webhook/evolution/atlas-one`
- [ ] Envio de texto, imagem, áudio, vídeo e documento validado
- [ ] Recebimento confirmado na Inbox

## 3) Operação de equipe

- [ ] Departamentos/equipes criados
- [ ] Atendentes cadastrados
- [ ] Transferência entre atendentes testada
- [ ] Status aberto / aguardando / fechado validado
- [ ] Notas internas e painel do cliente testados

## 4) CRM e automações

- [ ] Funil Kanban ajustado
- [ ] Lead editável
- [ ] Automações **só ativar após teste** (evitar mensagens automáticas indesejadas)
- [ ] Dashboard revisado

## 5) Auditoria e governança

- [ ] Monitor de acessos revisado (Admin)
- [ ] Responsável técnico definido
- [ ] Plano de contingência (queda WhatsApp/API)

## 6) Treinamento

- [ ] Treinamento 60–90 min com equipe
- [ ] Guia: `docs/GUIA-RAPIDO-ATENDENTE.md`
- [ ] Canal de suporte interno definido

## 7) Homologação final

- [ ] Cenário: cliente novo → atendimento → fechar
- [ ] Cenário: cliente responde após fechado → reabre
- [ ] 2+ usuários simultâneos sem erro
- [ ] Dono aprovou go-live

---

## Script de virada (servidor)

```bash
# 1. Backup
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U atlas atlas_one > backup-$(date +%F).sql

# 2. Deploy
docker compose -f docker-compose.prod.yml up -d --build

# 3. Verificar
curl -s https://SEU_DOMINIO/api/health
curl -s https://SEU_DOMINIO/api/ready

# 4. Monitorar logs 2h
docker compose -f docker-compose.prod.yml logs -f atlas-server
```
