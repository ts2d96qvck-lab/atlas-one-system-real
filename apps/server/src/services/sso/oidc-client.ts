import { createHash, randomBytes, createPublicKey } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import type { OidcProviderConfig } from "./oidc-config";

type OidcStatePayload = {
  provider: string;
  tenantSlug: string;
  codeVerifier: string;
  nonce: string;
};

type JwkKey = {
  kid?: string;
  kty?: string;
  n?: string;
  e?: string;
  x5c?: string[];
};

const jwksCache = new Map<string, { keys: JwkKey[]; fetchedAt: number }>();
const JWKS_TTL_MS = 60 * 60 * 1000;

function base64UrlEncode(value: Buffer) {
  return value.toString("base64url");
}

export function generateCodeVerifier() {
  return base64UrlEncode(randomBytes(32));
}

function codeChallenge(verifier: string) {
  return base64UrlEncode(createHash("sha256").update(verifier).digest());
}

export function signOidcState(payload: OidcStatePayload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "10m" });
}

export function verifyOidcState(state: string): OidcStatePayload {
  const decoded = jwt.verify(state, env.jwtSecret) as OidcStatePayload;
  if (!decoded.provider || !decoded.tenantSlug || !decoded.codeVerifier || !decoded.nonce) {
    throw new Error("Estado OIDC invalido");
  }
  return decoded;
}

export function buildAuthorizationUrl(config: OidcProviderConfig, params: { state: string; nonce: string }) {
  const url = new URL(config.authorizationEndpoint);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", params.state);
  url.searchParams.set("nonce", params.nonce);
  const { codeVerifier } = verifyOidcState(params.state);
  url.searchParams.set("code_challenge", codeChallenge(codeVerifier));
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

async function fetchJwks(jwksUri: string): Promise<JwkKey[]> {
  const cached = jwksCache.get(jwksUri);
  if (cached && Date.now() - cached.fetchedAt < JWKS_TTL_MS) return cached.keys;

  const response = await fetch(jwksUri);
  if (!response.ok) throw new Error("Falha ao carregar chaves OIDC");
  const body = (await response.json()) as { keys?: JwkKey[] };
  const keys = body.keys ?? [];
  jwksCache.set(jwksUri, { keys, fetchedAt: Date.now() });
  return keys;
}

function jwkToPem(key: JwkKey) {
  if (key.x5c?.[0]) {
    const der = Buffer.from(key.x5c[0], "base64");
    return createPublicKey({ key: der, format: "der", type: "spki" }).export({ type: "spki", format: "pem" }) as string;
  }
  if (key.kty === "RSA" && key.n && key.e) {
    return createPublicKey({
      key: { kty: "RSA", n: key.n, e: key.e },
      format: "jwk"
    }).export({ type: "spki", format: "pem" }) as string;
  }
  throw new Error("Chave JWK nao suportada");
}

async function resolvePublicKey(jwksUri: string, kid?: string) {
  const keys = await fetchJwks(jwksUri);
  const match = (kid ? keys.find((key) => key.kid === kid) : null) ?? keys[0];
  if (!match) throw new Error("Chave de assinatura OIDC nao encontrada");
  return jwkToPem(match);
}

export async function exchangeAuthorizationCode(
  config: OidcProviderConfig,
  code: string,
  codeVerifier: string
): Promise<{ idToken: string; accessToken?: string }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code_verifier: codeVerifier
  });

  const response = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });

  const payload = (await response.json()) as { id_token?: string; access_token?: string; error?: string };
  if (!response.ok || !payload.id_token) {
    throw new Error(payload.error ?? "Falha ao trocar codigo OIDC");
  }

  return { idToken: payload.id_token, accessToken: payload.access_token };
}

export async function verifyIdToken(
  config: OidcProviderConfig,
  idToken: string,
  nonce: string
): Promise<{ subject: string; email: string; name?: string; emailVerified: boolean }> {
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || typeof decoded === "string") throw new Error("id_token invalido");

  const publicKey = await resolvePublicKey(config.jwksUri, decoded.header.kid);
  const issuers = [config.issuer, config.issuer.replace(/\/$/, ""), "accounts.google.com", "https://accounts.google.com"];
  let payload: jwt.JwtPayload | null = null;
  let lastError: unknown;

  for (const issuer of issuers) {
    try {
      payload = jwt.verify(idToken, publicKey, {
        algorithms: ["RS256"],
        issuer,
        audience: config.clientId
      }) as jwt.JwtPayload;
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!payload) {
    throw lastError instanceof Error ? lastError : new Error("id_token invalido");
  }

  if (payload.nonce !== nonce) throw new Error("Nonce OIDC invalido");

  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
  const subject = typeof payload.sub === "string" ? payload.sub : "";
  if (!email || !subject) throw new Error("Identidade OIDC incompleta");

  const emailVerified = payload.email_verified === true || payload.email_verified === "true";
  if (!emailVerified && config.id === "google") {
    throw new Error("E-mail Google nao verificado");
  }

  return {
    subject,
    email,
    name: typeof payload.name === "string" ? payload.name : undefined,
    emailVerified
  };
}

export function createOidcStartState(provider: string, tenantSlug: string) {
  const codeVerifier = generateCodeVerifier();
  const nonce = base64UrlEncode(randomBytes(16));
  const state = signOidcState({ provider, tenantSlug, codeVerifier, nonce });
  return { state, codeVerifier, nonce };
}
