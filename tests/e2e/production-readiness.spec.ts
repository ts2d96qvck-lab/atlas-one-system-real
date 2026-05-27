import { test, expect } from "@playwright/test";

const API = process.env.QA_API_URL ?? "http://localhost:4000";

test.describe("Production readiness smoke", () => {
  test("API health returns ok", async ({ request }) => {
    const res = await request.get(`${API}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("API ready returns structured checks", async ({ request }) => {
    const res = await request.get(`${API}/api/ready`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.checks.database).toBe(true);
  });

  test("Unauthenticated API returns 401", async ({ request }) => {
    const res = await request.get(`${API}/inbox/conversations`);
    expect(res.status()).toBe(401);
  });
});
