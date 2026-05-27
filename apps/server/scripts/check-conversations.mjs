import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const rows = await prisma.conversation.findMany({
  select: {
    id: true,
    customerName: true,
    instanceId: true,
    instance: { select: { name: true } }
  },
  take: 10
});
console.log(JSON.stringify(rows, null, 2));
await prisma.$disconnect();
