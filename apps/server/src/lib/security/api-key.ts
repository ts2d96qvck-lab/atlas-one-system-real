import { createHash, randomBytes } from "node:crypto";

const KEY_PREFIX = "atlas_live_";

export function hashApiKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateApiKey() {
  const secret = randomBytes(24).toString("hex");
  const raw = `${KEY_PREFIX}${secret}`;
  return {
    raw,
    prefix: raw.slice(0, KEY_PREFIX.length + 8),
    hash: hashApiKey(raw)
  };
}

export function extractApiKeyFromRequest(headers: Record<string, string | string[] | undefined>) {
  const auth = headerValue(headers, "authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (token.startsWith(KEY_PREFIX)) return token;
  }
  const direct = headerValue(headers, "x-api-key");
  if (direct?.startsWith(KEY_PREFIX)) return direct;
  return null;
}

function headerValue(headers: Record<string, string | string[] | undefined>, name: string) {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}
