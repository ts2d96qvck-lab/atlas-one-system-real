import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireUser } from "../plugins/auth";
import { requirePermission } from "../plugins/permissions";
import { hasFullAccess, hasPermission } from "../services/auth.service";
import { sendError } from "../utils/http";
import {
  CAMPAIGN_VARIATION_MODES,
  POLISH_MODES,
  REPLY_TONES
} from "../services/ai/prompts";
import {
  aiAskAtlas,
  aiCampaignCompliance,
  aiCampaignImproveMessage,
  aiCampaignVariations,
  aiConversationSummary,
  aiLeadCloseProbability,
  aiLeadNextTask,
  aiLeadSummary,
  aiLeadWinLossInsight,
  aiMessagePolish,
  aiNextBestAction,
  aiSuggestedReply,
  aiTransferSummary,
  getAiProviderStatus,
  toPublicAiResponse
} from "../services/ai/atlas-ai.service";

const transferBodySchema = z.object({
  targetAgentName: z.string().optional(),
  transferNote: z.string().optional()
});

const toneBodySchema = z.object({
  tone: z.enum(REPLY_TONES).optional()
});

const polishBodySchema = z.object({
  draft: z.string().min(1),
  mode: z.enum(POLISH_MODES)
});

const campaignImproveSchema = z.object({
  message: z.string().min(1),
  messageKind: z.string().optional(),
  templateName: z.string().optional(),
  campaignName: z.string().optional()
});

const campaignVariationSchema = z.object({
  message: z.string().min(1),
  mode: z.enum(CAMPAIGN_VARIATION_MODES)
});

const campaignComplianceSchema = z.object({
  message: z.string().min(1)
});

const askBodySchema = z.object({
  question: z.string().min(3).max(500)
});

function aiActor(request: ReturnType<typeof requireUser>) {
  return {
    id: request.id,
    name: request.name,
    role: request.role,
    tenantId: request.tenantId
  };
}

function aiError(reply: Parameters<typeof sendError>[0], error: unknown) {
  const message = error instanceof Error ? error.message : "Nao consegui gerar agora. Tente novamente em instantes.";
  return sendError(reply, 400, message, undefined);
}

