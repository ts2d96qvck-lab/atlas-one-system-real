import type { SessionUser } from "./api";

export function normalizeSessionUser(user: Partial<SessionUser> | null | undefined): SessionUser {
  return {
    id: String(user?.id ?? ""),
    tenantId: String(user?.tenantId ?? ""),
    tenantSlug: String(user?.tenantSlug ?? ""),
    name: String(user?.name ?? "Usuario"),
    email: String(user?.email ?? ""),
    role: String(user?.role ?? "agent"),
    permissions: Array.isArray(user?.permissions) ? user.permissions.map(String) : []
  };
}

export function hasPermission(user: SessionUser, permission: string) {
  const permissions = user.permissions ?? [];
  return permissions.includes("*") || permissions.includes(permission);
}

export type AppSession = { token: string; user: SessionUser };

export function toAppSession(payload: { token?: string | null; user?: Partial<SessionUser> | null } | null | undefined): AppSession | null {
  const token = payload?.token?.trim();
  if (!token || !payload) return null;
  return { token, user: normalizeSessionUser(payload.user) };
}
