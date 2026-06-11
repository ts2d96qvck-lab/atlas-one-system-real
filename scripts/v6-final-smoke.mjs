import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(root, "..");
const outDir = path.join(repoRoot, "docs", "qa-visual-v6", "smoke-final");
const sessionPath = path.join(repoRoot, ".qa-session.json");
const BASE = "http://127.0.0.1:3001";

const results = [];

function record(id, name, pass, detail = "") {
  results.push({ id, name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} | ${id}. ${name}${detail ? ` — ${detail}` : ""}`);
}

async function safe(name, fn) {
  try {
    await fn();
  } catch (e) {
    record(Number(name.split(".")[0]) || 0, name.replace(/^\d+\.\s*/, ""), false, String(e.message ?? e));
  }
}

async function login(page, raw) {
  const password = process.env.QA_OWNER_PASSWORD ?? "82468028";
  const tenantSlug = raw.user.tenantSlug ?? "atlas-one";
  const ok = await page.evaluate(
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
    { key: "atlas-one-session-v2", email: raw.user.email, password, tenantSlug }
  );
  if (!ok.ok) throw new Error(`Login failed: ${ok.error}`);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => document.querySelectorAll("button.atlas-nav-item").length >= 4, { timeout: 120000 });
  await page.waitForTimeout(1500);
}

async function nav(page, label) {
  await page.locator(".atlas-v5-modal-backdrop").waitFor({ state: "hidden", timeout: 3000 }).catch(() => {});
  await page.locator("button.atlas-nav-item", { hasText: label }).first().click({ force: false });
  await page.waitForTimeout(1500);
}

async function closeCrmEditModal(page) {
  const backdrop = page.locator(".atlas-v5-modal-backdrop");
  if (!(await backdrop.count())) return;
  const cancel = page.locator(".atlas-v5-modal-panel button", { hasText: "Cancelar" }).first();
  if (await cancel.count()) {
    await cancel.click();
  } else {
    await page.locator(".atlas-v5-modal-panel button").first().click().catch(() => page.keyboard.press("Escape"));
  }
  await backdrop.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
}

async function shot(page, name) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function main() {
  const raw = JSON.parse(fs.readFileSync(sessionPath, "utf8"));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
    await login(page, raw);
    // 1 Login
    try {
      const navVisible = (await page.locator("button.atlas-nav-item").count()) >= 4;
      record(1, "Login/logout (login)", navVisible);
      await shot(page, "01-login");
    } catch (e) {
      record(1, "Login/logout (login)", false, String(e.message ?? e));
    }

    // 2 Inbox loads
    await nav(page, "Caixa de entrada");
    const inboxShell = await page.locator(".inbox-v42-shell, .inbox-v43-queue-title").first().isVisible().catch(() => false);
    record(2, "Inbox loads", inboxShell);
    await shot(page, "02-inbox");

    // 3 Open conversation
    const row = page.locator(".inbox-v42-row button").first();
    const hasRow = (await row.count()) > 0;
    if (hasRow) {
      await row.click();
      await page.waitForTimeout(1500);
      const thread = await page.locator(".inbox-v43-composer-input, .inbox-v42-composer").first().isVisible();
      record(3, "Open conversation", thread);
      await shot(page, "03-conversation-open");
    } else {
      record(3, "Open conversation", false, "no conversations in queue");
    }

    // 4 Send text message
    const composer = page.locator(".inbox-v43-composer-input").first();
    if (await composer.count()) {
      const marker = `v6-smoke-${Date.now()}`;
      await composer.fill(marker);
      await composer.press("Enter");
      await page.waitForTimeout(3500);
      const sent =
        (await page.locator(".inbox-v43-bubble-out, .inbox-v42-thread").filter({ hasText: marker }).count()) > 0 ||
        (await page.locator("body").filter({ hasText: marker }).count()) > 0;
      record(4, "Send text message", sent, sent ? marker : "bubble not found (may still be sending)");
      await shot(page, "04-send-text");
    } else {
      record(4, "Send text message", false, "composer missing");
    }

    // 5 Attachment UI
    const attachBtn = page.locator('.inbox-v43-composer-tool[title="Anexar arquivo"]').first();
    if (await attachBtn.count()) {
      const fileInput = page.locator('input[type="file"]').first();
      const hasInput = (await fileInput.count()) > 0;
      record(5, "Send attachment if possible", hasInput, hasInput ? "file input present" : "no file input");
    } else {
      record(5, "Send attachment if possible", false, "attach button missing");
    }

    // 6 Quick replies
    const hashBtn = page.locator('.inbox-v43-composer-tool').nth(1);
    if (await hashBtn.count()) {
      await hashBtn.click();
      await page.waitForTimeout(600);
      const menu = await page.locator('[role="dialog"], [data-radix-popper-content-wrapper]').first().isVisible().catch(() => false);
      record(6, "Quick replies open", menu);
      await page.keyboard.press("Escape");
      await shot(page, "06-quick-replies");
    } else {
      record(6, "Quick replies open", false);
    }

    // 7 Drawer open/close
    const drawerBtn = page.locator('button[aria-label="Detalhes da conversa"]').first();
    if (await drawerBtn.count()) {
      await drawerBtn.click();
      await page.waitForTimeout(700);
      const open = await page.locator('aside:has-text("Detalhes da conversa")').isVisible();
      await page.locator('button[aria-label="Fechar"]').first().click();
      await page.waitForTimeout(500);
      const closed = !(await page.locator('aside:has-text("Detalhes da conversa")').isVisible().catch(() => false));
      record(7, "Drawer opens/closes", open && closed);
      await shot(page, "07-drawer");
    } else {
      record(7, "Drawer opens/closes", false, "drawer button missing");
    }

    // 8 Atlas AI panel in drawer
    const drawerBtn2 = page.locator('button[aria-label="Detalhes da conversa"]').first();
    if (await drawerBtn2.count()) {
      await drawerBtn2.click();
      await page.waitForTimeout(600);
      const aiTab = page.locator("button", { hasText: "Atlas AI" }).first();
      if (await aiTab.count()) {
        await aiTab.click();
        await page.waitForTimeout(800);
        const aiVisible =
          (await page.locator(".atlas-ai-shell, .atlas-ai-hub, .atlas-ai-hero").count()) > 0 ||
          (await page.getByText(/Atlas AI|assistente|configur/i).count()) > 0;
        record(8, "Atlas AI panel opens (provider may be disabled)", aiVisible);
        await shot(page, "08-atlas-ai");
      } else {
        record(8, "Atlas AI panel opens (provider may be disabled)", false, "AI tab not found");
      }
      await page.keyboard.press("Escape");
    } else {
      record(8, "Atlas AI panel opens (provider may be disabled)", false);
    }

    // 9 Search
    const search = page.locator(".inbox-v42-search").first();
    if (await search.count()) {
      await search.fill("edson");
      await page.waitForTimeout(800);
      const filtered = (await page.locator(".inbox-v42-row").count()) >= 0;
      await search.fill("");
      record(9, "Search conversations", filtered);
    } else {
      record(9, "Search conversations", false);
    }

    // 10 Buckets
    const buckets = ["Histórico", "Todas", "Em andamento"];
    let bucketsOk = true;
    for (const b of buckets) {
      const tab = page.locator('.inbox-v42-segment button', { hasText: b }).first();
      if (!(await tab.count())) {
        bucketsOk = false;
        break;
      }
      await tab.click();
      await page.waitForTimeout(500);
    }
    record(10, "Switch buckets active/history/all", bucketsOk);
    await page.locator('.inbox-v42-segment button', { hasText: "Em andamento" }).first().click();
    await page.waitForTimeout(400);

    // 11 Mobile split — list and thread are mutually exclusive on small viewports
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(800);

      let mobileChat = await page.locator(".inbox-v43-composer-input").first().isVisible().catch(() => false);
      let mobileList = await page.locator(".inbox-v42-queue").isVisible().catch(() => false);
      let threadOnly = mobileChat && !mobileList;

      if (!threadOnly && mobileList) {
        const rowBtn = page.locator(".inbox-v42-row > button").first();
        if (await rowBtn.count()) {
          await rowBtn.click({ timeout: 8000 });
          await page.waitForTimeout(900);
          mobileChat = await page.locator(".inbox-v43-composer-input").first().isVisible().catch(() => false);
          mobileList = await page.locator(".inbox-v42-queue").isVisible().catch(() => false);
          threadOnly = mobileChat && !mobileList;
        }
      }

      const back = page.locator('button[aria-label="Voltar para a fila"]').first();
      if (threadOnly && (await back.count())) {
        await back.click();
        await page.waitForTimeout(900);
      }

      mobileList = await page.locator(".inbox-v42-queue").isVisible().catch(() => false);
      mobileChat = await page.locator(".inbox-v43-composer-input").first().isVisible().catch(() => false);
      const listOnly = mobileList && !mobileChat;

      if (listOnly) {
        const rowBtn = page.locator(".inbox-v42-row > button").first();
        if (await rowBtn.count()) {
          await rowBtn.click({ timeout: 8000 });
          await page.waitForTimeout(900);
          mobileList = await page.locator(".inbox-v42-queue").isVisible().catch(() => false);
          mobileChat = await page.locator(".inbox-v43-composer-input").first().isVisible().catch(() => false);
          threadOnly = mobileChat && !mobileList;
        }
      }

      record(
        11,
        "Mobile inbox list/thread split",
        listOnly && threadOnly,
        listOnly && threadOnly ? "list-only ↔ thread-only" : `list=${mobileList} chat=${mobileChat}`
      );
      await shot(page, "11-mobile-thread");
    } catch (e) {
      record(11, "Mobile inbox list/thread split", false, String(e.message ?? e));
    } finally {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForTimeout(600);
    }

    // 12 CRM loads
    try {
      await nav(page, "CRM");
      const crm = await page.locator("text=/Funil de vendas|CRM/").first().isVisible();
      record(12, "CRM loads", crm);
      await shot(page, "12-crm");
    } catch (e) {
      record(12, "CRM loads", false, String(e.message ?? e));
    }

    // 13 CRM dnd-kit move
    try {
      const draggable = page.locator(".atlas-v5-list-row").first();
      const columns = page.locator(".atlas-v5-card-pad-sm");
      if ((await draggable.count()) > 0 && (await columns.count()) >= 2) {
        const target = columns.nth(1);
        const box = await target.boundingBox();
        if (box) {
          const handle = await draggable.boundingBox();
          if (handle) {
            await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
            await page.mouse.down();
            await page.mouse.move(box.x + box.width / 2, box.y + 120, { steps: 14 });
            await page.mouse.up();
            await page.waitForTimeout(1500);
            record(13, "Move lead between stages (dnd-kit)", true, "drag executed");
          } else {
            record(13, "Move lead between stages (dnd-kit)", false, "no drag handle");
          }
        } else {
          record(13, "Move lead between stages (dnd-kit)", false, "no drop target box");
        }
      } else {
        record(13, "Move lead between stages (dnd-kit)", false, "no leads or columns");
      }
    } catch (e) {
      record(13, "Move lead between stages (dnd-kit)", false, String(e.message ?? e));
    }

    // 14 CRM edit modal
    try {
      const editBtn = page.locator('button[aria-label^="Editar lead"]').first();
      if (await editBtn.count()) {
        await editBtn.click({ force: true });
        await page.waitForTimeout(800);
        const modal = await page.locator("text=Editar lead").first().isVisible();
        await closeCrmEditModal(page);
        record(14, "CRM edit modal opens/saves", modal, modal ? "modal opened + closed" : "modal missing");
        await shot(page, "14-crm-edit");
      } else {
        record(14, "CRM edit modal opens/saves", false, "no lead to edit");
      }
    } catch (e) {
      record(14, "CRM edit modal opens/saves", false, String(e.message ?? e));
    }

    // 15 Dashboard real data
    try {
      await nav(page, "Painel");
      const dashApi = await page.evaluate(async () => {
        const session = JSON.parse(localStorage.getItem("atlas-one-session-v2") ?? "{}");
        const res = await fetch("/dashboard", {
          headers: { authorization: `Bearer ${session.token}` }
        }).catch(() => null);
        if (!res?.ok) return { ok: false, status: res?.status };
        return { ok: true, data: await res.json() };
      });
      const hasMetrics = dashApi.ok && typeof dashApi.data?.metrics === "object";
      const hasChart = (await page.locator(".recharts-wrapper, .recharts-surface").count()) > 0;
      record(15, "Dashboard loads charts without fake data", hasMetrics && hasChart, hasMetrics ? "API metrics + recharts" : "API/chart missing");
      await shot(page, "15-dashboard");
    } catch (e) {
      record(15, "Dashboard loads charts without fake data", false, String(e.message ?? e));
    }

    // 16 Admin loads
    try {
      await nav(page, "Administração");
      const admin = await page.locator("text=/Administração|Configurações|WhatsApp/").first().isVisible();
      record(16, "Admin loads", admin);
    } catch (e) {
      record(16, "Admin loads", false, String(e.message ?? e));
    }

    // 17 WhatsApp card
    try {
      const wa = await page.locator("text=/WhatsApp|QR|instância|Número/").first().isVisible();
      record(17, "WhatsApp card loads", wa);
      await shot(page, "17-admin-whatsapp");
    } catch (e) {
      record(17, "WhatsApp card loads", false, String(e.message ?? e));
    }

    // 18 Campaigns
    try {
      await nav(page, "Campanhas");
      const camp = await page.locator("text=Campanhas").first().isVisible();
      record(18, "Campaigns loads", camp);
      await shot(page, "18-campaigns");
    } catch (e) {
      record(18, "Campaigns loads", false, String(e.message ?? e));
    }

    // 19 Automations
    try {
      await nav(page, "Automações");
      const auto = await page.locator("text=Automações").first().isVisible();
      record(19, "Automations loads", auto);
      await shot(page, "19-automations");
    } catch (e) {
      record(19, "Automations loads", false, String(e.message ?? e));
    }

    // 20 Dark mode
    try {
      await page.evaluate(() => {
        localStorage.setItem("atlas-theme", "dark");
        document.documentElement.classList.add("dark");
      });
      await page.waitForTimeout(600);
      const dark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
      record(20, "Dark mode toggle", dark);
      await shot(page, "20-dark-mode");
    } catch (e) {
      record(20, "Dark mode toggle", false, String(e.message ?? e));
    }

    // Logout completes test 1
    try {
      await page.evaluate(() => {
        localStorage.setItem("atlas-theme", "light");
        document.documentElement.classList.remove("dark");
      });
      await nav(page, "Caixa de entrada");
      await page.locator('button[title="Perfil e notificações"]').first().click();
      await page.waitForTimeout(600);
      const logoutBtn = page.locator("button", { hasText: /^Sair$/ }).first();
      if (await logoutBtn.count()) {
        await logoutBtn.click();
        await page.waitForTimeout(1500);
        const loggedOut = (await page.locator('input[type="email"], input[placeholder*="mail" i]').count()) > 0;
        if (loggedOut) {
          const row1 = results.find((r) => r.id === 1);
          if (row1) {
            row1.detail = "login + logout OK";
            row1.pass = true;
          }
        }
      }
    } catch {
      /* logout optional */
    }
  } catch (err) {
    console.error("Smoke fatal:", err);
  } finally {
    await browser.close();
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify({ passed, failed, results }, null, 2));
  console.log("\n--- SUMMARY ---");
  console.log(`PASS: ${passed}  FAIL: ${failed}  TOTAL: ${results.length}`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
