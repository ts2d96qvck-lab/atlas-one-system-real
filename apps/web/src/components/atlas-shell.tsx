"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Inbox, LayoutDashboard, Loader2, Megaphone, Moon, Settings, Shield, Sun, Users } from "lucide-react";
import { Button, Card } from "@atlas-one/ui";
import {
  acceptInvite,
  bootstrapOwnerAccount,
  buildOidcLoginUrl,
  clearBootstrapSetup,
  confirmPasswordReset,
  getAuthProviders,
  getBootstrapStatus,
  getStoredBootstrapSetup,
  login,
  previewInvite,
  requestTenantAccess,
  requestPasswordReset,
  storeBootstrapSetup,
  verifyLoginCode,
  type AuthProviderInfo,
  type InvitePreview,
  type SessionUser
} from "../lib/api";
import dynamic from "next/dynamic";
import { friendlyError } from "../lib/friendly-errors";
import { PASSWORD_POLICY_HINT, validatePassword } from "../lib/password-policy";
import { hasPermission, normalizeSessionUser, toAppSession, type AppSession } from "../lib/session-user";
import { AtlasApp } from "./atlas-app";
import { NAV, roleLabel } from "../lib/product-copy";

function ViewLoading() {
  return (
    <div className="flex h-48 items-center justify-center">
      <Loader2 size={20} className="animate-spin text-slate-400" />
    </div>
  );
}

// Inbox stays statically imported (it is the default view); the rest are code-split per tab.
const AdminView = dynamic(() => import("./admin-view").then((m) => m.AdminView), { loading: ViewLoading });
const AutomationsView = dynamic(() => import("./automations-view").then((m) => m.AutomationsView), {
  loading: ViewLoading
});
const CampaignsView = dynamic(() => import("./campaigns-view").then((m) => m.CampaignsView), {
  loading: ViewLoading
});
const CrmView = dynamic(() => import("./crm-view").then((m) => m.CrmView), { loading: ViewLoading });
const DashboardView = dynamic(() => import("./dashboard-view").then((m) => m.DashboardView), {
  loading: ViewLoading
});

const STORAGE_KEY = "atlas-one-session-v2";

const views = [
  { id: "inbox", label: NAV.inbox, icon: Inbox },
  { id: "dashboard", label: NAV.dashboard, icon: LayoutDashboard },
  { id: "admin", label: NAV.admin, icon: Settings },
  { id: "crm", label: NAV.crm, icon: Users },
  { id: "campanhas", label: NAV.campanhas, icon: Megaphone },
  { id: "automacoes", label: NAV.automacoes, icon: Bot }
] as const;

export type AtlasView = (typeof views)[number]["id"];

type Session = AppSession;

