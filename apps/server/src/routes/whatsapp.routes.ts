import type { FastifyInstance } from "fastify";
import type { WhatsAppInstance } from "@prisma/client";
import QRCode from "qrcode";
import { z } from "zod";
import { requireAuth, requireUser } from "../plugins/auth";
import { requireRole } from "../plugins/roles";
import { prisma } from "../lib/prisma";
import { syncConversationAvatars } from "../services/webhook.service";
import { assertInstanceInTenant } from "../lib/tenant-guard";
import { sendError } from "../utils/http";
import { assertCanAddInstance } from "../services/billing/billing.service";
import {
  alignEvolutionInstanceForOps,
  listWhatsAppProviderCatalog,
  normalizeProviderKind,
  providerForInstance
} from "../services/whatsapp/whatsapp-instance.service";
import { createEvolutionProvider } from "../services/whatsapp/providers/evolution.provider";
import { buildEvolutionWebhookUrl } from "../lib/evolution-webhook-url";

const sendTextSchema = z.object({
  instanceName: z.string().min(1),
  number: z.string().min(10),
  text: z.string().min(1).max(4096)
});

const createInstanceSchema = z.object({
  name: z.string().min(2),
  label: z.string().min(2),
  phone: z.string().optional(),
  provider: z.enum(["evolution", "meta_cloud"]).default("evolution")
});

async function tenantSettingsFor(user: { tenantId: string }) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { settings: true }
  });
  return tenant?.settings;
}

async function prepareEvolutionInstance(user: { tenantId: string }, instance: WhatsAppInstance) {
  const provider = createEvolutionProvider();
  const aligned = await alignEvolutionInstanceForOps(user.tenantId, instance, provider);
  return { provider, ...aligned };
}

