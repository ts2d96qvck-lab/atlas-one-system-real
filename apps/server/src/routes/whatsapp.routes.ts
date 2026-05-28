import type { FastifyInstance } from "fastify";
import QRCode from "qrcode";
import { z } from "zod";
import { buildWebhookPublicUrl } from "@atlas-one/lib";
import { requireAuth, requireUser } from "../plugins/auth";
import { requireRole } from "../plugins/roles";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { syncConversationAvatars } from "../services/webhook.service";
import { assertInstanceInTenant } from "../lib/tenant-guard";
import { sendError } from "../utils/http";
import { assertCanAddInstance } from "../services/billing/billing.service";
import {
  listWhatsAppProviderCatalog,
  normalizeProviderKind,
  providerForInstance
} from "../services/whatsapp/whatsapp-instance.service";
import { createEvolutionProvider } from "../services/whatsapp/providers/evolution.provider";

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

function webhookUrl(tenantSlug: string) {
  const base = (env.evolutionWebhookBaseUrl || env.webhookPublicUrl).replace(/\/$/, "");
  let url = buildWebhookPublicUrl(base, tenantSlug);
  if (env.webhookSecret) {
    const separator = url.includes("?") ? "&" : "?";
    url = `${url}${separator}token=${encodeURIComponent(env.webhookSecret)}`;
  }
  return url;
}

async function tenantSettingsFor(user: { tenantId: string }) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { settings: true }
  });
  return tenant?.settings;
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
      const p = createEvolutionProvider();
      if (body.force) {
        try {
          await p.logout(instanceName);
        } catch {
          /* ignore */
        }
        await p.createInstanceIfMissing(instanceName, instance.phone ?? undefined);
      } else {
        await p.createInstanceIfMissing(instanceName, instance.phone ?? undefined);
      }

      const url = webhookUrl(user.tenantSlug);
      await p.setWebhook(instanceName, url);
      const result = await p.connect(instanceName);

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
        where: { id: instance.id },
        data: {
          status,
          lastSyncAt: new Date()
        }
      });

      return reply.send({
        ok: true,
        provider: kind,
        webhookUrl: url,
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
      const url = webhookUrl(user.tenantSlug);
      const settings = await tenantSettingsFor(user);
      await providerForInstance(instance, settings).provider.setWebhook(instanceName, url);
      return reply.send({ ok: true, provider: instance.provider, webhookUrl: url });
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
      const settings = await tenantSettingsFor(user);
      const state = await providerForInstance(instance, settings).provider.getState(instanceName);
      await prisma.whatsAppInstance.update({
        where: { id: instance.id },
        data: { status: state, lastSyncAt: new Date() }
      });
      return reply.send({ instanceName, provider: instance.provider, state });
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
      const settings = await tenantSettingsFor(user);
      await providerForInstance(instance, settings).provider.logout(instanceName);
    } catch {
      // Mesmo com erro do provedor, segue para marcar como desconectada localmente.
    }

    await prisma.whatsAppInstance.update({
      where: { id: instance.id },
      data: { status: "closed", lastSyncAt: new Date() }
    });
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
      const settings = await tenantSettingsFor(user);
      await providerForInstance(instance, settings).provider.logout(instanceName);
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
