import { apiUrl } from "./config";

const REQUEST_TIMEOUT_MS = 45000;

async function fetchWithTimeout(input: string, init?: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error && typeof error === "object" && "name" in error && (error as { name?: string }).name === "AbortError") {
      throw new Error("Tempo limite de requisicao atingido. Verifique a conexao e tente novamente.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export type SessionUser = {
  id: string;
  tenantId: string;
  tenantSlug: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
};

export type LoginResponse =
  | {
      requires2fa: true;
      challengeId: string;
      maskedPhone: string;
      message: string;
      role: string;
      ownerFirstAccess: boolean;
    }
  | { requires2fa: false; token: string; user: SessionUser };

export type Message = {
  id: string;
  conversationId: string;
  direction: "in" | "out";
  type: string;
  text: string | null;
  mediaUrl: string | null;
  status: string;
  createdAt: string;
  raw?: Record<string, unknown> | null;
};

export type Conversation = {
  id: string;
  customerName: string;
  customerPhone: string;
  status: string;
  priority: string;
  tags: unknown;
  lastMessageAt: string | null;
  teamId?: string | null;
  assignedToId?: string | null;
  assignedTo?: { id: string; name: string; role: string } | null;
  team?: { id: string; name: string } | null;
  instance?: { id: string; name: string; label: string; status: string };
  lead?: {
    id: string;
    company: string;
    status: string;
    value: unknown;
    email?: string | null;
    customFields?: Record<string, unknown>;
  } | null;
  messages?: Message[];
};

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  phone?: string | null;
  teamId?: string | null;
  team?: { id: string; name: string } | null;
  avatarUrl?: string | null;
};

export type TeamRow = {
  id: string;
  name: string;
  managerId?: string | null;
};

export type ShortcutItem = {
  tag: string;
  text: string;
  updatedAt: string;
};

export type AccessRequestRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  createdAt: string;
};

export type Lead = {
  id: string;
  company: string;
  contact: string;
  phone: string;
  status: string;
  value: unknown;
  email?: string | null;
  updatedAt?: string;
  expectedCloseDate?: string | null;
};

export type TenantSummary = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  billingStatus: "active" | "overdue" | "blocked";
  billingDueAt?: string | null;
  blockedAt?: string | null;
  _count: { users: number; conversations: number; leads: number; instances: number };
};

export type AuditLogRow = {
  id: string;
  actorId?: string | null;
  entity: string;
  entityId?: string | null;
  action: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  actor?: { id: string; name: string; email: string; role: string } | null;
};

export type AuditLogFilters = {
  limit?: number;
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
};

export type WhatsAppInstance = {
  id: string;
  name: string;
  label: string;
  phone?: string | null;
  status: string;
  lastSyncAt?: string | null;
  connectionState?: string | null;
  connectionStatus?: string | null;
  qrCode?: string | null;
  webhookStatus?: string | null;
};

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (!init?.body) {
    headers.delete("content-type");
  }

  const response = await fetchWithTimeout(`${apiUrl()}${path}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const base = body?.message ?? body?.error ?? `Erro ${response.status}`;
    const detail =
      typeof body?.details === "string"
        ? body.details
        : typeof body?.details?.message === "string"
          ? body.details.message
          : "";
    throw new Error(detail ? `${base}: ${detail}` : base);
  }

  return response.json() as Promise<T>;
}

export async function login(email: string, password: string, tenantSlug = "atlas-one") {
  const response = await fetchWithTimeout(`${apiUrl()}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tenantSlug: tenantSlug.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      password
    })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof body?.message === "string" ? body.message : undefined;
    const base = body?.error ?? body?.message ?? "Login invalido";
    throw new Error(detail && detail !== base ? `${base}: ${detail}` : base);
  }
  return body as LoginResponse;
}

export type AuthProviderInfo = {
  kind: "local" | "oidc";
  id: string;
  displayName: string;
  configured: boolean;
};

export async function getAuthProviders(tenantSlug?: string) {
  const query = tenantSlug ? `?tenant=${encodeURIComponent(tenantSlug)}` : "";
  const response = await fetchWithTimeout(`${apiUrl()}/auth/providers${query}`);
  if (!response.ok) return { providers: [] as AuthProviderInfo[] };
  return response.json() as Promise<{ providers: AuthProviderInfo[] }>;
}

