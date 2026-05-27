# Handoff — Trabalho concluído na ausência

**Data:** 2026-05-26  
**Para:** Vinicius (551996802944)  
**Status:** Concluído e testado (bateria final 100%)

---

## Mensagem WhatsApp enviada

Resumo final enviado para **551996802944** via instância **Atlas one** (Evolution conectado).

Para reenviar:
```powershell
node scripts/enviar-handoff-whatsapp.mjs 551996802944 "Sua mensagem aqui"
```

---

## Resultados finais de QA

| Teste | Resultado |
|-------|-----------|
| `node scripts/run-full-qa.mjs` | **8/8 PASS** |
| API smoke | **16/16 PASS** |
| Playwright E2E | **35/35 PASS** |
| Screenshots comerciais | **3/3 PASS** |
| Billing smoke | **PASS** |
| Docker validate | **PASS** (13 services) |
| Lint + build | **PASS** |

Comando único para repetir tudo:
```powershell
node scripts/run-full-qa.mjs
npx playwright test tests/e2e/screenshots.spec.ts
```

---

## O que foi finalizado

| Item | Status |
|------|--------|
| Build produção | ✅ OK (11 rotas incl. /apresentacao) |
| PM2 atlas-api + atlas-web | ✅ Online |
| Admin com menu atalhos | ✅ Deptos, API, WhatsApp, etc. |
| Landing visual + mockups | ✅ /landing |
| Apresentação PDF | ✅ /apresentacao → Ctrl+P |
| Screenshots comerciais | ✅ docs/screenshots/ |
| Guia onde clicar | ✅ docs/GUIA-ONDE-CLICAR.md |
| Manual completo PT | ✅ docs/MANUAL-OPERACAO-COMPLETO.md |
| Quota conversas (QA-006) | ✅ Enforced |
| Tenant isolado QA | ✅ atlas-test-customer |

---

## Como acessar (quando voltar)

```powershell
cd C:\Users\vinic\Downloads\atlas-one-system-real\atlas-one-system-real
.\start-atlas-completo.ps1
```

Abrir:
- **http://app.atlasone.local.gd** (recomendado)
- **http://127.0.0.1** (mesmo sistema)
- **/apresentacao** — PDF comercial
- **/landing** — site comercial

**Login demo:** empresa `atlas-one` · `demo@atlasone.com.br` / `Atlas2026!`

**Tenant QA:** `atlas-test-customer` · `admin@test.atlasone.local` / `AtlasQA!2026Secure`

---

## Onde clicar (resumo)

1. Entrar como **admin** ou **owner** (atendente não vê Admin)
2. Aba **Admin** (topo)
3. Botões: **Departamentos** | **API / Webhooks** | **WhatsApp**

Documento completo: **docs/GUIA-ONDE-CLICAR.md**

---

## Por que 127.0.0.1?

É **normal em desenvolvimento local**. Nginx escuta na porta 80 e redireciona para o app. Em produção (VPS) será `https://app.suaempresa.com.br`.

---

## Pendente (precisa VPS/credenciais — não bloqueia demo)

- Deploy VPS produção → `DEPLOY_FIRST_CUSTOMER.md`
- Asaas cobrança automática → `ASAAS_API_KEY` no `.env`
- Login owner produção com OTP real (sem QA bypass)
- Redis em produção (opcional em dev; status pode aparecer degraded)

---

## Responder pelo WhatsApp

O número conectado é **5517991743145** (instância "Atlas one").  
Você pode continuar a conversa por lá — quando voltar, peça ajustes e referencie este arquivo.

---

*Atlas One — handoff automático — QA final 2026-05-26*
