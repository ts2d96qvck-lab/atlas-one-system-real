import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env";

const TICKET_VERSION = 1;

type TicketPayload = {
  v: typeof TICKET_VERSION;
  exp: number;
  slug?: string;
};

function signingSecret() {
  return env.setupToken || env.jwtSecret;
}

function signPayload(payload: TicketPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", signingSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function parsePayload(token: string): TicketPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = createHmac("sha256", signingSecret()).update(body).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TicketPayload;
    if (payload.v !== TICKET_VERSION || typeof payload.exp !== "number") return null;
    return payload;
  } catch {
    return null;
  }
}

export function signBootstrapTicket(options?: { tenantSlug?: string; ttlHours?: number }) {
  if (!env.setupToken) {
    throw new Error("SETUP_TOKEN nao configurado");
  }
  const ttlHours = options?.ttlHours ?? 72;
  const exp = Date.now() + ttlHours * 60 * 60 * 1000;
  const slug = options?.tenantSlug?.trim().toLowerCase();
  const payload: TicketPayload = {
    v: TICKET_VERSION,
    exp,
    ...(slug ? { slug } : {})
  };
  return { token: signPayload(payload), expiresAt: new Date(exp).toISOString() };
}

export function verifyBootstrapTicket(token: string, options?: { tenantSlug?: string }) {
  const payload = parsePayload(token);
  if (!payload) return { ok: false as const, reason: "invalid" as const };
  if (Date.now() > payload.exp) return { ok: false as const, reason: "expired" as const };

  const slug = options?.tenantSlug?.trim().toLowerCase();
  if (payload.slug && slug && payload.slug !== slug) {
    return { ok: false as const, reason: "slug_mismatch" as const };
  }

  return { ok: true as const, tenantSlug: payload.slug };
}

export function isBootstrapTicketValid(token: string | undefined, options?: { tenantSlug?: string }) {
  if (!token?.trim()) return false;
  if (token === env.setupToken) return true;
  return verifyBootstrapTicket(token, options).ok;
}