export function buildOidcLoginUrl(providerId: string, tenantSlug: string) {
  return `${apiUrl()}/auth/oidc/${encodeURIComponent(providerId)}/start?tenant=${encodeURIComponent(tenantSlug)}`;
}

export type SsoSettings = {
  enabled: boolean;
  providers: Array<"google" | "microsoft" | "oidc">;
  jitProvisioning: boolean;
  availableProviders: Array<{ id: string; displayName: string; configured: true }>;
};

export function getSsoSettings(token: string) {
  return request<SsoSettings>("/admin/sso/settings", token, {
    headers: { "content-type": "application/json" }
  });
}

export function updateSsoSettings(
  token: string,
  payload: Partial<Pick<SsoSettings, "enabled" | "providers" | "jitProvisioning">>
) {
  return request<SsoSettings>("/admin/sso/settings", token, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function verifyLoginCode(challengeId: string, code: string) {
  const response = await fetchWithTimeout(`${apiUrl()}/auth/login/verify-code`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ challengeId, code })
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message ?? body?.error ?? "Codigo invalido");
  }
  return response.json() as Promise<{ token: string; user: SessionUser }>;
}

export async function requestPasswordReset(tenantSlug: string, email: string) {
  const response = await fetchWithTimeout(`${apiUrl()}/auth/password/request-reset`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenantSlug, email })
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message ?? body?.error ?? "Falha ao solicitar recuperacao");
  }
  return response.json() as Promise<{ ok: true; challengeId: string | null; maskedPhone: string | null }>;
}

export async function confirmPasswordReset(challengeId: string, code: string, newPassword: string) {
  const response = await fetchWithTimeout(`${apiUrl()}/auth/password/confirm-reset`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ challengeId, code, newPassword })
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message ?? body?.error ?? "Falha ao redefinir senha");
  }
  return response.json() as Promise<{ ok: true }>;
}

export async function bootstrapOwnerAccount(payload: {
  companyName: string;
  tenantSlug: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  ownerPhone: string;
}) {
  const response = await fetchWithTimeout(`${apiUrl()}/auth/bootstrap-owner`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message ?? body?.error ?? "Falha ao criar conta dona");
  }
  return response.json() as Promise<{ ok: true; tenant: { id: string; slug: string; name: string } }>;
}

export async function requestTenantAccess(payload: {
  tenantSlug: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
}) {
  const response = await fetchWithTimeout(`${apiUrl()}/auth/request-access`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message ?? body?.error ?? "Falha ao solicitar acesso");
  }
  return response.json() as Promise<{ ok: true; message: string }>;
}

