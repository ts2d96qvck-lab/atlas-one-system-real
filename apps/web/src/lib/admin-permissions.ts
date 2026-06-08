/** Permissões opcionais atribuíveis no Admin (além do pacote padrão do perfil). */
export const ADMIN_PERMISSION_OPTIONS = [
  {
    id: "ai:use",
    label: "Atlas AI",
    description: "Copiloto inteligente no Inbox, CRM, Campanhas e Painel"
  },
  {
    id: "campaign:read",
    label: "Campanhas (ler)",
    description: "Visualizar campanhas e disparos"
  },
  {
    id: "campaign:update",
    label: "Campanhas (editar)",
    description: "Criar e editar campanhas"
  },
  {
    id: "automation:read",
    label: "Automações (ler)",
    description: "Visualizar fluxos automáticos"
  },
  {
    id: "automation:update",
    label: "Automações (editar)",
    description: "Criar e editar automações"
  },
  {
    id: "dashboard:read",
    label: "Painel operacional",
    description: "Métricas e visão gerencial"
  },
  {
    id: "conversation:takeover",
    label: "Assumir conversas",
    description: "Monitorar e assumir filas de outros atendentes"
  }
] as const;

import { normalizePermissions } from "./session-user";

export function roleHasFullAccess(role: string, permissions?: string[] | undefined) {
  const normalizedRole = role.trim().toLowerCase();
  if (normalizedRole === "owner" || normalizedRole === "admin") return true;
  return userHasWildcard(permissions);
}

export function userHasWildcard(permissions: string[] | undefined) {
  return normalizePermissions(permissions).includes("*");
}

export function resolveEditablePermissions(role: string, permissions: string[] | undefined): string[] {
  if (roleHasFullAccess(role, permissions)) return ["*"];
  if (Array.isArray(permissions) && permissions.length) return [...permissions];
  return defaultPermissionsForRole(role);
}

export function defaultPermissionsForRole(role: string): string[] {
  switch (role) {
    case "owner":
    case "admin":
      return ["*"];
    case "supervisor":
      return [
        "conversation:read",
        "conversation:create",
        "conversation:update",
        "conversation:reply",
        "conversation:takeover",
        "crm:read",
        "lead:create",
        "lead:update",
        "dashboard:read",
        "admin:read",
        "automation:read",
        "automation:update",
        "campaign:read",
        "campaign:update"
      ];
    case "manager":
    case "team_manager":
      return [
        "conversation:read",
        "conversation:update",
        "conversation:reply",
        "conversation:takeover",
        "crm:read",
        "lead:create",
        "lead:update",
        "dashboard:read"
      ];
    case "agent":
    default:
      return [
        "conversation:read",
        "conversation:create",
        "conversation:update",
        "conversation:reply",
        "crm:read",
        "lead:create",
        "lead:update"
      ];
  }
}

export function togglePermission(current: string[], permissionId: string, enabled: boolean): string[] {
  const withoutWildcard = current.filter((item) => item !== "*");
  if (enabled) return [...new Set([...withoutWildcard, permissionId])];
  return withoutWildcard.filter((item) => item !== permissionId);
}
