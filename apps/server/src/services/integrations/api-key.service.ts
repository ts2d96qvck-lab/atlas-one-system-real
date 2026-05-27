import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { generateApiKey, hashApiKey } from "../../lib/security/api-key";

const createSchema = z.object({
  name: z.string().min(2).max(80),
  scopes: z.array(z.enum(["read", "write", "*"])).default(["read", "write"])
});

export type ApiKeyContext = {
  id: string;
  tenantId: string;
  name: string;
  scopes: string[];
};

function parseScopes(value: unknown): string[] {
  if (!Array.isArray(value)) return ["read", "write"];
  return value.map(String);
}

export async function listApiKeys(tenantId: string) {
  const rows = await prisma.apiKey.findMany({
    where: { tenantId, status: "active" },
    orderBy: { createdAt: "desc" }
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    scopes: parseScopes(row.scopes),
    status: row.status,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt
  }));
}

export async function createApiKey(tenantId: string, createdById: string, input: unknown) {
  const data = createSchema.parse(input);
  const generated = generateApiKey();
  const row = await prisma.apiKey.create({
    data: {
      tenantId,
      name: data.name,
      keyPrefix: generated.prefix,
      keyHash: generated.hash,
      scopes: data.scopes,
      createdById
    }
  });
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    scopes: parseScopes(row.scopes),
    key: generated.raw,
    createdAt: row.createdAt
  };
}

export async function revokeApiKey(tenantId: string, id: string) {
  const updated = await prisma.apiKey.updateMany({
    where: { id, tenantId, status: "active" },
    data: { status: "revoked", revokedAt: new Date() }
  });
  if (!updated.count) throw new Error("Chave API nao encontrada");
  return { id };
}

export async function resolveApiKey(raw: string): Promise<ApiKeyContext | null> {
  const keyHash = hashApiKey(raw);
  const row = await prisma.apiKey.findFirst({
    where: { keyHash, status: "active" }
  });
  if (!row) return null;

  void prisma.apiKey
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    scopes: parseScopes(row.scopes)
  };
}

export function apiKeyHasScope(ctx: ApiKeyContext, scope: "read" | "write") {
  if (ctx.scopes.includes("*")) return true;
  return ctx.scopes.includes(scope);
}
