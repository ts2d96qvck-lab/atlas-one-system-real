# WhatsApp Providers — Atlas One

Atlas One supports multiple WhatsApp backends through a single provider interface. Each tenant instance (`WhatsAppInstance.provider`) selects which backend handles send/connect for that number.

---

## Supported providers

| Provider | ID | Status | Best for |
|----------|-----|--------|----------|
| Evolution API | `evolution` | Production (current) | PME, QR connect, full inbox today |
| Meta Cloud API | `meta_cloud` | Production (inbound + send) | Enterprise, official API, procurement |

---

## Architecture

```
Inbox / Automations / SMS OTP
        │
        ▼
prepareOutboundInstance()  ──► align DB instance name (Evolution)
        │
        ▼
providerForInstance()  ──► factory by instance.provider
        │
   ┌────┴────┐
   ▼         ▼
Evolution   Meta Cloud
(Baileys)   (Graph API)
```

Code locations:

- Factory: `apps/server/src/services/whatsapp/providers/factory.ts`
- Meta config: `apps/server/src/services/whatsapp/meta-config.ts`
- Meta webhook parser: `apps/server/src/services/whatsapp/meta-webhook.parser.ts`
- Evolution: `apps/server/src/services/whatsapp/providers/evolution.provider.ts`
- Meta: `apps/server/src/services/whatsapp/providers/meta-cloud.provider.ts`
- Shared lib (Evolution client): `packages/lib/src/whatsapp.ts`

---

## Evolution API (default)

### Environment

```env
EVOLUTION_URL=http://localhost:8080
EVOLUTION_API_KEY=your-key
EVOLUTION_DEFAULT_INSTANCE=Atlas one
WHATSAPP_DEFAULT_PROVIDER=evolution
```

### Connect flow

1. Admin → WhatsApp → Add number (`provider: evolution`)
2. Click **Connect** → scan QR in Evolution
3. Webhook auto-sync to `/webhook/evolution/{tenantSlug}`

### Instance name mismatch

If Atlas DB name differs from Evolution (e.g. `atlas-one-comercial` vs `Atlas one`), the system auto-resolves by phone number and merges duplicate DB rows on send.

---

## Meta WhatsApp Cloud API

### Environment

```env
WHATSAPP_DEFAULT_PROVIDER=meta_cloud
META_WHATSAPP_ACCESS_TOKEN=EAA...
META_WHATSAPP_PHONE_NUMBER_ID=1234567890
META_WHATSAPP_BUSINESS_ACCOUNT_ID=optional
META_WHATSAPP_API_VERSION=v22.0
META_WHATSAPP_WEBHOOK_VERIFY_TOKEN=your-verify-token
```

### Setup (Meta Business Manager)

1. Create app at [developers.facebook.com](https://developers.facebook.com)
2. Add WhatsApp product → get **Phone number ID** and **Permanent token**
3. Configure webhook URL: `https://your-domain/webhook/meta`
4. Set verify token = `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN`
5. In Atlas Admin, create instance with `provider: meta_cloud`
6. Set instance `name` or `phone` to the Meta **Phone number ID** (used to route inbound webhooks)

Per-tenant overrides (optional) in `tenant.settings.whatsapp.meta`:

```json
{
  "accessToken": "EAA...",
  "phoneNumberId": "1234567890",
  "businessAccountId": "optional",
  "apiVersion": "v22.0"
}
```

### Inbound webhook (Phase 4.1)

- Parser: `meta-webhook.parser.ts` — messages (text, button, interactive) + delivery statuses
- Handler: `handleMetaCloudWebhook()` — creates conversation, lead, message; updates delivery status
- Instance resolution: match `phone_number_id` from webhook to instance `name` or `phone`

### Limitations

- Text send works when env or tenant settings are configured
- Media send requires public URL (not base64)
- No QR connect (number is registered in Meta)

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/whatsapp/providers` | List providers + config status |
| POST | `/whatsapp/instances` | Create instance (`provider` field) |
| GET | `/webhook/meta` | Meta webhook verification |
| POST | `/webhook/meta` | Meta webhook receiver (messages + statuses) |
| POST | `/webhook/evolution/:tenantSlug` | Evolution events (production) |

---

## Choosing a provider

| Need | Use |
|------|-----|
| Operate today, QR, media, automations | **Evolution** |
| Enterprise RFP, official Meta contract | **Meta Cloud** (configure env + instance) |
| Mixed tenants | Per-instance `provider` in database |

---

## Troubleshooting

### `Evolution API error 404: Not Found` on send

The instance name in Atlas does not exist in Evolution. Fix:

1. Check Evolution: `GET /instance/fetchInstances`
2. Align name in Admin or let auto-resolve run (same phone number)
3. Remove duplicate ghost instances

### Meta: "nao configurada"

Set `META_WHATSAPP_ACCESS_TOKEN` and `META_WHATSAPP_PHONE_NUMBER_ID` and restart API.

---

*Phase 4.1 — Meta inbound webhook + per-tenant config.*
