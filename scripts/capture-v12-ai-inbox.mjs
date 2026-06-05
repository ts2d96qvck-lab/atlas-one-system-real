/**
 * Atlas AI V1.2 inbox hub screenshots (web on :3001 + .qa-session.json).
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(root, "..");
const outDir = path.join(repoRoot, "docs", "qa-visual-v12");
const sessionPath = path.join(repoRoot, ".qa-session.json");

async function main() {
  if (!fs.existsSync(sessionPath)) {
    console.error("Missing .qa-session.json");
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(sessionPath, "utf8"));
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const email = raw.user.email;
  const tenantSlug = raw.user.tenantSlug ?? "atlas-one";
  const password = process.env.QA_OWNER_PASSWORD ?? "82468028";

  await page.goto("http://127.0.0.1:3001/", { waitUntil: "domcontentloaded" });
  await page.evaluate(
    async ({ email, password, tenantSlug }) => {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, tenantSlug })
      });
      const body = await res.json();
      localStorage.setItem("atlas-one-session-v2", JSON.stringify({ token: body.token, user: body.user }));
    },
    { email, password, tenantSlug }
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelectorAll("button.atlas-nav-item").length >= 4, { timeout: 120000 });

  await page.click('button.atlas-nav-item[data-view="inbox"]');
  await page.waitForTimeout(600);
  const row = page.locator("tr, [class*='conversation']").first();
  if (await row.count()) await row.click();
  await page.waitForTimeout(400);

  const aiTab = page.getByRole("button", { name: /Atlas AI/i });
  if (await aiTab.count()) await aiTab.click();
  await page.waitForTimeout(500);

  await page.screenshot({ path: path.join(outDir, "v12-inbox-ai-hub.png"), fullPage: false });

  const card = page.locator(".atlas-ai-hub-card").first();
  if (await card.count()) {
    await card.locator("button").last().click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, "v12-inbox-action-cards.png"), fullPage: false });
  }

  await browser.close();
  console.log("Saved to", outDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
