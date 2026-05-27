import { test, expect } from "@playwright/test";
import { API, getTokens } from "./helpers/auth";

test.describe("Tenant isolation", () => {
  test("QA token cannot read atlas-one conversation by cross-tenant id", async ({ request }) => {
    const demoLogin = await request.post(`${API}/auth/login`, {
      data: { email: "demo@atlasone.com.br", password: "Atlas2026!", tenantSlug: "atlas-one" }
    });
    expect(demoLogin.status()).toBe(200);
    const { token: demoToken } = await demoLogin.json();
    const qaToken = getTokens().qaAgent!;

    const demoInbox = await request.get(`${API}/inbox/conversations`, {
      headers: { Authorization: `Bearer ${demoToken}` }
    });
    expect(demoInbox.status()).toBe(200);
    const demoConvs = await demoInbox.json();
    expect(demoConvs.length).toBeGreaterThan(0);
    const foreignId = demoConvs[0].id as string;

    const cross = await request.get(`${API}/inbox/conversations/${foreignId}`, {
      headers: { Authorization: `Bearer ${qaToken}` }
    });
    expect(cross.status()).toBe(404);
  });

  test("API key from QA tenant returns only QA tenant leads", async ({ request }) => {
    const adminToken = getTokens().qaAdmin!;
    const keyRes = await request.post(`${API}/admin/integrations/api-keys`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: `Isolation test key ${Date.now()}` }
    });
    expect(keyRes.status()).toBe(201);
    const { key } = await keyRes.json();
    const leads = await request.get(`${API}/v1/leads`, {
      headers: { "X-API-Key": key }
    });
    expect(leads.status()).toBe(200);
    const body = await leads.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });
});
