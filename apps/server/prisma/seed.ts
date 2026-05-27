import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const funnelStages = [
  "Novos leads",
  "Contato feito",
  "Reuniao marcada",
  "Proposta enviada",
  "Negociacao",
  "Fechado",
  "Perdido"
];

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "true") {
    throw new Error("Seed bloqueado em producao. Use ALLOW_SEED=true apenas em staging.");
  }

  const tenant = await prisma.tenant.upsert({
    where: { slug: "atlas-one" },
    update: {
      name: "Atlas One",
      plan: "enterprise",
      settings: {
        menuBot: { enabled: false, greeting: "Ola! Escolha uma opcao:", invalidReply: "Opcao invalida.", options: [] }
      }
    },
    create: {
      name: "Atlas One",
      slug: "atlas-one",
      plan: "enterprise",
      settings: {
        menuBot: { enabled: false, greeting: "Ola! Escolha uma opcao:", invalidReply: "Opcao invalida.", options: [] }
      }
    }
  });

  const adminPassword = await bcrypt.hash("82468028", 12);
  const demoPassword = await bcrypt.hash("Atlas2026!", 12);

  const admin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: "viniciusseverino0688@icloud.com"
      }
    },
    update: {
      name: "Vinicius Severino",
      passwordHash: adminPassword,
      role: "owner",
      status: "active",
      phone: "5517996802944",
      twoFactorEnabled: true,
      permissions: ["*"]
    },
    create: {
      tenantId: tenant.id,
      name: "Vinicius Severino",
      email: "viniciusseverino0688@icloud.com",
      passwordHash: adminPassword,
      role: "owner",
      status: "active",
      phone: "5517996802944",
      twoFactorEnabled: true,
      permissions: ["*"]
    }
  });

  const demo = await prisma.user.upsert({
    where: {
      tenantId_email: {
      tenantId: tenant.id,
      email: "demo@atlasone.com.br"
      }
    },
    update: {
      name: "Demo Atlas One",
      passwordHash: demoPassword,
      role: "agent",
      status: "active",
      phone: "5517991743145",
      twoFactorEnabled: false,
      permissions: [
        "conversation:read",
        "conversation:create",
        "conversation:update",
        "conversation:reply",
        "crm:read",
        "lead:create",
        "lead:update"
      ]
    },
    create: {
      tenantId: tenant.id,
      name: "Demo Atlas One",
      email: "demo@atlasone.com.br",
      passwordHash: demoPassword,
      role: "agent",
      status: "active",
      phone: "5517991743145",
      twoFactorEnabled: false,
      permissions: [
        "conversation:read",
        "conversation:create",
        "conversation:update",
        "conversation:reply",
        "crm:read",
        "lead:create",
        "lead:update"
      ]
    }
  });

  const instance = await prisma.whatsAppInstance.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: "Atlas one"
      }
    },
    update: {
      label: "Atlas One Comercial",
      phone: "5517991743145",
      status: "open",
      ownerJid: "5517991743145@s.whatsapp.net",
      lastSyncAt: new Date()
    },
    create: {
      tenantId: tenant.id,
      name: "Atlas one",
      label: "Atlas One Comercial",
      phone: "5517991743145",
      status: "open",
      ownerJid: "5517991743145@s.whatsapp.net",
      lastSyncAt: new Date()
    }
  });

  const conversation = await prisma.conversation.upsert({
    where: { id: "atlas-one-demo-conversation" },
    update: {
      assignedToId: demo.id,
      status: "open",
      lastMessageAt: new Date()
    },
    create: {
      id: "atlas-one-demo-conversation",
      tenantId: tenant.id,
      instanceId: instance.id,
      assignedToId: demo.id,
      customerName: "Vinni",
      customerPhone: "5517996802944",
      status: "open",
      priority: "high",
      tags: ["whatsapp", "atlas-one", "demo"],
      lastMessageAt: new Date()
    }
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: conversation.id,
        direction: "in",
        type: "text",
        text: "Mensagem teste",
        status: "received"
      },
      {
        conversationId: conversation.id,
        direction: "out",
        type: "text",
        text: "Perfeito, mensagem recebida no Atlas One.",
        status: "sent"
      }
    ],
    skipDuplicates: true
  });

  await prisma.lead.upsert({
    where: { conversationId: conversation.id },
    update: {
      assignedToId: demo.id,
      company: "Atlas One",
      contact: "Vinni",
      status: "Proposta enviada",
      value: 42000
    },
    create: {
      tenantId: tenant.id,
      conversationId: conversation.id,
      assignedToId: demo.id,
      company: "Atlas One",
      contact: "Vinni",
      phone: "5517996802944",
      email: "demo@atlasone.com.br",
      origin: "WhatsApp",
      status: "Proposta enviada",
      value: 42000,
      customFields: {
        segmento: "Meios de pagamento",
        plano: "Enterprise"
      }
    }
  });

  const pipeline = await prisma.pipeline.upsert({
    where: { id: "atlas-one-main-pipeline" },
    update: { tenantId: tenant.id, name: "Pipeline Comercial" },
    create: {
      id: "atlas-one-main-pipeline",
      tenantId: tenant.id,
      name: "Pipeline Comercial"
    }
  });

  await Promise.all(
    funnelStages.map((stage, index) =>
      prisma.pipelineStage.upsert({
        where: {
          pipelineId_order: {
            pipelineId: pipeline.id,
            order: index
          }
        },
        update: { name: stage },
        create: {
          pipelineId: pipeline.id,
          name: stage,
          order: index,
          color: index >= 5 ? "#12b981" : "#1f6fff"
        }
      })
    )
  );

  await prisma.automation.upsert({
    where: { id: "atlas-one-follow-up-proposta" },
    update: {
      tenantId: tenant.id,
      enabled: false
    },
    create: {
      id: "atlas-one-follow-up-proposta",
      tenantId: tenant.id,
      name: "Follow-up de proposta Atlas One",
      trigger: "lead.stage.changed",
      enabled: false,
      config: {
        whenStage: "Proposta enviada",
        delayHours: 24,
        channel: "whatsapp"
      }
    }
  });

  await prisma.paymentIntegration.upsert({
    where: { id: "atlas-one-payments" },
    update: {
      tenantId: tenant.id,
      provider: "atlas-one",
      status: "active"
    },
    create: {
      id: "atlas-one-payments",
      tenantId: tenant.id,
      provider: "atlas-one",
      status: "active",
      config: {
        mode: "sandbox",
        webhook: "/payments/webhook/atlas-one"
      }
    }
  });

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      actorId: admin.id,
      entity: "Seed",
      action: "Enterprise seed executed",
      metadata: {
        users: [admin.email, demo.email],
        instance: instance.name
      }
    }
  });

  console.log({
    tenant: tenant.slug,
    admin: admin.email,
    demo: demo.email,
    instance: instance.name
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