export async function getBootstrapStatus(tenantSlug: string) {
  const query = new URLSearchParams({ tenantSlug }).toString();
  const response = await fetchWithTimeout(`${apiUrl()}/auth/bootstrap-status?${query}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message ?? body?.error ?? "Falha ao consultar status");
  }
  return response.json() as Promise<{ canBootstrap: boolean }>;
}

export function listConversations(token: string) {
  return request<Conversation[]>(`/inbox/conversations`, token, {
    headers: { "content-type": "application/json" }
  });
}

export function getConversation(token: string, id: string) {
  return request<Conversation>(`/inbox/conversations/${id}`, token, {
    headers: { "content-type": "application/json" }
  });
}

export function createConversation(
  token: string,
  payload: { instanceName?: string; customerName: string; customerPhone: string; avatarUrl?: string; assignedToId?: string }
) {
  return request<Conversation>(`/inbox/conversations`, token, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export function deleteConversation(token: string, id: string) {
  return request<{ id: string }>(`/inbox/conversations/${id}`, token, {
    method: "DELETE",
    headers: { "content-type": "application/json" }
  });
}

export function updateConversation(
  token: string,
  id: string,
  data: {
    assignedToId?: string | null;
    teamId?: string | null;
    status?: string;
    priority?: string;
    tags?: string[];
    customerName?: string;
    customerPhone?: string;
    transferNote?: string;
  }
) {
  return request<Conversation>(`/inbox/conversations/${id}`, token, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data)
  });
}

export function listTeams(token: string) {
  return request<TeamRow[]>(`/admin/teams`, token, { headers: { "content-type": "application/json" } });
}

export function createTeam(token: string, payload: { name: string; managerId?: string }) {
  return request<TeamRow>(`/admin/teams`, token, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export function deleteTeam(token: string, id: string) {
  return request<TeamRow>(`/admin/teams/${id}`, token, {
    method: "DELETE",
    headers: { "content-type": "application/json" }
  });
}

export function listShortcuts(token: string) {
  return request<ShortcutItem[]>(`/admin/shortcuts`, token, { headers: { "content-type": "application/json" } });
}

export function listInboxShortcuts(token: string) {
  return request<ShortcutItem[]>(`/inbox/shortcuts`, token, { headers: { "content-type": "application/json" } });
}

export type TagCatalogItem = {
  name: string;
  color?: string;
};

export function listInboxTags(token: string) {
  return request<TagCatalogItem[]>(`/inbox/tags`, token, { headers: { "content-type": "application/json" } });
}

export function saveInboxTags(token: string, tags: TagCatalogItem[]) {
  return request<TagCatalogItem[]>(`/inbox/tags`, token, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tags })
  });
}

export type ConversationActivityItem = {
  id: string;
  type: "note" | "transfer" | "update" | "legacy_note";
  createdAt: string;
  actor: { id: string; name: string; role: string } | null;
  payload: Record<string, unknown>;
};

export function listConversationActivity(token: string, conversationId: string) {
  return request<ConversationActivityItem[]>(`/inbox/conversations/${conversationId}/activity`, token, {
    headers: { "content-type": "application/json" }
  });
}

export function createConversationNote(token: string, conversationId: string, text: string) {
  return request<ConversationActivityItem>(`/inbox/conversations/${conversationId}/notes`, token, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text })
  });
}

export function upsertShortcut(token: string, payload: { tag: string; text: string }) {
  return request<ShortcutItem>(`/admin/shortcuts`, token, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export function deleteShortcut(token: string, tag: string) {
  return request<{ tag: string }>(`/admin/shortcuts/${encodeURIComponent(tag)}`, token, {
    method: "DELETE",
    headers: { "content-type": "application/json" }
  });
}

export function sendMessage(token: string, conversationId: string, payload: { text: string; replyToMessageId?: string }) {
  return request<Message>(`/inbox/conversations/${conversationId}/messages`, token, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export function editMessage(token: string, conversationId: string, messageId: string, text: string) {
  return request<Message>(`/inbox/conversations/${conversationId}/messages/${messageId}`, token, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text })
  });
}

export function deleteMessage(token: string, conversationId: string, messageId: string) {
  return request<Message>(`/inbox/conversations/${conversationId}/messages/${messageId}`, token, {
    method: "DELETE",
    headers: { "content-type": "application/json" }
  });
}

export function transcribeMessage(token: string, conversationId: string, messageId: string) {
  return request<Message>(`/inbox/conversations/${conversationId}/messages/${messageId}/transcribe`, token, {
    method: "POST",
    headers: { "content-type": "application/json" }
  });
}

export async function sendMediaFile(token: string, conversationId: string, file: File, caption?: string) {
  const form = new FormData();
  form.append("file", file);
  if (caption) form.append("caption", caption);
  const response = await fetchWithTimeout(`${apiUrl()}/inbox/conversations/${conversationId}/messages/media`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: form
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error ?? body?.message ?? "Falha ao enviar midia");
  }
  return response.json() as Promise<Message>;
}

export function listUsers(token: string) {
  return request<UserRow[]>(`/admin/users`, token, { headers: { "content-type": "application/json" } });
}

export function uploadUserAvatar(token: string, image: string, mimeType?: string) {
  return request<{ avatarUrl: string }>(`/admin/users/me/avatar`, token, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ image, mimeType })
  });
}

export type MonthlyTargetOverview = {
  month: string;
  tenantTargetValue: number;
  teamTargets: Array<{ teamId: string | null; teamName: string; targetValue: number }>;
  teams: Array<{ id: string; name: string }>;
};

export function getMonthlyTargets(token: string) {
  return request<MonthlyTargetOverview>(`/admin/monthly-targets`, token, { headers: { "content-type": "application/json" } });
}

export function saveMonthlyTargets(
  token: string,
  payload: { tenantTargetValue: number; teamTargets?: Array<{ teamId: string; targetValue: number }> }
) {
  return request<MonthlyTargetOverview>(`/admin/monthly-targets`, token, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export function listAccessRequests(token: string) {
  return request<AccessRequestRow[]>(`/admin/access-requests`, token, { headers: { "content-type": "application/json" } });
}

export function approveAccessRequest(token: string, id: string) {
  return request<{ id: string }>(`/admin/access-requests/${id}/approve`, token, {
    method: "POST",
    headers: { "content-type": "application/json" }
  });
}

export function rejectAccessRequest(token: string, id: string) {
  return request<{ id: string }>(`/admin/access-requests/${id}/reject`, token, {
    method: "DELETE",
    headers: { "content-type": "application/json" }
  });
}

export function deleteUser(token: string, id: string) {
  return request<{ id: string }>(`/admin/users/${id}`, token, {
    method: "DELETE",
    headers: { "content-type": "application/json" }
  });
}

export type CompanySettings = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  timezone: string;
  businessHoursStart: string;
  businessHoursEnd: string;
  welcomeMessage: string;
  slaFirstResponseMinutes: number;
  slaResolutionHours: number;
  messaging?: {
    showAgentNameToCustomer: boolean;
    showBotNameToCustomer: boolean;
    agentSignatureFormat: string;
    botSignatureFormat: string;
    signaturePlacement: "before" | "after" | "disabled";
  };
};

export type InvitePreview = {
  tenantName: string;
  tenantSlug: string;
  name: string;
  email: string;
  role: string;
  expiresAt: string;
};

export function getCompanySettings(token: string) {
  return request<CompanySettings>(`/admin/company-settings`, token, { headers: { "content-type": "application/json" } });
}

export function updateCompanySettings(
  token: string,
  payload: {
    name?: string;
    settings?: {
      timezone?: string;
      businessHoursStart?: string;
      businessHoursEnd?: string;
      welcomeMessage?: string;
      slaFirstResponseMinutes?: number;
      slaResolutionHours?: number;
      messaging?: {
        showAgentNameToCustomer?: boolean;
        showBotNameToCustomer?: boolean;
        agentSignatureFormat?: string;
        botSignatureFormat?: string;
        signaturePlacement?: "before" | "after" | "disabled";
      };
    };
  }
) {
  return request<CompanySettings>(`/admin/company-settings`, token, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export type MenuBotOption = {
  digit: string;
  label: string;
  teamId?: string;
};

export type MenuBotSettings = {
  enabled: boolean;
  greeting: string;
  invalidReply: string;
  options: MenuBotOption[];
  teams: TeamRow[];
};

export function getMenuBotSettings(token: string) {
  return request<MenuBotSettings>(`/admin/menu-bot`, token, { headers: { "content-type": "application/json" } });
}

export function updateMenuBotSettings(
  token: string,
  payload: {
    enabled?: boolean;
    greeting?: string;
    invalidReply?: string;
    options?: MenuBotOption[];
  }
) {
  return request<MenuBotSettings>(`/admin/menu-bot`, token, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function downloadOpsExport(
  token: string,
  kind: "leads" | "conversations" | "messages",
  query?: { from?: string; to?: string }
) {
  const params = new URLSearchParams();
  if (query?.from) params.set("from", query.from);
  if (query?.to) params.set("to", query.to);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const path =
    kind === "leads"
      ? `/ops/export/leads.csv`
      : kind === "conversations"
        ? `/ops/export/conversations.csv`
        : `/ops/export/messages.csv`;
  const response = await fetch(`${apiUrl()}${path}${suffix}`, {
    headers: { authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message ?? body?.error ?? "Falha ao exportar dados");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download =
    kind === "leads" ? "atlas-leads.csv" : kind === "conversations" ? "atlas-conversas.csv" : "atlas-mensagens.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function getChannelSettings(token: string) {
  return request<{ instances: WhatsAppInstance[] }>(`/admin/channel-settings`, token, {
    headers: { "content-type": "application/json" }
  });
}

export function inviteUser(
  token: string,
  payload: { name: string; email: string; role: string; teamId?: string }
) {
  return request<{ inviteUrl: string; expiresAt: string; userId: string }>(`/admin/users/invite`, token, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function previewInvite(inviteToken: string, tenantSlug: string) {
  const query = new URLSearchParams({ token: inviteToken, tenant: tenantSlug }).toString();
  const response = await fetchWithTimeout(`${apiUrl()}/auth/invite/preview?${query}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message ?? body?.error ?? "Convite invalido ou expirado");
  }
  return response.json() as Promise<InvitePreview>;
}

