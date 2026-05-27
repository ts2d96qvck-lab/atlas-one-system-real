# Atlas One — SSO Plan (OIDC)

Plano tecnico para Google Workspace e Microsoft Entra ID (Azure AD).

**Status:** Phase 7.1 implementado (Google/Microsoft/OIDC generico + admin UI).

---

## 1. Estado atual

| Item | Status |
|------|--------|
| Abstracao `AuthProvider` | ✅ `apps/server/src/lib/auth/` |
| Provider local (email/senha) | ✅ Producao |
| OIDC login (PKCE + callback) | ✅ `sso/oidc-client.ts`, `sso.service.ts` |
| Modelo `ExternalIdentity` | ✅ Prisma |
| Endpoints start/callback | ✅ `GET /auth/oidc/:provider/start`, `/auth/oidc/callback` |
| Admin SSO settings | ✅ `GET/PATCH /admin/sso/settings` |
| UI login SSO | ✅ `atlas-shell.tsx` |
| JIT provisioning | ✅ Config tenant |
| SSO-only mode | ❌ Pendente (7.3) |

---

## 2. Arquitetura proposta

```
Browser → IdP (Google/Microsoft)
       → Callback /auth/oidc/callback
       → oidcAuthProvider.resolveIdentity()
       → Link ou create User + ExternalIdentity
       → JWT session (mesmo formato atual)
```

### Providers suportados (roadmap)

| IdP | Protocolo | Uso |
|-----|-----------|-----|
| Google Workspace | OIDC | Enterprise Gmail |
| Microsoft Entra ID | OIDC | Azure AD / M365 |
| Generic OIDC | OIDC | Okta, Auth0, Keycloak |

---

## 3. Modelo de dados (futuro)

```prisma
model ExternalIdentity {
  id              String   @id @default(cuid())
  tenantId        String
  userId          String
  provider        String   // google | microsoft | oidc
  providerSubject String
  email           String
  metadata        Json     @default("{}")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([tenantId, provider, providerSubject])
  @@index([tenantId, userId])
}
```

Mapeamento em `auth-provider.types.ts` → `ExternalIdentityRecord`.

---

## 4. Variaveis de ambiente

```env
OIDC_ISSUER=https://login.microsoftonline.com/{tenant}/v2.0
OIDC_CLIENT_ID=
OIDC_CLIENT_SECRET=
OIDC_REDIRECT_URI=https://app.atlasone.app.br/auth/oidc/callback
```

Google: issuer `https://accounts.google.com`

---

## 5. Fluxo de login SSO

1. Usuario clica "Entrar com Google/Microsoft"
2. Redirect para authorize URL do IdP
3. Callback com code → troca por tokens (server-side)
4. Validar id_token (iss, aud, exp, email_verified)
5. Buscar `ExternalIdentity` ou `User` por email + tenantSlug
6. Se novo: criar user `status=invited` ou auto-provision (config tenant)
7. Emitir JWT identico ao login local
8. Audit: `auth_login_success` metadata `{ mode: "oidc", provider }`

---

## 6. Regras de negocio

| Cenario | Comportamento sugerido |
|---------|-------------------------|
| Email existe, SSO primeiro login | Vincular ExternalIdentity |
| SSO email desconhecido | Bloquear ou JIT conforme setting tenant |
| Owner local + SSO | Owner pode habilitar SSO-only apos teste |
| 2FA local + SSO | IdP MFA substitui 2FA Atlas para SSO users |

Setting tenant (futuro):

```json
{
  "ssoEnabled": true,
  "ssoProviders": ["google", "microsoft"],
  "ssoJitProvisioning": false
}
```

---

## 7. Endpoints a implementar (Phase 7.1)

| Metodo | Path | Descricao |
|--------|------|-----------|
| GET | `/auth/oidc/:provider/start` | Redirect para IdP |
| GET | `/auth/oidc/callback` | Recebe code, emite JWT |
| POST | `/admin/sso/settings` | Config SSO tenant |
| GET | `/admin/sso/settings` | Ler config |

---

## 8. Seguranca OIDC

- PKCE obrigatorio
- Validar nonce + state
- Rotacionar client_secret
- Allowlist redirect URIs
- Nao logar id_token completo

---

## 9. Cronograma sugerido

| Sprint | Entrega |
|--------|---------|
| 7 (atual) | Abstracao + docs + env |
| 7.1 | Prisma ExternalIdentity + callback Google |
| 7.2 | Microsoft Entra + admin UI |
| 7.3 | SSO-only mode + testes E2E |

---

## 10. Arquivos

| Arquivo | Papel |
|---------|-------|
| `lib/auth/auth-provider.types.ts` | Tipos |
| `lib/auth/providers/local.provider.ts` | Email/senha |
| `lib/auth/providers/oidc.provider.ts` | Stub OIDC |
| `lib/auth/index.ts` | Factory |

---

*SSO Plan v1 — Phase 7 foundation.*
