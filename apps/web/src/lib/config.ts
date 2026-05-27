/** URL da API — mesma origem (Nginx :80, rewrites Next :3001) ou API direta. */
export function apiUrl() {
  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    // Nginx (:80) ou HTTPS — mesma origem; rewrites Next encaminham /api, /media, etc.
    if (!port || port === "80" || port === "443" || port === "3001") {
      return window.location.origin;
    }
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000";
}

/** @deprecated Use apiUrl() */
export const API_URL = typeof window !== "undefined" ? apiUrl() : (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1");

export function wsUrl() {
  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    if (port === "3001") {
      return `${protocol}//${hostname}:4000`;
    }
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_WS_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1";
}

/** URL amigavel exibida ao usuario (nao e bug usar 127.0.0.1 em dev). */
export function displayAppUrl() {
  if (typeof window !== "undefined") {
    if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
      return "http://app.atlasone.local.gd (recomendado) ou http://127.0.0.1";
    }
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://app.atlasone.local.gd";
}