export async function acceptInvite(payload: { token: string; tenantSlug: string; password: string }) {
  const response = await fetchWithTimeout(`${apiUrl()}/auth/invite/accept`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message ?? body?.error ?? "Nao foi possivel aceitar convite");
  }
  return response.json() as Promise<{ token: string; user: SessionUser }>;
}

export function logout(token: string) {
  return request<{ ok: true }>("/auth/logout", token, {
    method: "POST",
    headers: { "content-type": "application/json" }
  });
}

export function listAuditLogs(token: string, filters: AuditLogFilters = {}) {
  const params = new URLSearchParams();
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.action) params.set("action", filters.action);
  if (filters.entity) params.set("entity", filters.entity);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const qs = params.toString();
  return request<AuditLogRow[]>(`/admin/audit-logs${qs ? `?${qs}` : ""}`, token, {
    headers: { "content-type": "application/json" }
  });
}

export function operationalReset(
  token: string,
  payload: { ownerName: string; ownerEmail: string; ownerPassword: string; ownerPhone: string; confirmation: "RESETAR" }
) {
  return request<{ ok: boolean; message: string }>(`/admin/owner/operational-reset`, token, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export function listTenants(token: string) {
  return request<TenantSummary[]>(`/admin/tenants`, token, { headers: { "content-type": "application/json" } });
}

export function ownerTenantsOverview(token: string) {
  return request<{
    summary: { tenants: number; active: number; overdue: number; blocked: number; users: number; numbers: number };
    tenants: TenantSummary[];
  }>(`/admin/owner/tenants-overview`, token, { headers: { "content-type": "application/json" } });
}

export function updateTenantBilling(
  token: string,
  tenantId: string,
  payload: { billingStatus: "active" | "overdue" | "blocked"; billingDueAt?: string | null }
) {
  return request<TenantSummary>(`/admin/tenants/${tenantId}/billing`, token, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export function onboardTenant(
  token: string,
  payload: {
    companyName: string;
    companyDocument?: string;
    slug: string;
    ownerName: string;
    ownerEmail: string;
    ownerPassword: string;
    whatsappInstanceName: string;
    whatsappLabel: string;
  }
) {
  return request<{ tenant: { id: string; name: string; slug: string }; owner: { id: string; email: string } }>(
    `/admin/tenants/onboard`,
    token,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }
  );
}

export function createInstance(
  token: string,
  payload: { name: string; label: string; phone?: string }
) {
  return request<{ id: string; name: string; label: string; status: string }>(`/whatsapp/instances`, token, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export function listInstances(token: string) {
  return request<WhatsAppInstance[]>(`/whatsapp/instances`, token, { headers: { "content-type": "application/json" } });
}

export function connectInstance(token: string, instanceName: string, force = false) {
  return request<{ ok: boolean; qrImage?: string | null; qrCode?: string | null; state?: string; webhookUrl?: string }>(
    `/whatsapp/instances/${instanceName}/connect`,
    token,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ force })
    }
  );
}

export function disconnectInstance(token: string, instanceName: string) {
  return request<{ ok: boolean; state: string }>(`/whatsapp/instances/${instanceName}/disconnect`, token, {
    method: "POST",
    headers: { "content-type": "application/json" }
  });
}

export function deleteInstance(token: string, instanceName: string) {
  return request<{ ok: boolean }>(`/whatsapp/instances/${instanceName}`, token, {
    method: "DELETE",
    headers: { "content-type": "application/json" }
  });
}

export function getPipeline(token: string) {
  return request<{ pipeline: { stages: { id: string; name: string; order: number }[] } | null; leads: Lead[] }>(
    `/crm/pipeline`,
    token,
    { headers: { "content-type": "application/json" } }
  );
}

export function updateLead(token: string, id: string, data: Partial<Lead & { customFields?: Record<string, unknown> }>) {
  return request<Lead>(`/crm/leads/${id}`, token, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data)
  });
}

