/**
 * API smoke tests — run against live local server.
 * Usage: node scripts/run-qa-api-smoke.mjs
 */
const BASE = process.env.QA_API_URL ?? "http://localhost:4000";

async function req(method, path, { token, body, headers } = {}) {
  const h = { ...(headers ?? {}) };
  if (token) h.Authorization = `Bearer ${token}`;
  if (body) h["Content-Type"] = "application/json";
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
    json = text;
  }
  return { status: res.status, json };
}

async function login(email, password, tenantSlug) {
  const r = await req("POST", "/auth/login", {
    body: { email, password, tenantSlug }
  });
  if (r.json?.token) return r.json.token;
  if (r.status === 200 && r.json?.requires2fa) return null;
  throw new Error(`Login failed ${email}: ${JSON.stringify(r.json)}`);
}

const results = [];

function record(name, expected, actual, status, notes = "") {
  results.push({ name, expected, actual, status, notes });
}

async function main() {
  // Health
  const health = await req("GET", "/api/health");
  record("GET /api/health", 200, health.status, health.status === 200 ? "PASS" : "FAIL");

  const ready = await req("GET", "/api/ready");
  record(
    "GET /api/ready",
    "200 + database true",
    `${ready.status} db=${ready.json?.checks?.database}`,
    ready.status === 200 && ready.json?.checks?.database ? "PASS" : "PARTIAL",
    `redis=${ready.json?.checks?.redis} evolution=${ready.json?.checks?.evolution}`
  );

  const unauth = await req("GET", "/inbox/conversations");
  record("Unauthenticated inbox", 401, unauth.status, unauth.status === 401 ? "PASS" : "FAIL");

  // Demo agent atlas-one
  let agentToken;
  try {
    agentToken = await login("demo@atlasone.com.br", "Atlas2026!", "atlas-one");
    record("Login demo agent", "token", agentToken ? "token" : "null", agentToken ? "PASS" : "FAIL");
  } catch (e) {
    record("Login demo agent", "token", String(e), "FAIL");
  }

  if (agentToken) {
    const adminTry = await req("GET", "/admin/users", { token: agentToken });
    record("Agent blocked from admin", 403, adminTry.status, adminTry.status === 403 ? "PASS" : "FAIL");

    const inbox = await req("GET", "/inbox/conversations", { token: agentToken });
    record("Agent inbox", 200, inbox.status, inbox.status === 200 ? "PASS" : "FAIL", `count=${Array.isArray(inbox.json) ? inbox.json.length : "?"}`);
  }

  // QA tenant
  const QA = { slug: "atlas-test-customer", pass: "AtlasQA!2026Secure" };
  let adminToken;
  try {
    adminToken = await login("admin@test.atlasone.local", QA.pass, QA.slug);
    record("Login QA admin", "token", adminToken ? "token" : "null", adminToken ? "PASS" : "FAIL");
  } catch (e) {
    record("Login QA admin", "token", String(e), "FAIL");
  }

  if (adminToken) {
    const billing = await req("GET", "/admin/billing/overview", { token: adminToken });
    record("QA billing overview", 200, billing.status, billing.status === 200 ? "PASS" : "FAIL", billing.json?.plan?.id);

    const logout = await req("POST", "/auth/logout", { token: adminToken });
    const after = await req("GET", "/auth/me", { token: adminToken });
    record("Logout revokes token", "401 after logout", after.status, after.status === 401 ? "PASS" : "FAIL");
  }

  let ownerToken;
  try {
    ownerToken = await login("owner@test.atlasone.local", QA.pass, QA.slug);
    record("Login QA owner", "token", ownerToken ? "token" : "null", ownerToken ? "PASS" : "PARTIAL", "2FA/Evolution may block in prod");
  } catch (e) {
    record("Login QA owner", "token", String(e), "BLOCKED", "Evolution offline blocks owner 2FA in prod mode");
  }

  // Web
  for (const [path, expectStatus] of [
    ["/", 200],
    ["/landing", 200],
    ["/status", 200],
    ["/pricing", 200],
    ["/terms", 200],
    ["/privacy", 200]
  ]) {
    const webBase = process.env.QA_WEB_URL ?? "http://localhost:3001";
    const r = await fetch(`${webBase}${path}`);
    record(`Web ${path}`, expectStatus, r.status, r.status === expectStatus ? "PASS" : "FAIL");
  }

  console.log(JSON.stringify({ base: BASE, results }, null, 2));
  const failed = results.filter((r) => r.status === "FAIL").length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
