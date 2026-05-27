export const roles = ["owner", "admin", "supervisor", "agent", "sdr", "billing"] as const;
export type Role = (typeof roles)[number];

export const permissions = [
  "conversation:view:all",
  "conversation:transfer",
  "conversation:reply",
  "lead:create",
  "lead:update",
  "pipeline:edit",
  "whatsapp:connect",
  "report:view",
  "data:export",
  "record:delete",
  "billing:manage"
] as const;

export type Permission = (typeof permissions)[number];

export function hasPermission(userPermissions: readonly string[], permission: Permission) {
  return userPermissions.includes(permission);
}