export function deleteLead(token: string, id: string) {
  return request<{ id: string }>(`/crm/leads/${id}`, token, {
    method: "DELETE",
    headers: { "content-type": "application/json" }
  });
}

export function createLead(
  token: string,
  data: {
    company: string;
    contact: string;
    phone: string;
    email?: string;
    status?: string;
    value?: number;
  }
) {
  return request<Lead>("/crm/leads", token, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data)
  });
}

export function syncWebhook(token: string, instanceName: string) {
  return request<{ ok: boolean; webhookUrl: string }>(
    `/whatsapp/instances/${instanceName}/webhook/sync`,
    token,
    { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }
  );
}

export function syncAvatars(token: string, instanceName?: string) {
  return request<{ ok: boolean; checked: number; updated: number }>(`/whatsapp/avatars/sync`, token, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(instanceName ? { instanceName } : {})
  });
}

export type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  status: string;
  lastUsedAt?: string | null;
  createdAt: string;
};

export type WebhookEndpointRow = {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type WebhookDeliveryRow = {
  id: string;
  event: string;
  status: string;
  attempts: number;
  lastError?: string | null;
  responseStatus?: number | null;
  createdAt: string;
  deliveredAt?: string | null;
  endpoint: { id: string; name: string; url: string };
};

export function listApiKeys(token: string) {
  return request<ApiKeyRow[]>("/admin/integrations/api-keys", token);
}

export function createApiKey(token: string, data: { name: string; scopes?: string[] }) {
  return request<{ id: string; name: string; keyPrefix: string; key: string; scopes: string[] }>(
    "/admin/integrations/api-keys",
    token,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data)
    }
  );
}

