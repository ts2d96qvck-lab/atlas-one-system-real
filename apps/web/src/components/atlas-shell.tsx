"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Moon, Shield, Sun } from "lucide-react";
import { Button, Card } from "@atlas-one/ui";
import {
  acceptInvite,
  bootstrapOwnerAccount,
  buildOidcLoginUrl,
  confirmPasswordReset,
  getAuthProviders,
  getBootstrapStatus,
  login,
  previewInvite,
  requestTenantAccess,
  requestPasswordReset,
  verifyLoginCode,
  type AuthProviderInfo,
  type InvitePreview,
  type SessionUser
} from "../lib/api";
import { friendlyError } from "../lib/friendly-errors";
import { hasPermission, normalizeSessionUser, toAppSession, type AppSession } from "../lib/session-user";
import { AtlasApp } from "./atlas-app";
import { AdminView } from "./admin-view";
import { AutomationsView } from "./automations-view";
import { CampaignsView } from "./campaigns-view";
import { CrmView } from "./crm-view";
import { DashboardView } from "./dashboard-view";

const STORAGE_KEY = "atlas-one-session-v2";

const views = [
  { id: "inbox", label: "Inbox" },
  { id: "dashboard", label: "Dashboard" },
  { id: "admin", label: "Admin" },
  { id: "crm", label: "CRM" },
  { id: "campanhas", label: "Campanhas" },
  { id: "automacoes", label: "Automacao" }
] as const;

export type AtlasView = (typeof views)[number]["id"];

type Session = AppSession;

function canAccessView(user: SessionUser, view: AtlasView) {
  const normalized = normalizeSessionUser(user);
  const isAdminTier = ["owner", "admin", "supervisor"].includes(normalized.role);
  const isManagerTier = isAdminTier || ["manager", "team_manager"].includes(normalized.role);

  if (view === "inbox") return true;
  if (view === "crm") return true;
  if (view === "dashboard") return isManagerTier || hasPermission(normalized, "dashboard:read");
  if (view === "admin") return isAdminTier || hasPermission(normalized, "admin:read");
  if (view === "automacoes") return isAdminTier || hasPermission(normalized, "automation:read");
  if (view === "campanhas") return isAdminTier || hasPermission(normalized, "campaign:read");
  return false;
}

