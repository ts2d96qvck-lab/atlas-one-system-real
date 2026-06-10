import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(root, "..");
const phase = process.argv[2] ?? "baseline";
const outDir = path.join(repoRoot, "docs", "qa-visual-v6", phase);
const sessionPath = path.join(repoRoot, ".qa-session.json");

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const views = [
  { id: "inbox", label: "Caixa de entrada", slug: "inbox" },
  { id: "dashboard", label: "Painel", slug: "dashboard" },
  { id: "crm", label: "CRM", slug: "crm" },
  { id: "admin", label: "Administração", slug: "admin" },
  { id: "campanhas", label: "Campanhas", slug: "campaigns" },
  { id: "automacoes", label: "Automações", slug: "automations" }
];

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    localStorage.setItem("atlas-theme", t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, theme);
  await page.waitForTimeout(400);
}

async function navTo(page, label) {
  const nav = page.locator("button.atlas-nav-item", { hasText: label }).first();
  await nav.waitFor({ state: "visible", timeout: 15000 });
  await nav.click();
  await page.waitForTimeout(1800);
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
  const page = await browser.newPage({ viewport: DESKTOP });

  const loginEmail = raw.user.email;
  const loginPassword = process.env.QA_OWNER_PASSWORD ?? "82468028";
  const loginTenant = raw.user.tenantSlug ?? "atlas-one";

  await page.goto("http://127.0.0.1:3001/", { waitUntil: "domcontentloaded", timeout: 90000 });
  const loggedIn = await page.evaluate(
    async ({ key, email, password, tenantSlug }) => {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, tenantSlug })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.token) {
        return { ok: false, error: body.error ?? body.message ?? res.status };
      }
      localStorage.setItem(key, JSON.stringify({ token: body.token, user: body.user }));
      return { ok: true };
    },
    { key: "atlas-one-session-v2", email: loginEmail, password: loginPassword, tenantSlug: loginTenant }
  );
  if (!loggedIn.ok) throw new Error(`Login failed: ${loggedIn.error ?? "unknown"}`);

  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => document.querySelectorAll("button.atlas-nav-item").length >= 4, {
    timeout: 120000
  });
  await page.waitForTimeout(1500);

  for (const theme of ["light", "dark"]) {
    await setTheme(page, theme);
    for (const view of views) {
      await page.setViewportSize(DESKTOP);
      await navTo(page, view.label);
      await shot(page, `${view.slug}-desktop-${theme}`);
      if (theme === "light") {
        await page.setViewportSize(MOBILE);
        await page.waitForTimeout(900);
        await shot(page, `${view.slug}-mobile-${theme}`);
        await page.setViewportSize(DESKTOP);
        await page.waitForTimeout(600);
      }
    }
  }

  // Mobile inbox with a conversation open (light)
  await setTheme(page, "light");
  await page.setViewportSize(DESKTOP);
  await navTo(page, "Caixa de entrada");
  await page.setViewportSize(MOBILE);
  await page.waitForTimeout(900);
  const firstConversation = page.locator(".inbox-v43-queue-item, [data-conversation-id], .inbox-v42-row").first();
  if (await firstConversation.count()) {
    await firstConversation.click().catch(() => {});
    await page.waitForTimeout(1500);
    await shot(page, "inbox-mobile-conversation-light");
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
