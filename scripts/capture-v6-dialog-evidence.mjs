import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(root, "..");
const outDir = path.join(repoRoot, "docs", "qa-visual-v6", "phase1");
const sessionPath = path.join(repoRoot, ".qa-session.json");

async function main() {
  const raw = JSON.parse(fs.readFileSync(sessionPath, "utf8"));
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto("http://127.0.0.1:3001/", { waitUntil: "domcontentloaded", timeout: 90000 });
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
    {
      key: "atlas-one-session-v2",
      email: raw.user.email,
      password: process.env.QA_OWNER_PASSWORD ?? "82468028",
      tenantSlug: raw.user.tenantSlug ?? "atlas-one"
    }
  );
  if (!loggedIn.ok) throw new Error(`Login failed: ${loggedIn.error}`);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => document.querySelectorAll("button.atlas-nav-item").length >= 4, { timeout: 120000 });

  // Confirm dialog evidence: automations delete
  await page.locator("button.atlas-nav-item", { hasText: "Automações" }).first().click();
  await page.waitForTimeout(2000);
  const deleteBtn = page.locator('button[aria-label="Excluir automação"]').first();
  if (await deleteBtn.count()) {
    await deleteBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outDir, "evidence-confirm-dialog.png") });
    console.log("saved evidence-confirm-dialog.png");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  } else {
    console.log("no automation rows; skipped confirm evidence");
  }

  // Toast evidence: toggle an automation (pausada/ativa toast)
  const toggleBtn = page.locator("button", { has: page.locator("text=/^(Ativa|Pausada)$/") }).first();
  if (await toggleBtn.count()) {
    await toggleBtn.click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(outDir, "evidence-toast.png") });
    console.log("saved evidence-toast.png");
    // restore original state
    await page.locator("button", { has: page.locator("text=/^(Ativa|Pausada)$/") }).first().click();
    await page.waitForTimeout(600);
  } else {
    console.log("no toggle; skipped toast evidence");
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
