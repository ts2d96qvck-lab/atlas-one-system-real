import { test, expect } from "@playwright/test";

test.describe("Public pages", () => {
  test("app login shell loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByText(/Atlas One|Entrar|Login/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("status page loads", async ({ page }) => {
    await page.goto("/status");
    await expect(page.getByText(/Status|operacional|degraded/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("pricing page loads", async ({ page }) => {
    const res = await page.goto("/pricing");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /Planos Atlas One/i })).toBeVisible();
  });

  test("terms page loads", async ({ page }) => {
    const res = await page.goto("/terms");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /Termos de uso/i })).toBeVisible();
  });

  test("privacy page loads", async ({ page }) => {
    const res = await page.goto("/privacy");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /Politica de privacidade/i })).toBeVisible();
  });

  test("landing page loads", async ({ page }) => {
    const res = await page.goto("/landing");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /Operacao comercial premium/i })).toBeVisible();
  });
});
