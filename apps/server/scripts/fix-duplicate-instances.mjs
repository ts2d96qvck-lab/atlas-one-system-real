import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalizePhone(value) {
  return (value ?? "").replace(/\D/g, "");
}

const instances = await prisma.whatsAppInstance.findMany({
  orderBy: { createdAt: "asc" }
});

const groups = new Map();
for (const row of instances) {
  const key = `${row.tenantId}:${normalizePhone(row.phone) || row.name.toLowerCase()}`;
  const bucket = groups.get(key) ?? [];
  bucket.push(row);
  groups.set(key, bucket);
}

let moved = 0;
let removed = 0;

for (const bucket of groups.values()) {
  if (bucket.length < 2) continue;

  const canonical =
    bucket.find((item) => item.name === "Atlas one") ??
    bucket.find((item) => !item.name.includes("-comercial")) ??
    bucket[0];
  const ghosts = bucket.filter((item) => item.id !== canonical.id);

  for (const ghost of ghosts) {
    const result = await prisma.conversation.updateMany({
      where: { instanceId: ghost.id },
      data: { instanceId: canonical.id }
    });
    moved += result.count;

    const remaining = await prisma.conversation.count({ where: { instanceId: ghost.id } });
    if (remaining === 0) {
      await prisma.whatsAppInstance.delete({ where: { id: ghost.id } });
      removed += 1;
      console.log(`removed ghost instance ${ghost.name} -> ${canonical.name}`);
    }
  }
}

console.log(JSON.stringify({ movedConversations: moved, removedInstances: removed }, null, 2));
await prisma.$disconnect();
