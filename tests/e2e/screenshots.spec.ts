import { test, expect } from "@playwright/test";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");
const PAGES = [
  { path: "/landing", heading: /Operacao comercial premium/i },
  { path: "/apresentacao", heading: /WhatsApp \+ CRM/i },
  { path: "/pricing", heading: /Planos Atlas One/i }
];

test.describe("Screenshots comerciais", () => {
  for (const { path, heading } of PAGES) {
    test(`screenshot ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible({ timeout: 15_000 });
      await page.screenshot({
        path: resolve(root, `docs/screenshots/screenshots${path.replace(/\//g, "-") || "-root"}.png`),
        fullPage: true
      });
    });
  }
});
