# Atlas One — Plano de Go-Live (Servidor de Teste + Domínio)

Use este guia quando comprar o domínio e subir o ambiente de **teste/marketing** (não depende do notebook).

**Status atual do código:** parcialmente pronto — infra Docker OK, build OK, falta só configurar domínio + VPS.

---

## Fases

### Fase 0 — Antes de comprar (5 min)

| Item | Recomendação |
|------|----------------|
| VPS | Linux Ubuntu 22.04+, 2 vCPU, 4 GB RAM, 40 GB |
| Domínio | Ex.: `app.suaempresa.com.br` ou `atlasone.com.br` |
| DNS | Cloudflare (grátis) — A record → IP do VPS |
| WhatsApp | Evolution no Docker (já no `docker-compose.prod.yml`) |

---

### Fase 1 — Domínio e DNS (você faz)

1. Compre o domínio (Registro.br, Cloudflare, Namecheap, etc.).
2. Crie registro **A** apontando para o IP do VPS:
   - `app.seudominio.com.br` → `203.0.113.10` (exemplo)
3. No Cloudflare: proxy laranja **ON**, SSL **Full (strict)**.
4. Anote a URL final: `https://app.seudominio.com.br`

---

### Fase 2 — Gerar `.env` do servidor (5 min)

No repositório (local ou no VPS após `git clone`):

```bash
node scripts/generate-staging-env.mjs app.seudominio.com.br
```

Edite o `.env` gerado:

- `PLATFORM_ADMIN_EMAILS` → seu e-mail real
- `SMS_PROVIDER` → `twilio` ou configure `SMS_WEBHOOK_URL` (obrigatório em produção)
- `ASAAS_API_KEY` → se for testar billing

**Nunca** use URL `trycloudflare.com` em staging/produção.

---

### Fase 3 — Subir stack Docker (15–30 min)

```bash
git clone <seu-repo> atlas-one && cd atlas-one
# copie ou gere o .env na raiz

docker compose -f docker-compose.prod.yml up -d --build

# Aguarde containers healthy
docker compose -f docker-compose.prod.yml ps
curl -s http://localhost/api/health
curl -s http://localhost/api/ready
```

Validar pelo domínio (após DNS propagar):

```bash
curl -s https://app.seudominio.com.br/api/health
curl -s https://app.seudominio.com.br/api/ready
```

---

### Fase 4 — Banco e primeiro acesso (10 min)

```bash
# Migrations rodam automaticamente no start do atlas-server
# Seed inicial (UMA VEZ, staging):
docker compose -f docker-compose.prod.yml exec atlas-server sh -c "ALLOW_SEED=true npx tsx prisma/seed.ts"
```

Acesse `https://app.seudominio.com.br` e faça login com usuário owner do seed (troque senha imediatamente).

**Defaults seguros no seed:**
- Robô URA (`menuBot`) **desligado**
- Automação de follow-up **desligada**

---

### Fase 5 — WhatsApp (20 min)

1. Admin → Instâncias → Conectar (QR).
2. Admin → **Sync webhook** (ou reconectar instância).
3. Webhook Evolution será:
   ```
   https://app.seudominio.com.br/webhook/evolution/atlas-one
   ```
4. Teste: envie mensagem de outro celular → deve aparecer na Inbox.

**Importante:** só ligue o robô URA (Admin → Robô de atendimento) quando quiser testar com clientes reais.

---

### Fase 6 — Homologação marketing (checklist)

- [ ] Login owner + agente demo
- [ ] Inbox enviar/receber texto e mídia
- [ ] CRM Kanban + lead
- [ ] Dashboard carrega
- [ ] `/status` página pública OK
- [ ] Sem respostas automáticas indesejadas (URA off)
- [ ] 2 usuários simultâneos
- [ ] Link de demo compartilhável (`/apresentacao`, `/teste`)

Ver também: [GO-LIVE-CHECKLIST.md](./GO-LIVE-CHECKLIST.md)

---

### Fase 7 — Marketing (quando Fase 6 OK)

| Canal | URL sugerida |
|-------|----------------|
| Demo | `https://app.seudominio.com.br/teste` |
| Apresentação | `https://app.seudominio.com.br/apresentacao` |
| Preços | `https://app.seudominio.com.br/pricing` |
| Status | `https://app.seudominio.com.br/status` |

Materiais: `docs/KIT-COMERCIALIZACAO.md`, `docs/APRESENTACAO-COMERCIAL.md`

---

## O que já está alinhado no código

| Área | Status |
|------|--------|
| `pnpm build` | OK |
| Docker prod (API + Web + nginx + Postgres + Redis + Evolution) | OK |
| `/api/health` e `/api/ready` | OK |
| Migrations Prisma versionadas | OK |
| Webhook Evolution por tenant slug | OK |
| Robô URA — anti-spam + desligado no seed | OK |
| CORS — trycloudflare bloqueado em produção | OK |
| Webhook Asaas — exige token | OK |
| Gerador de `.env` por domínio | `scripts/generate-staging-env.mjs` |

---

## O que ainda NÃO está pronto (pós-teste)

| Feature | Status | Impacto marketing |
|---------|--------|-------------------|
| Campanhas / disparo em massa | Schema only, sem UI | Médio — prometer "em breve" |
| Meta Cloud API oficial | Parcial | Baixo — Evolution cobre teste |
| SSO Google/Microsoft | Stub | Baixo |
| Billing Asaas produção | Sandbox OK, prod manual | Médio |
| TLS no compose | Use Cloudflare ou certbot | Resolvido via DNS |

---

## Comandos úteis pós-deploy

```bash
# Logs
docker compose -f docker-compose.prod.yml logs -f atlas-server atlas-web

# Reiniciar após mudar .env
docker compose -f docker-compose.prod.yml up -d --force-recreate atlas-server atlas-web

# Desligar robô URA no tenant existente (SQL)
docker compose -f docker-compose.prod.yml exec postgres psql -U atlas -d atlas_one -c \
  "UPDATE \"Tenant\" SET settings = jsonb_set(COALESCE(settings,'{}'), '{menuBot,enabled}', 'false') WHERE slug = 'atlas-one';"

# Backup
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U atlas atlas_one > backup.sql
```

---

## Decisão

| Ambiente | Veredicto |
|----------|-----------|
| Servidor de teste com domínio | **Pronto para subir** após Fases 1–3 |
| Produção comercial plena | **Parcial** — falta campanhas, billing prod, Meta oficial |

**Próximo passo imediato:** comprar domínio → VPS → `node scripts/generate-staging-env.mjs SEU_DOMINIO` → `docker compose -f docker-compose.prod.yml up -d --build`
