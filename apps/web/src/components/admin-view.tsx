"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, CreditCard, Hash, Loader2, Link2, MessageCircle, Plug, Plus, QrCode, RefreshCw, Settings, Shield, Smartphone, Trash2, Users } from "lucide-react";
import { Badge, Button, Card } from "@atlas-one/ui";
import { apiUrl } from "../lib/config";
import {
  approveAccessRequest,
  connectInstance,
  createTeam,
  createInstance,
  deleteTeam,
  deleteShortcut,
  deleteInstance,
  deleteUser,
  disconnectInstance,
  getCompanySettings,
  getMenuBotSettings,
  inviteUser,
  listAccessRequests,
  listAuditLogs,
  listInstances,
  listShortcuts,
  listTeams,
  operationalReset,
  ownerTenantsOverview,
  listTenants,
  onboardTenant,
  rejectAccessRequest,
  syncWebhook,
  updateCompanySettings,
  updateMenuBotSettings,
  upsertShortcut,
  updateTenantBilling,
  listApiKeys,
  createApiKey,
  revokeApiKey,
  listWebhookEndpoints,
  listWebhookEvents,
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  listWebhookDeliveries,
  getBillingOverview,
  getMonthlyTargets,
  recordManualPayment,
  saveMonthlyTargets,
  createBillingCheckout,
  getSsoSettings,
  updateSsoSettings,
  type AccessRequestRow,
  type ApiKeyRow,
  type AuditLogRow,
  type BillingOverview,
  type CompanySettings,
  type MenuBotOption,
  type MenuBotSettings,
  type MonthlyTargetOverview,
  type SsoSettings,
  type WebhookDeliveryRow,
  type WebhookEndpointRow,
  type SessionUser,
  type ShortcutItem,
  type TenantSummary,
  type TeamRow,
  type WhatsAppInstance
} from "../lib/api";
import { EmptyState } from "./empty-state";
import { OwnerClientsPanel } from "./owner-clients-panel";

type Props = { token: string; user?: SessionUser };

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
};

const ROLE_LABEL: Record<string, string> = {
  owner: "Diretoria",
  admin: "Administracao",
  supervisor: "Supervisao",
  agent: "Atendimento"
};

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  inactive: "Inativo",
  invited: "Convite pendente"
};

const AUDIT_ACTION_LABEL: Record<string, string> = {
  created: "Criacao",
  updated: "Atualizacao",
  deleted: "Exclusao",
  sent_text: "Mensagem de texto enviada",
  sent_media: "Midia enviada",
  auth_login_success: "Login bem-sucedido",
  auth_login_failed: "Tentativa de login falhou",
  auth_login_challenge: "Desafio 2FA enviado",
  auth_logout: "Logout",
  password_reset_requested: "Recuperacao de senha solicitada",
  password_reset_confirmed: "Senha redefinida",
  password_changed: "Senha alterada",
  permissions_updated: "Permissoes alteradas",
  data_export: "Exportacao de dados",
  api_key_created: "Chave API criada",
  api_key_revoked: "Chave API revogada",
  webhook_created: "Webhook criado",
  webhook_updated: "Webhook atualizado",
  webhook_deleted: "Webhook removido",
  commercial_event: "Evento comercial (API)",
  settings_updated: "Configuracoes alteradas"
};

function describeAuditLog(log: AuditLogRow) {
  const action = AUDIT_ACTION_LABEL[log.action] ?? log.action.replaceAll("_", " ");
  const entity =
    log.entity === "Conversation"
      ? "Conversa"
      : log.entity === "Message"
        ? "Mensagem"
        : log.entity === "Auth"
          ? "Autenticacao"
          : log.entity === "Export"
            ? "Exportacao"
            : log.entity;
  const actor = log.actor?.name ? ` · ${log.actor.name}` : "";
  return `${action} em ${entity}${actor}`;
}

