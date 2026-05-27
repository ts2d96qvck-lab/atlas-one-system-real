import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const rows = await prisma.whatsAppInstance.findMany({
  select: { id: true, name: true, label: true, phone: true, status: true, tenantId: true }
});
console.log(JSON.stringify(rows, null, 2));
await prisma.$disconnect();
