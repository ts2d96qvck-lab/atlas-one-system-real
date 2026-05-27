import { test, expect } from "@playwright/test";
import { API, getTokens } from "./helpers/auth";

test.describe("Auth API", () => {
  test("invalid login returns 401", async ({ request }) => {
    const res = await request.post(`${API}/auth/login`, {
      data: { email: "bad@test.com", password: "wrong", tenantSlug: "atlas-one" }
    });
    expect(res.status()).toBe(401);
  });

  test("valid demo agent login returns token", async () => {
    const { demoAgent } = getTokens();
    expect(demoAgent).toBeTruthy();
  });

  test("logout revokes session", async ({ request }) => {
    const res = await request.post(`${API}/auth/login`, {
      data: { email: "demo@atlasone.com.br", password: "Atlas2026!", tenantSlug: "atlas-one" }
    });
    expect(res.status()).toBe(200);
    const { token } = await res.json();
    await request.post(`${API}/auth/logout`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const me = await request.get(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(me.status()).toBe(401);
  });
});
