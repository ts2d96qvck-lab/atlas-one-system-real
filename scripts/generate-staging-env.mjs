#!/usr/bin/env node
/**
 * Gera .env de staging/produção a partir do domínio.
 * Uso: node scripts/generate-staging-env.mjs app.seudominio.com.br
 */
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const domain = process.argv[2]?.replace(/^https?:\/\//, "").replace(/\/$/, "");
if (!domain) {
  console.error("Uso: node scripts/generate-staging-env.mjs app.seudominio.com.br");
  process.exit(1);
}

const secret = (bytes = 32) => randomBytes(bytes).toString("hex");
const pgPass = secret(16);
const redisPass = secret(16);
const jwt = secret(32);
const webhook = secret(32);
const payments = secret(32);
const setup = secret(16);
const evolutionKey = secret(16);

const baseUrl = `https://${domain}`;

const content = `# Gerado por scripts/generate-staging-env.mjs — ${new Date().toISOString()}
# Domínio: ${domain}

NODE_ENV=production
LOG_LEVEL=info

APP_PUBLIC_URL=${baseUrl}
WEBHOOK_PUBLIC_URL=${baseUrl}

PORT=4000
HOST=0.0.0.0

POSTGRES_USER=atlas
POSTGRES_PASSWORD=${pgPass}
POSTGRES_DB=atlas_one
DATABASE_URL=postgresql://atlas:${pgPass}@postgres:5432/atlas_one

REDIS_PASSWORD=${redisPass}
REDIS_URL=redis://:${redisPass}@redis:6379

JWT_SECRET=${jwt}
WEBHOOK_SECRET=${webhook}
PAYMENTS_WEBHOOK_SECRET=${payments}
SETUP_TOKEN=${setup}

EVOLUTION_URL=http://evolution-api:8080
EVOLUTION_API_KEY=${evolutionKey}
EVOLUTION_DEFAULT_INSTANCE=Atlas one
EVOLUTION_PUBLIC_URL=${baseUrl}
WHATSAPP_DEFAULT_PROVIDER=evolution

CORS_ORIGINS=${baseUrl}
PLATFORM_ADMIN_EMAILS=seu-email@empresa.com
ALLOW_PUBLIC_BOOTSTRAP=false
ATLAS_ALLOW_LOCAL_SMS=false
ATLAS_ALLOW_SIMULATED_WHATSAPP=false
ATLAS_ENTERPRISE_MODE=true

PAYMENT_PROVIDER=manual
ASAAS_API_KEY=
ASAAS_ENV=sandbox
ASAAS_WEBHOOK_TOKEN=${payments}

SMS_PROVIDER=webhook
SMS_WEBHOOK_URL=
SMS_API_TOKEN=

NEXT_PUBLIC_API_URL=${baseUrl}
NEXT_PUBLIC_WS_URL=${baseUrl}
`;

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, ".env");
writeFileSync(out, content, "utf8");

console.log(`\n[atlas] .env gerado em ${out}`);
console.log(`[atlas] Domínio: ${baseUrl}`);
console.log("\nPróximos passos:");
console.log("  1. Edite PLATFORM_ADMIN_EMAILS no .env");
console.log("  2. Aponte DNS A → IP do VPS");
console.log("  3. Cloudflare SSL Full (strict) ou certbot");
console.log("  4. docker compose -f docker-compose.prod.yml up -d --build");
console.log("  5. ALLOW_SEED=true no primeiro deploy (ver TEST_SERVER_GO_LIVE.md)\n");
