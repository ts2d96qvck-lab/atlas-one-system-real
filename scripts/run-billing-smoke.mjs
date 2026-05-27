/**
 * Billing smoke — subscription webhook + optional Asaas checkout probe.
 * Usage: node scripts/run-billing-smoke.mjs
 */
const BASE = process.env.QA_API_URL ?? "http://localhost:4000";

async function req(method, path, { token, body, headers } = {}) {
  const h = { ...(headers ?? {}) };
  if (token) h.Authorization = `Bearer ${token}`;
  if (body) h["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
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
  const r = await req("POST", "/auth/login", { body: { email, password, tenantSlug } });
  if (r.json?.token) return r.json.token;
  throw new Error(`Login failed: ${JSON.stringify(r.json)}`);
}

const results = [];
function record(name, status, notes = "") {
  results.push({ name, status, notes });
}

async function main() {
  const subSecret = process.env.PAYMENTS_WEBHOOK_SECRET ?? "";
  const sub = await req("POST", "/payments/webhook/subscription", {
    body: {
      tenantSlug: "atlas-test-customer",
      plan: "pro",
      status: "active",
      externalId: `qa-smoke-${Date.now()}`
    },
    headers: subSecret ? { "x-webhook-secret": subSecret } : {}
  });
  record("Subscription webhook", sub.status === 200 ? "PASS" : "FAIL", String(sub.status));

  let adminToken;
  try {
    adminToken = await login("admin@test.atlasone.local", "AtlasQA!2026Secure", "atlas-test-customer");
  } catch (e) {
    record("Admin login", "FAIL", String(e));
    console.log(JSON.stringify({ results }, null, 2));
    process.exit(1);
  }

  const overview = await req("GET", "/admin/billing/overview", { token: adminToken });
  record(
    "Billing overview pro",
    overview.status === 200 && overview.json?.plan?.id === "pro" ? "PASS" : "FAIL",
    overview.json?.plan?.id
  );

  const checkout = await req("POST", "/admin/billing/checkout", {
    token: adminToken,
    body: { plan: "starter" }
  });
  if (checkout.status === 200 && checkout.json?.configured === false) {
    record("Asaas checkout", "EXT", checkout.json?.message ?? "ASAAS_API_KEY missing");
  } else if (checkout.status === 200 && checkout.json?.checkoutUrl) {
    record("Asaas checkout", "PASS", "checkoutUrl returned");
  } else {
    record("Asaas checkout", checkout.status === 200 ? "PARTIAL" : "FAIL", JSON.stringify(checkout.json).slice(0, 120));
  }

  const asaasMock = await req("POST", "/payments/webhook/asaas", {
    body: {
      event: "PAYMENT_RECEIVED",
      subscription: { externalReference: "atlas-test-customer:pro", status: "ACTIVE" }
    }
  });
  record("Asaas webhook mock", asaasMock.status === 200 ? "PASS" : "PARTIAL", String(asaasMock.status));

  console.log(JSON.stringify({ base: BASE, results }, null, 2));
  const failed = results.filter((r) => r.status === "FAIL").length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