function normalizeQrSrc(qrImage?: string | null) {
  if (!qrImage) return null;
  if (qrImage.startsWith("data:image")) return qrImage;
  return `data:image/png;base64,${qrImage.replace(/^data:image\/[a-z]+;base64,/, "")}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Ainda nao sincronizado";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Data invalida";
  return parsed.toLocaleString("pt-BR");
}

export function AdminView({ token, user }: Props) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequestRow[]>([]);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [ownerSummary, setOwnerSummary] = useState({
    tenants: 0,
    active: 0,
    overdue: 0,
    blocked: 0,
    users: 0,
    numbers: 0
  });
  const [loading, setLoading] = useState(true);
  const [apiHealth, setApiHealth] = useState<"checking" | "ok" | "down">("checking");
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [shortcuts, setShortcuts] = useState<ShortcutItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [selectedInstance, setSelectedInstance] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [billingBusyId, setBillingBusyId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "agent", teamId: "" });
  const [instanceForm, setInstanceForm] = useState({ name: "", label: "", phone: "" });
  const [resetForm, setResetForm] = useState({
    ownerName: "",
    ownerEmail: "",
    ownerPassword: "",
    ownerPhone: "",
    confirmation: ""
  });
  const [resetLoading, setResetLoading] = useState(false);
  const [tenantForm, setTenantForm] = useState({
    companyName: "",
    companyDocument: "",
    slug: "",
    ownerName: "",
    ownerEmail: "",
    ownerPassword: "",
    whatsappInstanceName: "principal",
    whatsappLabel: "WhatsApp Comercial"
  });
  const [teamForm, setTeamForm] = useState({ name: "", managerId: "" });
  const [teamSaving, setTeamSaving] = useState(false);
  const [shortcutForm, setShortcutForm] = useState({ tag: "", text: "" });
  const [lastOnboarded, setLastOnboarded] = useState<{
    tenantName: string;
    tenantSlug: string;
    ownerEmail: string;
  } | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [settingsForm, setSettingsForm] = useState({
    name: "",
    timezone: "America/Sao_Paulo",
    businessHoursStart: "08:00",
    businessHoursEnd: "18:00",
    welcomeMessage: "",
    slaFirstResponseMinutes: "15",
    slaResolutionHours: "24",
    showAgentNameToCustomer: true,
    showBotNameToCustomer: false,
    agentSignatureFormat: "Atendente {{agentName}}:",
    botSignatureFormat: "{{botName}}:",
    signaturePlacement: "before" as "before" | "after" | "disabled"
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [menuBot, setMenuBot] = useState<MenuBotSettings | null>(null);
  const [menuBotForm, setMenuBotForm] = useState({
    enabled: false,
    greeting: "Ola! Escolha uma opcao:",
    invalidReply: "Opcao invalida. Responda apenas com o numero da opcao desejada.",
    options: [] as MenuBotOption[]
  });
  const [menuBotSaving, setMenuBotSaving] = useState(false);
  const [ssoSettings, setSsoSettings] = useState<SsoSettings | null>(null);
  const [ssoSaving, setSsoSaving] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState("");
  const [inviting, setInviting] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookEndpointRow[]>([]);
  const [webhookDeliveries, setWebhookDeliveries] = useState<WebhookDeliveryRow[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);
  const [apiKeyForm, setApiKeyForm] = useState({ name: "" });
  const [webhookForm, setWebhookForm] = useState({ name: "Integracao", url: "", events: [] as string[] });
  const [lastCreatedApiKey, setLastCreatedApiKey] = useState("");
  const [lastWebhookSecret, setLastWebhookSecret] = useState("");
  const [integrationsBusy, setIntegrationsBusy] = useState(false);
  const [auditFilter, setAuditFilter] = useState("");
  const [auditEntityFilter, setAuditEntityFilter] = useState("");
  const auditFilterRef = useRef(auditFilter);
  const auditEntityFilterRef = useRef(auditEntityFilter);
  auditFilterRef.current = auditFilter;
  auditEntityFilterRef.current = auditEntityFilter;
  const [billingOverview, setBillingOverview] = useState<BillingOverview | null>(null);
  const [billingCheckoutLoading, setBillingCheckoutLoading] = useState<string | null>(null);
  const [manualPaymentNote, setManualPaymentNote] = useState("");
  const [manualPaymentSaving, setManualPaymentSaving] = useState(false);
  const [monthlyTargets, setMonthlyTargets] = useState<MonthlyTargetOverview | null>(null);
  const [monthlyTargetValue, setMonthlyTargetValue] = useState("");
  const [monthlyTargetSaving, setMonthlyTargetSaving] = useState(false);

  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const isOwner = user?.role === "owner";
  const activeInstance = instances.find((item) => item.name === selectedInstance) ?? null;
  const activeStatus = (activeInstance?.status ?? "").toLowerCase();
  const isConnected = activeStatus === "open" || activeStatus === "connected";
  const statusTone = isConnected
    ? "bg-emerald-50/90 text-emerald-700 border-emerald-200/80"
    : activeStatus === "connecting"
      ? "bg-amber-50/90 text-amber-700 border-amber-200/80"
      : "bg-slate-100/90 text-slate-600 border-slate-200/80";
  const statusLabel =
    activeStatus === "open" || activeStatus === "connected"
      ? "Conectado"
      : activeStatus === "connecting"
        ? "Conectando"
        : activeStatus
          ? "Desconectado"
          : "Sem status";
  const recommendedAction = !activeInstance
    ? "Selecione um numero para iniciar."
    : isConnected
      ? "Tudo certo. Se quiser trocar aparelho, gere um novo QR."
      : activeStatus === "connecting"
        ? "Aguardando leitura do QR no celular."
        : "Clique em Conectar QR e escaneie no WhatsApp.";
  const activeUsers = users.filter((user) => user.status === "active");
  const inactiveUsers = users.length - activeUsers.length;
  const departments = teams.map((team) => team.name);
  const connectedInstances = instances.filter((instance) => instance.status === "open" || instance.status === "connected");
  const disconnectedInstances = instances.length - connectedInstances.length;
  const tenantsCount = ownerSummary.tenants || tenants.length;
  const tenantUsersTotal = ownerSummary.users || tenants.reduce((sum, tenant) => sum + tenant._count.users, 0);
  const tenantInstancesTotal = ownerSummary.numbers || tenants.reduce((sum, tenant) => sum + tenant._count.instances, 0);

  const bootstrapAdminForms = useCallback(async () => {
    try {
      const settings = await getCompanySettings(token);
      setCompanySettings(settings);
      setSettingsForm({
        name: settings.name,
        timezone: settings.timezone,
        businessHoursStart: settings.businessHoursStart,
        businessHoursEnd: settings.businessHoursEnd,
        welcomeMessage: settings.welcomeMessage,
        slaFirstResponseMinutes: String(settings.slaFirstResponseMinutes ?? 15),
        slaResolutionHours: String(settings.slaResolutionHours ?? 24),
        showAgentNameToCustomer: settings.messaging?.showAgentNameToCustomer ?? false,
        showBotNameToCustomer: settings.messaging?.showBotNameToCustomer ?? false,
        agentSignatureFormat: settings.messaging?.agentSignatureFormat ?? "Atendente {{agentName}}:",
        botSignatureFormat: settings.messaging?.botSignatureFormat ?? "{{botName}}:",
        signaturePlacement: settings.messaging?.signaturePlacement ?? "disabled"
      });
    } catch {
      setCompanySettings(null);
    }
    try {
      const bot = await getMenuBotSettings(token);
      setMenuBot(bot);
      setMenuBotForm({
        enabled: bot.enabled,
        greeting: bot.greeting,
        invalidReply: bot.invalidReply,
        options: bot.options.length
          ? bot.options
          : [
              { digit: "1", label: "Comercial", teamId: bot.teams.find((team) => team.name.toLowerCase().includes("comercial"))?.id },
              { digit: "2", label: "Suporte", teamId: bot.teams.find((team) => team.name.toLowerCase().includes("suporte"))?.id }
            ]
      });
    } catch {
      setMenuBot(null);
    }
    try {
      const sso = await getSsoSettings(token);
      setSsoSettings(sso);
    } catch {
      setSsoSettings(null);
    }
    try {
      const targets = await getMonthlyTargets(token);
      setMonthlyTargets(targets);
      setMonthlyTargetValue(String(targets.tenantTargetValue || ""));
    } catch {
      setMonthlyTargets(null);
    }
  }, [token]);

  const refreshSnapshot = useCallback(async () => {
    try {
      const health = await fetch(`${apiUrl()}/health`);
      setApiHealth(health.ok ? "ok" : "down");
    } catch {
      setApiHealth("down");
    }

    const rows = await listInstances(token);
    setInstances(rows);
    setSelectedInstance((current) => {
      if (current && rows.some((item) => item.name === current)) return current;
      return rows[0]?.name ?? "";
    });

    const usersRes = await fetch(`${apiUrl()}/admin/users`, { headers: { authorization: `Bearer ${token}` } });
    if (usersRes.ok) setUsers(await usersRes.json());
    try {
      const teamRows = await listTeams(token);
      setTeams(teamRows);
    } catch {
      setTeams([]);
    }
    try {
      const requests = await listAccessRequests(token);
      setAccessRequests(requests);
    } catch {
      setAccessRequests([]);
    }
    try {
      const logs = await listAuditLogs(token, {
        limit: 50,
        action: auditFilterRef.current || undefined,
        entity: auditEntityFilterRef.current || undefined
      });
      setAuditLogs(logs);
    } catch {
      setAuditLogs([]);
    }
    try {
      const shortcutRows = await listShortcuts(token);
      setShortcuts(shortcutRows);
    } catch {
      setShortcuts([]);
    }
    try {
      const settings = await getCompanySettings(token);
      setCompanySettings(settings);
    } catch {
      setCompanySettings(null);
    }
    try {
      const bot = await getMenuBotSettings(token);
      setMenuBot(bot);
    } catch {
      setMenuBot(null);
    }
    try {
      const billing = await getBillingOverview(token);
      setBillingOverview(billing);
    } catch {
      setBillingOverview(null);
    }
    try {
      const targets = await getMonthlyTargets(token);
      setMonthlyTargets(targets);
    } catch {
      setMonthlyTargets(null);
    }
    try {
      const keys = await listApiKeys(token);
      setApiKeys(keys);
    } catch {
      setApiKeys([]);
    }
    try {
      const hooks = await listWebhookEndpoints(token);
      setWebhooks(hooks);
    } catch {
      setWebhooks([]);
    }
    try {
      const deliveries = await listWebhookDeliveries(token, 10);
      setWebhookDeliveries(deliveries);
    } catch {
      setWebhookDeliveries([]);
    }
    try {
      const catalog = await listWebhookEvents(token);
      setWebhookEvents(catalog.events);
    } catch {
      setWebhookEvents([]);
    }
    try {
      const overview = await ownerTenantsOverview(token);
      setTenants(overview.tenants);
      setOwnerSummary(overview.summary);
    } catch {
      try {
        const tenantRows = await listTenants(token);
        setTenants(tenantRows);
      } catch {
        /* owner only */
      }
    }
  }, [token]);

  const refreshAuditLogs = useCallback(async () => {
    try {
      const logs = await listAuditLogs(token, {
        limit: 50,
        action: auditFilter || undefined,
        entity: auditEntityFilter || undefined
      });
      setAuditLogs(logs);
    } catch {
      setAuditLogs([]);
    }
  }, [token, auditFilter, auditEntityFilter]);

  useEffect(() => {
    void bootstrapAdminForms().finally(() => setLoading(false));
  }, [bootstrapAdminForms]);

  useEffect(() => {
    void refreshSnapshot();
    const t = setInterval(refreshSnapshot, 45000);
    return () => clearInterval(t);
  }, [refreshSnapshot]);

  useEffect(() => {
    void refreshAuditLogs();
  }, [refreshAuditLogs]);

  async function connectWhatsApp(force = false) {
    if (!selectedInstance) {
      setMessage("Selecione primeiro um numero para conectar.");
      return;
    }
    setConnecting(true);
    try {
      const body = await connectInstance(token, selectedInstance, force);
      const img = normalizeQrSrc(body.qrImage);
      if (img) {
        setQrSrc(img);
        setMessage(`QR pronto para ${selectedInstance}. Escaneie no WhatsApp do celular.`);
      } else if (body.state === "open" || body.state === "connected") {
        setQrSrc(null);
        setMessage(`Numero ${selectedInstance} conectado com sucesso.`);
      } else {
        setMessage(`Numero ${selectedInstance} em ${body.state ?? "connecting"}.`);
      }
      try {
        await syncWebhook(token, selectedInstance);
      } catch (syncErr) {
        const syncReason = syncErr instanceof Error ? syncErr.message : "falha ao sincronizar webhook";
        setMessage((current) => `${current} Aviso: ${syncReason}. Use Sync webhook se necessario.`);
      }
      await refreshSnapshot();
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Erro ao conectar";
      setMessage(`Falha ao conectar ${selectedInstance}. ${reason}`);
    } finally {
      setConnecting(false);
    }
  }

  async function disconnectWhatsApp() {
    if (!selectedInstance) {
      setMessage("Selecione primeiro um numero para desconectar.");
      return;
    }
    setDisconnecting(true);
    setQrSrc(null);
    try {
      await disconnectInstance(token, selectedInstance);
      setMessage("Numero desconectado com sucesso.");
      await refreshSnapshot();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Falha ao desconectar");
    } finally {
      setDisconnecting(false);
    }
  }

  async function syncSelectedWebhook() {
    if (!selectedInstance) {
      setMessage("Selecione primeiro um numero para sincronizar webhook.");
      return;
    }
    setSyncing(true);
    try {
      const result = await syncWebhook(token, selectedInstance);
      setMessage(`Webhook sincronizado: ${result.webhookUrl}`);
      await refreshSnapshot();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Falha ao sincronizar webhook");
    } finally {
      setSyncing(false);
    }
  }

  async function createUser() {
    const requiresDepartment = form.role === "agent" || form.role === "supervisor";
    if (requiresDepartment && !form.teamId) {
      setMessage("Selecione um departamento para esse usuario.");
      return;
    }
    const payload = {
      ...form,
      teamId: form.teamId || undefined
    };
    const res = await fetch(`${apiUrl()}/admin/users`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const body = await res.json();
      setMessage(body?.error ?? "Erro ao criar usuario");
      return;
    }
    setForm({ name: "", email: "", password: "", role: "agent", teamId: "" });
    await refreshSnapshot();
    setMessage("Usuario criado.");
  }

  async function inviteUserByLink() {
    const requiresDepartment = form.role === "agent" || form.role === "supervisor";
    if (!form.name.trim() || !form.email.trim()) {
      setMessage("Informe nome e e-mail para convidar.");
      return;
    }
    if (requiresDepartment && !form.teamId) {
      setMessage("Selecione um departamento para esse usuario.");
      return;
    }
    setInviting(true);
    setLastInviteUrl("");
    try {
      const result = await inviteUser(token, {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        teamId: form.teamId || undefined
      });
      setLastInviteUrl(result.inviteUrl);
      setForm({ name: "", email: "", password: "", role: "agent", teamId: "" });
      setMessage("Convite criado. Copie o link e envie para a pessoa.");
      await refreshSnapshot();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao convidar usuario");
    } finally {
      setInviting(false);
    }
  }

  async function saveManualPayment(status: "active" | "overdue" | "blocked") {
    setManualPaymentSaving(true);
    try {
      const updated = await recordManualPayment(token, { status, note: manualPaymentNote.trim() || undefined });
      setBillingOverview(updated);
      setMessage(status === "active" ? "Pagamento registrado e acesso liberado." : "Status financeiro atualizado.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Nao foi possivel registrar pagamento");
    } finally {
      setManualPaymentSaving(false);
    }
  }

  async function saveCompanySettings() {
    setSettingsSaving(true);
    try {
      await updateCompanySettings(token, {
        name: settingsForm.name.trim(),
        settings: {
          timezone: settingsForm.timezone,
          businessHoursStart: settingsForm.businessHoursStart,
          businessHoursEnd: settingsForm.businessHoursEnd,
          welcomeMessage: settingsForm.welcomeMessage,
          slaFirstResponseMinutes: Number(settingsForm.slaFirstResponseMinutes) || 15,
          slaResolutionHours: Number(settingsForm.slaResolutionHours) || 24,
          messaging: {
            showAgentNameToCustomer: settingsForm.showAgentNameToCustomer,
            showBotNameToCustomer: settingsForm.showBotNameToCustomer,
            agentSignatureFormat: settingsForm.agentSignatureFormat,
            botSignatureFormat: settingsForm.botSignatureFormat,
            signaturePlacement: settingsForm.signaturePlacement
          }
        }
      });
      setMessage("Configuracoes da empresa salvas.");
      await refreshSnapshot();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao salvar configuracoes");
    } finally {
      setSettingsSaving(false);
    }
  }

  async function saveMenuBotSettings() {
    setMenuBotSaving(true);
    try {
      const cleaned = menuBotForm.options
        .map((option) => ({
          digit: option.digit.trim(),
          label: option.label.trim(),
          teamId: option.teamId || undefined
        }))
        .filter((option) => option.digit && option.label);
      const saved = await updateMenuBotSettings(token, {
        enabled: menuBotForm.enabled,
        greeting: menuBotForm.greeting.trim(),
        invalidReply: menuBotForm.invalidReply.trim(),
        options: cleaned
      });
      setMenuBot(saved);
      setMenuBotForm({
        enabled: saved.enabled,
        greeting: saved.greeting,
        invalidReply: saved.invalidReply,
        options: saved.options
      });
      setMessage("Robo de atendimento salvo.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao salvar robo de atendimento");
    } finally {
      setMenuBotSaving(false);
    }
  }

  async function saveMonthlyTargetSettings() {
    setMonthlyTargetSaving(true);
    try {
      const updated = await saveMonthlyTargets(token, {
        tenantTargetValue: Number(monthlyTargetValue || 0)
      });
      setMonthlyTargets(updated);
      setMonthlyTargetValue(String(updated.tenantTargetValue || ""));
      setMessage(`Meta de ${updated.month} salva. O dashboard passa a usar este valor.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao salvar meta comercial");
    } finally {
      setMonthlyTargetSaving(false);
    }
  }

  function copyAccessLink(value: string) {
    void navigator.clipboard.writeText(value);
    setMessage("Link copiado para a area de transferencia.");
  }

  async function saveSsoSettings() {
    if (!ssoSettings) return;
    setSsoSaving(true);
    try {
      await updateSsoSettings(token, {
        enabled: ssoSettings.enabled,
        providers: ssoSettings.providers,
        jitProvisioning: ssoSettings.jitProvisioning
      });
      setMessage("Configuracoes SSO salvas.");
      await refreshSnapshot();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao salvar SSO");
    } finally {
      setSsoSaving(false);
    }
  }

  async function handleBillingCheckout(plan: "starter" | "pro") {
    setBillingCheckoutLoading(plan);
    try {
      const result = await createBillingCheckout(token, plan);
      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
        setMessage(`Checkout ${plan} aberto (${result.provider}).`);
      } else {
        setMessage(result.message ?? "Checkout iniciado.");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao iniciar checkout");
    } finally {
      setBillingCheckoutLoading(null);
    }
  }

  async function handleCreateApiKey() {
    if (!apiKeyForm.name.trim()) {
      setMessage("Informe um nome para a chave API.");
      return;
    }
    setIntegrationsBusy(true);
    try {
      const created = await createApiKey(token, { name: apiKeyForm.name.trim() });
      setLastCreatedApiKey(created.key);
      setApiKeyForm({ name: "" });
      setMessage(`Chave API criada. Copie agora — nao sera exibida novamente.`);
      await refreshSnapshot();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao criar chave API");
    } finally {
      setIntegrationsBusy(false);
    }
  }

  async function handleRevokeApiKey(id: string) {
    setIntegrationsBusy(true);
    try {
      await revokeApiKey(token, id);
      setMessage("Chave API revogada.");
      await refreshSnapshot();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao revogar chave API");
    } finally {
      setIntegrationsBusy(false);
    }
  }

  async function handleCreateWebhook() {
    if (!webhookForm.url.trim() || !webhookForm.events.length) {
      setMessage("Informe URL e pelo menos um evento para o webhook.");
      return;
    }
    setIntegrationsBusy(true);
    try {
      const created = await createWebhookEndpoint(token, {
        name: webhookForm.name.trim() || "Integracao",
        url: webhookForm.url.trim(),
        events: webhookForm.events
      });
      setLastWebhookSecret(created.secret);
      setWebhookForm({ name: "Integracao", url: "", events: [] });
      setMessage("Webhook criado. Copie o secret de assinatura agora.");
      await refreshSnapshot();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao criar webhook");
    } finally {
      setIntegrationsBusy(false);
    }
  }

  async function handleDeleteWebhook(id: string) {
    setIntegrationsBusy(true);
    try {
      await deleteWebhookEndpoint(token, id);
      setMessage("Webhook removido.");
      await refreshSnapshot();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao remover webhook");
    } finally {
      setIntegrationsBusy(false);
    }
  }

  function toggleWebhookEvent(event: string) {
    setWebhookForm((current) => ({
      ...current,
      events: current.events.includes(event)
        ? current.events.filter((item) => item !== event)
        : [...current.events, event]
    }));
  }

  async function createDepartment() {
    if (!teamForm.name.trim()) {
      setMessage("Informe o nome do departamento.");
      return;
    }
    if (teamForm.name.trim().length < 2) {
      setMessage("Nome do departamento precisa ter pelo menos 2 caracteres.");
      return;
    }
    setTeamSaving(true);
    try {
      await createTeam(token, {
        name: teamForm.name.trim(),
        managerId: teamForm.managerId || undefined
      });
      setTeamForm({ name: "", managerId: "" });
      setMessage("Departamento criado com sucesso.");
      await refreshSnapshot();
      document.getElementById("admin-departamentos")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao criar departamento");
    } finally {
      setTeamSaving(false);
    }
  }

  async function saveShortcut() {
    if (!shortcutForm.tag.trim() || !shortcutForm.text.trim()) {
      setMessage("Preencha hashtag e texto do atalho.");
      return;
    }
    try {
      await upsertShortcut(token, {
        tag: shortcutForm.tag.trim(),
        text: shortcutForm.text.trim()
      });
      setShortcutForm({ tag: "", text: "" });
      setMessage("Atalho salvo com sucesso.");
      await refreshSnapshot();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao salvar atalho");
    }
  }

  async function removeShortcut(tag: string) {
    const ok = window.confirm(`Excluir atalho ${tag}?`);
    if (!ok) return;
    try {
      await deleteShortcut(token, tag);
      setMessage(`Atalho ${tag} excluido.`);
      await refreshSnapshot();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao excluir atalho");
    }
  }

  async function removeDepartment(team: TeamRow) {
    const ok = window.confirm(`Excluir departamento ${team.name}?`);
    if (!ok) return;
    try {
      await deleteTeam(token, team.id);
      setMessage(`Departamento ${team.name} excluido.`);
      await refreshSnapshot();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao excluir departamento");
    }
  }

  async function createNumber() {
    try {
      await createInstance(token, {
        name: instanceForm.name.trim(),
        label: instanceForm.label.trim(),
        phone: instanceForm.phone.trim() || undefined
      });
      setInstanceForm({ name: "", label: "", phone: "" });
      setMessage("Numero criado. Agora clique Conectar QR.");
      await refreshSnapshot();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao criar numero");
    }
  }

  async function createTenant() {
    if (
      !tenantForm.companyName.trim() ||
      !tenantForm.slug.trim() ||
      !tenantForm.ownerName.trim() ||
      !tenantForm.ownerEmail.trim() ||
      !tenantForm.ownerPassword.trim()
    ) {
      setMessage("Preencha todos os campos obrigatorios para liberar acesso do cliente.");
      return;
    }
    try {
      const result = await onboardTenant(token, tenantForm);
      setMessage("Empresa onboarded com sucesso para revenda.");
      setLastOnboarded({
        tenantName: result.tenant.name,
        tenantSlug: result.tenant.slug,
        ownerEmail: result.owner.email
      });
      setTenantForm({
        companyName: "",
        companyDocument: "",
        slug: "",
        ownerName: "",
        ownerEmail: "",
        ownerPassword: "",
        whatsappInstanceName: "principal",
        whatsappLabel: "WhatsApp Comercial"
      });
      await refreshSnapshot();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao onboard tenant");
    }
  }

  async function removeSelectedUser() {
    if (!selectedUser) return;
    if (selectedUser.role === "owner") {
      setMessage("O dono da empresa nao pode ser excluido.");
      return;
    }
    try {
      await deleteUser(token, selectedUser.id);
      setMessage(`Usuario ${selectedUser.name} excluido.`);
      setSelectedUser(null);
      await refreshSnapshot();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao excluir usuario");
    }
  }

  async function removeUserDirect(user: UserRow) {
    if (user.role === "owner") {
      setMessage("O dono da empresa nao pode ser excluido.");
      return;
    }
    const ok = window.confirm(`Excluir usuario ${user.name}? Essa acao nao pode ser desfeita.`);
    if (!ok) return;
    try {
      await deleteUser(token, user.id);
      setMessage(`Usuario ${user.name} excluido.`);
      if (selectedUser?.id === user.id) setSelectedUser(null);
      await refreshSnapshot();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao excluir usuario");
    }
  }

  async function approveRequest(id: string) {
    try {
      await approveAccessRequest(token, id);
      setMessage("Solicitacao aprovada. Usuario ativado.");
      await refreshSnapshot();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao aprovar solicitacao");
    }
  }

  async function rejectRequest(id: string) {
    try {
      await rejectAccessRequest(token, id);
      setMessage("Solicitacao recusada e removida.");
      await refreshSnapshot();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao recusar solicitacao");
    }
  }

  async function removeInstance(name: string) {
    try {
      await deleteInstance(token, name);
      if (selectedInstance === name) setSelectedInstance("");
      setMessage(`Numero ${name} removido.`);
      await refreshSnapshot();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao remover numero");
    }
  }

  async function runReset() {
    if (resetForm.confirmation !== "RESETAR") {
      setMessage("Digite RESETAR para confirmar o reset operacional.");
      return;
    }
    setResetLoading(true);
    try {
      const result = await operationalReset(token, {
        ownerName: resetForm.ownerName.trim(),
        ownerEmail: resetForm.ownerEmail.trim(),
        ownerPassword: resetForm.ownerPassword,
        ownerPhone: resetForm.ownerPhone.trim(),
        confirmation: "RESETAR"
      });
      setMessage(`${result.message} Voce sera desconectado para entrar com o novo owner.`);
      setTimeout(() => {
        localStorage.removeItem("atlas:token");
        localStorage.removeItem("atlas-one-session");
        localStorage.removeItem("atlas-one-session-v2");
        window.location.reload();
      }, 900);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro no reset operacional");
    } finally {
      setResetLoading(false);
    }
  }

  async function changeTenantBilling(tenantId: string, billingStatus: "active" | "overdue" | "blocked") {
    setBillingBusyId(tenantId);
    try {
      await updateTenantBilling(token, tenantId, { billingStatus });
      setMessage(`Status financeiro atualizado para ${billingStatus}.`);
      await refreshSnapshot();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao atualizar status financeiro");
    } finally {
      setBillingBusyId(null);
    }
  }

  return (
    <main className="w-full p-4 pb-28 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="text-3xl font-semibold">Administracao</h1>
          <p className="text-sm text-atlas-muted">WhatsApp, usuarios e permissoes</p>
          <p className="mt-1 text-xs">
            API:{" "}
            <span
              className={
                apiHealth === "ok"
                  ? "font-semibold text-emerald-700"
                  : apiHealth === "down"
                    ? "font-semibold text-rose-700"
                    : "font-semibold text-slate-500"
              }
            >
              {apiHealth === "ok" ? "saudavel" : apiHealth === "down" ? "instavel" : "checando"}
            </span>
          </p>
          <nav className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
            {[
              { id: "admin-config", label: "Empresa" },
              { id: "admin-integracoes", label: "API / Webhooks" },
              { id: "admin-billing", label: "Plano e vendas" },
              { id: "admin-metas", label: "Metas" },
              { id: "admin-convite", label: "Links de acesso" },
              { id: "admin-whatsapp", label: "WhatsApp" },
              { id: "admin-usuarios", label: "Usuarios" },
              { id: "admin-departamentos", label: "Departamentos" },
              { id: "admin-robo", label: "Robo URA" },
              { id: "admin-aprovacao", label: "Aprovacao" },
              { id: "admin-auditoria", label: "Auditoria" }
            ].map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="shrink-0 rounded-full border border-white/70 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-800"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </header>

        <Card id="admin-config" className="scroll-mt-24 p-5">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-atlas-blue" />
            <p className="font-semibold">Configuracoes da empresa</p>
          </div>
          <p className="mt-1 text-xs text-atlas-muted">
            Nome, fuso horario e horario comercial usados na operacao do time.
            {companySettings ? ` · ID: ${companySettings.slug}` : null}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              className="rounded-xl bg-white/80 px-3 py-2 text-sm sm:col-span-2"
              placeholder="Nome da empresa"
              value={settingsForm.name}
              onChange={(e) => setSettingsForm((s) => ({ ...s, name: e.target.value }))}
            />
            <select
              className="rounded-xl bg-white/80 px-3 py-2 text-sm"
              value={settingsForm.timezone}
              onChange={(e) => setSettingsForm((s) => ({ ...s, timezone: e.target.value }))}
            >
              <option value="America/Sao_Paulo">Brasilia (GMT-3)</option>
              <option value="America/Manaus">Manaus (GMT-4)</option>
              <option value="America/Belem">Belem (GMT-3)</option>
            </select>
            <input
              className="rounded-xl bg-white/80 px-3 py-2 text-sm"
              type="time"
              value={settingsForm.businessHoursStart}
              onChange={(e) => setSettingsForm((s) => ({ ...s, businessHoursStart: e.target.value }))}
            />
            <input
              className="rounded-xl bg-white/80 px-3 py-2 text-sm"
              type="time"
              value={settingsForm.businessHoursEnd}
              onChange={(e) => setSettingsForm((s) => ({ ...s, businessHoursEnd: e.target.value }))}
            />
            <textarea
              className="min-h-[72px] rounded-xl bg-white/80 px-3 py-2 text-sm sm:col-span-2"
              placeholder="Mensagem de boas-vindas (opcional)"
              value={settingsForm.welcomeMessage}
              onChange={(e) => setSettingsForm((s) => ({ ...s, welcomeMessage: e.target.value }))}
            />
            <input
              className="rounded-xl bg-white/80 px-3 py-2 text-sm"
              type="number"
              min={1}
              max={240}
              placeholder="SLA 1a resposta (min)"
              value={settingsForm.slaFirstResponseMinutes}
              onChange={(e) => setSettingsForm((s) => ({ ...s, slaFirstResponseMinutes: e.target.value }))}
            />
            <input
              className="rounded-xl bg-white/80 px-3 py-2 text-sm"
              type="number"
              min={1}
              max={168}
              placeholder="SLA resolucao (horas)"
              value={settingsForm.slaResolutionHours}
              onChange={(e) => setSettingsForm((s) => ({ ...s, slaResolutionHours: e.target.value }))}
            />
          </div>
          <div className="mt-4 rounded-2xl border border-white/70 bg-white/60 p-4">
            <p className="text-sm font-semibold">Assinatura visivel ao cliente (WhatsApp)</p>
            <p className="mt-1 text-xs text-atlas-muted">
              Para o cliente ver o nome do atendente, o Atlas adiciona a assinatura no texto enviado ao WhatsApp.
            </p>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settingsForm.showAgentNameToCustomer}
                onChange={(e) => setSettingsForm((s) => ({ ...s, showAgentNameToCustomer: e.target.checked }))}
              />
              Mostrar nome do atendente
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settingsForm.showBotNameToCustomer}
                onChange={(e) => setSettingsForm((s) => ({ ...s, showBotNameToCustomer: e.target.checked }))}
              />
              Mostrar nome do robo
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                className="rounded-xl bg-white/80 px-3 py-2 text-sm sm:col-span-2"
                placeholder="Formato assinatura atendente"
                value={settingsForm.agentSignatureFormat}
                onChange={(e) => setSettingsForm((s) => ({ ...s, agentSignatureFormat: e.target.value }))}
              />
              <select
                className="rounded-xl bg-white/80 px-3 py-2 text-sm sm:col-span-2"
                value={settingsForm.signaturePlacement}
                onChange={(e) =>
                  setSettingsForm((s) => ({
                    ...s,
                    signaturePlacement: e.target.value as "before" | "after" | "disabled"
                  }))
                }
              >
                <option value="disabled">Sem assinatura no WhatsApp</option>
                <option value="before">Assinatura antes da mensagem</option>
                <option value="after">Assinatura depois da mensagem</option>
              </select>
            </div>
          </div>
          <Button className="mt-4" onClick={() => void saveCompanySettings()} disabled={settingsSaving}>
            {settingsSaving ? <Loader2 className="animate-spin" size={16} /> : "Salvar configuracoes"}
          </Button>
        </Card>

        {ssoSettings?.availableProviders.length ? (
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-atlas-blue" />
              <p className="font-semibold">Login SSO (OIDC)</p>
            </div>
            <p className="mt-1 text-xs text-atlas-muted">
              Google, Microsoft ou OIDC generico. Requer variaveis no servidor (SSO_PLAN.md).
            </p>
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ssoSettings.enabled}
                onChange={(e) => setSsoSettings((s) => (s ? { ...s, enabled: e.target.checked } : s))}
              />
              SSO habilitado para esta empresa
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ssoSettings.jitProvisioning}
                onChange={(e) => setSsoSettings((s) => (s ? { ...s, jitProvisioning: e.target.checked } : s))}
              />
              Criar usuario automaticamente no primeiro login SSO
            </label>
            <div className="mt-3 flex flex-wrap gap-3">
              {ssoSettings.availableProviders.map((provider) => (
                <label key={provider.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ssoSettings.providers.includes(provider.id as SsoSettings["providers"][number])}
                    onChange={(e) =>
                      setSsoSettings((s) => {
                        if (!s) return s;
                        const next = e.target.checked
                          ? [...new Set([...s.providers, provider.id as SsoSettings["providers"][number]])]
                          : s.providers.filter((p) => p !== provider.id);
                        return { ...s, providers: next };
                      })
                    }
                  />
                  {provider.displayName}
                </label>
              ))}
            </div>
            <Button className="mt-4" onClick={() => void saveSsoSettings()} disabled={ssoSaving}>
              {ssoSaving ? <Loader2 className="animate-spin" size={16} /> : "Salvar SSO"}
            </Button>
          </Card>
        ) : null}

        <Card id="admin-integracoes" className="scroll-mt-24 p-5">
          <div className="flex items-center gap-2">
            <Plug size={18} className="text-atlas-blue" />
            <p className="font-semibold">Integracoes (API e Webhooks)</p>
          </div>
          <p className="mt-1 text-xs text-atlas-muted">
            Conecte CRM externo, Zapier, Make ou sistemas proprios. Documentacao em API.md e WEBHOOKS.md.
          </p>

          {lastCreatedApiKey ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs">
              <p className="font-semibold text-amber-800">Chave API (copie agora)</p>
              <code className="mt-2 block break-all rounded bg-white/80 p-2 text-[11px]">{lastCreatedApiKey}</code>
            </div>
          ) : null}

          {lastWebhookSecret ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs">
              <p className="font-semibold text-amber-800">Secret do webhook (copie agora)</p>
              <code className="mt-2 block break-all rounded bg-white/80 p-2 text-[11px]">{lastWebhookSecret}</code>
            </div>
          ) : null}

          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold">Chaves API</p>
              <div className="mt-3 flex gap-2">
                <input
                  className="flex-1 rounded-xl bg-white/80 px-3 py-2 text-sm"
                  placeholder="Nome da integracao"
                  value={apiKeyForm.name}
                  onChange={(e) => setApiKeyForm({ name: e.target.value })}
                />
                <Button onClick={() => void handleCreateApiKey()} disabled={integrationsBusy}>
                  Criar
                </Button>
              </div>
              <div className="mt-3 space-y-2">
                {apiKeys.length === 0 ? (
                  <p className="text-xs text-atlas-muted">Nenhuma chave ativa.</p>
                ) : (
                  apiKeys.map((key) => (
                    <div key={key.id} className="flex items-center justify-between rounded-xl border border-white/70 bg-white/60 px-3 py-2 text-xs">
                      <div>
                        <p className="font-medium">{key.name}</p>
                        <p className="text-atlas-muted">{key.keyPrefix}… · {key.scopes.join(", ")}</p>
                      </div>
                      <Button variant="glass" onClick={() => void handleRevokeApiKey(key.id)} disabled={integrationsBusy}>
                        Revogar
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold">Webhooks de saida</p>
              <div className="mt-3 grid gap-2">
                <input
                  className="rounded-xl bg-white/80 px-3 py-2 text-sm"
                  placeholder="Nome"
                  value={webhookForm.name}
                  onChange={(e) => setWebhookForm((s) => ({ ...s, name: e.target.value }))}
                />
                <input
                  className="rounded-xl bg-white/80 px-3 py-2 text-sm"
                  placeholder="https://seu-sistema.com/webhooks/atlas"
                  value={webhookForm.url}
                  onChange={(e) => setWebhookForm((s) => ({ ...s, url: e.target.value }))}
                />
                <div className="flex flex-wrap gap-2">
                  {(webhookEvents.length ? webhookEvents : ["message.created", "lead.created"]).map((event) => (
                    <button
                      key={event}
                      type="button"
                      className={`rounded-full px-2.5 py-1 text-[11px] ${
                        webhookForm.events.includes(event)
                          ? "bg-blue-600 text-white"
                          : "bg-white/80 text-slate-600"
                      }`}
                      onClick={() => toggleWebhookEvent(event)}
                    >
                      {event}
                    </button>
                  ))}
                </div>
                <Button onClick={() => void handleCreateWebhook()} disabled={integrationsBusy}>
                  Adicionar webhook
                </Button>
              </div>
              <div className="mt-3 space-y-2">
                {webhooks.length === 0 ? (
                  <p className="text-xs text-atlas-muted">Nenhum webhook configurado.</p>
                ) : (
                  webhooks.map((hook) => (
                    <div key={hook.id} className="rounded-xl border border-white/70 bg-white/60 px-3 py-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{hook.name}</p>
                          <p className="break-all text-atlas-muted">{hook.url}</p>
                          <p className="mt-1 text-atlas-muted">{(hook.events as string[]).join(", ")}</p>
                        </div>
                        <Button variant="glass" onClick={() => void handleDeleteWebhook(hook.id)} disabled={integrationsBusy}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {webhookDeliveries.length > 0 ? (
            <div className="mt-5">
              <p className="text-sm font-semibold">Entregas recentes</p>
              <div className="mt-2 space-y-1">
                {webhookDeliveries.map((delivery) => (
                  <div key={delivery.id} className="flex items-center justify-between rounded-lg bg-white/50 px-3 py-2 text-[11px]">
                    <span>
                      {delivery.event} → {delivery.endpoint.name}
                    </span>
                    <span className={delivery.status === "success" ? "text-emerald-700" : delivery.status === "failed" ? "text-rose-700" : "text-amber-700"}>
                      {delivery.status} ({delivery.attempts}x)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <p className="mt-4 text-xs text-atlas-muted">
            OpenAPI: <code>/v1/openapi.json</code> · Base URL publica: <code>/v1</code>
          </p>
        </Card>

        <Card id="admin-billing" className="scroll-mt-24 p-5">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-atlas-blue" />
            <p className="font-semibold">Plano, vendas e controle de acessos</p>
          </div>
          {billingOverview ? (
            <>
              <p className="mt-1 text-xs text-atlas-muted">
                Plano {billingOverview.plan.name} · {billingOverview.plan.priceLabel}
                {billingOverview.billing.trialActive && billingOverview.billing.trialEndsAt
                  ? ` · Trial ate ${new Date(billingOverview.billing.trialEndsAt).toLocaleDateString("pt-BR")}`
                  : ""}
                {billingOverview.billing.dueAt
                  ? ` · Vencimento ${new Date(billingOverview.billing.dueAt).toLocaleDateString("pt-BR")}`
                  : ""}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/70 bg-white/70 p-3">
                  <p className="text-xs text-atlas-muted">Seats (usuarios)</p>
                  <p className="mt-1 text-2xl font-semibold">
                    {billingOverview.seats.used}/{billingOverview.seats.limit}
                  </p>
                  <p className="text-xs text-atlas-muted">{billingOverview.seats.available} disponiveis</p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/70 p-3">
                  <p className="text-xs text-atlas-muted">Canais WhatsApp</p>
                  <p className="mt-1 text-2xl font-semibold">
                    {billingOverview.channels.used}/{billingOverview.channels.limit}
                  </p>
                  <p className="text-xs text-atlas-muted">{billingOverview.channels.available} disponiveis</p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/70 p-3">
                  <p className="text-xs text-atlas-muted">Conversas no mes</p>
                  <p className="mt-1 text-2xl font-semibold">{billingOverview.usage.conversationsThisMonth}</p>
                  <p className="text-xs text-atlas-muted">
                    {billingOverview.limits.maxConversationsPerMonth
                      ? `Limite ${billingOverview.limits.maxConversationsPerMonth}`
                      : "Ilimitado"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/70 p-3">
                  <p className="text-xs text-atlas-muted">Status financeiro</p>
                  <p className="mt-1 text-lg font-semibold capitalize">{billingOverview.billing.status}</p>
                  <p className="text-xs text-atlas-muted">{billingOverview.billing.subscriptionStatus}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
                {Object.entries(billingOverview.plan.features).map(([key, enabled]) => (
                  <span
                    key={key}
                    className={`rounded-full px-2.5 py-1 ${enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}
                  >
                    {key}: {enabled ? "sim" : "nao"}
                  </span>
                ))}
              </div>
              {!billingOverview.capabilities.canAddUser ? (
                <p className="mt-3 text-xs font-medium text-amber-800">
                  Limite de seats atingido. Faca upgrade do plano para convidar mais usuarios.
                </p>
              ) : null}
              {billingOverview.plan.id !== "pro" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="glass"
                    disabled={Boolean(billingCheckoutLoading)}
                    onClick={() => void handleBillingCheckout("pro")}
                  >
                    {billingCheckoutLoading === "pro" ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      "Assinar Pro"
                    )}
                  </Button>
                  {billingOverview.plan.id !== "starter" ? (
                    <Button
                      variant="glass"
                      disabled={Boolean(billingCheckoutLoading)}
                      onClick={() => void handleBillingCheckout("starter")}
                    >
                      {billingCheckoutLoading === "starter" ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        "Plano Starter"
                      )}
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-5 rounded-2xl border border-white/70 bg-white/70 p-4">
                <p className="text-sm font-semibold">Controle comercial manual</p>
                <p className="mt-1 text-xs text-atlas-muted">
                  Marque pagamento recebido, atraso ou bloqueio. Ideal enquanto o Asaas producao nao estiver ativo.
                </p>
                <p className="mt-2 rounded-xl border border-blue-100 bg-blue-50/80 px-3 py-2 text-[11px] text-blue-900">
                  Transcricao de audio: configure <code>OPENAI_API_KEY</code> ou <code>GROQ_API_KEY</code> no servidor e reinicie a API
                  (<code>pm2 restart atlas-api</code>). Groq tem tier gratuito com Whisper.
                </p>
                <textarea
                  className="mt-3 min-h-[64px] w-full rounded-xl bg-white/90 px-3 py-2 text-sm"
                  placeholder="Observacao (ex: PIX recebido, boleto vencido, cliente em negociacao...)"
                  value={manualPaymentNote}
                  onChange={(e) => setManualPaymentNote(e.target.value)}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button className="h-8 px-3 text-xs" disabled={manualPaymentSaving} onClick={() => void saveManualPayment("active")}>
                    Marcar como pago / liberar
                  </Button>
                  <Button variant="glass" className="h-8 px-3 text-xs" disabled={manualPaymentSaving} onClick={() => void saveManualPayment("overdue")}>
                    Marcar atrasado
                  </Button>
                  <Button variant="glass" className="h-8 px-3 text-xs" disabled={manualPaymentSaving} onClick={() => void saveManualPayment("blocked")}>
                    Bloquear acesso
                  </Button>
                </div>
                {billingOverview.billing.paymentHistory?.length ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold text-slate-600">Historico manual recente</p>
                    {billingOverview.billing.paymentHistory.slice(0, 5).map((entry, index) => (
                      <div key={`${String(entry.at)}-${index}`} className="rounded-xl bg-white/80 px-3 py-2 text-xs">
                        <p className="font-medium capitalize">{String(entry.status ?? "evento")}</p>
                        <p className="text-slate-500">{entry.note ? String(entry.note) : "Sem observacao"}</p>
                        <p className="text-[10px] text-slate-400">
                          {entry.at ? new Date(String(entry.at)).toLocaleString("pt-BR") : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              {billingOverview.access ? (
                <div className="mt-5 rounded-2xl border border-white/70 bg-white/70 p-4">
                  <p className="text-sm font-semibold">Equipe e acessos ({billingOverview.access.activeUsers} ativos)</p>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-500">
                          <th className="px-2 py-1">Nome</th>
                          <th className="px-2 py-1">Email</th>
                          <th className="px-2 py-1">Papel</th>
                          <th className="px-2 py-1">Departamento</th>
                          <th className="px-2 py-1">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billingOverview.access.users.map((member) => (
                          <tr key={member.id} className="border-t border-slate-100">
                            <td className="px-2 py-2 font-medium">{member.name}</td>
                            <td className="px-2 py-2">{member.email}</td>
                            <td className="px-2 py-2 capitalize">{member.role}</td>
                            <td className="px-2 py-2">{member.team?.name ?? "—"}</td>
                            <td className="px-2 py-2">
                              <Badge>{member.status === "active" ? "Ativo" : member.status}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <p className="mt-3 text-xs text-atlas-muted">Carregando informacoes do plano...</p>
          )}
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold">Visao executiva da operacao</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/70 bg-white/70 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-atlas-muted">Usuarios do meu time</p>
                <Users size={16} className="text-atlas-blue" />
              </div>
              <p className="mt-2 text-2xl font-semibold">{users.length}</p>
              <p className="text-xs text-atlas-muted">
                {activeUsers.length} ativos · {inactiveUsers} inativos
              </p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/70 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-atlas-muted">Departamentos</p>
                <Building2 size={16} className="text-atlas-blue" />
              </div>
              <p className="mt-2 text-2xl font-semibold">{departments.length}</p>
              <p className="truncate text-xs text-atlas-muted">{departments.join(" · ") || "Sem departamentos"}</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/70 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-atlas-muted">Numeros WhatsApp</p>
                <Smartphone size={16} className="text-atlas-blue" />
              </div>
              <p className="mt-2 text-2xl font-semibold">{instances.length}</p>
              <p className="text-xs text-atlas-muted">
                {connectedInstances.length} conectados · {disconnectedInstances} desconectados
              </p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/70 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-atlas-muted">Clientes SaaS ativos</p>
                <Shield size={16} className="text-atlas-blue" />
              </div>
              <p className="mt-2 text-2xl font-semibold">{tenantsCount || 1}</p>
              <p className="text-xs text-atlas-muted">
                {tenantUsersTotal || users.length} usuarios · {tenantInstancesTotal || instances.length} numeros
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <p className="font-semibold">Playbook comercial padrao</p>
          <p className="mt-1 text-xs text-atlas-muted">
            Fluxo recomendado para equipes de vendas e atendimento em todos os clientes.
          </p>
          <div className="mt-3 grid gap-2 text-xs">
            <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-2">
              <p className="font-semibold">1) Qualificacao inicial (ate 10 min)</p>
              <p className="text-atlas-muted">Confirmar nome, necessidade, orçamento e responsavel pela decisao.</p>
            </div>
            <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-2">
              <p className="font-semibold">2) Registro no CRM</p>
              <p className="text-atlas-muted">Garantir contato com telefone, etapa correta e valor estimado.</p>
            </div>
            <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-2">
              <p className="font-semibold">3) Transferencia por departamento</p>
              <p className="text-atlas-muted">Mover para Comercial, Suporte ou Financeiro conforme demanda.</p>
            </div>
            <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-2">
              <p className="font-semibold">4) Follow-up e fechamento</p>
              <p className="text-atlas-muted">Usar automacoes para follow-up e atualizar etapa para Fechado/Perdido.</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Hash size={15} className="text-atlas-blue" />
            <p className="font-semibold">Atalhos por hashtag (respostas rapidas)</p>
          </div>
          <p className="mt-1 text-xs text-atlas-muted">
            Exemplo: <strong>#boasvindas</strong>. No Inbox, digite a hashtag e clique em aplicar.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <input
              className="rounded-xl bg-white/80 px-3 py-2 text-sm"
              placeholder="#tag"
              value={shortcutForm.tag}
              onChange={(e) => setShortcutForm((s) => ({ ...s, tag: e.target.value }))}
            />
            <input
              className="rounded-xl bg-white/80 px-3 py-2 text-sm sm:col-span-2"
              placeholder="Texto da resposta rapida"
              value={shortcutForm.text}
              onChange={(e) => setShortcutForm((s) => ({ ...s, text: e.target.value }))}
            />
          </div>
          <Button className="mt-3" variant="glass" onClick={saveShortcut}>
            <Plus size={16} /> Salvar atalho
          </Button>
          <div className="mt-3 space-y-2">
            {shortcuts.map((shortcut) => (
              <div key={shortcut.tag} className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2 text-xs">
                <div className="min-w-0">
                  <p className="font-semibold">{shortcut.tag}</p>
                  <p className="truncate text-atlas-muted">{shortcut.text}</p>
                </div>
                <Button
                  variant="glass"
                  className="h-7 px-2"
                  onClick={() => void removeShortcut(shortcut.tag)}
                  aria-label={`Excluir ${shortcut.tag}`}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            ))}
            {!shortcuts.length ? <p className="text-xs text-atlas-muted">Nenhum atalho cadastrado.</p> : null}
          </div>
        </Card>

        {isOwner ? (
          <OwnerClientsPanel
            tenants={tenants}
            summary={ownerSummary}
            busyId={billingBusyId}
            onBillingChange={changeTenantBilling}
          />
        ) : null}

        <Card id="admin-metas" className="scroll-mt-24 p-5">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-atlas-blue" />
            <p className="font-semibold">Metas comerciais do mes</p>
          </div>
          <p className="mt-1 text-xs text-atlas-muted">
            Este valor alimenta o gauge <strong>Execucao da meta</strong> no Dashboard. E diferente do simulador (20/30/3500).
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              className="rounded-xl bg-white/80 px-3 py-2 text-sm"
              type="number"
              min={0}
              placeholder="Meta de receita do mes (R$)"
              value={monthlyTargetValue}
              onChange={(e) => setMonthlyTargetValue(e.target.value)}
            />
            <Button onClick={() => void saveMonthlyTargetSettings()} disabled={monthlyTargetSaving}>
              {monthlyTargetSaving ? <Loader2 className="animate-spin" size={16} /> : "Salvar meta"}
            </Button>
          </div>
          {monthlyTargets ? (
            <p className="mt-2 text-xs text-atlas-muted">
              Mes atual: {monthlyTargets.month} · Meta cadastrada: R${" "}
              {Number(monthlyTargets.tenantTargetValue || 0).toLocaleString("pt-BR")}
            </p>
          ) : null}
        </Card>

        <Card id="admin-convite" className="scroll-mt-24 p-5">
          <div className="flex items-center gap-2">
            <Link2 size={18} className="text-atlas-blue" />
            <p className="font-semibold">Links para teste e cadastro</p>
          </div>
          <p className="mt-1 text-xs text-atlas-muted">
            Envie estes links para a pessoa testar o Atlas One no computador dela. Solicitacoes de equipe aparecem em Aprovacao.
          </p>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-white/70 bg-white/75 p-3">
              <p className="text-xs font-semibold text-slate-700">Pagina de demonstracao</p>
              <p className="mt-1 break-all text-xs text-slate-500">
                {typeof window !== "undefined" ? `${window.location.origin}/teste` : "/teste"}
              </p>
              <Button
                variant="glass"
                className="mt-2 h-8 px-3 text-xs"
                onClick={() =>
                  copyAccessLink(typeof window !== "undefined" ? `${window.location.origin}/teste` : "/teste")
                }
              >
                Copiar link de demo
              </Button>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/75 p-3">
              <p className="text-xs font-semibold text-slate-700">Cadastro direto da equipe</p>
              <p className="mt-1 break-all text-xs text-slate-500">
                {typeof window !== "undefined"
                  ? `${window.location.origin}/?auth=equipe&tenant=${companySettings?.slug ?? "sua-empresa"}`
                  : "/?auth=equipe"}
              </p>
              <Button
                variant="glass"
                className="mt-2 h-8 px-3 text-xs"
                onClick={() =>
                  copyAccessLink(
                    typeof window !== "undefined"
                      ? `${window.location.origin}/?auth=equipe&tenant=${companySettings?.slug ?? "sua-empresa"}`
                      : "/?auth=equipe"
                  )
                }
              >
                Copiar link da equipe
              </Button>
            </div>
          </div>
        </Card>

        <Card id="admin-whatsapp" className="scroll-mt-24 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Shield className="text-atlas-blue" />
              <div>
                <p className="font-semibold">{activeInstance?.label ?? "Nenhum numero selecionado"}</p>
                <p className="text-xs text-atlas-muted">
                  {activeInstance
                    ? `Instancia: ${activeInstance.name}${activeInstance.phone ? ` · Telefone: ${activeInstance.phone}` : ""}`
                    : "Crie ou selecione uma instancia"}
                </p>
                <span className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${statusTone}`}>
                  <span className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-500" : activeStatus === "connecting" ? "bg-amber-500" : "bg-slate-400"}`} />
                  {statusLabel}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <select
                className="h-10 min-w-[210px] rounded-xl border border-white/70 bg-white/80 px-3 text-sm"
                value={selectedInstance}
                onChange={(e) => setSelectedInstance(e.target.value)}
              >
                <option value="">Selecionar numero</option>
                {instances.map((instance) => (
                  <option key={instance.id} value={instance.name}>
                    {instance.label} ({instance.name})
                  </option>
                ))}
              </select>
              <Button
                onClick={() => connectWhatsApp(isConnected)}
                disabled={connecting || !selectedInstance}
              >
                {connecting ? <Loader2 className="animate-spin" size={18} /> : <QrCode size={18} />}
                {isConnected ? "Gerar novo QR" : "Conectar QR"}
              </Button>
              <Button variant="glass" onClick={disconnectWhatsApp} disabled={disconnecting || !selectedInstance}>
                {disconnecting ? <Loader2 className="animate-spin" size={16} /> : "Desconectar"}
              </Button>
              <Button variant="glass" onClick={syncSelectedWebhook} disabled={syncing || !selectedInstance}>
                {syncing ? <Loader2 className="animate-spin" size={16} /> : "Sync webhook"}
              </Button>
              <Button variant="glass" onClick={() => void refreshSnapshot()} title="Atualiza listas e status sem apagar formularios em edicao">
                <RefreshCw size={16} />
              </Button>
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/70 bg-white/70 p-3">
              <p className="text-[11px] font-semibold text-atlas-muted">Proxima acao recomendada</p>
              <p className="mt-1 text-xs text-slate-700">{recommendedAction}</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/70 p-3">
              <p className="text-[11px] font-semibold text-atlas-muted">Ultima sincronizacao webhook</p>
              <p className="mt-1 text-xs text-slate-700">{formatDateTime(activeInstance?.lastSyncAt)}</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/70 p-3">
              <p className="text-[11px] font-semibold text-atlas-muted">Contexto da sessao</p>
              <p className="mt-1 text-xs text-slate-700">
                {activeInstance ? `${activeInstance.label} (${activeInstance.name})` : "Nenhuma instancia selecionada"}
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-atlas-muted">
            {activeInstance
              ? `Numero selecionado: ${activeInstance.label} (${activeInstance.name}). ${
                  isConnected ? "Ja conectado." : "Ainda nao conectado."
                }`
              : "Selecione um numero para iniciar conexao via QR."}{" "}
            Use Conectar QR para parear, Desconectar para encerrar e Sync webhook para atualizar o endpoint.
          </p>
          {message ? <p className="mt-3 text-sm">{message}</p> : null}
          {qrSrc ? (
            <img src={qrSrc} alt="QR" className="mx-auto mt-6 h-72 w-72 rounded-2xl bg-white p-4 shadow-sm" />
          ) : null}
        </Card>

        <Card className="p-5">
          <p className="font-semibold">Adicionar numero de WhatsApp</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <input
              className="rounded-xl bg-white/80 px-3 py-2 text-sm"
              placeholder="Nome tecnico (ex: comercial-sp)"
              value={instanceForm.name}
              onChange={(e) => setInstanceForm((s) => ({ ...s, name: e.target.value }))}
            />
            <input
              className="rounded-xl bg-white/80 px-3 py-2 text-sm"
              placeholder="Rótulo (ex: Comercial SP)"
              value={instanceForm.label}
              onChange={(e) => setInstanceForm((s) => ({ ...s, label: e.target.value }))}
            />
            <input
              className="rounded-xl bg-white/80 px-3 py-2 text-sm"
              placeholder="Número com DDI (opcional)"
              value={instanceForm.phone}
              onChange={(e) => setInstanceForm((s) => ({ ...s, phone: e.target.value }))}
            />
          </div>
          <Button className="mt-4" onClick={createNumber}>
            <Plus size={16} /> Adicionar numero
          </Button>
        </Card>

        <Card id="admin-usuarios" className="scroll-mt-24 p-5">
          <p className="font-semibold">Novo usuario</p>
          <p className="mt-1 text-xs text-atlas-muted">
            Crie com senha imediata ou envie um link de convite valido por 7 dias.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              className="rounded-xl bg-white/80 px-3 py-2 text-sm"
              placeholder="Nome"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="rounded-xl bg-white/80 px-3 py-2 text-sm"
              placeholder="E-mail"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              className="rounded-xl bg-white/80 px-3 py-2 text-sm"
              placeholder="Senha (criacao direta)"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <select
              className="rounded-xl bg-white/80 px-3 py-2 text-sm"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="agent">Atendente</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Admin</option>
            </select>
            <select
              className="rounded-xl bg-white/80 px-3 py-2 text-sm sm:col-span-2"
              value={form.teamId}
              onChange={(e) => setForm({ ...form, teamId: e.target.value })}
            >
              <option value="">{form.role === "agent" || form.role === "supervisor" ? "Departamento (obrigatorio)" : "Departamento (opcional)"}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={createUser}>
              <Plus size={16} /> Criar com senha
            </Button>
            <Button variant="glass" onClick={() => void inviteUserByLink()} disabled={inviting}>
              {inviting ? <Loader2 className="animate-spin" size={16} /> : <Link2 size={16} />}
              Convidar por link
            </Button>
          </div>
          {lastInviteUrl ? (
            <div className="mt-3 rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <p className="font-semibold text-emerald-800 dark:text-emerald-200">Link de convite</p>
              <p className="mt-1 break-all text-emerald-700 dark:text-emerald-300">{lastInviteUrl}</p>
              <Button
                className="mt-2 h-8 px-3 text-xs"
                variant="glass"
                onClick={() => {
                  void navigator.clipboard.writeText(lastInviteUrl);
                  setMessage("Link copiado para a area de transferencia.");
                }}
              >
                Copiar link
              </Button>
            </div>
          ) : null}
        </Card>

        <Card id="admin-departamentos" className="scroll-mt-24 p-5">
          <p className="font-semibold">Departamentos</p>
          <p className="mt-1 text-xs text-atlas-muted">Crie departamentos e vincule atendentes para transferencias mais organizadas.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <input
              className="rounded-xl bg-white/80 px-3 py-2 text-sm sm:col-span-2"
              placeholder="Nome do departamento (ex: Comercial)"
              value={teamForm.name}
              onChange={(e) => setTeamForm((s) => ({ ...s, name: e.target.value }))}
            />
            <select
              className="rounded-xl bg-white/80 px-3 py-2 text-sm"
              value={teamForm.managerId}
              onChange={(e) => setTeamForm((s) => ({ ...s, managerId: e.target.value }))}
            >
              <option value="">Gerente (opcional)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <Button className="mt-3" onClick={() => void createDepartment()} disabled={teamSaving}>
            {teamSaving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
            Criar departamento
          </Button>
          <div className="mt-3 space-y-2">
            {teams.map((team) => (
              <div key={team.id} className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2 text-xs">
                <div>
                  <p className="font-semibold">{team.name}</p>
                  <p className="text-atlas-muted">
                    Gerente: {users.find((u) => u.id === team.managerId)?.name ?? "Nao definido"}
                  </p>
                </div>
                <Button variant="glass" className="h-7 px-2" onClick={() => void removeDepartment(team)} aria-label={`Excluir ${team.name}`}>
                  <Trash2 size={13} />
                </Button>
              </div>
            ))}
            {!teams.length ? (
              <EmptyState
                title="Nenhum departamento"
                description="Organize sua equipe criando departamentos como Comercial, Suporte ou Financeiro."
                actionLabel="Criar departamento acima"
              />
            ) : null}
          </div>
        </Card>

        <Card id="admin-robo" className="scroll-mt-24 p-5">
          <div className="flex items-center gap-2">
            <MessageCircle size={18} className="text-atlas-blue" />
            <p className="font-semibold">Robo de atendimento (URA)</p>
          </div>
          <p className="mt-1 text-xs text-atlas-muted">
            O robo envia o menu apenas no <strong>primeiro contato</strong> ou quando o cliente volta a falar depois de voce
            <strong> fechar</strong> o atendimento. Durante a conversa aberta, o atendente humano responde normalmente.
          </p>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={menuBotForm.enabled}
              onChange={(e) => setMenuBotForm((s) => ({ ...s, enabled: e.target.checked }))}
            />
            Ativar robo automatico no WhatsApp
          </label>
          <div className="mt-3 grid gap-3">
            <textarea
              className="min-h-[72px] rounded-xl bg-white/80 px-3 py-2 text-sm"
              placeholder="Mensagem de boas-vindas"
              value={menuBotForm.greeting}
              onChange={(e) => setMenuBotForm((s) => ({ ...s, greeting: e.target.value }))}
            />
            <textarea
              className="min-h-[56px] rounded-xl bg-white/80 px-3 py-2 text-sm"
              placeholder="Resposta quando a opcao for invalida"
              value={menuBotForm.invalidReply}
              onChange={(e) => setMenuBotForm((s) => ({ ...s, invalidReply: e.target.value }))}
            />
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-600">Opcoes do menu</p>
              <Button
                variant="glass"
                className="h-7 px-2 text-xs"
                onClick={() =>
                  setMenuBotForm((s) => ({
                    ...s,
                    options: [...s.options, { digit: String(s.options.length + 1), label: "", teamId: "" }]
                  }))
                }
              >
                <Plus size={13} />
                Adicionar opcao
              </Button>
            </div>
            {menuBotForm.options.map((option, index) => (
              <div key={`${option.digit}-${index}`} className="grid gap-2 rounded-xl border border-white/70 bg-white/70 p-3 sm:grid-cols-[72px_1fr_1fr_auto]">
                <input
                  className="rounded-lg bg-white px-2 py-1.5 text-sm"
                  placeholder="Numero"
                  value={option.digit}
                  onChange={(e) =>
                    setMenuBotForm((s) => ({
                      ...s,
                      options: s.options.map((row, rowIndex) => (rowIndex === index ? { ...row, digit: e.target.value } : row))
                    }))
                  }
                />
                <input
                  className="rounded-lg bg-white px-2 py-1.5 text-sm"
                  placeholder="Texto da opcao (ex: Comercial)"
                  value={option.label}
                  onChange={(e) =>
                    setMenuBotForm((s) => ({
                      ...s,
                      options: s.options.map((row, rowIndex) => (rowIndex === index ? { ...row, label: e.target.value } : row))
                    }))
                  }
                />
                <select
                  className="rounded-lg bg-white px-2 py-1.5 text-sm"
                  value={option.teamId ?? ""}
                  onChange={(e) =>
                    setMenuBotForm((s) => ({
                      ...s,
                      options: s.options.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, teamId: e.target.value || undefined } : row
                      )
                    }))
                  }
                >
                  <option value="">Departamento destino</option>
                  {(menuBot?.teams ?? teams).map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="glass"
                  className="h-8 w-8"
                  onClick={() =>
                    setMenuBotForm((s) => ({
                      ...s,
                      options: s.options.filter((_, rowIndex) => rowIndex !== index)
                    }))
                  }
                  aria-label="Remover opcao"
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            ))}
            {!menuBotForm.options.length ? (
              <EmptyState
                title="Nenhuma opcao configurada"
                description="Adicione opcoes como 1 Comercial, 2 Suporte, 3 Financeiro."
                actionLabel="Adicionar primeira opcao"
              />
            ) : null}
          </div>
          <Button className="mt-4" onClick={() => void saveMenuBotSettings()} disabled={menuBotSaving}>
            {menuBotSaving ? <Loader2 className="animate-spin" size={16} /> : "Salvar robo de atendimento"}
          </Button>
        </Card>

        <Card id="admin-aprovacao" className="scroll-mt-24 p-5">
          <p className="font-semibold">Aprovacao de acessos pendentes</p>
          <p className="mt-1 text-xs text-atlas-muted">Solicitacoes de equipe aguardando autorizacao do dono.</p>
          <div className="mt-3 space-y-2">
            {accessRequests.map((req) => (
              <div key={req.id} className="rounded-2xl border border-white/70 bg-white/70 px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{req.name}</p>
                    <p className="text-xs text-atlas-muted">{req.email}</p>
                    <p className="text-[10px] text-atlas-muted">
                      {req.phone ? `Telefone: ${req.phone}` : "Sem telefone"} ·{" "}
                      {new Date(req.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <Badge>Pendente</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button className="h-8 px-3 text-xs" onClick={() => void approveRequest(req.id)}>
                    Aprovar acesso
                  </Button>
                  <Button variant="glass" className="h-8 px-3 text-xs" onClick={() => void rejectRequest(req.id)}>
                    Recusar e excluir
                  </Button>
                </div>
              </div>
            ))}
            {!accessRequests.length ? (
              <EmptyState
                title="Nenhuma solicitacao pendente"
                description="Quando alguem pedir acesso pela aba Equipe no login, aparecera aqui para aprovacao."
              />
            ) : null}
          </div>
        </Card>

        <Card className="p-5">
          <p className="font-semibold">Equipe</p>
          {loading ? (
            <Loader2 className="mx-auto mt-6 animate-spin" />
          ) : users.length ? (
            <div className="mt-4 space-y-2">
              {users.map((u) => (
                <div
                  key={u.id}
                  onDoubleClick={() => setSelectedUser(u)}
                  className={`flex items-center justify-between gap-2 rounded-2xl px-4 py-3 ${
                    selectedUser?.id === u.id ? "bg-blue-50/80 ring-1 ring-blue-200" : "bg-white/70"
                  }`}
                >
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelectedUser(u)}>
                    <p className="font-medium">{u.name}</p>
                    <p className="truncate text-sm text-atlas-muted">{u.email}</p>
                    <p className="text-[10px] text-atlas-muted">clique para selecionar · duplo clique para acoes rapidas</p>
                  </button>
                  <div className="flex items-center gap-2">
                    <Badge>{ROLE_LABEL[u.role] ?? u.role}</Badge>
                    <Badge>{STATUS_LABEL[u.status] ?? u.status}</Badge>
                    {u.role !== "owner" ? (
                      <Button variant="glass" className="h-8 px-2" onClick={() => void removeUserDirect(u)} aria-label={`Excluir ${u.name}`}>
                        <Trash2 size={14} />
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                title="Equipe vazia"
                description="Convide colegas por link ou crie usuarios com senha para comecar a operar."
              />
            </div>
          )}
          {selectedUser && selectedUser.role !== "owner" ? (
            <div className="mt-3 rounded-2xl border border-white/70 bg-white/70 p-3">
              <p className="text-sm font-semibold">Acoes rapidas · {selectedUser.name}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="glass" onClick={removeSelectedUser}>
                  <Trash2 size={14} /> Excluir usuario
                </Button>
                <Button
                  variant="glass"
                  onClick={async () => {
                    await fetch(`${apiUrl()}/admin/users/${selectedUser.id}`, {
                      method: "PATCH",
                      headers,
                      body: JSON.stringify({ status: selectedUser.status === "active" ? "inactive" : "active" })
                    });
                    await refreshSnapshot();
                  }}
                >
                  {selectedUser.status === "active" ? "Desativar" : "Ativar"}
                </Button>
              </div>
            </div>
          ) : null}
        </Card>

        <Card className="p-5">
          <p className="font-semibold">Numeros salvos</p>
          <div className="mt-3 space-y-2">
            {instances.map((instance) => (
              <div key={instance.id} className="flex items-center justify-between rounded-2xl bg-white/70 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{instance.label}</p>
                  <p className="text-xs text-atlas-muted">{instance.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{instance.status}</Badge>
                  <Button variant="glass" className="h-8 px-2" onClick={() => removeInstance(instance.name)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
            {!instances.length ? <p className="text-xs text-atlas-muted">Nenhum numero salvo.</p> : null}
          </div>
        </Card>

        <Card id="admin-auditoria" className="scroll-mt-24 p-5">
          <p className="font-semibold">Monitor de acessos</p>
          <p className="mt-1 text-xs text-atlas-muted">
            Trilha de auditoria: login, permissoes, exportacoes, integracoes e alteracoes criticas.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <select
              className="rounded-xl bg-white/80 px-3 py-2 text-xs"
              value={auditFilter}
              onChange={(e) => setAuditFilter(e.target.value)}
            >
              <option value="">Todas acoes</option>
              <option value="auth_login_success">Login OK</option>
              <option value="auth_logout">Logout</option>
              <option value="data_export">Exportacao</option>
              <option value="permissions_updated">Permissoes</option>
              <option value="api_key_created">Chave API</option>
            </select>
            <select
              className="rounded-xl bg-white/80 px-3 py-2 text-xs"
              value={auditEntityFilter}
              onChange={(e) => setAuditEntityFilter(e.target.value)}
            >
              <option value="">Todas entidades</option>
              <option value="Auth">Autenticacao</option>
              <option value="User">Usuario</option>
              <option value="Export">Exportacao</option>
              <option value="ApiKey">API</option>
              <option value="WebhookEndpoint">Webhook</option>
            </select>
          </div>
          <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
            {auditLogs.map((log) => (
              <div key={log.id} className="rounded-xl bg-white/70 px-3 py-2 text-xs">
                <p className="font-semibold">{describeAuditLog(log)}</p>
                <p className="text-atlas-muted">{new Date(log.createdAt).toLocaleString("pt-BR")}</p>
              </div>
            ))}
            {!auditLogs.length ? <p className="text-xs text-atlas-muted">Sem eventos recentes.</p> : null}
          </div>
        </Card>

        {isOwner ? <Card className="p-5">
          <p className="font-semibold">Reset operacional (owner)</p>
          <p className="mt-1 text-xs text-atlas-muted">
            Apaga usuarios, numeros, conversas, CRM e automacoes. Mantem apenas um novo dono com 2FA obrigatorio.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              className="rounded-xl bg-white/80 px-3 py-2 text-sm"
              placeholder="Nome do dono"
              value={resetForm.ownerName}
              onChange={(e) => setResetForm((s) => ({ ...s, ownerName: e.target.value }))}
            />
            <input
              className="rounded-xl bg-white/80 px-3 py-2 text-sm"
              placeholder="E-mail do dono"
              value={resetForm.ownerEmail}
              onChange={(e) => setResetForm((s) => ({ ...s, ownerEmail: e.target.value }))}
            />
            <input
              className="rounded-xl bg-white/80 px-3 py-2 text-sm"
              placeholder="Senha do dono"
              type="password"
              value={resetForm.ownerPassword}
              onChange={(e) => setResetForm((s) => ({ ...s, ownerPassword: e.target.value }))}
            />
            <input
              className="rounded-xl bg-white/80 px-3 py-2 text-sm"
              placeholder="Telefone para 2FA (com DDI)"
              value={resetForm.ownerPhone}
              onChange={(e) => setResetForm((s) => ({ ...s, ownerPhone: e.target.value }))}
            />
            <input
              className="rounded-xl bg-white/80 px-3 py-2 text-sm sm:col-span-2"
              placeholder='Confirme digitando "RESETAR"'
              value={resetForm.confirmation}
              onChange={(e) => setResetForm((s) => ({ ...s, confirmation: e.target.value.toUpperCase() }))}
            />
          </div>
          <Button
            className="mt-4"
            variant="glass"
            onClick={runReset}
            disabled={resetLoading || !resetForm.ownerName || !resetForm.ownerEmail || !resetForm.ownerPassword || !resetForm.ownerPhone}
          >
            {resetLoading ? <Loader2 className="animate-spin" size={16} /> : <Shield size={16} />}
            Executar reset total
          </Button>
        </Card> : null}

        {isOwner ? <Card className="p-5">
          <p className="font-semibold">Revenda multiempresa (onboarding)</p>
          <p className="mt-1 text-xs text-atlas-muted">Crie o cliente e libere o acesso do dono em poucos cliques.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              className="rounded-xl bg-white/80 px-3 py-2 text-sm"
              placeholder="Nome da empresa"
              value={tenantForm.companyName}
              onChange={(e) => setTenantForm((s) => ({ ...s, companyName: e.target.value }))}
            />
            <input
              className="rounded-xl bg-white/80 px-3 py-2 text-sm"
              placeholder="CNPJ / Documento fiscal (opcional)"
              value={tenantForm.companyDocument}
              onChange={(e) => setTenantForm((s) => ({ ...s, companyDocument: e.target.value }))}
            />
            <input
              className="rounded-xl bg-white/80 px-3 py-2 text-sm"
              placeholder="Slug (ex: cliente-x)"
              value={tenantForm.slug}
              onChange={(e) => setTenantForm((s) => ({ ...s, slug: e.target.value.toLowerCase() }))}
            />
            <input
              className="rounded-xl bg-white/80 px-3 py-2 text-sm"
              placeholder="Nome do dono"
              value={tenantForm.ownerName}
              onChange={(e) => setTenantForm((s) => ({ ...s, ownerName: e.target.value }))}
            />
            <input
              className="rounded-xl bg-white/80 px-3 py-2 text-sm"
              placeholder="Email do dono"
              value={tenantForm.ownerEmail}
              onChange={(e) => setTenantForm((s) => ({ ...s, ownerEmail: e.target.value }))}
            />
            <input
              className="rounded-xl bg-white/80 px-3 py-2 text-sm"
              placeholder="Senha inicial"
              type="password"
              value={tenantForm.ownerPassword}
              onChange={(e) => setTenantForm((s) => ({ ...s, ownerPassword: e.target.value }))}
            />
            <input
              className="rounded-xl bg-white/80 px-3 py-2 text-sm"
              placeholder="Instância WhatsApp"
              value={tenantForm.whatsappInstanceName}
              onChange={(e) => setTenantForm((s) => ({ ...s, whatsappInstanceName: e.target.value }))}
            />
          </div>
          <Button className="mt-4" onClick={createTenant}>
            Onboard empresa para revenda
          </Button>
          {lastOnboarded ? (
            <div className="mt-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-3 text-xs text-emerald-900">
              <p className="font-semibold">Cliente pronto para liberar acesso</p>
              <p className="mt-1">
                Empresa: <strong>{lastOnboarded.tenantName}</strong> · Slug: <strong>{lastOnboarded.tenantSlug}</strong>
              </p>
              <p>
                Dono: <strong>{lastOnboarded.ownerEmail}</strong>
              </p>
              <p className="mt-1">
                Proximo passo: enviar login para o dono e pedir para conectar o WhatsApp no primeiro acesso.
              </p>
            </div>
          ) : null}
          {!!tenants.length && (
            <div className="mt-4 space-y-2">
              {tenants.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-atlas-muted">{t.slug}</p>
                  </div>
                  <div className="text-right text-xs text-atlas-muted">
                    <p>{t._count.users} usuários</p>
                    <p>{t._count.instances} números</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card> : null}
      </div>
    </main>
  );
}
