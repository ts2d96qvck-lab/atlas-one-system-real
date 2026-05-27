# HANDOFF — Atlas One / SigaVox (continuar em outra IA)

> **Cole este arquivo inteiro** em um novo chat se precisar continuar o desenvolvimento.

---

## 1. O que é o projeto

**Atlas One / SigaVox** — SaaS WhatsApp + CRM + SDR multi-tenant para revenda (cliente alvo: **Cashfest**).

- **Stack oficial (usar esta):** monorepo enterprise em `apps/server` + `apps/web`
- **Legado (não evoluir):** `server.js` + `public/` + `data/db.json` — só referência de UX

---

## 2. Caminho do projeto

```
C:\Users\vinic\Downloads\atlas-one-system-real\atlas-one-system-real
```

---

## 3. Como ver o projeto AGORA

### Opção A — script Windows

```powershell
cd C:\Users\vinic\Downloads\atlas-one-system-real\atlas-one-system-real
.\start-enterprise.ps1
```

### Opção B — manual

```powershell
# Terminal 1 — PostgreSQL (se não estiver rodando)
docker compose -f docker-compose.atlas-db.yml up -d

# Terminal 2 — API
cd apps\server
npx pnpm dev

# Terminal 3 — Web
cd apps\web
npx pnpm dev
```

| URL | Serviço |
|-----|---------|
| http://localhost:3001 | Interface (Next.js) |
| http://localhost:4000 | API (Fastify) |
| http://localhost:4000/health | Health check |
| http://localhost:8080 | Evolution API (WhatsApp) |

### Login

- E-mail: `viniciusseverino0688@icloud.com`
- Senha: `82468028` (definida em `apps/server/prisma/seed.ts`)
- Tenant: `cashfest`

---

## 4. Estrutura do monorepo

```
atlas-one-system-real/
├── apps/
│   ├── server/          # API Fastify :4000, Prisma, Socket.IO, webhooks
│   │   ├── src/
│   │   │   ├── routes/       # auth, inbox, crm, whatsapp, admin, automations, payments
│   │   │   ├── services/     # webhook, inbox, crm, admin, automation
│   │   │   ├── server.ts
│   │   │   └── lib/          # prisma, realtime, media-storage
│   │   ├── prisma/schema.prisma
│   │   ├── prisma/seed.ts
│   │   ├── .env              # DATABASE_URL, EVOLUTION_*, WEBHOOK_PUBLIC_URL
│   │   └── uploads/          # mídias recebidas/enviadas
│   └── web/             # Next.js 14 :3001
│       ├── src/components/
│       │   ├── atlas-shell.tsx   # login + nav inferior
│       │   ├── atlas-app.tsx     # inbox
│       │   ├── admin-view.tsx    # QR WhatsApp + usuários
│       │   ├── crm-view.tsx      # Kanban
│       │   ├── automations-view.tsx
│       │   └── dashboard-view.tsx
│       └── .env.local            # NEXT_PUBLIC_API_URL=http://localhost:4000
├── packages/
│   ├── lib/             # EvolutionWhatsAppProvider, parseEvolutionWebhook
│   └── ui/              # componentes glass (Button, Card, Badge)
├── server.js            # LEGADO — não usar para features novas
├── public/              # LEGADO — UI antiga
├── docker-compose.atlas-db.yml
├── docker-compose.evolution.yml
├── ENTERPRISE.md
└── start-enterprise.ps1
```

---

## 5. Variáveis de ambiente importantes

### `apps/server/.env`

```env
DATABASE_URL=postgresql://atlas:atlas@localhost:5432/atlas_one
EVOLUTION_URL=http://localhost:8080
EVOLUTION_API_KEY=<sua chave - ver docker-compose.evolution.yml>
EVOLUTION_DEFAULT_INSTANCE=atlas-one-comercial
WEBHOOK_PUBLIC_URL=http://localhost:4000
JWT_SECRET=...
PORT=4000
```

### `apps/web/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=http://localhost:4000
```

**Webhook:** Evolution em Docker recebe `http://host.docker.internal:4000/webhook/evolution` (automático quando `WEBHOOK_PUBLIC_URL` é localhost).

---

## 6. O que JÁ está implementado

| Módulo | Status |
|--------|--------|
| Auth JWT + bcrypt + multi-tenant | OK |
| Inbox lista/chat/envio texto | OK |
| Tempo real Socket.IO (`inbox:message`) | OK |
| Webhook Evolution (texto + mídias) | OK |
| Dedupe mensagem triplicada | OK (webhook 3min + mergeMessages UI) |
| Envio mídia multipart + gravar áudio | OK |
| Exibir imagem/áudio/vídeo recebidos | OK (`/media/` + fetch Evolution) |
| Admin QR + webhook + criar usuário | OK |
| CRM Kanban drag + valor pipeline | OK |
| Automações CRUD + trigger etapa lead | OK |
| Webhook Cashfest `/payments/webhook/cashfest` | OK |
| Transferência conversa + status + notas | OK |
| Dashboard API + tela básica | OK |