function ThemeToggle({
  theme,
  onToggle,
  className = "fixed bottom-4 left-4 z-50"
}: {
  theme: "light" | "dark";
  onToggle: () => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <button
        type="button"
        className="glass-panel inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-slate-600 hover:text-blue-700"
        onClick={onToggle}
        title="Alternar modo noturno"
      >
        {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        {theme === "dark" ? "Claro" : "Noturno"}
      </button>
    </div>
  );
}

export function AtlasShell() {
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<AtlasView>("inbox");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [challengeRole, setChallengeRole] = useState("");
  const [ownerFirstAccess, setOwnerFirstAccess] = useState(false);
  const [smsCode, setSmsCode] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register" | "team" | "forgot" | "invite">("login");
  const [inviteToken, setInviteToken] = useState("");
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null);
  const [invitePassword, setInvitePassword] = useState("");
  const [ownerCompanyName, setOwnerCompanyName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [requestName, setRequestName] = useState("");
  const [requestPhone, setRequestPhone] = useState("");
  const [canCreateOwner, setCanCreateOwner] = useState(true);
  const [resetChallengeId, setResetChallengeId] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [liveAt, setLiveAt] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [ssoProviders, setSsoProviders] = useState<AuthProviderInfo[]>([]);
  const [adminMounted, setAdminMounted] = useState(false);

  const commitSession = useCallback((payload: { token?: string | null; user?: Partial<SessionUser> | null } | null) => {
    const next = toAppSession(payload);
    if (!next) {
      setSession(null);
      return;
    }
    setSession(next);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    const ssoToken = params.get("sso_token");
    const ssoError = params.get("sso_error");
    if (ssoError) {
      setError(decodeURIComponent(ssoError));
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      return;
    }
    if (!ssoToken) return;

    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${window.location.origin}/auth/me`, {
          headers: { authorization: `Bearer ${ssoToken}` }
        });
        if (!res.ok) throw new Error("Sessao SSO invalida");
        const body = (await res.json()) as { user: SessionUser };
        const next = toAppSession({ token: ssoToken, user: body.user });
        if (!next) throw new Error("Sessao SSO invalida");
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setSession(next);
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      } catch (err) {
        setError(friendlyError(err instanceof Error ? err.message : "Falha no login SSO"));
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const invite = params.get("invite");
    const tenant = params.get("tenant");
    const auth = params.get("auth");
    if (invite && tenant) {
      setInviteToken(invite);
      setTenantSlug(tenant);
      setAuthMode("invite");
    } else if (auth === "equipe" || auth === "team") {
      setAuthMode("team");
      if (tenant) setTenantSlug(tenant);
    } else if (auth === "register" || auth === "cadastro") {
      setAuthMode("register");
    }
  }, []);

  useEffect(() => {
    if (authMode !== "invite" || !inviteToken || !tenantSlug.trim()) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    previewInvite(inviteToken, tenantSlug.trim())
      .then((preview) => {
        if (cancelled) return;
        setInvitePreview(preview);
        setEmail(preview.email);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(friendlyError(err instanceof Error ? err.message : "Convite invalido"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authMode, inviteToken, tenantSlug]);

  useEffect(() => {
    localStorage.removeItem("atlas-one-session");
    localStorage.removeItem("atlas:token");
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    let parsed: Session | null = null;
    try {
      parsed = JSON.parse(raw) as Session;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    void (async () => {
      try {
        const res = await fetch(`${typeof window !== "undefined" ? window.location.origin : ""}/auth/me`, {
          headers: { authorization: `Bearer ${parsed!.token}` }
        });
        if (!res.ok) {
          localStorage.removeItem(STORAGE_KEY);
          setSession(null);
          return;
        }
        const body = (await res.json()) as { user: SessionUser };
        const next = toAppSession({ token: parsed!.token, user: body.user });
        if (!next) {
          localStorage.removeItem(STORAGE_KEY);
          setSession(null);
          return;
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setSession(next);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        setSession(null);
      }
    })();

    setLiveAt(new Date().toLocaleTimeString("pt-BR"));
    const timer = setInterval(() => setLiveAt(new Date().toLocaleTimeString("pt-BR")), 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("atlas-theme");
    const next = saved === "dark" ? "dark" : "light";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("atlas-theme", theme);
  }, [theme]);

  const visibleViews = session ? views.filter((item) => canAccessView(session.user, item.id)) : views;

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ view?: AtlasView }>;
      if (!custom.detail?.view || !session) return;
      if (canAccessView(session.user, custom.detail.view)) setView(custom.detail.view);
    };
    window.addEventListener("atlas:navigate", handler as EventListener);
    return () => window.removeEventListener("atlas:navigate", handler as EventListener);
  }, [session]);

  useEffect(() => {
    if (!session) {
      setAdminMounted(false);
      return;
    }
    if (view === "admin" && canAccessView(session.user, "admin")) {
      setAdminMounted(true);
    }
  }, [session, view]);

  useEffect(() => {
    if (!session) return;
    if (canAccessView(session.user, view)) return;
    const fallback = visibleViews[0]?.id ?? "inbox";
    setView(fallback);
  }, [session, view, visibleViews]);

  useEffect(() => {
    let cancelled = false;
    const slug = tenantSlug.trim().toLowerCase();
    if (!slug) {
      setCanCreateOwner(true);
      return;
    }
    getBootstrapStatus(slug)
      .then((status) => {
        if (cancelled) return;
        setCanCreateOwner(status.canBootstrap);
        if (!status.canBootstrap && authMode === "register") {
          setAuthMode("login");
          setInfo("Esta empresa ja possui cadastro. Entre ou solicite acesso como equipe.");
        }
      })
      .catch(() => {
        if (!cancelled) setCanCreateOwner(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantSlug, authMode]);

  useEffect(() => {
    if (authMode !== "login" || !tenantSlug.trim() || session) {
      setSsoProviders([]);
      return;
    }
    let cancelled = false;
    void getAuthProviders(tenantSlug.trim())
      .then(({ providers }) => {
        if (!cancelled) {
          setSsoProviders(providers.filter((provider) => provider.kind === "oidc" && provider.configured));
        }
      })
      .catch(() => {
        if (!cancelled) setSsoProviders([]);
      });
    return () => {
      cancelled = true;
    };
  }, [authMode, tenantSlug, session]);

  const handleLogin = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const result = await login(email, password, tenantSlug);
      if (result.requires2fa) {
        setChallengeId(result.challengeId);
        setMaskedPhone(result.maskedPhone);
        setChallengeRole(result.role);
        setOwnerFirstAccess(result.ownerFirstAccess);
        setInfo(result.message);
        return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toAppSession(result)));
      commitSession(result);
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Login invalido"));
    } finally {
      setLoading(false);
    }
  }, [email, password, tenantSlug, commitSession]);

  const handleAcceptInvite = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!inviteToken || !tenantSlug.trim()) return;
      setLoading(true);
      setError("");
      setInfo("");
      try {
        const result = await acceptInvite({
          token: inviteToken,
          tenantSlug: tenantSlug.trim(),
          password: invitePassword
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toAppSession(result)));
        commitSession(result);
        if (typeof window !== "undefined") {
          window.history.replaceState({}, "", window.location.pathname);
        }
      } catch (err) {
        setError(friendlyError(err instanceof Error ? err.message : "Nao foi possivel aceitar convite"));
      } finally {
        setLoading(false);
      }
    },
    [invitePassword, inviteToken, tenantSlug, commitSession]
  );

  const handleVerifyCode = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (!challengeId) return;
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const result = await verifyLoginCode(challengeId, smsCode);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toAppSession(result)));
      commitSession(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Codigo invalido");
    } finally {
      setLoading(false);
    }
  }, [challengeId, smsCode, commitSession]);

  const handleRequestReset = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const result = await requestPasswordReset(tenantSlug, email);
      if (result.challengeId) {
        setResetChallengeId(result.challengeId);
        setInfo(`Codigo enviado para ${result.maskedPhone}. Informe o codigo e a nova senha.`);
      } else {
        setInfo("Se existir conta com SMS ativo, o codigo foi enviado para o telefone cadastrado.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao solicitar recuperacao");
    } finally {
      setLoading(false);
    }
  }, [email, tenantSlug]);

  const handleConfirmReset = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    try {
      await confirmPasswordReset(resetChallengeId, resetCode, newPassword);
      setInfo("Senha alterada com sucesso. Voce ja pode entrar.");
      setAuthMode("login");
      setResetCode("");
      setResetChallengeId("");
      setNewPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao redefinir senha");
    } finally {
      setLoading(false);
    }
  }, [newPassword, resetChallengeId, resetCode]);

  const handleBootstrapOwner = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setLoading(true);
      setError("");
      setInfo("");
      try {
        await bootstrapOwnerAccount({
          companyName: ownerCompanyName,
          tenantSlug,
          ownerName,
          ownerEmail: email,
          ownerPassword: password,
          ownerPhone
        });
        setInfo("Conta criada com sucesso. Faca login e confirme o codigo no WhatsApp.");
        setAuthMode("login");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao criar conta dona");
      } finally {
        setLoading(false);
      }
    },
    [email, ownerCompanyName, ownerName, ownerPhone, password, tenantSlug]
  );

  const handleRequestAccess = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setLoading(true);
      setError("");
      setInfo("");
      try {
        const result = await requestTenantAccess({
          tenantSlug,
          name: requestName,
          email,
          password,
          phone: requestPhone || undefined
        });
        setInfo(result.message);
        setAuthMode("login");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao solicitar acesso");
      } finally {
        setLoading(false);
      }
    },
    [email, password, requestName, requestPhone, tenantSlug]
  );

  if (!session) {
    return (
      <>
        <ThemeToggle theme={theme} onToggle={() => setTheme((current) => (current === "dark" ? "light" : "dark"))} />
        <main className="flex min-h-dvh items-center justify-center overflow-y-auto overflow-x-hidden bg-gradient-to-br from-slate-50 via-blue-50/40 to-violet-50/30 p-4 py-8 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 sm:p-6">
          <Card className="my-auto w-full max-w-md border-white/80 p-6 shadow-xl shadow-blue-500/10 sm:p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-500 text-white shadow-lg shadow-blue-500/30">
              <Shield size={24} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Atlas One</h1>
            <p className="mt-1 text-sm text-atlas-muted">Plataforma de atendimento e vendas</p>
            <p className="mt-2 text-xs text-slate-500">Acesso local: app.atlasone.local.gd</p>
            {typeof window !== "undefined" && window.location.protocol === "https:" ? (
              <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                Conexao segura
              </p>
            ) : null}
          </div>

          {!challengeId && authMode !== "forgot" && authMode !== "invite" ? (
            <div className="mb-5 grid grid-cols-3 gap-1 rounded-2xl bg-slate-100/80 p-1 dark:bg-slate-800/60">
              {([
                ["login", "Entrar"],
                ["register", "Criar conta"],
                ["team", "Equipe"]
              ] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setAuthMode(mode);
                    setError("");
                    setInfo("");
                  }}
                  className={`rounded-xl px-2 py-2 text-xs font-semibold transition sm:text-sm ${
                    authMode === mode
                      ? "bg-white text-blue-700 shadow dark:bg-slate-900 dark:text-blue-300"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          {challengeId ? (
            <form className="space-y-4" onSubmit={handleVerifyCode}>
              {challengeRole === "owner" ? (
                <div className="rounded-2xl border border-blue-200/80 bg-blue-50/70 p-3">
                  <p className="text-sm font-semibold text-blue-900">
                    {ownerFirstAccess ? "Primeiro acesso do dono" : "Acesso de dono confirmado"}
                  </p>
                  <p className="text-xs text-blue-800">
                    Validacao em duas etapas obrigatoria para conta proprietaria.
                  </p>
                </div>
              ) : null}
              <p className="text-sm text-atlas-muted">Confirme o codigo enviado no WhatsApp para {maskedPhone}.</p>
              <label className="block text-sm">
                <span className="text-atlas-muted">Codigo (6 digitos)</span>
                <input
                  className="atlas-field mt-2 w-full rounded-2xl px-4 py-3 outline-none"
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  required
                />
              </label>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {info ? <p className="text-sm text-emerald-700">{info}</p> : null}
              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" size={18} /> : "Confirmar acesso"}
              </Button>
              <Button
                className="w-full"
                variant="glass"
                type="button"
                onClick={() => {
                  setChallengeId("");
                  setSmsCode("");
                  setChallengeRole("");
                  setOwnerFirstAccess(false);
                  setInfo("");
                }}
              >
                Voltar
              </Button>
            </form>
          ) : authMode === "forgot" ? (
            <div className="space-y-4">
              <form className="space-y-3" onSubmit={handleRequestReset}>
                <label className="block text-sm">
                  <span className="text-atlas-muted">Empresa (ID da empresa)</span>
                  <input
                    className="atlas-field mt-2 w-full rounded-2xl px-4 py-3 outline-none"
                    value={tenantSlug}
                    onChange={(e) => setTenantSlug(e.target.value.toLowerCase())}
                    required
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-atlas-muted">E-mail</span>
                  <input
                    className="atlas-field mt-2 w-full rounded-2xl px-4 py-3 outline-none"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    required
                  />
                </label>
                <Button className="w-full" type="submit" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" size={18} /> : "Enviar codigo por SMS"}
                </Button>
              </form>
              <form className="space-y-3" onSubmit={handleConfirmReset}>
                {resetChallengeId ? (
                  <p className="text-xs text-atlas-muted">Codigo enviado. Informe o SMS e a nova senha abaixo.</p>
                ) : null}
                <label className="block text-sm">
                  <span className="text-atlas-muted">Codigo SMS</span>
                  <input
                    className="atlas-field mt-2 w-full rounded-2xl px-4 py-3 outline-none"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    required
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-atlas-muted">Nova senha</span>
                  <input
                    className="atlas-field mt-2 w-full rounded-2xl px-4 py-3 outline-none"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    type="password"
                    minLength={8}
                    required
                  />
                </label>
                {error ? <p className="text-sm text-red-600">{error}</p> : null}
                {info ? <p className="text-sm text-emerald-700">{info}</p> : null}
                <Button className="w-full" type="submit" disabled={loading || !resetChallengeId}>
                  {loading ? <Loader2 className="animate-spin" size={18} /> : "Redefinir senha"}
                </Button>
              </form>
              <Button className="w-full" variant="glass" onClick={() => setAuthMode("login")}>
                Voltar para login
              </Button>
            </div>
          ) : authMode === "invite" ? (
            <form className="space-y-4" onSubmit={handleAcceptInvite}>
              {invitePreview ? (
                <div className="rounded-2xl border border-blue-200/80 bg-blue-50/70 p-3 dark:border-blue-900/50 dark:bg-blue-950/30">
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Convite para {invitePreview.tenantName}</p>
                  <p className="mt-1 text-xs text-blue-800 dark:text-blue-200">
                    Ola, {invitePreview.name}. Defina sua senha para entrar como{" "}
                    {invitePreview.role === "admin" ? "administrador" : invitePreview.role === "supervisor" ? "supervisor" : "atendente"}.
                  </p>
                  <p className="mt-1 text-[10px] text-blue-700 dark:text-blue-300">{invitePreview.email}</p>
                </div>
              ) : loading ? (
                <p className="text-sm text-atlas-muted">Validando convite...</p>
              ) : null}
              <label className="block text-sm">
                <span className="text-atlas-muted">Nova senha (min. 8 caracteres)</span>
                <input
                  className="atlas-field mt-2 w-full rounded-2xl px-4 py-3 outline-none"
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  type="password"
                  minLength={8}
                  required
                  disabled={!invitePreview}
                />
              </label>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {info ? <p className="text-sm text-emerald-700">{info}</p> : null}
              <Button className="w-full" type="submit" disabled={loading || !invitePreview}>
                {loading ? <Loader2 className="animate-spin" size={18} /> : "Ativar conta e entrar"}
              </Button>
              <Button
                className="w-full"
                variant="glass"
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setInvitePreview(null);
                  setInviteToken("");
                  setInvitePassword("");
                  setError("");
                  if (typeof window !== "undefined") window.history.replaceState({}, "", window.location.pathname);
                }}
              >
                Ja tenho conta
              </Button>
            </form>
          ) : authMode === "register" ? (
            <form className="space-y-4" onSubmit={handleBootstrapOwner}>
              <p className="text-sm text-atlas-muted">
                Primeiro acesso da sua empresa: crie a conta do responsavel (dono/contratante).
              </p>
              <label className="block text-sm">
                <span className="text-atlas-muted">Nome da empresa</span>
                <input
                  className="atlas-field mt-2 w-full rounded-2xl px-4 py-3 outline-none"
                  value={ownerCompanyName}
                  onChange={(e) => setOwnerCompanyName(e.target.value)}
                  required
                />
              </label>
              <label className="block text-sm">
                  <span className="text-atlas-muted">Empresa (ID da empresa)</span>
                <input
                  className="atlas-field mt-2 w-full rounded-2xl px-4 py-3 outline-none"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value.toLowerCase())}
                  placeholder="ex: minha-empresa"
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="text-atlas-muted">Seu nome (dono)</span>
                <input
                  className="atlas-field mt-2 w-full rounded-2xl px-4 py-3 outline-none"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="text-atlas-muted">Telefone para 2FA (com DDI)</span>
                <input
                  className="atlas-field mt-2 w-full rounded-2xl px-4 py-3 outline-none"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="text-atlas-muted">E-mail do dono</span>
                <input
                  className="atlas-field mt-2 w-full rounded-2xl px-4 py-3 outline-none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="seuemail@empresa.com"
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="text-atlas-muted">Senha</span>
                <input
                  className="atlas-field mt-2 w-full rounded-2xl px-4 py-3 outline-none"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  minLength={8}
                  required
                />
              </label>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {info ? <p className="text-sm text-emerald-700">{info}</p> : null}
              <Button className="w-full" type="submit" disabled={loading || !canCreateOwner}>
                {loading ? <Loader2 className="animate-spin" size={18} /> : "Criar conta da empresa"}
              </Button>
              {!canCreateOwner ? (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Este ID de empresa ja esta em uso. Entre na aba Entrar ou use outro ID.
                </p>
              ) : null}
              <Button className="w-full" variant="glass" type="button" onClick={() => setAuthMode("login")}>
                Ja tenho conta
              </Button>
            </form>
          ) : authMode === "team" ? (
            <form className="space-y-4" onSubmit={handleRequestAccess}>
              <p className="text-sm text-atlas-muted">
                Voce faz parte da equipe? Solicite acesso. O responsavel da empresa aprova no painel Admin.
              </p>
              <label className="block text-sm">
                  <span className="text-atlas-muted">Empresa (ID da empresa)</span>
                <input
                  className="atlas-field mt-2 w-full rounded-2xl px-4 py-3 outline-none"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value.toLowerCase())}
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="text-atlas-muted">Nome completo</span>
                <input
                  className="atlas-field mt-2 w-full rounded-2xl px-4 py-3 outline-none"
                  value={requestName}
                  onChange={(e) => setRequestName(e.target.value)}
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="text-atlas-muted">Telefone (opcional)</span>
                <input
                  className="atlas-field mt-2 w-full rounded-2xl px-4 py-3 outline-none"
                  value={requestPhone}
                  onChange={(e) => setRequestPhone(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-atlas-muted">E-mail</span>
                <input
                  className="atlas-field mt-2 w-full rounded-2xl px-4 py-3 outline-none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="text-atlas-muted">Senha</span>
                <input
                  className="atlas-field mt-2 w-full rounded-2xl px-4 py-3 outline-none"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  minLength={8}
                  required
                />
              </label>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {info ? <p className="text-sm text-emerald-700">{info}</p> : null}
              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" size={18} /> : "Solicitar acesso"}
              </Button>
              <Button className="w-full" variant="glass" type="button" onClick={() => setAuthMode("login")}>
                Voltar para login
              </Button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleLogin}>
              <label className="block text-sm">
                <span className="text-atlas-muted">Empresa (ID da empresa)</span>
                <input
                  className="atlas-field mt-2 w-full rounded-2xl px-4 py-3 outline-none"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value.toLowerCase())}
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="text-atlas-muted">E-mail</span>
                <input
                  className="atlas-field mt-2 w-full rounded-2xl px-4 py-3 outline-none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="text-atlas-muted">Senha</span>
                <input
                  className="atlas-field mt-2 w-full rounded-2xl px-4 py-3 outline-none"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="Digite sua senha"
                  required
                />
              </label>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {info ? <p className="text-sm text-emerald-700">{info}</p> : null}
              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" size={18} /> : "Entrar"}
              </Button>
              {ssoProviders.length ? (
                <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700">
                  <p className="text-center text-xs text-atlas-muted">ou entre com SSO</p>
                  {ssoProviders.map((provider) => (
                    <Button
                      key={provider.id}
                      className="w-full"
                      variant="glass"
                      type="button"
                      disabled={loading || !tenantSlug.trim()}
                      onClick={() => {
                        window.location.href = buildOidcLoginUrl(provider.id, tenantSlug.trim());
                      }}
                    >
                      {provider.displayName}
                    </Button>
                  ))}
                </div>
              ) : null}
              <Button className="w-full" variant="glass" type="button" onClick={() => setAuthMode("forgot")}>
                Esqueci minha senha
              </Button>
            </form>
          )}
        </Card>
        </main>
      </>
    );
  }

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden">
      <ThemeToggle
        theme={theme}
        onToggle={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        className="fixed right-4 top-4 z-[60]"
      />

      <div className="fixed bottom-3 left-1/2 z-50 flex w-[min(calc(100vw-1.5rem),920px)] -translate-x-1/2 flex-col items-center gap-1.5 px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="glass-panel flex max-w-full flex-wrap items-center justify-center gap-1 rounded-2xl px-2 py-1.5 backdrop-blur-xl sm:gap-2">
          {visibleViews.map((item) => {
            const isActive = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={`relative shrink-0 rounded-xl px-2 py-1.5 text-xs font-semibold tracking-wide transition sm:px-2.5 sm:text-sm ${
                  isActive
                    ? "bg-white/90 text-blue-700 shadow-sm dark:bg-slate-900/90 dark:text-blue-300"
                    : "text-slate-600 hover:text-blue-700 dark:text-slate-400"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="text-[10px] text-slate-500">ao vivo · {liveAt}</div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-24 pt-2 sm:pb-28">
      {view === "inbox" ? <AtlasApp token={session.token} user={session.user} /> : null}
      {view === "dashboard" && canAccessView(session.user, "dashboard") ? <DashboardView token={session.token} /> : null}
      {canAccessView(session.user, "admin") && adminMounted ? (
        <div className={view === "admin" ? "" : "hidden"} aria-hidden={view !== "admin"}>
          <AdminView token={session.token} user={session.user} />
        </div>
      ) : null}
      {view === "crm" ? <CrmView token={session.token} /> : null}
      {view === "campanhas" && canAccessView(session.user, "campanhas") ? (
        <CampaignsView token={session.token} />
      ) : null}
      {view === "automacoes" && canAccessView(session.user, "automacoes") ? <AutomationsView token={session.token} /> : null}
      </div>
    </div>
  );
}
