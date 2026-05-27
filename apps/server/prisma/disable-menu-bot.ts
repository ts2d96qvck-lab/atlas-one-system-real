import { PrismaClient } from "@prisma/client";

const slug = process.argv[2] ?? "atlas-one";
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug } });
  if (!tenant) throw new Error(`Tenant "${slug}" nao encontrado.`);
  const settings =
    tenant.settings && typeof tenant.settings === "object" && !Array.isArray(tenant.settings)
      ? { ...(tenant.settings as Record<string, unknown>) }
      : {};
  settings.menuBot = {
    enabled: false,
    greeting: "Ola! Escolha uma opcao:",
    invalidReply: "Opcao invalida.",
    options: []
  };
  await prisma.tenant.update({ where: { id: tenant.id }, data: { settings } });
  console.log(`[atlas] Robo URA desligado para tenant "${slug}".`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