export async function aiRoutes(app: FastifyInstance) {
  app.get("/status", { preHandler: [requireAuth] }, async (request, reply) => {
    const user = requireUser(request);
    return reply.send({
      ...getAiProviderStatus(),
      canUse: hasFullAccess(user) || hasPermission(user, "ai:use")
    });
  });

  app.post(
    "/conversations/:conversationId/summary",
    { preHandler: [requireAuth, requirePermission("ai:use"), requirePermission("conversation:read")] },
    async (request, reply) => {
      const user = requireUser(request);
      const { conversationId } = request.params as { conversationId: string };
      try {
        return reply.send(toPublicAiResponse(await aiConversationSummary(aiActor(user), conversationId)));
      } catch (error) {
        return aiError(reply, error);
      }
    }
  );

  app.post(
    "/conversations/:conversationId/suggested-reply",
    { preHandler: [requireAuth, requirePermission("ai:use"), requirePermission("conversation:read")] },
    async (request, reply) => {
      const user = requireUser(request);
      const { conversationId } = request.params as { conversationId: string };
      const body = toneBodySchema.safeParse(request.body ?? {});
      if (!body.success) return sendError(reply, 400, "Tom invalido", body.error.flatten());
      try {
        return reply.send(
          toPublicAiResponse(await aiSuggestedReply(aiActor(user), conversationId, body.data.tone ?? "amigavel"))
        );
      } catch (error) {
        return aiError(reply, error);
      }
    }
  );

  app.post(
    "/conversations/:conversationId/next-action",
    { preHandler: [requireAuth, requirePermission("ai:use"), requirePermission("conversation:read")] },
    async (request, reply) => {
      const user = requireUser(request);
      const { conversationId } = request.params as { conversationId: string };
      try {
        return reply.send(toPublicAiResponse(await aiNextBestAction(aiActor(user), conversationId)));
      } catch (error) {
        return aiError(reply, error);
      }
    }
  );

  app.post(
    "/conversations/:conversationId/transfer-summary",
    { preHandler: [requireAuth, requirePermission("ai:use"), requirePermission("conversation:read")] },
    async (request, reply) => {
      const user = requireUser(request);
      const { conversationId } = request.params as { conversationId: string };
      const body = transferBodySchema.safeParse(request.body ?? {});
      if (!body.success) return sendError(reply, 400, "Dados invalidos", body.error.flatten());
      try {
        return reply.send(toPublicAiResponse(await aiTransferSummary(aiActor(user), conversationId, body.data)));
      } catch (error) {
        return aiError(reply, error);
      }
    }
  );

  app.post(
    "/conversations/:conversationId/message-polish",
    { preHandler: [requireAuth, requirePermission("ai:use"), requirePermission("conversation:read")] },
    async (request, reply) => {
      const user = requireUser(request);
      const { conversationId } = request.params as { conversationId: string };
      const body = polishBodySchema.safeParse(request.body ?? {});
      if (!body.success) return sendError(reply, 400, "Dados invalidos", body.error.flatten());
      try {
        return reply.send(toPublicAiResponse(await aiMessagePolish(aiActor(user), conversationId, body.data)));
      } catch (error) {
        return aiError(reply, error);
      }
    }
  );

  app.post(
    "/leads/:leadId/summary",
    { preHandler: [requireAuth, requirePermission("ai:use"), requirePermission("crm:read")] },
    async (request, reply) => {
      const user = requireUser(request);
      const { leadId } = request.params as { leadId: string };
      try {
        return reply.send(toPublicAiResponse(await aiLeadSummary(aiActor(user), leadId)));
      } catch (error) {
        return aiError(reply, error);
      }
    }
  );

  app.post(
    "/leads/:leadId/close-probability",
    { preHandler: [requireAuth, requirePermission("ai:use"), requirePermission("crm:read")] },
    async (request, reply) => {
      const user = requireUser(request);
      const { leadId } = request.params as { leadId: string };
      try {
        return reply.send(toPublicAiResponse(await aiLeadCloseProbability(aiActor(user), leadId)));
      } catch (error) {
        return aiError(reply, error);
      }
    }
  );

  app.post(
    "/leads/:leadId/next-task",
    { preHandler: [requireAuth, requirePermission("ai:use"), requirePermission("crm:read")] },
    async (request, reply) => {
      const user = requireUser(request);
      const { leadId } = request.params as { leadId: string };
      try {
        return reply.send(toPublicAiResponse(await aiLeadNextTask(aiActor(user), leadId)));
      } catch (error) {
        return aiError(reply, error);
      }
    }
  );

  app.post(
    "/leads/:leadId/win-loss-insight",
    { preHandler: [requireAuth, requirePermission("ai:use"), requirePermission("crm:read")] },
    async (request, reply) => {
      const user = requireUser(request);
      const { leadId } = request.params as { leadId: string };
      try {
        return reply.send(toPublicAiResponse(await aiLeadWinLossInsight(aiActor(user), leadId)));
      } catch (error) {
        return aiError(reply, error);
      }
    }
  );

  app.post(
    "/campaigns/improve-message",
    { preHandler: [requireAuth, requirePermission("ai:use"), requirePermission("campaign:read")] },
    async (request, reply) => {
      const user = requireUser(request);
      const body = campaignImproveSchema.safeParse(request.body ?? {});
      if (!body.success) return sendError(reply, 400, "Dados invalidos", body.error.flatten());
      try {
        return reply.send(toPublicAiResponse(await aiCampaignImproveMessage(aiActor(user), body.data)));
      } catch (error) {
        return aiError(reply, error);
      }
    }
  );

  app.post(
    "/campaigns/variations",
    { preHandler: [requireAuth, requirePermission("ai:use"), requirePermission("campaign:read")] },
    async (request, reply) => {
      const user = requireUser(request);
      const body = campaignVariationSchema.safeParse(request.body ?? {});
      if (!body.success) return sendError(reply, 400, "Dados invalidos", body.error.flatten());
      try {
        return reply.send(toPublicAiResponse(await aiCampaignVariations(aiActor(user), body.data)));
      } catch (error) {
        return aiError(reply, error);
      }
    }
  );

  app.post(
    "/campaigns/compliance-check",
    { preHandler: [requireAuth, requirePermission("ai:use"), requirePermission("campaign:read")] },
    async (request, reply) => {
      const user = requireUser(request);
      const body = campaignComplianceSchema.safeParse(request.body ?? {});
      if (!body.success) return sendError(reply, 400, "Dados invalidos", body.error.flatten());
      try {
        return reply.send(toPublicAiResponse(await aiCampaignCompliance(aiActor(user), body.data)));
      } catch (error) {
        return aiError(reply, error);
      }
    }
  );

  app.post(
    "/ask",
    { preHandler: [requireAuth, requirePermission("ai:use"), requirePermission("dashboard:read")] },
    async (request, reply) => {
      const user = requireUser(request);
      const body = askBodySchema.safeParse(request.body ?? {});
      if (!body.success) return sendError(reply, 400, "Pergunta invalida", body.error.flatten());
      try {
        return reply.send(toPublicAiResponse(await aiAskAtlas(aiActor(user), body.data.question)));
      } catch (error) {
        return aiError(reply, error);
      }
    }
  );
}
