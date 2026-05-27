import { env } from "../../config/env";

export type OidcProviderId = "google" | "microsoft" | "oidc";

export type OidcProviderConfig = {
  id: OidcProviderId;
  displayName: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
};

function redirectUri() {
  const base = env.oidcRedirectUri.trim() || `${env.appPublicUrl.replace(/\/$/, "")}/auth/oidc/callback`;
  return base;
}

const GOOGLE = {
  issuer: "https://accounts.google.com",
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  jwksUri: "https://www.googleapis.com/oauth2/v3/certs"
};

export function getOidcProviderConfig(id: string): OidcProviderConfig | null {
  const provider = id as OidcProviderId;

  if (provider === "google") {
    const clientId = env.googleOidcClientId || env.oidcClientId;
    const clientSecret = env.googleOidcClientSecret || env.oidcClientSecret;
    if (!clientId || !clientSecret) return null;
    return {
      id: "google",
      displayName: "Google",
      clientId,
      clientSecret,
      redirectUri: redirectUri(),
      ...GOOGLE
    };
  }

  if (provider === "microsoft") {
    const clientId = env.microsoftOidcClientId || env.oidcClientId;
    const clientSecret = env.microsoftOidcClientSecret || env.oidcClientSecret;
    const tenant = env.microsoftOidcTenant || "common";
    if (!clientId || !clientSecret) return null;
    const issuer = `https://login.microsoftonline.com/${tenant}/v2.0`;
    return {
      id: "microsoft",
      displayName: "Microsoft",
      clientId,
      clientSecret,
      redirectUri: redirectUri(),
      issuer,
      authorizationEndpoint: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
      tokenEndpoint: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      jwksUri: `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`
    };
  }

  if (provider === "oidc") {
    if (!env.oidcIssuer || !env.oidcClientId || !env.oidcClientSecret) return null;
    const issuer = env.oidcIssuer.replace(/\/$/, "");
    return {
      id: "oidc",
      displayName: "SSO",
      clientId: env.oidcClientId,
      clientSecret: env.oidcClientSecret,
      redirectUri: redirectUri(),
      issuer,
      authorizationEndpoint: `${issuer}/authorize`,
      tokenEndpoint: `${issuer}/token`,
      jwksUri: `${issuer}/.well-known/jwks.json`
    };
  }

  return null;
}

export function listConfiguredOidcProviders() {
  return (["google", "microsoft", "oidc"] as const)
    .map((id) => {
      const config = getOidcProviderConfig(id);
      if (!config) return null;
      return { id: config.id, displayName: config.displayName, configured: true };
    })
    .filter(Boolean) as Array<{ id: OidcProviderId; displayName: string; configured: true }>;
}
