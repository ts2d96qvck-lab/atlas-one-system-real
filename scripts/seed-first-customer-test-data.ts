/**
 * QA seed — Atlas Test Customer (development/staging ONLY).
 *
 * Usage:
 *   cd apps/server && npx tsx ../../scripts/seed-first-customer-test-data.ts
 *
 * Reset: re-run this script (upserts). To wipe tenant:
 *   DELETE FROM "User" WHERE "tenantId" IN (SELECT id FROM "Tenant" WHERE slug = 'atlas-test-customer');
 *   DELETE FROM "Tenant" WHERE slug = 'atlas-test-customer';
 *   (or use prisma studio — only in dev)
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TENANT_SLUG = "atlas-test-customer";
const PASSWORD = "AtlasQA!2026Secure";

const USERS = [
  { name: "Test Owner", email: "owner@test.atlasone.local", role: "owner", phone: "5511999887701" },
  { name: "Test Admin", email: "admin@test.atlasone.local", role: "admin", phone: "5511999887702" },
  { name: "Test Supervisor", email: "supervisor@test.atlasone.local", role: "supervisor", phone: "5511999887703" },
  { name: "Test Agent One", email: "agent1@test.atlasone.local", role: "agent", phone: "5511999887704" },
  { name: "Test Agent Two", email: "agent2@test.atlasone.local", role: "agent", phone: "5511999887705" }
] as const;

const LEAD_STATUSES = ["Novos leads", "Contato feito", "Proposta enviada", "Fechado", "Perdido"];

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "true") {
    console.error("BLOCKED: set ALLOW_SEED=true only in staging to run QA seed in production.");
    process.exit(1);
  }

  console.warn("\n⚠️  QA SEED — modifies database for tenant:", TENANT_SLUG);
  console.warn("    Safe for dev/staging only.\n");

  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const tenant = await prisma.tenant.upsert({
    where: { slug: TENANT_SLUG },
    update: {
      name: "Atlas Test Customer",
      plan: "pro",
      billingStatus: "active",
      status: "active",
      settings: {
        maxUsers: 10,
        billing: { subscriptionStatus: "active", provider: "manual" }
      }
    },
    create: {
      name: "Atlas Test Customer",
      slug: TENANT_SLUG,
      plan: "pro",
      billingStatus: "active",
      status: "active",
      settings: {
        maxUsers: 10,
        billing: { subscriptionStatus: "active", provider: "manual" }
      }
    }
  });

  const permMap: Record<string, string[]> = {
    owner: ["*"],
    admin: ["*"],
    supervisor: [
      "conversation:read",
      "conversation:create",
      "conversation:update",
      "conversation:reply",
      "conversation:takeover",
      "crm:read",
      "lead:create",
      "lead:update",
      "dashboard:read",
      "admin:read",
      "automation:read",
      "automation:update"
    ],
    agent: [
      "conversation:read",
      "conversation:create",
      "conversation:update",
      "conversation:reply",
      "crm:read",
      "lead:create",
      "lead:update"
    ]
  };

  const createdUsers: Record<string, { id: string; email: string; role: string }> = {};

  for (const u of USERS) {
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: u.email } },
      update: {
        name: u.name,
        passwordHash,
        role: u.role,
        status: "active",
        phone: u.phone,
        twoFactorEnabled: false,
        permissions: permMap[u.role] ?? permMap.agent
      },
      create: {
        tenantId: tenant.id,
        name: u.name,
        email: u.email,
        passwordHash,
        role: u.role,
        status: "active",
        phone: u.phone,
        twoFactorEnabled: false,
        permissions: permMap[u.role] ?? permMap.agent
      }
    });
    createdUsers[u.role === "agent" ? u.email : u.role] = { id: user.id, email: user.email, role: user.role };
  }

  const teamVendas = await prisma.team.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Vendas" } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Vendas",
      managerId: createdUsers.supervisor?.id ?? null,
      monthlyTarget: 50000
    }
  });

  const teamSuporte = await prisma.team.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Suporte" } },
    update: {},
    create: { tenantId: tenant.id, name: "Suporte", monthlyTarget: 20000 }
  });

  await prisma.user.updateMany({
    where: { tenantId: tenant.id, email: { in: ["agent1@test.atlasone.local", "agent2@test.atlasone.local"] } },
    data: { teamId: teamVendas.id }
  });

  const instance = await prisma.whatsAppInstance.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "qa-comercial" } },
    update: { label: "WhatsApp QA", status: "open", provider: "evolution" },
    create: {
      tenantId: tenant.id,
      name: "qa-comercial",
      label: "WhatsApp QA",
      phone: "5511999887766",
      provider: "evolution",
      status: "open"
    }
  });

  let pipeline = await prisma.pipeline.findFirst({ where: { tenantId: tenant.id } });
  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: { tenantId: tenant.id, name: "Pipeline QA" }
    });
    for (let i = 0; i < LEAD_STATUSES.length; i++) {
      await prisma.pipelineStage.create({
        data: {
          pipelineId: pipeline.id,
          name: LEAD_STATUSES[i]!,
          order: i,
          color: i >= 3 ? "#12b981" : "#1f6fff"
        }
      });
    }
  }

  const agent1Id = createdUsers["agent1@test.atlasone.local"]?.id;
  const agent2Id = createdUsers["agent2@test.atlasone.local"]?.id;

  for (let i = 1; i <= 10; i++) {
    const phone = `551199900${String(i).padStart(4, "0")}`;
    const status = LEAD_STATUSES[i % LEAD_STATUSES.length]!;
    const convStatus = i <= 3 ? "open" : i === 4 ? "closed" : "open";
    const assignee = i <= 2 ? agent1Id : i === 3 ? agent2Id : agent1Id;

    const conversation = await prisma.conversation.upsert({
      where: { id: `qa-conv-${tenant.id}-${i}`.slice(0, 25) },
      update: {
        customerName: `Cliente QA ${i}`,
        customerPhone: phone,
        status: convStatus,
        assignedToId: assignee ?? null,
        teamId: teamVendas.id,
        lastMessageAt: new Date()
      },
      create: {
        id: `qa-conv-${i}-${tenant.slug}`.replace(/-/g, "").slice(0, 25),
        tenantId: tenant.id,
        instanceId: instance.id,
        customerName: `Cliente QA ${i}`,
        customerPhone: phone,
        status: convStatus,
        assignedToId: assignee ?? null,
        teamId: teamVendas.id,
        priority: "normal",
        tags: ["whatsapp", "qa"],
        lastMessageAt: new Date()
      }
    }).catch(async () => {
      return prisma.conversation.create({
        data: {
          tenantId: tenant.id,
          instanceId: instance.id,
          customerName: `Cliente QA ${i}`,
          customerPhone: phone,
          status: convStatus,
          assignedToId: assignee ?? null,
          teamId: teamVendas.id,
          priority: "normal",
          tags: ["whatsapp", "qa"],
          lastMessageAt: new Date()
        }
      });
    });

    await prisma.message.createMany({
      data: [
        {
          conversationId: conversation.id,
          direction: "in",
          type: "text",
          text: `Mensagem inbound QA ${i}`,
          status: "received"
        },
        {
          conversationId: conversation.id,
          direction: "out",
          type: "text",
          text: `Resposta agente QA ${i}`,
          status: "sent"
        }
      ],
      skipDuplicates: true
    });

    await prisma.lead.upsert({
      where: { id: `qa-lead-${i}-${tenant.slug}`.replace(/-/g, "").slice(0, 25) },
      update: {
        company: `Empresa QA ${i}`,
        contact: `Contato QA ${i}`,
        phone,
        status,
        value: i * 1000,
        assignedToId: assignee ?? null,
        teamId: teamVendas.id
      },
      create: {
        tenantId: tenant.id,
        conversationId: conversation.id,
        company: `Empresa QA ${i}`,
        contact: `Contato QA ${i}`,
        phone,
        origin: "WhatsApp QA",
        status,
        value: i * 1000,
        assignedToId: assignee ?? null,
        teamId: teamVendas.id
      }
    }).catch(async () => {
      return prisma.lead.create({
        data: {
          tenantId: tenant.id,
          conversationId: conversation.id,
          company: `Empresa QA ${i}`,
          contact: `Contato QA ${i}`,
          phone,
          origin: "WhatsApp QA",
          status,
          value: i * 1000,
          assignedToId: assignee ?? null,
          teamId: teamVendas.id
        }
      });
    });
  }

  const apiKeyHash = await bcrypt.hash("qa-test-key-atlas-one", 12);
  await prisma.apiKey.upsert({
    where: { id: "qa-api-key-placeholder" },
    update: { status: "active" },
    create: {
      id: "qa-api-key-placeholder",
      tenantId: tenant.id,
      name: "QA Test Key",
      keyPrefix: "atlas_qa_",
      keyHash: apiKeyHash,
      scopes: ["read", "write"],
      status: "active"
    }
  }).catch(() => undefined);

  await prisma.webhookEndpoint.upsert({
    where: { id: "qa-webhook-placeholder" },
    update: { status: "active" },
    create: {
      id: "qa-webhook-placeholder",
      tenantId: tenant.id,
      url: "https://webhook.site/qa-atlas-test",
      secret: "qa-webhook-secret-min-32-chars-long",
      events: ["*"],
      status: "active"
    }
  }).catch(() => undefined);

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      actorId: createdUsers.owner?.id,
      entity: "QA",
      action: "qa_seed_completed",
      metadata: { tenantSlug: TENANT_SLUG, users: USERS.length }
    }
  });

  console.log("\n✅ QA seed complete");
  console.log("   Tenant:", tenant.name, `(${TENANT_SLUG})`);
  console.log("   Plan: pro | Password for all QA users:", PASSWORD);
  console.log("   Users:");
  for (const u of USERS) console.log(`     - ${u.email} (${u.role})`);
  console.log("\n   Login: POST /auth/login { tenantSlug: 'atlas-test-customer', email, password }");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
