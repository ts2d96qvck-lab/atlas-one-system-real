import { localAuthProvider } from "./providers/local.provider";
import { oidcAuthProvider } from "./providers/oidc.provider";
import type { AuthProvider, AuthProviderKind } from "./auth-provider.types";
import { listConfiguredOidcProviders } from "../../services/sso/oidc-config";

const providers: AuthProvider[] = [localAuthProvider, oidcAuthProvider];

export function listAuthProviders() {
  const oidc = listConfiguredOidcProviders().map((provider) => ({
    kind: "oidc" as const,
    id: provider.id,
    displayName: provider.displayName,
    configured: true
  }));

  return [
    {
      kind: localAuthProvider.kind,
      id: localAuthProvider.kind,
      displayName: localAuthProvider.displayName,
      configured: localAuthProvider.isConfigured()
    },
    ...oidc
  ];
}

export function getAuthProvider(kind: AuthProviderKind): AuthProvider | null {
  return providers.find((provider) => provider.kind === kind) ?? null;
}

export function getConfiguredAuthProviders() {
  return providers.filter((provider) => provider.isConfigured());
}
