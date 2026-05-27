export function openApiV1Spec() {
  return {
    openapi: "3.0.3",
    info: {
      title: "Atlas One Public API",
      version: "1.0.0",
      description: "API REST para integrar CRM, conversas e eventos comerciais do Atlas One."
    },
    servers: [{ url: "/v1" }],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "http",
          scheme: "bearer",
          description: "Bearer atlas_live_..."
        }
      }
    },
    security: [{ ApiKeyAuth: [] }],
    paths: {
      "/leads": {
        get: { summary: "Listar leads", tags: ["CRM"] },
        post: { summary: "Criar lead", tags: ["CRM"] }
      },
      "/leads/{id}": {
        patch: { summary: "Atualizar lead (status, dados)", tags: ["CRM"] }
      },
      "/conversations": {
        get: { summary: "Listar conversas", tags: ["Inbox"] }
      },
      "/conversations/{id}": {
        get: { summary: "Detalhe da conversa", tags: ["Inbox"] }
      },
      "/conversations/{id}/messages": {
        get: { summary: "Mensagens da conversa", tags: ["Inbox"] }
      },
      "/events": {
        post: { summary: "Registrar evento comercial", tags: ["Events"] }
      },
      "/export/leads.csv": {
        get: { summary: "Exportar leads CSV", tags: ["Export"] }
      },
      "/export/conversations.csv": {
        get: { summary: "Exportar conversas CSV", tags: ["Export"] }
      },
      "/export/messages.csv": {
        get: { summary: "Exportar mensagens CSV", tags: ["Export"] }
      },
      "/events/catalog": {
        get: { summary: "Catalogo de eventos de webhook", tags: ["Events"] }
      }
    }
  };
}
