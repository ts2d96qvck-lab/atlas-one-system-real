/** Terminologia e rótulos visíveis — fonte única para PT-BR enterprise. */

export const NAV = {
  inbox: "Caixa de entrada",
  dashboard: "Painel",
  admin: "Administração",
  crm: "CRM",
  campanhas: "Campanhas",
  automacoes: "Automações"
} as const;

export type NavId = keyof typeof NAV;

export const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  admin: "Gestor",
  supervisor: "Supervisor",
  agent: "Atendente",
  manager: "Gestor",
  team_manager: "Gestor"
};

export function roleLabel(role?: string | null) {
  if (!role) return "Atendente";
  return ROLE_LABELS[role] ?? role;
}

export const CONVERSATION_STATUS: Record<string, string> = {
  open: "Aberto",
  waiting_customer: "Aguardando cliente",
  waiting_internal: "Aguardando interno",
  resolved: "Resolvido",
  closed: "Fechado",
  archived: "Arquivado"
};

export function conversationStatusLabel(status: string) {
  return CONVERSATION_STATUS[status] ?? status;
}

export const CONVERSATION_STATUS_SHORT: Record<string, string> = {
  open: "Aberto",
  waiting_customer: "Ag. cliente",
  waiting_internal: "Ag. interno",
  resolved: "Resolvido",
  closed: "Fechado",
  archived: "Arquivado"
};
