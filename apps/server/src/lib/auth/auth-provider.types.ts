/**
 * Auth provider abstraction — foundation for SSO (Google/Microsoft OIDC).
 * Current production auth uses LocalAuthProvider (email + password + JWT).
 */

export type AuthProviderKind = "local" | "oidc";

export type AuthIdentity = {
  provider: AuthProviderKind;
  subject: string;
  email: string;
  name?: string;
  tenantSlug?: string;
  raw?: Record<string, unknown>;
};

export type AuthProvider = {
  kind: AuthProviderKind;
  displayName: string;
  isConfigured(): boolean;
  /** Resolve identity from provider-specific credentials or callback payload. */
  resolveIdentity(input: unknown): Promise<AuthIdentity | null>;
};

export type ExternalUserLink = {
  tenantId: string;
  userId: string;
  provider: AuthProviderKind;
  providerSubject: string;
  email: string;
  linkedAt: Date;
};

/** Shape for future `ExternalIdentity` Prisma model (Phase 7.1 / SSO rollout). */
export type ExternalIdentityRecord = {
  id: string;
  tenantId: string;
  userId: string;
  provider: string;
  providerSubject: string;
  email: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};
