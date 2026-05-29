import { prisma } from "../lib/prisma";
import { auditLog } from "./audit.service";

export type ConversationActivityItem = {
  id: string;
  type: "note" | "transfer" | "update" | "legacy_note";
  createdAt: string;
  actor: { id: string; name: string; role: string } | null;
  payload: Record<string, unknown>;
};

function metadataObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function normalizeToken(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

export async function parseMentions(tenantId: string, text: string) {
  const users = await prisma.user.findMany({
    where: { tenantId },
    select: { id: true, name: true, email: true }
  });

  const mentions: string[] = [];
  const mentionNames: string[] = [];
  const seen = new Set<string>();

  const register = (user: { id: string; name: string }) => {
    if (seen.has(user.id)) return;
    seen.add(user.id);
    mentions.push(user.id);
    mentionNames.push(user.name);
  };

  for (const match of text.matchAll(/@\[([a-z0-9]+)\]/gi)) {
    const userId = match[1];
    const user = users.find((row) => row.id === userId);
    if (user) register(user);
  }

  for (const match of text.matchAll(/@([a-zA-Z0-9._-]+)/g)) {
    const token = match[1]?.trim();
    if (!token || token.startsWith("[")) continue;
    const normalized = normalizeToken(token);
    const user = users.find((row) => {
      const firstName = row.name.split(/\s+/)[0] ?? "";
      const emailLocal = row.email.split("@")[0] ?? "";
      return (
        normalizeToken(firstName) === normalized ||
        normalizeToken(row.name) === normalized ||
        normalizeToken(emailLocal) === normalized
      );
    });
    if (user) register(user);
  }

  return { mentions, mentionNames };
}

export async function createInternalNote(
  tenantId: string,
  actorId: string,
  conversationId: string,
  text: string
) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Texto obrigatorio");

  const conversation = await prisma.conversation.findFirst({
    where: { tenantId, id: conversationId },
    select: { id: true }
  });
  if (!conversation) throw new Error("Conversa nao encontrada");

  const { mentions, mentionNames } = await parseMentions(tenantId, trimmed);
  const log = await auditLog({
    tenantId,
    actorId,
    entity: "Conversation",
    entityId: conversationId,
    action: "internal_note",
    metadata: { text: trimmed, mentions, mentionNames }
  });

  const actor = await prisma.user.findFirst({
    where: { tenantId, id: actorId },
    select: { id: true, name: true, role: true }
  });

  return mapActivityItem(log, actor);
}

function mapActivityItem(
  log: {
    id: string;
    action: string;
    metadata: unknown;
    createdAt: Date;
    actorId: string | null;
  },
  actor: { id: string; name: string; role: string } | null
): ConversationActivityItem {
  const metadata = metadataObject(log.metadata);
  if (log.action === "internal_note") {
    return {
      id: log.id,
      type: "note",
      createdAt: log.createdAt.toISOString(),
      actor,
      payload: {
        text: metadata.text ?? "",
        mentions: metadata.mentions ?? [],
        mentionNames: metadata.mentionNames ?? []
      }
    };
  }
  if (log.action === "transferred") {
    return {
      id: log.id,
      type: "transfer",
      createdAt: log.createdAt.toISOString(),
      actor,
      payload: {
        fromUserId: metadata.fromUserId ?? null,
        fromUserName: metadata.fromUserName ?? "Sem responsavel",
        toUserId: metadata.toUserId ?? null,
        toUserName: metadata.toUserName ?? "Sem responsavel",
        teamId: metadata.teamId ?? null,
        note: metadata.note ?? null
      }
    };
  }
  return {
    id: log.id,
    type: "update",
    createdAt: log.createdAt.toISOString(),
    actor,
    payload: metadata
  };
}

export async function listConversationActivity(tenantId: string, conversationId: string, limit = 50) {
  const conversation = await prisma.conversation.findFirst({
    where: { tenantId, id: conversationId },
    select: {
      id: true,
      lead: { select: { customFields: true } }
    }
  });
  if (!conversation) throw new Error("Conversa nao encontrada");

  const logs = await prisma.auditLog.findMany({
    where: {
      tenantId,
      entity: "Conversation",
      entityId: conversationId,
      action: { in: ["internal_note", "transferred", "updated"] }
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(200, Math.max(limit, 1) * 3)
  });

  const filtered = logs.filter((log) => {
    if (log.action === "internal_note" || log.action === "transferred") return true;
    const metadata = metadataObject(log.metadata);
    return metadata.assignedToId !== undefined && metadata.assignedToId !== null;
  });

  const actorIds = [...new Set(filtered.map((log) => log.actorId).filter(Boolean))] as string[];
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { tenantId, id: { in: actorIds } },
        select: { id: true, name: true, role: true }
      })
    : [];
  const actorMap = new Map(actors.map((actor) => [actor.id, actor]));

  const items = filtered.slice(0, limit).map((log) =>
    mapActivityItem(log, log.actorId ? (actorMap.get(log.actorId) ?? null) : null)
  );

  const hasNote = items.some((item) => item.type === "note" || item.type === "legacy_note");
  const customFields = metadataObject(conversation.lead?.customFields);
  const legacyNote = typeof customFields.internalNotes === "string" ? customFields.internalNotes.trim() : "";

  if (legacyNote && !hasNote) {
    items.push({
      id: `legacy-${conversationId}`,
      type: "legacy_note",
      createdAt: new Date(0).toISOString(),
      actor: null,
      payload: { text: legacyNote }
    });
  }

  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function recordConversationTransfer(input: {
  tenantId: string;
  actorId: string;
  conversationId: string;
  fromUserId: string | null;
  toUserId: string | null;
  teamId: string | null;
  note?: string | null;
}) {
  const [fromUser, toUser] = await Promise.all([
    input.fromUserId
      ? prisma.user.findFirst({
          where: { tenantId: input.tenantId, id: input.fromUserId },
          select: { id: true, name: true }
        })
      : Promise.resolve(null),
    input.toUserId
      ? prisma.user.findFirst({
          where: { tenantId: input.tenantId, id: input.toUserId },
          select: { id: true, name: true }
        })
      : Promise.resolve(null)
  ]);

  await auditLog({
    tenantId: input.tenantId,
    actorId: input.actorId,
    entity: "Conversation",
    entityId: input.conversationId,
    action: "transferred",
    metadata: {
      fromUserId: input.fromUserId,
      fromUserName: fromUser?.name ?? "Sem responsavel",
      toUserId: input.toUserId,
      toUserName: toUser?.name ?? "Sem responsavel",
      teamId: input.teamId,
      note: input.note?.trim() || null
    }
  });
}
