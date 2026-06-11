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

/** Rótulos do inbox e compositor. */
export const INBOX_COPY = {
  transcribeAudio: "Transcrever áudio",
  messageActions: "Ações da mensagem",
  quickReplies: "Respostas rápidas",
  quickRepliesHint: "Respostas rápidas (Ctrl+K)",
  noQuickReply: "Nenhuma resposta rápida encontrada.",
  transferNotePlaceholder: "Nota da transferência (opcional)",
  saveCadence: "Salvar cadência",
  cadenceLabel: "Cadência comercial"
} as const;

/** Normaliza nomes de etapa do CRM exibidos na UI. */
const CRM_STAGE_LABELS: Record<string, string> = {
  "Reuniao marcada": "Reunião marcada",
  Negociacao: "Negociação",
  "Recuperação de Credito": "Recuperação de Crédito"
};

export function crmStageLabel(name: string) {
  return CRM_STAGE_LABELS[name] ?? name;
}

export const CONVERSATION_STATUS_SHORT: Record<string, string> = {
  open: "Aberto",
  waiting_customer: "Ag. cliente",
  waiting_internal: "Ag. interno",
  resolved: "Resolvido",
  closed: "Fechado",
  archived: "Arquivado"
};

export const LIFECYCLE_STATUSES = [
  "open",
  "waiting_customer",
  "waiting_internal",
  "resolved",
  "closed",
  "archived"
] as const;

export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

export const ACTIVE_CONVERSATION_STATUSES: LifecycleStatus[] = [
  "open",
  "waiting_customer",
  "waiting_internal"
];

export const HISTORY_CONVERSATION_STATUSES: LifecycleStatus[] = ["resolved", "closed", "archived"];

export const INBOX_QUEUE_BUCKETS = {
  active: "Em andamento",
  history: "Histórico",
  all: "Todas"
} as const;

export const INBOX_QUEUE_BUCKET_HELP = {
  active: "Conversas abertas e aguardando resposta.",
  history: "Encerradas, resolvidas e arquivadas — nada desaparece, fica aqui.",
  all: "Todas as conversas, inclusive arquivadas."
} as const;

/** Empty states e mensagens operacionais compartilhadas. */
export const EMPTY_COPY = {
  inboxQueue: {
    title: "Nenhuma conversa",
    descriptionActive: "Nenhuma conversa ativa com estes filtros. Limpe a busca ou mude a fila.",
    descriptionHistory: "Nenhuma conversa no histórico. Tente Todas ou limpe a busca.",
    descriptionDefault: "Nenhuma conversa encontrada. Ajuste os filtros ou inicie um novo contato."
  },
  inboxThread: {
    title: "Selecione uma conversa",
    description: "Escolha um contato na fila para responder ou use + para iniciar um novo."
  },
  crmColumn: {
    title: "Coluna vazia",
    description: "Arraste um lead para cá ou crie um novo lead.",
    action: "Novo lead"
  },
  campaigns: {
    title: "Nenhuma campanha",
    description: "Crie uma campanha para disparar mensagens em massa pelo WhatsApp.",
    action: "Ir para o formulário"
  },
  automations: {
    title: "Nenhuma automação",
    description: "Configure regras para leads e conversas sem trabalho manual repetitivo.",
    action: "Criar automação"
  }
} as const;

export const MODULE_COPY = {
  dashboard: {
    unavailable: "Painel indisponível no momento. Exibindo dados padrão.",
    exportFailed: "Falha ao exportar",
    noPipeline: "Sem dados de pipeline ainda.",
    noInstances: "Sem números cadastrados.",
    noTeam: "Sem dados de desempenho ainda.",
    conversion: "conversão"
  },
  loadFailed: {
    campaigns: "Não foi possível carregar campanhas.",
    automations: "Não foi possível carregar automações."
  }
} as const;
