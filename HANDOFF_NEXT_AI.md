# Atlas One/SigaVox - HANDOFF COMPLETO

## Estado atual (rodando)
- Web: http://localhost:3001
- API: http://localhost:4000
- Health: GET /health
- Evolution API: http://localhost:8080 (instancia `atlas-one-comercial`)

## Login seed
- email: viniciusseverino0688@icloud.com
- senha: 82468028
- tenant: cashfest

## O que foi implementado

### Inbox/WhatsApp
- Recepcao webhook Evolution com persistencia em PostgreSQL.
- Dedupe de mensagens enviadas (corrigido bug de triplicacao).
- Tempo real via Socket.IO (`inbox:message`).
- Envio de texto funcionando.
- Envio de midia via upload endpoint multipart (`POST /inbox/conversations/:id/messages/media`).
- Upload/clip no front; gravacao de audio via MediaRecorder no front.
- Render de imagem/audio/video/documento no chat.
- Transferencia de conversa (`PATCH /inbox/conversations/:id` com `assignedToId`).
- Atualizacao de status da conversa (`open|waiting_customer|closed`).
- Nota interna por lead (salva em `lead.customFields.internalNotes`).

### Admin
- Rotas admin (`/admin/users`, create/update/list).
- Tela Admin com:
  - status de instancia
  - conectar/reconectar QR
  - sync webhook
  - CRUD basico de usuarios

### CRM
- Rota pipeline (`GET /crm/pipeline`) e leads.
- Tela CRM com colunas do funil e drag/drop de cards.
- Atualizacao de etapa (`PATCH /crm/leads/:id`).

### Automacoes + Cashfest
- Rotas `/automations` (list/create/update).
- Trigger em mudanca de etapa (`runLeadStageAutomations`).
- Webhook de pagamentos Cashfest: `POST /payments/webhook/cashfest`.
- Atualiza status de lead conforme evento `payment.paid` / `payment.overdue`.

## Principais arquivos alterados
- apps/server/src/server.ts
- apps/server/src/lib/realtime.ts
- apps/server/src/lib/media-storage.ts
- apps/server/src/routes/index.ts
- apps/server/src/routes/whatsapp.routes.ts
- apps/server/src/routes/inbox.routes.ts
- apps/server/src/routes/admin.routes.ts
- apps/server/src/routes/automation.routes.ts
- apps/server/src/routes/payments.routes.ts
- apps/server/src/services/webhook.service.ts
- apps/server/src/services/inbox.service.ts
- apps/server/src/services/admin.service.ts
- apps/server/src/services/crm.service.ts
- apps/server/src/services/automation.service.ts
- packages/lib/src/whatsapp.ts
- packages/lib/src/evolution-message.ts
- apps/web/src/components/atlas-shell.tsx
- apps/web/src/components/atlas-app.tsx
- apps/web/src/components/admin-view.tsx
- apps/web/src/components/crm-view.tsx
- apps/web/src/components/automations-view.tsx
- apps/web/src/lib/api.ts
- apps/web/src/lib/messages.ts
- .env.example
- apps/server/.env
- ENTERPRISE.md

## Validados agora
- `apps/server`: `npx pnpm run lint` OK
- `apps/web`: `npx pnpm run lint` OK
- API health/web status OK
- smoke test send texto: 1 mensagem (sem duplicar)

## Pendencias (para fechar 100% da especificacao premium)
1. Waveform de audio no player (hoje usa `<audio controls>`).
2. Reactions/reply/forward no chat (ainda nao implementado).
3. Typing/read indicators reais de WhatsApp no front.
4. Permissoes granuladas completas por acao e enforcement em todas as rotas.
5. Auditoria mais completa (hoje parcial).
6. Fila automatica de distribuicao (round-robin/peso/disponibilidade).
7. Upload drag-and-drop visual dedicado (hoje input file via clipe).
8. UX premium final (microanimacoes, skeletons consistentes em todos modulos).
9. Testes automatizados e2e para fluxo inbox midia + webhook.
10. Hardening LGPD/seguranca (2FA TOTP admin, politicas de retencao, CSRF detalhado se necessario).

## Se continuar em outra IA
Prompt recomendado:
"Continue a partir de HANDOFF_NEXT_AI.md. Priorize pendencias 1-4 primeiro sem quebrar o que ja funciona. Rode lint server/web a cada etapa e mantenha app em localhost:3001 + api:4000."

