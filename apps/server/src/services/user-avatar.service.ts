import type { Prisma } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { uploadsRoot } from "../lib/media-storage";

function settingsObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function avatarMap(settings: Record<string, unknown>) {
  const map = settings.userAvatars;
  if (!map || typeof map !== "object" || Array.isArray(map)) return {} as Record<string, string>;
  const entries = Object.entries(map).filter(([, value]) => typeof value === "string");
  return Object.fromEntries(entries) as Record<string, string>;
}

export function getUserAvatarFromSettings(settings: unknown, userId: string) {
  const map = avatarMap(settingsObject(settings));
  return map[userId] ?? null;
}

export async function saveUserAvatar(tenantId: string, userId: string, base64: string, mimeType?: string) {
  const ext = mimeType?.includes("png") ? "png" : mimeType?.includes("webp") ? "webp" : "jpg";
  const dir = path.join(uploadsRoot(), tenantId, "user-avatars");
  await mkdir(dir, { recursive: true });
  const fileName = `${userId}.${ext}`;
  const clean = base64.replace(/^data:[^;]+;base64,/, "");
  await writeFile(path.join(dir, fileName), Buffer.from(clean, "base64"));
  const avatarUrl = `/media/${tenantId}/user-avatars/${fileName}`;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  if (!tenant) throw new Error("Empresa nao encontrada.");
  const settings = settingsObject(tenant.settings);
  const nextSettings = {
    ...settings,
    userAvatars: {
      ...avatarMap(settings),
      [userId]: avatarUrl
    }
  };

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: nextSettings as Prisma.InputJsonObject }
  });

  return avatarUrl;
}

export async function attachAvatarUrls<T extends { id: string }>(tenantId: string, rows: T[]) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  const map = avatarMap(settingsObject(tenant?.settings));
  return rows.map((row) => ({ ...row, avatarUrl: map[row.id] ?? null }));
}
