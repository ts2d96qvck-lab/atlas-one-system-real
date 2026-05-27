import { test, expect } from "@playwright/test";
import { API, getTokens } from "./helpers/auth";

/**
 * First customer flow — API-level validation of onboarding path.
 * UI signup and WhatsApp live send remain external/manual.
 */
test.describe("First customer flow (API)", () => {
  test("pricing and legal pages reachable", async ({ page }) => {
    for (const path of ["/pricing", "/terms", "/privacy"]) {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
    }
  });

  test("QA tenant billing is Pro plan", async ({ request }) => {
    const token = getTokens().qaAdmin!;
    const res = await request.get(`${API}/admin/billing/overview`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.plan.id).toBe("pro");
    expect(body.seats.limit).toBeGreaterThanOrEqual(10);
  });

  test("admin can list users (team onboarded)", async ({ request }) => {
    const token = getTokens().qaAdmin!;
    const res = await request.get(`${API}/admin/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(res.status()).toBe(200);
    const users = await res.json();
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThanOrEqual(5);
    const roles = users.map((u: { role: string }) => u.role);
    expect(roles).toContain("owner");
    expect(roles).toContain("agent");
  });

  test("agent has inbox conversations", async ({ request }) => {
    const token = getTokens().qaAgent!;
    const res = await request.get(`${API}/inbox/conversations`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(res.status()).toBe(200);
    const convs = await res.json();
    expect(convs.length).toBeGreaterThan(0);
  });

  test("supervisor can view SLA report", async ({ request }) => {
    const token = getTokens().qaSupervisor!;
    const res = await request.get(`${API}/ops/sla`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(res.status()).toBe(200);
  });

  test("agent blocked from billing (RBAC)", async ({ request }) => {
    const token = getTokens().qaAgent!;
    const res = await request.get(`${API}/admin/billing/overview`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(res.status()).toBe(403);
  });
});
