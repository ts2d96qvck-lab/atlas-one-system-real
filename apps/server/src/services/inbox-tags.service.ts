import { z } from "zod";
import { prisma } from "../lib/prisma";

export type TagCatalogItem = {
  name: string;
  color?: string;
};

const DEFAULT_TAG_CATALOG: TagCatalogItem[] = [
  { name: "enterprise", color: "#6366f1" },
  { name: "whatsapp", color: "#22c55e" },
  { name: "proposta", color: "#0ea5e9" },
  { name: "prioridade", color: "#f59e0b" }
];

const tagCatalogSchema = z.object({
  tags: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(40),
        color: z.string().trim().max(32).optional()
      })
    )
    .max(100)
});

function settingsObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function isReservedTag(name: string) {
  const lower = name.toLowerCase();
  return lower.startsWith("avatar:") || lower.startsWith("atlas-");
}

function normalizeCatalogItem(item: TagCatalogItem): TagCatalogItem {
  const name = item.name.trim();
  const color = item.color?.trim();
  return color ? { name, color } : { name };
}

export function readTagCatalog(settings: unknown): TagCatalogItem[] {
  const raw = settingsObject(settings).tags;
  if (!Array.isArray(raw) || !raw.length) return DEFAULT_TAG_CATALOG;

  const parsed: TagCatalogItem[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    let name = "";
    let color: string | undefined;
    if (typeof entry === "string") {
      name = entry.trim();
    } else if (entry && typeof entry === "object") {
      const row = entry as Record<string, unknown>;
      name = typeof row.name === "string" ? row.name.trim() : "";
      color = typeof row.color === "string" ? row.color.trim() : undefined;
    }
    if (!name || isReservedTag(name)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    parsed.push(normalizeCatalogItem({ name, color }));
  }

  return parsed.length ? parsed : DEFAULT_TAG_CATALOG;
}

export function conversationDisplayTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0 && !isReservedTag(tag))
    .map((tag) => tag.trim());
}

export async function listInboxTags(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  if (!tenant) return DEFAULT_TAG_CATALOG;
  return readTagCatalog(tenant.settings);
}

export async function saveInboxTags(tenantId: string, input: unknown) {
  const data = tagCatalogSchema.parse(input);
  const normalized = data.tags
    .map((item) => normalizeCatalogItem(item))
    .filter((item) => !isReservedTag(item.name));

  const unique = new Map<string, TagCatalogItem>();
  for (const item of normalized) {
    unique.set(item.name.toLowerCase(), item);
  }
  const tags = Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));

  const current = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  if (!current) throw new Error("Empresa nao encontrada.");

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      settings: {
        ...settingsObject(current.settings),
        tags
      }
    }
  });

  return tags;
}
