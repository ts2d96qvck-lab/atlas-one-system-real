import { test, expect } from "@playwright/test";
import { API, getTokens } from "./helpers/auth";

test.describe("Seat limits", () => {
  test("blocks user creation when plan seat limit reached", async ({ request }) => {
    const token = getTokens().qaAdmin!;
    const overview = await request.get(`${API}/admin/billing/overview`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const billing = await overview.json();
    const limit = billing.seats.limit as number;
    const used = billing.seats.used as number;
    const remaining = Math.max(0, limit - used);

    if (remaining > 0) {
      for (let i = 0; i < remaining; i++) {
        const res = await request.post(`${API}/admin/users`, {
          headers: { Authorization: `Bearer ${token}` },
          data: {
            name: `Seat Fill ${i}`,
            email: `seat-fill-${Date.now()}-${i}@test.atlasone.local`,
            password: "AtlasQA!2026Secure",
            role: "admin"
          }
        });
        expect(res.status(), `user ${i + 1}/${remaining}`).toBe(201);
      }
    }

    const blocked = await request.post(`${API}/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: "Over Limit User",
        email: `over-limit-${Date.now()}@test.atlasone.local`,
        password: "AtlasQA!2026Secure",
        role: "admin"
      }
    });
    expect(blocked.status()).toBe(400);
    const body = await blocked.json();
    expect(JSON.stringify(body)).toMatch(/Limite de usuarios|limite/i);
  });
});
