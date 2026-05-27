import { test, expect } from "@playwright/test";

test.describe("Mobile public pages", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("landing page mobile", async ({ page }) => {
    await page.goto("/landing");
    await expect(page.getByRole("heading", { name: /Operacao comercial premium/i })).toBeVisible();
  });

  test("pricing page mobile", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { name: /Planos Atlas One/i })).toBeVisible();
  });

  test("login shell mobile", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
  });
});
