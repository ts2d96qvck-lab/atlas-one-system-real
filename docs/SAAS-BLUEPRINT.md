# Atlas One / SigaVox SaaS Blueprint

## Decisao tecnica

O sistema legado em `server.js` e `public/` continua rodando em `http://localhost:3000` para demonstracao e operacao local.
A nova fundacao enterprise fica em:

- `apps/web`: Next.js 14, Tailwind, Radix, React Query, Zustand e Framer Motion.
- `apps/server`: Fastify, TypeScript, Clean Architecture, Prisma, Socket.IO e integracao WhatsApp plugavel.
- `packages/ui`: Design System premium compartilhado.
- `packages/lib`: helpers de auth, tenancy e provedores WhatsApp.

## Primeira entrega comercial

1. Manter WhatsApp real via Evolution API no app atual.
2. Migrar o backend para `apps/server` com Prisma e PostgreSQL.
3. Migrar a inbox premium para `apps/web`.
4. Adicionar multi-tenant real com `tenantId` em todas as entidades.
5. Criar modulos de CRM, pipeline, automacoes, relatorios e cobranca Cashfest.

## Contrato WhatsApp

Toda integracao deve passar pela interface `WhatsAppProvider` em `packages/lib/src/whatsapp.ts`.
Isso permite trocar Evolution API por WPPConnect ou API oficial sem reescrever inbox, CRM e automacoes.

## Modelo de dados

O schema inicial esta em `apps/server/prisma/schema.prisma` e cobre:

- tenants
- usuarios, roles e permissoes
- instancias WhatsApp
- conversas e mensagens
- leads e pipeline
- automacoes
- auditoria
- integracoes de pagamento

## Padrao visual

Luxo silencioso, glass claro, off-white, azul premium e microinteracoes discretas.
O objetivo e parecer produto SaaS de alto valor, nao painel generico.