function canAccessView(user: SessionUser, view: AtlasView) {
  const normalized = normalizeSessionUser(user);
  const isAdminTier = ["owner", "admin", "supervisor"].includes(normalized.role);
  const isManagerTier = isAdminTier || ["manager", "team_manager"].includes(normalized.role);

  if (view === "inbox") return true;
  if (view === "crm") {
    return isManagerTier || hasPermission(normalized, "crm:read") || hasPermission(normalized, "lead:update");
  }
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
  const [canCreateOwner, setCanCreateOwner] = useState(false);
  const [signupAuthorized, setSignupAuthorized] = useState(false);
  const [signupBlockedMessage, setSignupBlockedMessage] = useState<string | null>(null);
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
        if (!res.ok) throw new Error("Sessão SSO inválida");
        const body = (await res.json()) as { user: SessionUser };
        const next = toAppSession({ token: ssoToken, user: body.user });
        if (!next) throw new Error("Sessão SSO inválida");
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
    const setup = params.get("setup");
    let urlChanged = false;

    if (setup) {
      storeBootstrapSetup(setup);
      params.delete("setup");
      urlChanged = true;
      setSignupAuthorized(true);
    }

    if (tenant) setTenantSlug(tenant);

    if (invite && tenant) {
      setInviteToken(invite);
      setAuthMode("invite");
    } else if (auth === "equipe" || auth === "team") {
      setAuthMode("team");
    } else if (auth === "register" || auth === "cadastro") {
      if (setup || getStoredBootstrapSetup() || process.env.NODE_ENV === "development") {
        setAuthMode("register");
        setSignupAuthorized(true);
      } else {
        setAuthMode("login");
        setInfo("Cadastro disponível apenas por link de onboarding enviado pela Atlas.");
      }
    }

    if (urlChanged) {
      const next = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
    }
  }, []);

  useEffect(() => {
    if (getStoredBootstrapSetup()) setSignupAuthorized(true);
    if (process.env.NODE_ENV === "development") setSignupAuthorized(true);
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
        setError(friendlyError(err instanceof Error ? err.message : "Convite inválido"));
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
    const authorized =
      signupAuthorized || Boolean(getStoredBootstrapSetup()) || process.env.NODE_ENV === "development";

    if (!authorized) {
      setCanCreateOwner(false);
      setSignupBlockedMessage("Cadastro disponível apenas por link de onboarding enviado pela Atlas.");
      return () => {
        cancelled = true;
      };
    }

    if (!slug) {
      setCanCreateOwner(false);
      setSignupBlockedMessage(null);
      return () => {
        cancelled = true;
      };
    }

    getBootstrapStatus(slug)
      .then((status) => {
        if (cancelled) return;
        setCanCreateOwner(status.canBootstrap);
        setSignupBlockedMessage(status.blockedReason ?? null);
        if (!status.canBootstrap && authMode === "register") {
          setInfo(status.blockedReason ?? "Este identificador de empresa não está disponível para cadastro.");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setCanCreateOwner(false);
        setSignupBlockedMessage(
          "Não foi possível verificar o cadastro agora. Tente novamente ou use o link enviado pela Atlas."
        );
      });
    return () => {
      cancelled = true;
    };
  }, [tenantSlug, signupAuthorized, authMode]);

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
      setError(friendlyError(err instanceof Error ? err.message : "Login inválido"));
    } finally {
      setLoading(false);
    }
  }, [email, password, tenantSlug, commitSession]);

  const handleAcceptInvite = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!inviteToken || !tenantSlug.trim()) return;
      const passwordCheck = validatePassword(invitePassword);
      if (!passwordCheck.ok) {
        setError(passwordCheck.message);
        return;
      }
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
        setError(friendlyError(err instanceof Error ? err.message : "Não foi possível aceitar convite"));
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
      setError(err instanceof Error ? err.message : "Código inválido");
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
        setInfo(`Código enviado para ${result.maskedPhone}. Informe o código e a nova senha.`);
      } else {
        setInfo("Se existir conta com SMS ativo, o código foi enviado para o telefone cadastrado.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao solicitar recuperação");
    } finally {
      setLoading(false);
    }
  }, [email, tenantSlug]);

  const handleConfirmReset = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.ok) {
      setError(passwordCheck.message);
      return;
    }
    setLoading(true);
    setError("");
    setInfo("");
    try {
      await confirmPasswordReset(resetChallengeId, resetCode, newPassword);
      setInfo("Senha alterada com sucesso. Você já pode entrar.");
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
      const passwordCheck = validatePassword(password);
      if (!passwordCheck.ok) {
        setError(passwordCheck.message);
        return;
      }
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
        clearBootstrapSetup();
        if (process.env.NODE_ENV !== "development") {
          setSignupAuthorized(false);
        }
        setInfo(
          "Empresa criada. Próximos passos: (1) Entrar com e-mail e senha, (2) Confirmar código no WhatsApp, (3) Conectar WhatsApp em Admin → WhatsApp."
        );
        setAuthMode("login");
      } catch (err) {
        setError(friendlyError(err instanceof Error ? err.message : "Falha ao criar conta da empresa"));
      } finally {
        setLoading(false);
      }
    },
    [email, ownerCompanyName, ownerName, ownerPhone, password, tenantSlug]
  );

  const handleRequestAccess = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const passwordCheck = validatePassword(password);
      if (!passwordCheck.ok) {
        setError(passwordCheck.message);
        return;
      }
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
        <main className="atlas-app-bg flex min-h-dvh items-center justify-center overflow-y-auto overflow-x-hidden p-4 py-8 sm:p-6">
          <Card className="my-auto w-full max-w-md border-slate-200 p-6 shadow-sm sm:p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Shield size={24} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Atlas One</h1>
            <p className="mt-1 text-sm text-atlas-muted">Plataforma de atendimento e vendas</p>
            {typeof window !== "undefined" && window.location.protocol === "https:" ? (
              <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                Conexão segura
              </p>
            ) : null}
          </div>

          {!challengeId && authMode !== "forgot" && authMode !== "invite" ? (
            <div
              className={`mb-5 grid gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800/80 ${
                signupAuthorized ? "grid-cols-3" : "grid-cols-2"
              }`}
            >
              {(
                [
                  ["login", "Entrar"],
                  ...(signupAuthorized ? ([["register", "Criar conta"]] as const) : []),
                  ["team", "Equipe"]
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setAuthMode(mode);
                    setError("");
                    setInfo("");
                  }}
                  className={`rounded-lg px-2 py-2 text-xs font-semibold transition sm:text-sm ${
                    authMode === mode
                      ? "bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          {!signupAuthorized && authMode === "login" && signupBlockedMessage ? (
            <p className="mb-4 rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              {signupBlockedMessage}
            </p>
          ) : null}
          {challengeId ? (
            <form className="space-y-4" onSubmit={handleVerifyCode}>
              {challengeRole === "owner" ? (
                <div className="rounded-2xl border border-blue-200/80 bg-blue-50/70 p-3">
                  <p className="text-sm font-semibold text-blue-900">
                    {ownerFirstAccess ? "Primeiro acesso do proprietário" : "Acesso de proprietário confirmado"}
                  </p>
                  <p className="text-xs text-blue-800">
                    Validação em duas etapas obrigatória para conta proprietária.
                  </p>
                </div>
              ) : null}
              <p className="text-sm text-atlas-muted">Confirme o código enviado no WhatsApp para {maskedPhone}.</p>
              <label className="block text-sm">
                <span className="text-atlas-muted">Código (6 dígitos)</span>
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
                <span className="text-atlas-muted">Identificador da empresa</span>
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
                  <p className="text-xs text-atlas-muted">Código enviado. Informe o SMS e a nova senha abaixo.</p>
                ) : null}
                <label className="block text-sm">
                  <span className="text-atlas-muted">Código SMS</span>
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
                    minLength={12}
                    required
                  />
                  <p className="mt-1 text-[11px] text-atlas-muted">{PASSWORD_POLICY_HINT}</p>
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
                    Olá, {invitePreview.name}. Defina sua senha para entrar como {roleLabel(invitePreview.role)}.
                  </p>
                  <p className="mt-1 text-[10px] text-blue-700 dark:text-blue-300">{invitePreview.email}</p>
                </div>
              ) : loading ? (
                <p className="text-sm text-atlas-muted">Validando convite...</p>
              ) : null}
              <label className="block text-sm">
                <span className="text-atlas-muted">Nova senha</span>
                <input
                  className="atlas-field mt-2 w-full rounded-2xl px-4 py-3 outline-none"
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  type="password"
                  minLength={12}
                  required
                  disabled={!invitePreview}
                />
                <p className="mt-1 text-[11px] text-atlas-muted">{PASSWORD_POLICY_HINT}</p>
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
                Já tenho conta
              </Button>
            </form>
          ) : authMode === "register" ? (
            <form className="space-y-4" onSubmit={handleBootstrapOwner}>
              <p className="text-sm text-atlas-muted">
                Primeiro acesso da sua empresa: crie a conta do responsável (proprietário/contratante).
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
                <span className="text-atlas-muted">Identificador da empresa</span>
                <input
                  className="atlas-field mt-2 w-full rounded-2xl px-4 py-3 outline-none"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value.toLowerCase())}
                  placeholder="ex: minha-empresa"
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="text-atlas-muted">Seu nome (proprietário)</span>
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
                <span className="text-atlas-muted">E-mail do proprietário</span>
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
                  minLength={12}
                  required
                />
                <p className="mt-1 text-[11px] text-atlas-muted">{PASSWORD_POLICY_HINT}</p>
              </label>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {info ? <p className="text-sm text-emerald-700">{info}</p> : null}
              <Button className="w-full" type="submit" disabled={loading || !canCreateOwner}>
                {loading ? <Loader2 className="animate-spin" size={18} /> : "Criar conta da empresa"}
              </Button>
              {!canCreateOwner && signupBlockedMessage ? (
                <p className="text-xs text-amber-700 dark:text-amber-300">{signupBlockedMessage}</p>
              ) : null}
              <Button className="w-full" variant="glass" type="button" onClick={() => setAuthMode("login")}>
                Já tenho conta
              </Button>
            </form>
          ) : authMode === "team" ? (
            <form className="space-y-4" onSubmit={handleRequestAccess}>
              <p className="text-sm text-atlas-muted">
                Você faz parte da equipe? Solicite acesso. O responsável da empresa aprova na Administração.
              </p>
              <label className="block text-sm">
                <span className="text-atlas-muted">Identificador da empresa</span>
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
                  minLength={12}
                  required
                />
                <p className="mt-1 text-[11px] text-atlas-muted">{PASSWORD_POLICY_HINT}</p>
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
                <span className="text-atlas-muted">Identificador da empresa</span>
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
                  <p className="text-center text-xs text-atlas-muted">ou entre com SSO corporativo</p>
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
    <div className="atlas-app-bg flex h-dvh max-h-dvh overflow-hidden">
      <aside className="atlas-sidebar-lite hidden w-[12.25rem] shrink-0 flex-col lg:flex xl:w-[13rem]">
        <div className="border-b border-white/30 px-3 py-3.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">Atlas One</p>
          <p className="mt-1 truncate text-[13px] font-semibold tracking-tight text-slate-800">{session.user.tenantSlug}</p>
          <p className="truncate text-[11px] text-slate-500">
            {session.user.name} · {roleLabel(session.user.role)}
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2.5" aria-label="Navegação principal">
          {visibleViews.map((item) => {
            const isActive = view === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                className={`atlas-nav-item ${isActive ? "atlas-nav-item-active" : ""}`}
              >
                <Icon size={16} className="shrink-0 opacity-70" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-white/30 px-2 py-2.5">
          <button
            type="button"
            className="atlas-nav-item w-full"
            aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo noturno"}
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            {theme === "dark" ? "Modo claro" : "Modo noturno"}
          </button>
          <p className="mt-2 px-1 text-[10px] text-slate-400">Atualizado · {liveAt}</p>
        </div>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <ThemeToggle
          theme={theme}
          onToggle={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
          className="fixed right-4 top-4 z-[60] lg:hidden"
        />

        <div className="atlas-main-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-28 pt-2 lg:pb-4 lg:pt-3">
          <div className={view === "inbox" ? "flex h-full min-h-0 flex-col" : "hidden"} aria-hidden={view !== "inbox"}>
            <AtlasApp token={session.token} user={session.user} />
          </div>
          {view === "dashboard" && canAccessView(session.user, "dashboard") ? (
            <DashboardView token={session.token} user={session.user} />
          ) : null}
          {canAccessView(session.user, "admin") && adminMounted ? (
            <div className={view === "admin" ? "" : "hidden"} aria-hidden={view !== "admin"}>
              <AdminView token={session.token} user={session.user} />
            </div>
          ) : null}
          {view === "crm" ? <CrmView token={session.token} user={session.user} /> : null}
          {view === "campanhas" && canAccessView(session.user, "campanhas") ? (
            <CampaignsView token={session.token} user={session.user} />
          ) : null}
          {view === "automacoes" && canAccessView(session.user, "automacoes") ? (
            <AutomationsView token={session.token} />
          ) : null}
        </div>

        <div className="atlas-mobile-nav fixed bottom-3 left-1/2 z-50 flex w-[min(calc(100vw-1.5rem),920px)] -translate-x-1/2 flex-col items-center gap-1.5 px-2 pb-[env(safe-area-inset-bottom)] lg:hidden">
          <div className="glass-panel flex max-w-full flex-wrap items-center justify-center gap-0.5 rounded-2xl border border-white/50 bg-white/55 p-1 shadow-sm backdrop-blur-xl sm:gap-1">
            {visibleViews.map((item) => {
              const isActive = view === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setView(item.id)}
                  aria-label={item.label}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl px-2.5 text-xs font-medium transition sm:px-3 sm:text-sm ${
                    isActive
                      ? "bg-white/90 text-slate-900 shadow-sm ring-1 ring-slate-200/80 dark:bg-white/12 dark:text-slate-100 dark:ring-slate-600/50"
                      : "text-slate-500 hover:bg-white/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100"
                  }`}
                >
                  <Icon size={16} />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              );
            })}
          </div>
          <div className="text-[10px] font-medium text-slate-400">Atualizado · {liveAt}</div>
        </div>
      </div>
    </div>
  );
}
