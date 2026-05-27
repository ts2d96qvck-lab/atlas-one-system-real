import { env } from "../config/env";

function isPrivateHostname(hostname: string) {
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  if (hostname.endsWith(".local") || hostname.endsWith(".local.gd")) return true;
  if (!env.isProduction && hostname.endsWith(".trycloudflare.com")) return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(hostname)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(hostname)) return true;
  return false;
}

export function resolveCorsOrigin(origin: string | undefined, callback: (err: Error | null, allow: boolean) => void) {
  if (!origin) {
    callback(null, true);
    return;
  }

  if (env.corsOrigins.includes(origin)) {
    callback(null, true);
    return;
  }

  if (!env.isProduction) {
    callback(null, true);
    return;
  }

  try {
    const url = new URL(origin);
    if (isPrivateHostname(url.hostname)) {
      callback(null, true);
      return;
    }
  } catch {
    callback(new Error("Origin invalida"), false);
    return;
  }

  callback(new Error("Origin nao permitida"), false);
}

export const corsOptions = {
  origin: resolveCorsOrigin,
  credentials: true
};
