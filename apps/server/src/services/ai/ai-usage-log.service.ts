import { prisma } from "../../lib/prisma";

export type AiUsageLogInput = {
  tenantId: string;
  userId?: string | null;
  feature: string;
  provider: string;
  model?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  latencyMs?: number | null;
  status: "success" | "error";
  errorCode?: string | null;
  entityType?: string | null;
  entityId?: string | null;
};

export async function logAiUsage(input: AiUsageLogInput) {
  return prisma.atlasAiUsageLog.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      feature: input.feature,
      provider: input.provider,
      model: input.model ?? null,
      promptTokens: input.promptTokens ?? null,
      completionTokens: input.completionTokens ?? null,
      totalTokens: input.totalTokens ?? null,
      latencyMs: input.latencyMs ?? null,
      status: input.status,
      errorCode: input.errorCode ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null
    }
  });
}
