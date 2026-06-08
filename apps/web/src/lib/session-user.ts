import type { SessionUser } from "./api";

export function normalizePermissions(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value === "*") return ["*"];
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "*") return ["*"];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) return parsed.map(String);
      } catch {
        return [];
      }
    }
  }
  return [];
}

export function normalizeSessionUser(user: Partial<SessionUser> | null | undefined): SessionUser {
  return {
    id: String(user?.id ?? ""),
    tenantId: String(user?.tenantId ?? ""),
    tenantSlug: String(user?.tenantSlug ?? ""),
    name: String(user?.name ?? "Usuario"),
    email: String(user?.email ?? ""),
    role: String(user?.role ?? "agent").trim().toLowerCase(),
    permissions: normalizePermissions(user?.permissions)
  };
}

export function hasFullAccess(user: Pick<SessionUser, "role" | "permissions">) {
  const role = (user.role ?? "agent").trim().toLowerCase();
  if (role === "owner" || role === "admin") return true;
  return normalizePermissions(user.permissions).includes("*");
}

export function hasPermission(user: SessionUser, permission: string) {
  if (hasFullAccess(user)) return true;
  return normalizePermissions(user.permissions).includes(permission);
}

export function canUseAtlasAi(user?: SessionUser | null) {
  if (!user) return false;
  return hasPermission(user, "ai:use");
}

export type AppSession = { token: string; user: SessionUser };

export function toAppSession(payload: { token?: string | null; user?: Partial<SessionUser> | null } | null | undefined): AppSession | null {
  const token = payload?.token?.trim();
  if (!token || !payload) return null;
  return { token, user: normalizeSessionUser(payload.user) };
}
