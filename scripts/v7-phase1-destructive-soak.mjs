/**
 * V7 Phase 1 destructive soak — API + socket layer.
 * Usage: node scripts/v7-phase1-destructive-soak.mjs
 */
import { chromium } from "@playwright/test";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { io } = require("../apps/web/node_modules/socket.io-client/dist/socket.io.js");

const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(root, "..");
const outDir = path.join(repoRoot, "docs", "qa-v7-phase1-soak");
const API = process.env.QA_API_URL ?? "http://127.0.0.1:4000";
const WEB = process.env.QA_WEB_URL ?? "http://127.0.0.1:3001";

const results = [];

function record(id, name, pass, detail = "", severity = pass ? "—" : "medium") {
  results.push({ id, name, pass, detail, severity });
  console.log(`${pass ? "PASS" : "FAIL"} | ${id}. ${name}${detail ? ` — ${detail}` : ""}`);
}

async function api(method, path, { token, body, timeoutMs = 45000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = {};
    if (token) headers.authorization = `Bearer ${token}`;
    if (body) headers["content-type"] = "application/json";
    const res = await fetch(`${API}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    return { status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

async function loginFromSession() {
  const sessionPath = path.join(repoRoot, ".qa-session.json");
  const raw = JSON.parse(fs.readFileSync(sessionPath, "utf8"));
  const password = process.env.QA_OWNER_PASSWORD ?? "82468028";
  const res = await api("POST", "/auth/login", {
    body: { email: raw.user.email, password, tenantSlug: raw.user.tenantSlug ?? "atlas-one" }
  });
  if (!res.json?.token) throw new Error(`Login failed: ${JSON.stringify(res.json)}`);
  return { token: res.json.token, user: res.json.user };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const { token, user } = await loginFromSession();

  const inbox = await api("GET", "/inbox/conversations?bucket=active", { token });
  const conversations = Array.isArray(inbox.json) ? inbox.json : [];
  if (!conversations.length) {
    console.error("No conversations for soak tests");
    process.exit(1);
  }
  const convId = conversations[0].id;

  // T1: Idempotency — parallel same clientMessageId
  const idemKey = `soak-idem-${Date.now()}`;
  const marker = `v7-soak-idem-${Date.now()}`;
  const [r1, r2] = await Promise.all([
    api("POST", `/inbox/conversations/${convId}/messages`, {
      token,
      body: { text: marker, clientMessageId: idemKey }
    }),
    api("POST", `/inbox/conversations/${convId}/messages`, {
      token,
      body: { text: marker, clientMessageId: idemKey }
    })
  ]);
  const id1 = r1.json?.id;
  const id2 = r2.json?.id;
  const sameId = id1 && id2 && id1 === id2;
  record(
    "T1",
    "Parallel duplicate clientMessageId (idempotency)",
    sameId && (r1.status === 201 || r1.status === 200) && (r2.status === 201 || r2.status === 200),
    sameId
      ? `single message ${id1}, statuses ${r1.json?.status}/${r2.json?.status}`
      : `ids ${id1} vs ${id2}, HTTP ${r1.status}/${r2.status}, err=${r1.json?.error ?? r2.json?.error ?? "n/a"}`,
    sameId ? "—" : "critical"
  );

  // T1b: No duplicate DB rows for parallel key
  const threadAfterIdem = await api("GET", `/inbox/conversations/${convId}`, { token });
  const idemRows = (threadAfterIdem.json?.messages ?? []).filter((m) => m.clientMessageId === idemKey);
  record(
    "T1b",
    "Parallel idempotency — single DB row per clientMessageId",
    idemRows.length <= 1,
    `rows=${idemRows.length}`,
    idemRows.length <= 1 ? "—" : "critical"
  );

  // T2: Sequential retry same key after terminal state
  await sleep(500);
  const r3 = await api("POST", `/inbox/conversations/${convId}/messages`, {
    token,
    body: { text: marker, clientMessageId: idemKey }
  });
  record(
    "T2",
    "Sequential retry same clientMessageId after send",
    r3.json?.id === id1,
    `returned ${r3.json?.id}, status ${r3.json?.status}`,
    r3.json?.id === id1 ? "—" : "critical"
  );

  // T3: DB-first — message persisted with status field (not 400 on provider path)
  const dbKey = `soak-db-${Date.now()}`;
  const sendRes = await api("POST", `/inbox/conversations/${convId}/messages`, {
    token,
    body: { text: `v7-soak-db-${Date.now()}`, clientMessageId: dbKey }
  });
  const hasId = Boolean(sendRes.json?.id);
  const hasStatus = typeof sendRes.json?.status === "string";
  const not400 = sendRes.status !== 400;
  record(
    "T3",
    "DB-first send returns persisted message (201 + id + status)",
    hasId && hasStatus && not400,
    `HTTP ${sendRes.status}, status=${sendRes.json?.status}, delivery=${sendRes.json?.raw?.deliveryStatus ?? "n/a"}`,
    hasId && not400 ? "—" : "critical"
  );

  // T4: Rapid different keys (duplicate risk audit)
  const rapidKeys = [0, 1, 2].map((i) => `soak-rapid-${Date.now()}-${i}`);
  const rapid = await Promise.all(
    rapidKeys.map((k, i) =>
      api("POST", `/inbox/conversations/${convId}/messages`, {
        token,
        body: { text: `v7-soak-rapid-${Date.now()}-${i}`, clientMessageId: k }
      })
    )
  );
  const rapidIds = new Set(rapid.map((r) => r.json?.id).filter(Boolean));
  record(
    "T4",
    "Rapid sends with distinct clientMessageIds (3 messages created)",
    rapidIds.size === 3,
    `unique ids=${rapidIds.size} (expected 3 distinct WhatsApp sends if provider OK)`,
    "—"
  );

  // T5: Failed send explainability — empty text should 400 before provider
  const bad = await api("POST", `/inbox/conversations/${convId}/messages`, {
    token,
    body: { text: "", clientMessageId: `soak-empty-${Date.now()}` }
  });
  record("T5", "Invalid send rejected before provider", bad.status === 400, `HTTP ${bad.status}`, "—");

  // T6: Socket join + realtime emit after reconnect storm
  let socketMsgs = 0;
  try {
    await new Promise((resolve, reject) => {
      const socket = io(API, {
        auth: { token },
        transports: ["websocket"],
        reconnection: true,
        reconnectionDelay: 400,
        reconnectionAttempts: 5
      });
      const timeout = setTimeout(() => {
        socket.disconnect();
        reject(new Error("socket test timeout"));
      }, 18000);
      const doJoin = () => socket.emit("join", { tenantId: user.tenantId });
      socket.on("connect", doJoin);
      socket.on("inbox:message", () => {
        socketMsgs += 1;
      });
      socket.io.on("reconnect", doJoin);

      (async () => {
        await sleep(800);
        for (let i = 0; i < 3; i += 1) {
          socket.disconnect();
          await sleep(350);
          socket.connect();
          await sleep(600);
        }
        doJoin();
        await sleep(400);
        await api("POST", `/inbox/conversations/${convId}/messages`, {
          token,
          body: { text: `v7-soak-socket-${Date.now()}`, clientMessageId: `soak-sock-${Date.now()}` }
        });
        await sleep(1500);
        clearTimeout(timeout);
        socket.disconnect();
        resolve(null);
      })().catch(reject);
    });
    record(
      "T6",
      "Socket disconnect/reconnect receives inbox:message",
      socketMsgs >= 1,
      `events=${socketMsgs}`,
      socketMsgs >= 1 ? "—" : "high"
    );
  } catch (e) {
    record("T6", "Socket disconnect/reconnect receives inbox:message", false, String(e.message), "high");
  }

  // T7: CRM pipeline failure visibility (API)
  const crmOk = await api("GET", "/crm/pipeline", { token });
  const crmBad = await api("GET", "/crm/pipeline", { token: "invalid-token" });
  record(
    "T7",
    "CRM pipeline auth failure is explicit (401)",
    crmOk.status === 200 && crmBad.status === 401,
    `ok=${crmOk.status} bad=${crmBad.status}`,
    crmBad.status === 401 ? "—" : "medium"
  );

  // T8: Provider failure explainability (Evolution down → failed + reason)
  const providerFail = sendRes.json?.status === "failed" && sendRes.json?.raw?.failureReason;
  record(
    "T8-api",
    "Provider failure persisted with failureReason (no silent drop)",
    Boolean(providerFail),
    providerFail ? String(sendRes.json.raw.failureReason).slice(0, 80) : `status=${sendRes.json?.status}`,
    providerFail ? "—" : "high"
  );

  // T8+: Playwright — refresh, multi-tab, CRM UI
  const browser = await chromium.launch({ headless: true });
  const rawSession = JSON.parse(fs.readFileSync(path.join(repoRoot, ".qa-session.json"), "utf8"));
  try {
    const ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const ctxB = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    async function loginPage(page) {
      await page.goto(WEB, { waitUntil: "domcontentloaded", timeout: 120000 });
      const password = process.env.QA_OWNER_PASSWORD ?? "82468028";
      const tenantSlug = rawSession.user.tenantSlug ?? "atlas-one";
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
        { key: "atlas-one-session-v2", email: rawSession.user.email, password, tenantSlug }
      );
      if (!ok.ok) throw new Error(`Login failed: ${ok.error}`);
      await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForFunction(() => document.querySelectorAll("button.atlas-nav-item").length >= 4, {
        timeout: 120000
      });
      await page.waitForTimeout(1500);
      await page.locator("button.atlas-nav-item", { hasText: "Caixa de entrada" }).first().click();
      await page.waitForTimeout(1500);
    }

    await loginPage(pageA);
    await loginPage(pageB);

    const row = pageA.locator(".inbox-v42-row button").first();
    if (await row.count()) {
      await row.click();
      await pageA.waitForTimeout(1200);
    }

    const composer = pageA.locator(".inbox-v43-composer-input").first();
    const pwMarker = `v7-soak-pw-${Date.now()}`;
    await composer.fill(pwMarker);
    await pageA.locator(".inbox-v43-composer-send").first().click();
    await pageA.waitForTimeout(2500);

    const bubbleA = pageA.locator(".inbox-v43-bubble-out", { hasText: pwMarker }).first();
    const visibleA = await bubbleA.count() ? await bubbleA.isVisible() : false;
    const statusA = visibleA
      ? await bubbleA.locator(".inbox-v43-bubble-status").first().innerText().catch(() => "")
      : "";

    await pageA.reload({ waitUntil: "domcontentloaded" });
    await pageA.waitForTimeout(3000);
    await pageA.locator("button.atlas-nav-item", { hasText: "Caixa de entrada" }).first().click();
    if (await row.count()) await row.click();
    await pageA.waitForTimeout(1500);
    const bubbleAfterRefresh = pageA.locator(".inbox-v43-bubble-out", { hasText: pwMarker }).first();
    record(
      "T8",
      "Browser refresh preserves sent message in thread",
      (await bubbleAfterRefresh.count()) > 0,
      `after refresh count=${await bubbleAfterRefresh.count()}`,
      (await bubbleAfterRefresh.count()) > 0 ? "—" : "high"
    );

    await pageB.reload({ waitUntil: "domcontentloaded" });
    await pageB.waitForTimeout(2500);
    await pageB.locator("button.atlas-nav-item", { hasText: "Caixa de entrada" }).first().click();
    await pageB.waitForTimeout(1500);
    const queuePreview = pageB.locator(".inbox-v42-row", { hasText: pwMarker }).first();
    record(
      "T9",
      "Second tab queue shows sent message preview (multi-tab sync)",
      (await queuePreview.count()) > 0,
      `row match=${await queuePreview.count()}`,
      (await queuePreview.count()) > 0 ? "—" : "medium"
    );

    record(
      "T10",
      "Send shows status label in bubble (user understands state)",
      visibleA && statusA.length > 0,
      `status="${statusA}"`,
      visibleA && statusA ? "—" : "medium"
    );

    // CRM UI failure banner (route abort)
    await pageA.route("**/crm/pipeline**", (route) => route.abort("failed"));
    await pageA.locator("button.atlas-nav-item", { hasText: "CRM" }).first().click();
    await pageA.waitForTimeout(2000);
    const crmBanner = pageA.locator('[role="alert"]', { hasText: "Não foi possível carregar o funil" }).first();
    const crmBannerText = (await crmBanner.count()) ? await crmBanner.innerText().catch(() => "") : "";
    record(
      "T11",
      "CRM pipeline load failure shows visible banner",
      crmBannerText.length > 10,
      crmBannerText.slice(0, 80) || "no banner",
      crmBannerText ? "—" : "medium"
    );

    await ctxA.close();
    await ctxB.close();
  } catch (e) {
    record("T8-ui", "Playwright destructive UI block", false, String(e.message), "high");
  } finally {
    await browser.close();
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);
  const report = {
    at: new Date().toISOString(),
    api: API,
    web: WEB,
    passed,
    failed: failed.length,
    results
  };
  fs.writeFileSync(path.join(outDir, "destructive-soak-results.json"), JSON.stringify(report, null, 2));
  console.log(`\n--- SOAK SUMMARY ---\nPASS: ${passed}  FAIL: ${failed.length}  TOTAL: ${results.length}`);
  if (failed.length) {
    console.log("\nFailures:");
    for (const f of failed) console.log(`  [${f.severity}] ${f.id} ${f.name}: ${f.detail}`);
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error("Soak fatal:", err);
  process.exit(2);
});
