# Onde Clicar no Atlas One — Guia Visual

**Para:** dono, admin e quem está perdido na interface  
**Problema comum:** Admin é uma página longa — tudo existe, mas precisa rolar ou usar os atalhos no topo.

---

## 1. Por que aparece `127.0.0.1`? (NÃO é bug)

| URL que você vê | O que significa |
|-----------------|-----------------|
| `http://127.0.0.1` | Acesso local via Nginx (porta 80) — **correto em dev** |
| `http://127.0.0.1:3001` | Acesso direto ao Next.js — funciona, mas URL feia |
| `http://app.atlasone.local.gd` | URL bonita local (precisa hosts + Nginx) |
| `https://....trycloudflare.com` | Link público temporário para clientes testarem |

### Como usar a URL certa

**Sempre prefira iniciar assim:**

```powershell
.\start-atlas-completo.ps1
```

Isso sobe: banco + Evolution + Nginx + túnel Cloudflare.

Depois abra **um destes**:

1. **http://app.atlasone.local.gd** (melhor)
2. **http://127.0.0.1** (mesma coisa, sem nome bonito)

**Não use** `:3001` no dia a dia — use só se estiver debugando.

Em **produção** (VPS), o cliente verá `https://app.suaempresa.com.br` — nunca 127.0.0.1.

---

## 2. Menu principal (barra superior)

Depois de logar, você vê estas abas:

| Aba | Para quem | O que faz |
|-----|-----------|-----------|
| **Inbox** | Todos | Atender WhatsApp |
| **Dashboard** | Supervisor, dono | Métricas e SLA |
| **Admin** | Dono, admin, supervisor | Configurações (departamentos, API, WhatsApp…) |
| **CRM** | Todos | Funil de leads |
| **Automacao** | Admin+ | Regras automáticas |

> **Atendente (agent)** só vê Inbox e CRM — **não vê Admin**.

---

## 3. Admin — atalhos no topo (NOVO)

Entre em **Admin** e use os botões logo abaixo do título:

| Botão | Vai para |
|-------|----------|
| **Empresa** | Nome, horário, SLA |
| **API / Webhooks** | **Chaves API aqui** |
| **Plano** | Billing, seats, upgrade |
| **WhatsApp** | QR Code, conectar número |
| **Usuarios** | Criar atendentes |
| **Departamentos** | **Criar departamentos aqui** |
| **Auditoria** | Log de acessos |

---

## 4. Departamentos — passo a passo

1. Login como **dono** ou **admin**
2. Clique na aba **Admin** (topo)
3. Clique no botão **Departamentos** (atalho) **ou** role até a seção "Departamentos"
4. No campo, digite ex.: `Comercial`, `Suporte`, `Novos`
5. Clique **Criar departamento**
6. Ao criar usuário, selecione o departamento no dropdown

**Por que departamentos?**  
Transferências e filas usam departamento. Crie pelo menos **Novos** para clientes que entram.

---

## 5. Chave API — passo a passo

1. Login como **dono** ou **admin**
2. Aba **Admin**
3. Clique **API / Webhooks**
4. Seção **Chaves API** → digite um nome (ex.: `Meu ERP`)
5. Clique **Criar**
6. **Copie a chave imediatamente** — só aparece uma vez (caixa amarela)

**Requisitos:**

- Plano **Pro** ou superior (Starter não tem API)
- Perfil admin ou owner

**Usar a chave:**

```http
GET https://seudominio.com.br/v1/leads
Header: X-API-Key: atlas_live_sua_chave_aqui
```

Documentação: `API.md` na raiz do projeto.

---

## 6. WhatsApp — passo a passo

1. Admin → botão **WhatsApp**
2. Selecione a instância ou crie em "Adicionar numero"
3. Clique **Conectar QR**
4. Escaneie com WhatsApp do celular comercial
5. Clique **Sync webhook**
6. Teste enviando mensagem para o número

---

## 7. Apresentação comercial e PDF

| O que | Onde |
|-------|------|
| Site comercial | `/landing` |
| Planos | `/pricing` |
| **Apresentação para imprimir/PDF** | **`/apresentacao`** |

### Gerar PDF

1. Abra `http://127.0.0.1/apresentacao` (ou app.atlasone.local.gd)
2. Clique **Salvar como PDF** ou pressione **Ctrl+P**
3. Destino: **Salvar como PDF**
4. Margens: **Mínima**

Envie o PDF ao cliente antes da reunião.

---

## 8. Credenciais de teste

| Perfil | Empresa | E-mail | Senha |
|--------|---------|--------|-------|
| Atendente demo | `atlas-one` | `demo@atlasone.com.br` | `Atlas2026!` |
| QA (testes) | `atlas-test-customer` | `admin@test.atlasone.local` | `AtlasQA!2026Secure` |

Dono real: use sua conta configurada no bootstrap.

---

## 9. “Falta ferramenta” — o que existe vs o que vem depois

| Existe hoje | Onde |
|-------------|------|
| Inbox WhatsApp | Aba Inbox |
| CRM Kanban | Aba CRM |
| Dashboard | Aba Dashboard |
| Departamentos | Admin → Departamentos |
| API Keys | Admin → API / Webhooks |
| Webhooks saída | Admin → API / Webhooks |
| Billing/planos | Admin → Plano |
| Auditoria | Admin → Auditoria |
| Landing comercial | `/landing` |
| PDF apresentação | `/apresentacao` |

| Ainda manual / externo | Nota |
|------------------------|------|
| Cobrança automática Asaas | Precisa `ASAAS_API_KEY` |
| Domínio produção | Precisa VPS |
| SSO Google/Microsoft | Precisa configurar OIDC no `.env` |

---

## 10. Algo não funciona?

```powershell
.\start-atlas-completo.ps1
curl http://127.0.0.1/api/health
```

Se API = saudável e Admin não carrega: faça logout e entre como **admin** ou **owner**, não como atendente.

Mais ajuda: `docs/FAQ-SUPORTE.md`

---

*Guia prático — Atlas One*
