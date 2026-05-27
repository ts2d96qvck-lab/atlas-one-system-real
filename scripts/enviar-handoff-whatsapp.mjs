/**
 * Envia mensagem de handoff via Evolution API (WhatsApp conectado).
 * Usage: node scripts/enviar-handoff-whatsapp.mjs [numero] [mensagem]
 * Exemplo: node scripts/enviar-handoff-whatsapp.mjs 551996802944 "Teste Atlas One"
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  for (const p of [".env", "apps/server/.env"]) {
    const full = resolve(process.cwd(), p);
    if (!existsSync(full)) continue;
    for (const line of readFileSync(full, "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

loadEnv();

const number = process.argv[2] ?? "551996802944";
const text =
  process.argv[3] ??
  `Atlas One online. Acesse http://127.0.0.1 — docs: docs/GUIA-ONDE-CLICAR.md`;

const url = process.env.EVOLUTION_URL ?? "http://localhost:8080";
const key = process.env.EVOLUTION_API_KEY ?? "";
const instance = encodeURIComponent(process.env.EVOLUTION_DEFAULT_INSTANCE ?? "Atlas one");

if (!key) {
  console.error("EVOLUTION_API_KEY missing");
  process.exit(1);
}

const res = await fetch(`${url}/message/sendText/${instance}`, {
  method: "POST",
  headers: { apikey: key, "Content-Type": "application/json" },
  body: JSON.stringify({ number, text })
});

const body = await res.text();
console.log(JSON.stringify({ status: res.status, number, body: body.slice(0, 500) }, null, 2));
process.exit(res.ok ? 0 : 1);
