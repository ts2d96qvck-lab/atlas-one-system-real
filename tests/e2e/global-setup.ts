import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const API = process.env.QA_API_URL ?? "http://localhost:4000";
const TOKEN_FILE = resolve(process.cwd(), ".qa-tokens.json");

type TokenCache = {
  demoAgent?: string;
  qaAgent?: string;
  qaAdmin?: string;
  qaSupervisor?: string;
};

async function login(email: string, password: string, tenantSlug: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, tenantSlug })
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Login ${email} failed: ${res.status} ${JSON.stringify(body)}`);
  if (body.requires2fa) throw new Error(`Login ${email} requires 2FA`);
  if (!body.token) throw new Error(`Login ${email} missing token`);
  return body.token as string;
}

export default async function globalSetup() {
  const cache: TokenCache = {};
  cache.demoAgent = await login("demo@atlasone.com.br", "Atlas2026!", "atlas-one");
  const qaPass = "AtlasQA!2026Secure";
  const qaSlug = "atlas-test-customer";
  cache.qaAgent = await login("agent1@test.atlasone.local", qaPass, qaSlug);
  cache.qaAdmin = await login("admin@test.atlasone.local", qaPass, qaSlug);
  cache.qaSupervisor = await login("supervisor@test.atlasone.local", qaPass, qaSlug);
  writeFileSync(TOKEN_FILE, JSON.stringify(cache, null, 2));
}

export function readTokenCache(): TokenCache {
  if (!existsSync(TOKEN_FILE)) {
    throw new Error("Missing .qa-tokens.json — run playwright test (globalSetup) first");
  }
  return JSON.parse(readFileSync(TOKEN_FILE, "utf8")) as TokenCache;
}
