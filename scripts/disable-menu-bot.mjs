#!/usr/bin/env node
/**
 * Desliga o robô URA (menu bot) no tenant atlas-one.
 * Uso: node scripts/disable-menu-bot.mjs [tenant-slug]
 */
import { PrismaClient } from "@prisma/client";

const slug = process.argv[2] ?? "atlas-one";
const prisma = new PrismaClient();

try {
  const tenant = await prisma.tenant.findFirst({ where: { slug } });
  if (!tenant) {
    console.error(`Tenant "${slug}" nao encontrado.`);
    process.exit(1);
  }
  const settings =
    tenant.settings && typeof tenant.settings === "object" && !Array.isArray(tenant.settings)
      ? { ...tenant.settings }
      : {};
  settings.menuBot = {
    enabled: false,
    greeting: "Ola! Escolha uma opcao:",
    invalidReply: "Opcao invalida.",
    options: []
  };
  await prisma.tenant.update({ where: { id: tenant.id }, data: { settings } });
  console.log(`[atlas] Robo URA desligado para tenant "${slug}".`);
} finally {
  await prisma.$disconnect();
}
