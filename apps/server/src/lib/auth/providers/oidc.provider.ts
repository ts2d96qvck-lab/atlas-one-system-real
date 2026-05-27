import { env } from "../../../config/env";
import type { AuthIdentity, AuthProvider } from "../auth-provider.types";

type OidcCallbackInput = {
  issuer?: string;
  subject?: string;
  email?: string;
  name?: string;
  tenantSlug?: string;
};

/**
 * OIDC stub for Google Workspace / Microsoft Entra ID.
 * Full implementation planned — see SSO_PLAN.md.
 */
export const oidcAuthProvider: AuthProvider = {
  kind: "oidc",
  displayName: "SSO (OIDC)",
  isConfigured: () => Boolean(env.oidcIssuer && env.oidcClientId && env.oidcClientSecret),
  async resolveIdentity(input: unknown): Promise<AuthIdentity | null> {
    if (!oidcAuthProvider.isConfigured()) return null;
    const data = input as OidcCallbackInput;
    if (!data.subject || !data.email) return null;
    return {
      provider: "oidc",
      subject: data.subject,
      email: data.email.toLowerCase(),
      name: data.name,
      tenantSlug: data.tenantSlug,
      raw: { issuer: data.issuer ?? env.oidcIssuer }
    };
  }
};
