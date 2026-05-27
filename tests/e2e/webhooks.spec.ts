import { test, expect } from "@playwright/test";
import { API, getTokens } from "./helpers/auth";

test.describe("Outbound webhooks", () => {
  test("conversation.created triggers delivery record", async ({ request }) => {
    const adminToken = getTokens().qaAdmin!;
    const agentToken = getTokens().qaAgent!;

    const hookRes = await request.post(`${API}/admin/integrations/webhooks`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        name: "QA webhook test",
        url: "https://httpbin.org/post",
        events: ["conversation.created"]
      }
    });
    expect(hookRes.status()).toBe(201);
    const hook = await hookRes.json();

    const convRes = await request.post(`${API}/inbox/conversations`, {
      headers: { Authorization: `Bearer ${agentToken}` },
      data: {
        customerName: "Webhook QA Lead",
        customerPhone: `5511999${String(Date.now()).slice(-6)}`,
        priority: "normal",
        tags: []
      }
    });
    expect(convRes.status()).toBe(201);

    await new Promise((r) => setTimeout(r, 3000));

    const deliveries = await request.get(`${API}/admin/integrations/webhooks/deliveries?limit=20`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(deliveries.status()).toBe(200);
    const items = await deliveries.json();
    expect(Array.isArray(items)).toBe(true);
    const match = items.find(
      (d: { endpointId?: string; event?: string }) =>
        d.endpointId === hook.id && d.event === "conversation.created"
    );
    expect(match, "delivery record for conversation.created").toBeTruthy();

    await request.delete(`${API}/admin/integrations/webhooks/${hook.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
  });
});
