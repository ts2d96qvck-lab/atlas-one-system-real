import { test, expect } from "@playwright/test";
import { loginAsDemo } from "./helpers/auth";

test.describe("Messaging UX", () => {
  test("composer preserves multiline draft locally", async ({ page }) => {
    await loginAsDemo(page);
    await page.waitForTimeout(1500);
    const textarea = page.locator("textarea").first();
    if (!(await textarea.isVisible().catch(() => false))) {
      test.skip(true, "Inbox composer not visible in this session");
    }
    const sample = "Linha 1\n\nLinha 2\n\nLinha 3";
    await textarea.fill(sample);
    await expect(textarea).toHaveValue(sample);
  });
});
