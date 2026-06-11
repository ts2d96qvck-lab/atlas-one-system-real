import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(root, "..");
const outDir = path.join(repoRoot, "docs", "qa-visual-v6", "phase5");
const sessionPath = path.join(repoRoot, ".qa-session.json");

async function login(page, raw) {
  const loginPassword = process.env.QA_OWNER_PASSWORD ?? "82468028";
  const loginTenant = raw.user.tenantSlug ?? "atlas-one";
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
      password: loginPassword,
      tenantSlug: loginTenant
    }
  );
  if (!loggedIn.ok) throw new Error(`Login failed: ${loggedIn.error}`);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => document.querySelectorAll("button.atlas-nav-item").length >= 4, { timeout: 120000 });
  await page.waitForTimeout(1200);
}

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log("saved", `${name}.png`, fs.statSync(file).size);
}

async function main() {
  const raw = JSON.parse(fs.readFileSync(sessionPath, "utf8"));
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://127.0.0.1:3001/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await login(page, raw);

  // Confirm dialog
  await page.locator("button.atlas-nav-item", { hasText: "Automações" }).first().click();
  await page.waitForTimeout(1500);
  const deleteBtn = page.locator('button[aria-label="Excluir automação"]').first();
  if (await deleteBtn.count()) {
    await deleteBtn.click();
    await page.waitForTimeout(500);
    await shot(page, "evidence-confirm-dialog-light");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  // Toast
  const toggleBtn = page.locator("button", { has: page.locator("text=/^(Ativa|Pausada)$/") }).first();
  if (await toggleBtn.count()) {
    await toggleBtn.click();
    await page.waitForTimeout(800);
    await shot(page, "evidence-toast-light");
    await toggleBtn.click();
    await page.waitForTimeout(400);
  }

  // Inbox empty thread (desktop) — pick CRM with empty column feel via search nonsense
  await page.locator("button.atlas-nav-item", { hasText: "Caixa de entrada" }).first().click();
  await page.waitForTimeout(800);
  const search = page.locator(".inbox-v42-search");
  if (await search.count()) {
    await search.fill("__atlas_qa_empty__");
    await page.waitForTimeout(600);
    await shot(page, "evidence-inbox-empty-queue-light");
    await search.fill("");
  }

  // CRM board
  await page.locator("button.atlas-nav-item", { hasText: "CRM" }).first().click();
  await page.waitForTimeout(1500);
  await shot(page, "evidence-crm-populated-light");

  // Dashboard warning banner is hard to force; capture populated dashboard
  await page.locator("button.atlas-nav-item", { hasText: "Painel" }).first().click();
  await page.waitForTimeout(1500);
  await shot(page, "evidence-dashboard-populated-light");

  // Dark mode samples
  await page.evaluate(() => {
    localStorage.setItem("atlas-theme", "dark");
    document.documentElement.classList.add("dark");
  });
  await page.waitForTimeout(500);
  await page.locator("button.atlas-nav-item", { hasText: "Caixa de entrada" }).first().click();
  await page.waitForTimeout(1000);
  await shot(page, "evidence-inbox-populated-dark");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(700);
  await shot(page, "evidence-inbox-mobile-dark");

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
