import { test, expect } from "@playwright/test";
import { API, getTokens } from "./helpers/auth";

test.describe("RBAC API", () => {
  test("agent cannot access admin users", async ({ request }) => {
    const token = getTokens().qaAgent!;
    const res = await request.get(`${API}/admin/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(res.status()).toBe(403);
  });

  test("admin can access billing overview", async ({ request }) => {
    const token = getTokens().qaAdmin!;
    const res = await request.get(`${API}/admin/billing/overview`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.plan.id).toBe("pro");
  });

  test("supervisor can access SLA ops", async ({ request }) => {
    const token = getTokens().qaSupervisor!;
    const res = await request.get(`${API}/ops/sla`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(res.status()).toBe(200);
  });
});
