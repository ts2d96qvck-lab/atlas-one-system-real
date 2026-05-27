import { test, expect } from "@playwright/test";
import { API, getTokens } from "./helpers/auth";

test.describe("Production smoke", () => {
  test("health endpoint", async ({ request }) => {
    const res = await request.get(`${API}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("ready endpoint", async ({ request }) => {
    const res = await request.get(`${API}/api/ready`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.checks?.database).toBe(true);
  });

  test("unauthenticated API returns 401", async ({ request }) => {
    const res = await request.get(`${API}/inbox/conversations`);
    expect(res.status()).toBe(401);
  });

  test("authenticated inbox works", async ({ request }) => {
    const token = getTokens().qaAgent!;
    const res = await request.get(`${API}/inbox/conversations`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(res.status()).toBe(200);
  });
});
