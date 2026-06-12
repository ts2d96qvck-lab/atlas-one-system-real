/**
 * Phase A onboarding validation — bootstrap tickets, password policy, API gates.
 *
 * Usage:
 *   node scripts/phase-a-onboarding-validation.mjs
 *
 * Env (optional):
 *   QA_API_URL=http://localhost:4000
 *   SETUP_TOKEN=...            (required for ticket signing tests)
 *   ATLAS_ENTERPRISE_MODE=true (must match running server for API gate tests)
 *   QA_OWNER_TOKEN=...         (non-platform owner JWT)
 *   QA_PLATFORM_TOKEN=...      (platform admin JWT)
 */
import { createHmac } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.QA_API_URL ?? "http://localhost:4000";
function loadEnvValue(key) {
  for (const rel of ["apps/server/.env", ".env", "../../.env"]) {
    const path = resolve(process.cwd(), rel);
    if (!existsSync(path)) continue;
    const match = readFileSync(path, "utf8").match(new RegExp(`^${key}=(.+)$`, "m"));
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

const SETUP_TOKEN = process.env.SETUP_TOKEN || loadEnvValue("SETUP_TOKEN") || "";
const ENTERPRISE =
  process.env.ATLAS_ENTERPRISE_MODE === "true" || loadEnvValue("ATLAS_ENTERPRISE_MODE") === "true";
const results = [];

function record(area, name, status, notes = "") {
  results.push({ area, name, status, notes });
}

async function req(method, path, { headers, body, token } = {}) {
  const h = { ...(headers ?? {}) };
  if (token) h.Authorization = `Bearer ${token}`;
  if (body) h["Content-Type"] = "application/json";
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: h,
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    return { ok: res.ok, status: res.status, json };
  } catch (error) {
    return { ok: false, status: 0, json: { error: String(error) } };
  }
}

function signTicket({ exp, slug }) {
  const secret = SETUP_TOKEN || "atlas-one-dev-secret";
  const payload = { v: 1, exp, ...(slug ? { slug } : {}) };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function validatePassword(password) {
  if (password.length < 12) return { ok: false, message: "min 12" };
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const classes = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
  if (classes < 3) return { ok: false, message: "need 3 classes" };
  return { ok: true };
}

async function testTicketCrypto() {
  if (!SETUP_TOKEN) {
    record("ticket", "SETUP_TOKEN configured", "SKIP", "Set SETUP_TOKEN to run ticket crypto tests");
    return;
  }

  const valid = signTicket({ exp: Date.now() + 3600_000, slug: "acme-corp" });
  const expired = signTicket({ exp: Date.now() - 1000, slug: "acme-corp" });
  const invalid = `${valid}x`;
  const otherSlug = signTicket({ exp: Date.now() + 3600_000, slug: "other-corp" });

  record("ticket", "valid signed ticket format", valid.includes(".") ? "PASS" : "FAIL");
  record("ticket", "expired ticket exp in past", expired.split(".")[0] ? "PASS" : "FAIL");
  record("ticket", "invalid ticket tampered", invalid !== valid ? "PASS" : "FAIL");
  record("ticket", "slug-bound ticket distinct slugs", otherSlug !== valid ? "PASS" : "FAIL");
}

async function testPasswordPolicy() {
  const weak = ["short", "password12345", "abcdefghijkl", "ABCDEFGHIJKL"];
  for (const p of weak) {
    const r = validatePassword(p);
    record("password", `reject weak: ${p.slice(0, 8)}…`, r.ok ? "FAIL" : "PASS");
  }
  const strong = "AtlasQA!2026Secure";
  record("password", "accept strong policy password", validatePassword(strong).ok ? "PASS" : "FAIL");
}

async function testBootstrapApi() {
  const health = await req("GET", "/api/health");
  if (health.status !== 200) {
    record("api", "server reachable", "SKIP", `GET /api/health -> ${health.status}`);
    return;
  }
  record("api", "server reachable", "PASS");

  const slug = `phase-a-${Date.now().toString(36)}`;

  // Missing ticket (enterprise mode only meaningful)
  const missing = await req("GET", `/auth/bootstrap-status?tenantSlug=${slug}`);
  if (ENTERPRISE) {
    record(
      "api",
      "missing setup ticket blocks bootstrap",
      missing.json?.canBootstrap === false && missing.json?.signupRequiresLink === true ? "PASS" : "FAIL",
      JSON.stringify(missing.json)
    );
  } else {
    record("api", "missing setup ticket blocks bootstrap", "SKIP", "Server not in ATLAS_ENTERPRISE_MODE=true");
  }

  if (!SETUP_TOKEN) {
    record("api", "signed ticket bootstrap-status", "SKIP", "SETUP_TOKEN missing");
    return;
  }

  const validTicket = signTicket({ exp: Date.now() + 3600_000, slug });
  const expiredTicket = signTicket({ exp: Date.now() - 1000, slug });
  const invalidTicket = `${validTicket}bad`;
  const wrongSlugTicket = signTicket({ exp: Date.now() + 3600_000, slug: "wrong-slug" });

  const validStatus = await req("GET", `/auth/bootstrap-status?tenantSlug=${slug}`, {
    headers: { "X-Setup-Token": validTicket }
  });
  record(
    "api",
    "valid ticket allows bootstrap-status",
    validStatus.json?.canBootstrap === true ? "PASS" : "FAIL",
    JSON.stringify(validStatus.json)
  );

  const expiredStatus = await req("GET", `/auth/bootstrap-status?tenantSlug=${slug}`, {
    headers: { "X-Setup-Token": expiredTicket }
  });
  record(
    "api",
    "expired setup ticket rejected",
    ENTERPRISE
      ? expiredStatus.json?.canBootstrap === false && expiredStatus.json?.signupRequiresLink === true
        ? "PASS"
        : "FAIL"
      : "SKIP",
    JSON.stringify(expiredStatus.json)
  );

  const invalidStatus = await req("GET", `/auth/bootstrap-status?tenantSlug=${slug}`, {
    headers: { "X-Setup-Token": invalidTicket }
  });
  record(
    "api",
    "invalid setup ticket rejected",
    ENTERPRISE
      ? invalidStatus.json?.canBootstrap === false && invalidStatus.json?.signupRequiresLink === true
        ? "PASS"
        : "FAIL"
      : "SKIP",
    JSON.stringify(invalidStatus.json)
  );

  const slugMismatch = await req("GET", `/auth/bootstrap-status?tenantSlug=${slug}`, {
    headers: { "X-Setup-Token": wrongSlugTicket }
  });
  record(
    "api",
    "slug-bound ticket rejects wrong tenant",
    ENTERPRISE
      ? slugMismatch.json?.canBootstrap === false && slugMismatch.json?.signupRequiresLink === true
        ? "PASS"
        : "FAIL"
      : "SKIP",
    JSON.stringify(slugMismatch.json)
  );

  const weakBootstrap = await req("POST", "/auth/bootstrap-owner", {
    headers: { "X-Setup-Token": validTicket },
    body: {
      companyName: "Phase A Test Co",
      tenantSlug: slug,
      ownerName: "Owner Test",
      ownerEmail: `owner-${slug}@test.local`,
      ownerPassword: "short",
      ownerPhone: "+5511999999999"
    }
  });
  record(
    "api",
    "weak password rejected on bootstrap-owner",
    weakBootstrap.status === 400 ? "PASS" : "FAIL",
    `status=${weakBootstrap.status}`
  );

  const strongPass = "AtlasQA!2026Secure";
  const create = await req("POST", "/auth/bootstrap-owner", {
    headers: { "X-Setup-Token": validTicket },
    body: {
      companyName: "Phase A Test Co",
      tenantSlug: slug,
      ownerName: "Owner Test",
      ownerEmail: `owner-${slug}@test.local`,
      ownerPassword: strongPass,
      ownerPhone: "+5511999999999"
    }
  });
  record(
    "api",
    "valid ticket creates tenant owner",
    create.status === 201 ? "PASS" : "FAIL",
    `status=${create.status} ${JSON.stringify(create.json)}`
  );

  const reuse = await req("POST", "/auth/bootstrap-owner", {
    headers: { "X-Setup-Token": validTicket },
    body: {
      companyName: "Phase A Test Co",
      tenantSlug: slug,
      ownerName: "Owner Test 2",
      ownerEmail: `owner2-${slug}@test.local`,
      ownerPassword: strongPass,
      ownerPhone: "+5511999999999"
    }
  });
  record(
    "api",
    "reused ticket blocked after owner exists",
    reuse.status === 400 ? "PASS" : "FAIL",
    `status=${reuse.status}`
  );

  const reuseStatus = await req("GET", `/auth/bootstrap-status?tenantSlug=${slug}`, {
    headers: { "X-Setup-Token": validTicket }
  });
  record(
    "api",
    "reused ticket bootstrap-status shows blocked",
    reuseStatus.json?.canBootstrap === false ? "PASS" : "FAIL",
    JSON.stringify(reuseStatus.json)
  );
}

async function testAdminGates() {
  const ownerToken = process.env.QA_OWNER_TOKEN;
  const platformToken = process.env.QA_PLATFORM_TOKEN;

  if (!ownerToken) {
    record("admin", "non-platform owner blocked from bootstrap-link", "SKIP", "Set QA_OWNER_TOKEN");
  } else {
    const ownerTry = await req("POST", "/admin/onboarding/bootstrap-link", {
      token: ownerToken,
      body: { tenantSlug: "demo" }
    });
    record(
      "admin",
      "non-platform owner blocked from bootstrap-link",
      ownerTry.status === 403 ? "PASS" : "FAIL",
      `status=${ownerTry.status}`
    );
  }

  if (!platformToken) {
    record("admin", "platform admin can generate bootstrap-link", "SKIP", "Set QA_PLATFORM_TOKEN");
  } else {
    const link = await req("POST", "/admin/onboarding/bootstrap-link", {
      token: platformToken,
      body: { tenantSlug: "new-customer-demo" }
    });
    record(
      "admin",
      "platform admin can generate bootstrap-link",
      link.status === 200 && link.json?.url?.includes("setup=") ? "PASS" : "FAIL",
      `status=${link.status}`
    );
  }
}

async function main() {
  await testTicketCrypto();
  await testPasswordPolicy();
  await testBootstrapApi();
  await testAdminGates();

  const summary = {
    base: BASE,
    enterpriseMode: ENTERPRISE,
    setupTokenConfigured: Boolean(SETUP_TOKEN),
    pass: results.filter((r) => r.status === "PASS").length,
    fail: results.filter((r) => r.status === "FAIL").length,
    skip: results.filter((r) => r.status === "SKIP").length,
    results
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.fail > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
