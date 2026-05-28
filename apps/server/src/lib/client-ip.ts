import type { FastifyRequest } from "fastify";

/** Loopback, RFC1918, and common Docker bridge ranges — not used for suspicious-login IP checks. */
export function isPrivateOrLoopbackIp(ip: string | undefined | null) {
  const value = String(ip ?? "").trim();
  if (!value) return true;
  if (value === "127.0.0.1" || value === "::1" || value === "localhost") return true;
  if (value.startsWith("10.")) return true;
  if (value.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(value)) return true;
  if (value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd")) return true;
  return false;
}

/** Prefer the left-most X-Forwarded-For hop (original client) when behind nginx/Cloudflare. */
export function resolveClientIp(request: FastifyRequest) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    const client = forwarded.split(",")[0]?.trim();
    if (client) return client;
  }
  const realIp = request.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) return realIp.trim();
  return request.ip;
}