export async function whatsappRoutes(app: FastifyInstance) {
  const adminGuard = [requireAuth, requireRole("admin", "owner")];

  app.get("/providers", { preHandler: requireAuth }, async (_request, reply) => {
    return reply.send({ providers: listWhatsAppProviderCatalog() });
  });

  app.post("/instances", { preHandler: adminGuard }, async (request, reply) => {
    const user = requireUser(request);
    const data = createInstanceSchema.parse(request.body);

    try {
      await assertCanAddInstance(user.tenantId);
    } catch (error) {
      return sendError(reply, 400, "Limite do plano atingido", error instanceof Error ? error.message : error);
    }

    const created = await prisma.whatsAppInstance.create({
      data: {
        tenantId: user.tenantId,
        name: data.name.trim(),
        label: data.label.trim(),
        phone: data.phone?.replace(/\D/g, "") || null,
        provider: normalizeProviderKind(data.provider),
        status: data.provider === "meta_cloud" ? "open" : "created"
      }
    });

    return reply.status(201).send(created);
  });

  app.get("/instances", { preHandler: requireAuth }, async (request, reply) => {
    const user = requireUser(request);
    return reply.send(
      await prisma.whatsAppInstance.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { updatedAt: "desc" }
      })
    );
  });

  app.post("/instances/:instanceName/connect", { preHandler: adminGuard }, async (request, reply) => {
    const user = requireUser(request);
    const { instanceName } = request.params as { instanceName: string };
    const body = (request.body ?? {}) as { force?: boolean };
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { tenantId: user.tenantId, name: instanceName }
    });
    if (!instance) {
      return reply.status(404).send({ error: "Instancia nao encontrada" });
    }

    const kind = normalizeProviderKind(instance.provider);
    if (kind === "meta_cloud") {
      return sendError(
        reply,
        400,
        "Numeros Meta Cloud sao conectados no Meta Business Manager. Configure META_WHATSAPP_* no servidor."
      );
    }

    try {
      const { provider: p, evolutionName, instance: alignedInstance, renamed, dbName } =
        await prepareEvolutionInstance(user, instance);

      if (body.force) {
        try {
          await p.logout(evolutionName);
        } catch {
          /* ignore */
        }
        await p.createInstanceIfMissing(evolutionName, alignedInstance.phone ?? undefined);
      } else {
        await p.createInstanceIfMissing(evolutionName, alignedInstance.phone ?? undefined);
      }

      const url = buildEvolutionWebhookUrl(user.tenantSlug);
      await p.setWebhook(evolutionName, url);
      const result = await p.connect(evolutionName);

      let qrImage = (result as { qrImage?: string | null }).qrImage ?? null;
      const qrCode = result.qrCode;
      if (!qrImage && typeof qrCode === "string" && qrCode.length > 8) {
        if (qrCode.startsWith("data:image")) {
          qrImage = qrCode;
        } else {
          qrImage = await QRCode.toDataURL(qrCode, { margin: 1, width: 320 });
        }
      }

      const status = String(result.state ?? (qrImage ? "connecting" : "connecting"));
      await prisma.whatsAppInstance.update({
        where: { id: alignedInstance.id },
        data: {
          status,
          lastSyncAt: new Date()
        }
      });

      return reply.send({
        ok: true,
        provider: kind,
        webhookUrl: url,
        evolutionInstanceName: evolutionName,
        dbInstanceRenamed: renamed,
        previousDbName: renamed ? dbName : undefined,
        qrCode,
        qrImage,
        state: status,
        raw: result.raw
      });
    } catch (error) {
      return sendError(reply, 400, "Falha ao conectar numero", error instanceof Error ? error.message : error);
    }
  });

  app.post("/instances/:instanceName/webhook/sync", { preHandler: adminGuard }, async (request, reply) => {
    const user = requireUser(request);
    const { instanceName } = request.params as { instanceName: string };
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { tenantId: user.tenantId, name: instanceName }
    });
    if (!instance) {
      return reply.status(404).send({ error: "Instancia nao encontrada" });
    }

    try {
      const url = buildEvolutionWebhookUrl(user.tenantSlug);
      const { provider: p, evolutionName, instance: alignedInstance, renamed, dbName } =
        await prepareEvolutionInstance(user, instance);
      await p.setWebhook(evolutionName, url);
      return reply.send({
        ok: true,
        provider: instance.provider,
        webhookUrl: url,
        evolutionInstanceName: evolutionName,
        dbInstanceName: alignedInstance.name,
        dbInstanceRenamed: renamed,
        previousDbName: renamed ? dbName : undefined
      });
    } catch (error) {
      return sendError(reply, 400, "Falha ao sincronizar webhook", error instanceof Error ? error.message : error);
    }
  });

  app.post("/avatars/sync", { preHandler: adminGuard }, async (request, reply) => {
    const user = requireUser(request);
    const body = (request.body ?? {}) as { instanceName?: string };
    try {
      const result = await syncConversationAvatars(user.tenantId, body.instanceName);
      return reply.send({ ok: true, ...result });
    } catch (error) {
      return sendError(reply, 400, "Falha ao sincronizar fotos de perfil", error instanceof Error ? error.message : error);
    }
  });

  app.get("/instances/:instanceName/state", { preHandler: adminGuard }, async (request, reply) => {
    const user = requireUser(request);
    const { instanceName } = request.params as { instanceName: string };
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { tenantId: user.tenantId, name: instanceName }
    });
    if (!instance) return sendError(reply, 404, "Instancia nao encontrada");
    try {
      const { provider, evolutionName, instance: alignedInstance } = await prepareEvolutionInstance(user, instance);
      const state = await provider.getState(evolutionName);
      await prisma.whatsAppInstance.update({
        where: { id: alignedInstance.id },
        data: { status: state, lastSyncAt: new Date() }
      });
      return reply.send({
        instanceName: alignedInstance.name,
        evolutionInstanceName: evolutionName,
        provider: instance.provider,
        state
      });
    } catch (error) {
      return sendError(reply, 400, "Falha ao consultar estado da instancia", error instanceof Error ? error.message : error);
    }
  });

  app.post("/instances/:instanceName/disconnect", { preHandler: adminGuard }, async (request, reply) => {
    const user = requireUser(request);
    const { instanceName } = request.params as { instanceName: string };
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { tenantId: user.tenantId, name: instanceName }
    });
    if (!instance) return sendError(reply, 404, "Instancia nao encontrada");

    try {
      const { provider, evolutionName, instance: alignedInstance } = await prepareEvolutionInstance(user, instance);
      await provider.logout(evolutionName);
      await prisma.whatsAppInstance.update({
        where: { id: alignedInstance.id },
        data: { status: "closed", lastSyncAt: new Date() }
      });
    } catch {
      await prisma.whatsAppInstance.update({
        where: { id: instance.id },
        data: { status: "closed", lastSyncAt: new Date() }
      });
    }

    return reply.send({ ok: true, state: "closed" });
  });

  app.delete("/instances/:instanceName", { preHandler: adminGuard }, async (request, reply) => {
    const user = requireUser(request);
    const { instanceName } = request.params as { instanceName: string };
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { tenantId: user.tenantId, name: instanceName }
    });
    if (!instance) return sendError(reply, 404, "Instancia nao encontrada");
    try {
      const { provider, evolutionName } = await prepareEvolutionInstance(user, instance);
      await provider.logout(evolutionName);
    } catch {
      // ignore provider failures on deletion path
    }
    await prisma.whatsAppInstance.delete({ where: { id: instance.id } });
    return reply.send({ ok: true });
  });

  app.post("/messages/text", { preHandler: [requireAuth, requireRole("admin", "owner")] }, async (request, reply) => {
    const user = requireUser(request);
    const input = sendTextSchema.parse(request.body);
    await assertInstanceInTenant(user.tenantId, input.instanceName);
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { tenantId: user.tenantId, name: input.instanceName }
    });
    if (!instance) return sendError(reply, 404, "Instancia nao encontrada");
    const settings = await tenantSettingsFor(user);
    const provider = providerForInstance(instance, settings).provider;
    const sendName = await provider.resolveInstanceName(instance.name, instance.phone ?? undefined);
    const result = await provider.sendText({
      ...input,
      instanceName: sendName,
      instancePhone: instance.phone ?? undefined
    });
    return reply.status(202).send({ ok: true, result });
  });
}
