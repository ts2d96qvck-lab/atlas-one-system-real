import { loginSchema } from "../../../services/auth.service";
import type { AuthIdentity, AuthProvider } from "../auth-provider.types";

/**
 * Local email/password provider — current default for all tenants.
 */
export const localAuthProvider: AuthProvider = {
  kind: "local",
  displayName: "Email e senha",
  isConfigured: () => true,
  async resolveIdentity(input: unknown): Promise<AuthIdentity | null> {
    const data = loginSchema.safeParse(input);
    if (!data.success) return null;
    return {
      provider: "local",
      subject: data.data.email.toLowerCase(),
      email: data.data.email.toLowerCase(),
      tenantSlug: data.data.tenantSlug
    };
  }
};
