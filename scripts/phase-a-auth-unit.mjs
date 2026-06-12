/**
 * Unit checks for setup authorization (no HTTP). Run from repo root:
 *   ATLAS_ENTERPRISE_MODE=true SETUP_TOKEN=test-setup-token-32chars-minimum!! node scripts/phase-a-auth-unit.mjs
 */
process.env.ATLAS_ENTERPRISE_MODE ??= "true";
process.env.NODE_ENV ??= "development";
process.env.SETUP_TOKEN ??= "test-setup-token-32chars-minimum!!";

const { isSetupAuthorizedForTenant } = await import(
  "../apps/server/src/lib/security/validate-env.ts"
);
const { signBootstrapTicket, verifyBootstrapTicket } = await import(
  "../apps/server/src/lib/security/bootstrap-ticket.ts"
);

const signed = signBootstrapTicket({ tenantSlug: "acme-corp", ttlHours: 1 });
const expiredPayload = JSON.parse(
  Buffer.from(signed.token.split(".")[0], "base64url").toString("utf8")
);
expiredPayload.exp = Date.now() - 1000;
const { createHmac } = await import("node:crypto");
const body = Buffer.from(JSON.stringify(expiredPayload)).toString("base64url");
const sig = createHmac("sha256", process.env.SETUP_TOKEN).update(body).digest("base64url");
const expired = `${body}.${sig}`;

const checks = {
  missingCredential: isSetupAuthorizedForTenant(undefined, "acme-corp") === false,
  validTicket: isSetupAuthorizedForTenant(signed.token, "acme-corp") === true,
  wrongSlug: isSetupAuthorizedForTenant(signed.token, "other-corp") === false,
  rawSetupToken: isSetupAuthorizedForTenant(process.env.SETUP_TOKEN, "acme-corp") === true,
  expiredTicket: verifyBootstrapTicket(expired, { tenantSlug: "acme-corp" }).ok === false
};

console.log(JSON.stringify({ checks, pass: Object.values(checks).every(Boolean) }, null, 2));
process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
