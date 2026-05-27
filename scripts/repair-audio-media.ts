#!/usr/bin/env node
/**
 * Corrige arquivos de audio salvos com extensao invalida (.ogg; codecs=opus)
 * Usage: cd apps/server && npx tsx ../../scripts/repair-audio-media.ts
 */
import { existsSync, renameSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const uploadsRoot = path.resolve(process.cwd(), "uploads");

async function main() {
  const messages = await prisma.message.findMany({
    where: { type: "audio", mediaUrl: { not: null } },
    select: { id: true, mediaUrl: true }
  });

  let fixed = 0;
  for (const msg of messages) {
    const mediaUrl = msg.mediaUrl!;
    if (!mediaUrl.includes(";")) continue;

    const match = mediaUrl.match(/^\/media\/([^/]+)\/(.+)$/);
    if (!match) continue;
    const [, tenantId, badName] = match;
    const cleanName = badName.replace(/;.*$/i, "").replace(/\.(ogg|opus|mp3|webm)$/i, (m) => m) || `${msg.id}.ogg`;
    const finalName = cleanName.endsWith(".ogg") || cleanName.endsWith(".mp3") ? cleanName : `${msg.id}.ogg`;

    const oldPath = path.join(uploadsRoot, tenantId, badName);
    const newPath = path.join(uploadsRoot, tenantId, finalName);
    const newUrl = `/media/${tenantId}/${finalName}`;

    if (existsSync(oldPath)) {
      if (!existsSync(newPath)) renameSync(oldPath, newPath);
    } else if (!existsSync(newPath)) {
      console.warn("missing file", oldPath);
      continue;
    }

    await prisma.message.update({ where: { id: msg.id }, data: { mediaUrl: newUrl } });
    fixed++;
    console.log("fixed", msg.id, "->", newUrl);
  }

  console.log(JSON.stringify({ scanned: messages.length, fixed }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
