/**
 * Captures Atlas AI V1.1 UI screenshots (requires web on :3001 and valid .qa-session.json).
 * Usage: pnpm --filter @atlas-one/web start  (port 3001) then node scripts/capture-v11-ai-screenshots.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(root, "..");
const outDir = path.join(repoRoot, "docs", "qa-visual-v11");
const sessionPath = path.join(repoRoot, ".qa-session.json");

async function login(page, session) {
  const loginEmail = session.user.email;
  const loginPassword = process.env.QA_OWNER_PASSWORD ?? "82468028";
  const loginTenant = session.user.tenantSlug ?? "atlas-one";
  await page.goto("http://127.0.0.1:3001/", { waitUntil: "domcontentloaded", timeout: 60000 });
  const loggedIn = await page.evaluate(
    async ({ key, email, password, tenantSlug }) => {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, tenantSlug })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.token) return { ok: false, error: body.error ?? res.status };
      localStorage.setItem(key, JSON.stringify({ token: body.token, user: body.user }));
      return { ok: true };
    },
    { key: "atlas-one-session-v2", email: loginEmail, password: loginPassword, tenantSlug: loginTenant }
  );
  if (!loggedIn.ok) throw new Error(`Login failed: ${loggedIn.error ?? "unknown"}`);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(
    () => document.querySelectorAll("button.atlas-nav-item").length >= 4,
    { timeout: 120000 }
  );
}

async function clickNav(page, viewId) {
  await page.click(`button.atlas-nav-item[data-view="${viewId}"]`, { timeout: 30000 });
  await page.waitForTimeout(800);
}

async function main() {
  if (!fs.existsSync(sessionPath)) {
    console.error("Missing .qa-session.json — run QA login first.");
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(sessionPath, "utf8"));
  const session = { token: raw.token, user: raw.user };
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await login(page, session);

  await clickNav(page, "inbox");
  const conv = page.locator('[data-testid="conversation-row"], .atlas-conversation-row, tr').first();
  if (await conv.count()) {
    await conv.click();
    await page.waitForTimeout(600);
  }
  const aiTab = page.getByRole("button", { name: /Atlas AI|AI/i }).first();
  if (await aiTab.count()) await aiTab.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, "v11-inbox-ai-panel.png"), fullPage: false });

  const tonePill = page.locator(".atlas-ai-pill").first();
  if (await tonePill.count()) {
    await page.screenshot({ path: path.join(outDir, "v11-inbox-tone-selector.png"), fullPage: false });
  }

  await clickNav(page, "crm");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, "v11-crm-ai-card.png"), fullPage: false });

  await clickNav(page, "campanhas");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, "v11-campaigns-ai.png"), fullPage: false });

  await clickNav(page, "dashboard");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, "v11-dashboard-ask-atlas.png"), fullPage: false });

  await browser.close();
  console.log("Screenshots saved to", outDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
