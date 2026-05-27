#!/usr/bin/env node
/**
 * Bateria completa de QA — smoke + billing + docker + playwright + API extended
 * Usage: node scripts/run-full-qa.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const results = [];

function run(name, cmd, args = []) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", shell: true, timeout: 300_000 });
  const ok = r.status === 0;
  results.push({ name, ok, exit: r.status, tail: (r.stdout + r.stderr).slice(-800) });
  return ok;
}

async function waitHealth() {
  for (let i = 0; i < 30; i++) {
    try {
      const h = await fetch("http://localhost:4000/api/health");
      const w = await fetch("http://localhost:3001/landing");
      if (h.ok && w.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

console.log("Waiting for API + Web...");
const ready = await waitHealth();
results.push({ name: "Services ready", ok: ready, exit: ready ? 0 : 1 });

run("API smoke", "node", ["scripts/run-qa-api-smoke.mjs"]);
run("Billing smoke", "node", ["scripts/run-billing-smoke.mjs"]);
run("Docker validate", "node", ["scripts/validate-docker-compose.mjs"]);
run("Playwright E2E", "npx", ["playwright", "test"]);

// Extended API checks
const API = "http://localhost:4000";
let extOk = true;
try {
  const login = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@test.atlasone.local",
      password: "AtlasQA!2026Secure",
      tenantSlug: "atlas-test-customer"
    })
  });
  const { token } = await login.json();
  if (!token) throw new Error("no token");
  const checks = [
    ["GET /admin/teams", await fetch(`${API}/admin/teams`, { headers: { Authorization: `Bearer ${token}` } })],
    ["GET /admin/integrations/api-keys", await fetch(`${API}/admin/integrations/api-keys`, { headers: { Authorization: `Bearer ${token}` } })],
    ["GET /ops/export/leads.csv", await fetch(`${API}/ops/export/leads.csv`, { headers: { Authorization: `Bearer ${token}` } })]
  ];
  for (const [label, res] of checks) {
    if (!res.ok) {
      extOk = false;
      results.push({ name: label, ok: false, exit: res.status });
    } else {
      results.push({ name: label, ok: true, exit: 0 });
    }
  }
} catch (e) {
  extOk = false;
  results.push({ name: "Extended API", ok: false, error: String(e) });
}

const failed = results.filter((r) => !r.ok).length;
const summary = { failed, total: results.length, results };
console.log(JSON.stringify(summary, null, 2));
process.exit(failed > 0 ? 1 : 0);
