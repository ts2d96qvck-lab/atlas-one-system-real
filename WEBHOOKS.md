# Atlas One — Webhooks de Saida

Webhooks configuraveis por tenant para notificar sistemas externos sobre eventos do Atlas One.

---

## Configuracao

**Admin → Integracoes → Webhooks de saida**

1. Informe URL HTTPS do seu endpoint
2. Selecione os eventos desejados
3. Copie o **secret** exibido na criacao (usado para validar assinatura)

---

## Eventos disponiveis

| Evento | Quando dispara |
|--------|----------------|
| `conversation.created` | Nova conversa (WhatsApp ou manual) |
| `conversation.closed` | Conversa fechada/resolvida |
| `message.created` | Nova mensagem (entrada ou saida) |
| `lead.created` | Lead criado |
| `lead.updated` | Lead atualizado |
| `deal.won` | Status contem "fechado" |
| `deal.lost` | Status contem "perdido" |
| `commercial.event` | Evento via API `POST /v1/events` |

Use `*` na lista de eventos para receber todos (via API admin).

---

## Formato da entrega

**POST** para a URL configurada.

Headers:

| Header | Valor |
|--------|-------|
| `Content-Type` | `application/json` |
| `User-Agent` | `Atlas-One-Webhooks/1.0` |
| `X-Atlas-Event` | Nome do evento |
| `X-Atlas-Delivery-Id` | ID unico da entrega |
| `X-Atlas-Timestamp` | Unix timestamp (segundos) |
| `X-Atlas-Signature` | `sha256=<hmac>` |

Body:

```json
{
  "id": "delivery-id",
  "event": "lead.created",
  "createdAt": "2026-05-25T18:00:00.000Z",
  "data": {
    "id": "...",
    "company": "Acme",
    "contact": "Maria",
    "phone": "5511999999999",
    "status": "Novos leads"
  }
}
```

---

## Validacao de assinatura

```javascript
const crypto = require("crypto");

function verifyAtlasSignature(secret, rawBody, timestamp, signatureHeader) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const received = signatureHeader.replace("sha256=", "");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}
```

Responda **2xx** em ate 15 segundos para confirmar recebimento.

---

## Retentativas

| Tentativa | Intervalo |
|-----------|-----------|
| 1 | Imediata |
| 2 | +1 min |
| 3 | +5 min |
| 4 | +15 min |
| 5 | +60 min |

Apos 5 falhas, status = `failed`. Entregas ficam visiveis em **Admin → Integracoes → Entregas recentes**.

Worker de retry roda a cada 60 segundos no servidor.

---

## Logs

Cada entrega gera registro em `WebhookDelivery`:

- status: `pending`, `success`, `failed`
- attempts, lastError, responseStatus
- payload completo do evento

---

## Zapier / Make

1. Crie um webhook Catch Hook no Zapier/Make
2. Cole a URL no Atlas One
3. Selecione eventos (`lead.created`, `message.created`, etc.)
4. Valide assinatura HMAC no Code step (opcional)

---

## Arquivos

| Area | Caminho |
|------|---------|
| Dispatcher | `apps/server/src/services/integrations/webhook-dispatcher.service.ts` |
| Endpoints admin | `apps/server/src/services/integrations/webhook-endpoint.service.ts` |
| Emissao de eventos | `apps/server/src/services/integrations/integration-events.service.ts` |

---

*Phase 6 — webhooks configuraveis por tenant.*
