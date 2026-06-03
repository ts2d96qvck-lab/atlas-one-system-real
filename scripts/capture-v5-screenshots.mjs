import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(root, "..");
const outDir = path.join(repoRoot, "docs", "qa-visual-v5");
const sessionPath = path.join(repoRoot, ".qa-session.json");

const views = [
  { id: "inbox", label: "Caixa de entrada", file: "v5-desktop-inbox.png" },
  { id: "dashboard", label: "Painel", file: "v5-desktop-dashboard.png" },
  { id: "crm", label: "CRM", file: "v5-desktop-crm.png" },
  { id: "admin", label: "Administração", file: "v5-desktop-admin.png" },
  { id: "campanhas", label: "Campanhas", file: "v5-desktop-campaigns.png" },
  { id: "automacoes", label: "Automações", file: "v5-desktop-automations.png" }
];

function toAppSession(raw) {
  return {
    token: raw.token,
    user: {
      id: raw.user.id,
      tenantId: raw.user.tenantId,
      tenantSlug: raw.user.tenantSlug,
      name: raw.user.name,
      email: raw.user.email,
      role: raw.user.role,
      permissions: raw.user.permissions ?? ["*"]
    }
  };
}

async function main() {
  const raw = JSON.parse(fs.readFileSync(sessionPath, "utf8"));
  const session = toAppSession(raw);
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

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
      if (!res.ok || !body.token) {
        return { ok: false, error: body.error ?? body.message ?? res.status };
      }
      localStorage.setItem(
        key,
        JSON.stringify({
          token: body.token,
          user: body.user
        })
      );
      return { ok: true };
    },
    { key: "atlas-one-session-v2", email: loginEmail, password: loginPassword, tenantSlug: loginTenant }
  );
  if (!loggedIn.ok) {
    throw new Error(`Login failed: ${loggedIn.error ?? "unknown"}`);
  }
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  try {
    await page.waitForFunction(
      () => document.querySelectorAll("button.atlas-nav-item").length >= 4,
      { timeout: 120000 }
    );
  } catch (err) {
    await page.screenshot({ path: path.join(outDir, "v5-debug-after-login.png"), fullPage: true });
    const snippet = await page.locator("body").innerText();
    console.error("Nav not ready. Body snippet:", snippet.slice(0, 500));
    throw err;
  }
  await page.waitForTimeout(1200);

  for (const view of views) {
    const nav = page.locator("button.atlas-nav-item", { hasText: view.label }).first();
    await nav.waitFor({ state: "visible", timeout: 15000 });
    await nav.click();
    await page.waitForTimeout(2000);
    const header = page.locator(".atlas-v5-title, .inbox-v42-title").first();
    await header.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
    await page.screenshot({ path: path.join(outDir, view.file), fullPage: false });
    const bytes = fs.statSync(path.join(outDir, view.file)).size;
    console.log("saved", view.file, bytes);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