---

## 7. O que FALTA para “produto comercial 100%” (spec original)

Prioridade sugerida:

1. **Design premium** — refinar UI com `public/styles.css` legado + glass; animações Framer
2. **Indicadores entrega/lido** — UI para status `delivered`/`read` (webhook `messages.update` já parcial)
3. **Filas round-robin** — distribuição automática de conversas
4. **Respostas rápidas / macros** — repositório + atalhos no chat
5. **Motor automação enviar WhatsApp** — hoje só registra audit log
6. **2FA admin, LGPD, rate-limit fino**
7. **Docker compose unificado** (web+server+db+redis+evolution)
8. **CI/CD GitHub Actions**
9. **Testes E2E**
10. **Migrar número/instância por tenant** no admin (hoje fixo `atlas-one-comercial`)

---

## 8. API — rotas principais

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/auth/login` | Login |
| GET | `/inbox/conversations` | Lista conversas |
| GET | `/inbox/conversations/:id` | Detalhe + mensagens |
| POST | `/inbox/conversations/:id/messages` | Enviar texto JSON |
| POST | `/inbox/conversations/:id/messages/media` | Enviar arquivo multipart |
| PATCH | `/inbox/conversations/:id` | Transferir, status |
| POST | `/webhook/evolution` | Webhook Evolution (público) |
| GET | `/whatsapp/instances` | Instâncias |
| POST | `/whatsapp/instances/:name/connect` | QR Code body `{force:true}` |
| POST | `/whatsapp/instances/:name/webhook/sync` | Sincronizar webhook |
| GET | `/crm/pipeline` | Funil + leads |
| PATCH | `/crm/leads/:id` | Mover lead / customFields |
| GET/POST | `/admin/users` | Usuários |
| GET/POST/PATCH | `/automations` | Automações |
| POST | `/payments/webhook/cashfest` | Pagamentos Cashfest |
| GET | `/dashboard` | Métricas |

---

## 9. WhatsApp / Evolution — fluxo

1. Evolution API rodando (`docker compose -f docker-compose.evolution.yml up -d`)
2. Instância `atlas-one-comercial` no Prisma seed
3. Admin → **Conectar QR** → escanear celular
4. **Sincronizar webhook**
5. Mensagens entram em `POST /webhook/evolution` → Prisma → Socket → Inbox

**Problema comum:** mensagens não chegam → verificar webhook URL na Evolution Manager e `WEBHOOK_PUBLIC_URL`.

---

## 10. Comandos úteis

```powershell
cd apps\server
npx pnpm db:push      # migrar schema
npx pnpm db:seed      # dados demo Cashfest
npx pnpm run lint     # typecheck server

cd apps\web
npx pnpm run lint

# Enterprise (raiz)
npx pnpm run dev:enterprise
```

---

## 11. Bugs conhecidos / cuidados

- **Porta 4000/3001 ocupada:** matar processo Node antes de `pnpm dev`
- **tsx watch** às vezes falha `EADDRINUSE` ao reiniciar — matar PID na porta
- **Áudio webm:** Evolution pode não aceitar todos os formatos; testar ogg/mp3
- **Mídia Evolution URL:** se base64 falhar, depende de `getBase64FromMediaMessage`
- **Legado `npm run dev` na raiz** sobe `server.js` :3000 — **não misturar** com enterprise :3001

---

## 12. Prompt para próxima IA

```
Continuo o Atlas One/SigaVox enterprise em:
C:\Users\vinic\Downloads\atlas-one-system-real\atlas-one-system-real

Leia HANDOFF-CONTINUAR.md e ENTERPRISE.md.
Stack: apps/server (Fastify+Prisma+Socket) + apps/web (Next.js).
NÃO evoluir server.js legado.

Prioridade: [descreva tarefa]
Manter http://localhost:3001 funcionando.
Login: viniciusseverino0688@icloud.com / senha no seed.ts
```

---

## 13. Decisões de arquitetura

- **Fonte da verdade:** PostgreSQL via Prisma (`apps/server/prisma/schema.prisma`)
- **WhatsApp:** Evolution API v2 (`packages/lib/src/whatsapp.ts`)
- **Realtime:** Socket.IO room `tenant:{tenantId}` evento `inbox:message`
- **Mídias:** salvas em `apps/server/uploads/{tenantId}/{messageId}.ext`, servidas em `/media/`
- **Multi-tenant:** `tenantId` em todas as queries autenticadas

---

## 14. Contato / contexto comercial

- Cliente demo: **Cashfest**
- Produto revenda SaaS premium (glassmorphism, inbox tipo WhatsApp Web)
- Spec completa estava na conversa Cursor (recepção mídias, admin, CRM, automações, LGPD, deploy)

---

**Última verificação:** API e Web respondendo em localhost. Sistema utilizável em http://localhost:3001 com abas Inbox · Dashboard · Admin · CRM · Automacao.