export function revokeApiKey(token: string, id: string) {
  return request<{ id: string }>(`/admin/integrations/api-keys/${id}`, token, {
    method: "DELETE",
    headers: { "content-type": "application/json" }
  });
}

export function listWebhookEndpoints(token: string) {
  return request<WebhookEndpointRow[]>("/admin/integrations/webhooks", token);
}

export function listWebhookEvents(token: string) {
  return request<{ events: string[] }>("/admin/integrations/webhooks/events", token);
}

export function createWebhookEndpoint(
  token: string,
  data: { name: string; url: string; events: string[]; status?: "active" | "paused" }
) {
  return request<WebhookEndpointRow & { secret: string }>("/admin/integrations/webhooks", token, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data)
  });
}

export function deleteWebhookEndpoint(token: string, id: string) {
  return request<{ id: string }>(`/admin/integrations/webhooks/${id}`, token, {
    method: "DELETE",
    headers: { "content-type": "application/json" }
  });
}

export function listWebhookDeliveries(token: string, limit = 20) {
  return request<WebhookDeliveryRow[]>(`/admin/integrations/webhooks/deliveries?limit=${limit}`, token);
}

export type BillingOverview = {
  tenant: { id: string; name: string; slug: string };
  plan: {
    id: string;
    name: string;
    description: string;
    priceLabel: string;
    features: Record<string, boolean>;
  };
  limits: { maxUsers: number; maxInstances: number; maxConversationsPerMonth: number | null };
  usage: { users: number; instances: number; conversationsThisMonth: number };
  seats: { used: number; limit: number; available: number };
  channels: { used: number; limit: number; available: number };
  billing: {
    status: string;
    dueAt?: string | null;
    blockedAt?: string | null;
    trialEndsAt?: string | null;
    trialActive: boolean;
    subscriptionStatus: string;
    provider?: string | null;
    externalCustomerId?: string | null;
    notes?: string;
    paymentHistory?: Array<Record<string, unknown>>;
  };
  capabilities: {
    canAddUser: boolean;
    canAddInstance: boolean;
    withinConversationQuota: boolean;
  };
  access?: {
    users: Array<{
      id: string;
      name: string;
      email: string;
      role: string;
      status: string;
      phone?: string | null;
      createdAt: string;
      team?: { id: string; name: string } | null;
    }>;
    pendingAccessRequests: number;
    activeUsers: number;
    inactiveUsers: number;
    lastLogins: Array<{ actorId: string | null; createdAt: string; actor?: { name: string; email: string } | null }>;
  };
};

export function getBillingOverview(token: string) {
  return request<BillingOverview>("/admin/billing/overview", token);
}

export function recordManualPayment(
  token: string,
  payload: { status: "active" | "overdue" | "blocked"; note?: string; amount?: number; paidAt?: string }
) {
  return request<BillingOverview>("/admin/billing/manual-payment", token, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export function listBillingPlans(token: string) {
  return request<{ plans: BillingOverview["plan"][] }>("/admin/billing/plans", token);
}

export type BillingCheckoutResult = {
  provider: string;
  configured: boolean;
  checkoutUrl?: string;
  message?: string;
  plan?: string;
};

export function createBillingCheckout(token: string, plan: "starter" | "pro") {
  return request<BillingCheckoutResult>("/admin/billing/checkout", token, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plan })
  });
}
