import { parseEvolutionWebhook } from "@atlas-one/lib";
import { createEvolutionProvider } from "./whatsapp/providers/evolution.provider";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { saveMediaBase64 } from "../lib/media-storage";
import { emitToTenant } from "../lib/realtime";
import {
  iterateMetaWebhookEvents,
  mapMetaDeliveryStatus
} from "./whatsapp/meta-webhook.parser";
import {
  emitIntegrationEvent,
  publicConversationPayload,
  publicLeadPayload,
  publicMessagePayload
} from "./integrations/integration-events.service";
import { assertWithinConversationQuota } from "./billing/billing.service";
import { processMenuBot, MENU_DONE_TAG } from "./menu-bot.service";
import { ensureInboundTeam, pickAssigneeForTeam } from "./teams.service";

const conversationListInclude = {
  assignedTo: { select: { id: true, name: true, role: true } },
  team: { select: { id: true, name: true } },
  instance: { select: { id: true, name: true, label: true, status: true } },
  lead: { select: { id: true, company: true, status: true, value: true } },
  messages: { orderBy: { createdAt: "desc" as const }, take: 1 }
};

function normalizeAvatarUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return null;
}

function normalizeWhatsAppNumber(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith("55")) return `55${digits}`;
  return digits;
}

function phoneCandidates(raw: string) {
  const normalized = normalizeWhatsAppNumber(raw);
  const set = new Set<string>();
  if (!normalized) return [];
  set.add(normalized);

  const withNoCountry = normalized.startsWith("55") ? normalized.slice(2) : normalized;
  if (withNoCountry) {
    set.add(withNoCountry);
    set.add(`55${withNoCountry}`);
  }

  if (withNoCountry.length === 10) {
    const withNine = `${withNoCountry.slice(0, 2)}9${withNoCountry.slice(2)}`;
    set.add(withNine);
    set.add(`55${withNine}`);
  }
  if (withNoCountry.length === 11 && withNoCountry[2] === "9") {
    const withoutNine = `${withNoCountry.slice(0, 2)}${withNoCountry.slice(3)}`;
    set.add(withoutNine);
    set.add(`55${withoutNine}`);
  }

  return Array.from(set).filter(Boolean);
}

async function resolveWhatsAppInstance(instanceName: string, tenantSlug?: string) {
  if (tenantSlug) {
    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug.toLowerCase() } });
    if (!tenant) return null;
    return prisma.whatsAppInstance.findFirst({
      where: { tenantId: tenant.id, name: instanceName },
      include: { tenant: true }
    });
  }

  const matches = await prisma.whatsAppInstance.findMany({
    where: { name: instanceName },
    include: { tenant: true }
  });
  if (matches.length === 1) return matches[0];
  return null;
}

function pickAvatarFromWebhook(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const root = body as Record<string, unknown>;
  const data = (root.data && typeof root.data === "object" ? root.data : {}) as Record<string, unknown>;
  const key = (data.key && typeof data.key === "object" ? data.key : {}) as Record<string, unknown>;
  const contact = (data.contact && typeof data.contact === "object" ? data.contact : {}) as Record<string, unknown>;
  const message = (data.message && typeof data.message === "object" ? data.message : {}) as Record<string, unknown>;
  const contextInfo = (message.contextInfo && typeof message.contextInfo === "object"
    ? message.contextInfo
    : {}) as Record<string, unknown>;
  const candidates = [
    root.profilePicUrl,
    root.profilePictureUrl,
    data.profilePicUrl,
    data.profilePictureUrl,
    data.picture,
    data.pictureUrl,
    data.avatar,
    key.profilePicUrl,
    key.profilePictureUrl,
    contact.profilePicUrl,
    contact.profilePictureUrl,
    contact.avatar,
    message.profilePicUrl,
    message.profilePictureUrl,
    contextInfo.profilePicUrl,
    contextInfo.profilePictureUrl
  ];
  for (const item of candidates) {
    const normalized = normalizeAvatarUrl(item);
    if (normalized) return normalized;
  }

  const stack: unknown[] = [body];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
      continue;
    }
    if (typeof current !== "object") continue;
    const row = current as Record<string, unknown>;
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === "string") {
        const looksLikeAvatarKey = /(profile|avatar|photo|picture|img)/i.test(key);
        if (!looksLikeAvatarKey) continue;
        const normalized = normalizeAvatarUrl(value);
        if (normalized) return normalized;
      } else if (value && typeof value === "object") {
        stack.push(value);
      }
    }
  }

  return null;
}

function withAvatarTag(tags: unknown, avatarUrl?: string | null) {
  const current = Array.isArray(tags) ? tags.filter((tag) => typeof tag === "string").map(String) : [];
  const cleaned = current.filter((tag) => !tag.startsWith("avatar:"));
  const normalized = normalizeAvatarUrl(avatarUrl);
  if (normalized) cleaned.push(`avatar:${normalized}`);
  return cleaned;
}

function avatarFromTags(tags: unknown) {
  if (!Array.isArray(tags)) return null;
  const found = tags.find((tag) => typeof tag === "string" && tag.startsWith("avatar:"));
  if (typeof found !== "string") return null;
  return normalizeAvatarUrl(found.slice("avatar:".length));
}

async function fetchAvatarWithProvider(instanceName: string, customerPhone: string) {
  const provider = createEvolutionProvider();
  const timeout = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), 4000);
  });
  const request = provider
    .getProfilePictureUrl(instanceName, customerPhone)
    .then((value) => normalizeAvatarUrl(value))
    .catch(() => null);
  return Promise.race([request, timeout]);
}

async function pickAssigneeForInbound(tenantId: string, preferredTeamId?: string | null) {
  return pickAssigneeForTeam(tenantId, preferredTeamId);
}

export async function syncConversationAvatars(tenantId: string, instanceName?: string) {
  const instances = await prisma.whatsAppInstance.findMany({
    where: { tenantId, ...(instanceName ? { name: instanceName } : {}) },
    select: { id: true, name: true }
  });
  if (!instances.length) return { checked: 0, updated: 0 };

  let checked = 0;
  let updated = 0;
  for (const instance of instances) {
    const conversations = await prisma.conversation.findMany({
      where: { tenantId, instanceId: instance.id },
      select: { id: true, customerPhone: true, tags: true },
      orderBy: { updatedAt: "desc" },
      take: 300
    });

    for (const conversation of conversations) {
      checked += 1;
      if (avatarFromTags(conversation.tags)) continue;
      const avatarUrl = await fetchAvatarWithProvider(instance.name, conversation.customerPhone);
      if (!avatarUrl) continue;
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { tags: withAvatarTag(conversation.tags, avatarUrl) }
      });
      updated += 1;
    }
  }

  return { checked, updated };
}

function normalizeRemoteJid(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function extractReplyProviderIdFromWebhook(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const root = body as Record<string, unknown>;
  const data = (root.data && typeof root.data === "object" ? root.data : {}) as Record<string, unknown>;
  const message = (data.message && typeof data.message === "object" ? data.message : {}) as Record<string, unknown>;
  const candidates = Object.values(message).filter((item) => item && typeof item === "object") as Record<string, unknown>[];
  for (const candidate of candidates) {
    const contextInfo = (candidate.contextInfo && typeof candidate.contextInfo === "object"
      ? candidate.contextInfo
      : {}) as Record<string, unknown>;
    const stanzaId = contextInfo.stanzaId;
    if (typeof stanzaId === "string" && stanzaId.trim()) return stanzaId.trim();
  }
  return null;
}

function extractReactionPayload(body: unknown): { remoteJid: string; targetProviderId: string; emoji: string; actorJid: string } | null {
  if (!body || typeof body !== "object") return null;
  const root = body as Record<string, unknown>;
  const data = (root.data && typeof root.data === "object" ? root.data : {}) as Record<string, unknown>;
  const key = (data.key && typeof data.key === "object" ? data.key : {}) as Record<string, unknown>;
  const message = (data.message && typeof data.message === "object" ? data.message : {}) as Record<string, unknown>;
  const reactionMessage = (message.reactionMessage && typeof message.reactionMessage === "object"
    ? message.reactionMessage
    : {}) as Record<string, unknown>;
  const reactionKey = (reactionMessage.key && typeof reactionMessage.key === "object"
    ? reactionMessage.key
    : {}) as Record<string, unknown>;

  const targetProviderId = typeof reactionKey.id === "string" ? reactionKey.id.trim() : "";
  if (!targetProviderId) return null;

  const remoteJid = normalizeRemoteJid(key.remoteJid ?? data.remoteJid);
  const emoji = typeof reactionMessage.text === "string" ? reactionMessage.text.trim() : "";
  const actorJid = normalizeRemoteJid(key.participant ?? key.remoteJid ?? "");
  return { remoteJid, targetProviderId, emoji, actorJid };
}

async function handleReactionEvent(body: unknown, tenantSlug?: string) {
  const payload = extractReactionPayload(body);
  if (!payload) return { ok: true, skipped: "no_reaction_payload" };
  if (!payload.remoteJid || payload.remoteJid.endsWith("@g.us")) return { ok: true, skipped: "invalid_reaction_jid" };

  const data = ((body as Record<string, unknown>).data ?? {}) as Record<string, unknown>;
  const instanceName = String((body as Record<string, unknown>).instance ?? data.instance ?? env.defaultInstance);
  const instance = await resolveWhatsAppInstance(instanceName, tenantSlug);
  if (!instance) return { ok: true, skipped: "instance_not_registered", instance: instanceName };

  const rawPhone = payload.remoteJid.replace("@s.whatsapp.net", "");
  const customerPhone = normalizeWhatsAppNumber(rawPhone);
  const candidates = phoneCandidates(rawPhone);
  const conversation = await prisma.conversation.findFirst({
    where: {
      tenantId: instance.tenantId,
      instanceId: instance.id,
      customerPhone: { in: candidates.length ? candidates : [customerPhone] }
    }
  });
  if (!conversation) return { ok: true, skipped: "conversation_not_found_for_reaction" };

  const target = await prisma.message.findFirst({
    where: {
      conversationId: conversation.id,
      providerId: payload.targetProviderId
    }
  });
  if (!target) return { ok: true, skipped: "target_message_not_found_for_reaction" };

  const currentRaw = target.raw && typeof target.raw === "object" ? (target.raw as Record<string, unknown>) : {};
  const currentReactions = Array.isArray(currentRaw.reactions) ? currentRaw.reactions : [];
  const normalized = currentReactions
    .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : null))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .filter((item) => typeof item.actorJid === "string" && typeof item.emoji === "string");

  const actorJid = payload.actorJid || payload.remoteJid;
  const withoutActor = normalized.filter((item) => String(item.actorJid) !== actorJid);
  const nextReactions =
    payload.emoji.length > 0
      ? [...withoutActor, { actorJid, emoji: payload.emoji, reactedAt: new Date().toISOString() }]
      : withoutActor;

  const updatedMessage = await prisma.message.update({
    where: { id: target.id },
    data: {
      raw: {
        ...currentRaw,
        reactions: nextReactions
      } as Prisma.InputJsonValue
    }
  });

  const updatedConversation = await prisma.conversation.findUnique({
    where: { id: conversation.id },
    include: {
      assignedTo: { select: { id: true, name: true, role: true } },
      instance: { select: { id: true, name: true, label: true, status: true } },
      lead: { select: { id: true, company: true, status: true, value: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 }
    }
  });

  if (updatedConversation) {
    emitToTenant(instance.tenantId, "inbox:message", {
      conversation: updatedConversation,
      message: updatedMessage
    });
  }

  return { ok: true, updated: updatedMessage.id };
}

function mapEvolutionDeliveryStatus(statusRaw: unknown) {
  if (statusRaw == null) return null;
  const statusMap: Record<string, string> = {
    DELIVERY_ACK: "delivered",
    READ: "read",
    PLAYED: "read",
    SERVER_ACK: "sent",
    PENDING: "queued",
    ERROR: "failed",
    FAILED: "failed",
    "0": "failed",
    "1": "queued",
    "2": "sent",
    "3": "delivered",
    "4": "read",
    "5": "read"
  };

  const upper = String(statusRaw).toUpperCase();
  if (statusMap[upper]) return statusMap[upper];

  const numeric = Number(statusRaw);
  if (!Number.isNaN(numeric) && statusMap[String(numeric)]) return statusMap[String(numeric)];

  const lower = String(statusRaw).toLowerCase();
  if (["sent", "delivered", "read", "failed", "queued", "pending", "received"].includes(lower)) return lower;
  return lower;
}

async function applySingleMessageStatusUpdate(
  item: Record<string, unknown>,
  body: Record<string, unknown>,
  tenantSlug?: string
) {
  const key = (item.key ?? {}) as Record<string, unknown>;
  const providerId = key.id ? String(key.id) : null;
  const update = item.update as Record<string, unknown> | undefined;
  const statusRaw = item.status ?? update?.status ?? update?.ack;
  const mapped = mapEvolutionDeliveryStatus(statusRaw);
  if (!providerId || !mapped) return { skipped: "status_without_id" as const };

  const instanceName = String(body.instance ?? item.instance ?? env.defaultInstance);
  const instance = await resolveWhatsAppInstance(instanceName, tenantSlug);

  const existing = await prisma.message.findFirst({
    where: instance
      ? { providerId, conversation: { tenantId: instance.tenantId } }
      : { providerId },
    include: {
      conversation: {
        include: {
          assignedTo: { select: { id: true, name: true, role: true } },
          team: { select: { id: true, name: true } },
          instance: { select: { id: true, name: true, label: true, status: true } },
          lead: { select: { id: true, company: true, status: true, value: true } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 }
        }
      }
    }
  });

  if (!existing) return { skipped: "message_not_found_for_status" as const, status: mapped, providerId };

  const raw =
    existing.raw && typeof existing.raw === "object" && !Array.isArray(existing.raw)
      ? (existing.raw as Record<string, unknown>)
      : {};
  const nextStatus = mapped === "failed" ? "failed" : mapped;
  const deliveryStatus = ["sent", "delivered", "read", "failed", "queued", "pending"].includes(nextStatus)
    ? nextStatus
    : mapped;

  const updatedMessage = await prisma.message.update({
    where: { id: existing.id },
    data: {
      status: nextStatus,
      raw: {
        ...raw,
        deliveryStatus,
        statusUpdatedAt: new Date().toISOString(),
        lastProviderStatus: String(statusRaw)
      }
    }
  });

  emitToTenant(existing.conversation.tenantId, "inbox:message", {
    conversation: existing.conversation,
    message: updatedMessage
  });

  return { updated: true as const, status: nextStatus, messageId: updatedMessage.id };
}

async function handleMessageStatusUpdate(body: Record<string, unknown>, tenantSlug?: string) {
  const data = body.data ?? body;
  const items = Array.isArray(data) ? data : [data as Record<string, unknown>];
  const results = [];

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    results.push(await applySingleMessageStatusUpdate(item as Record<string, unknown>, body, tenantSlug));
  }

  const updated = results.filter((row) => "updated" in row && row.updated).length;
  const first = results[0];
  if (!updated && results.length === 1 && first && "skipped" in first) return { ok: true, ...first };
  return { ok: true, updated, results };
}

async function resolveMetaWhatsAppInstance(phoneNumberId: string) {
  return prisma.whatsAppInstance.findFirst({
    where: {
      provider: { in: ["meta_cloud", "meta"] },
      OR: [{ name: phoneNumberId }, { phone: phoneNumberId }]
    },
    include: { tenant: true }
  });
}

async function ingestMetaInboundMessage(
  instance: Awaited<ReturnType<typeof resolveMetaWhatsAppInstance>>,
  parsed: {
    from: string;
    messageId: string;
    type: string;
    text: string;
    customerName?: string;
  },
  rawBody: unknown
) {
  if (!instance) return { ok: true, skipped: "instance_not_registered" };

  const customerPhone = normalizeWhatsAppNumber(parsed.from);
  const candidates = phoneCandidates(parsed.from);
  const preview = parsed.text || `[${parsed.type}]`;

  let conversation = await prisma.conversation.findFirst({
    where: {
      tenantId: instance.tenantId,
      customerPhone: { in: candidates.length ? candidates : [customerPhone] },
      instanceId: instance.id
    }
  });

  let isNewConversation = false;
  let reopenedToInbound = false;

  if (!conversation) {
    isNewConversation = true;
    await assertWithinConversationQuota(instance.tenantId);
    const inboundTeam = await ensureInboundTeam(instance.tenantId);
    const assignee = await pickAssigneeForInbound(instance.tenantId, inboundTeam?.id);
    conversation = await prisma.conversation.create({
      data: {
        tenantId: instance.tenantId,
        instanceId: instance.id,
        assignedToId: assignee?.id ?? null,
        teamId: inboundTeam?.id ?? assignee?.teamId ?? null,
        customerName: parsed.customerName || customerPhone,
        customerPhone,
        status: "open",
        priority: "normal",
        tags: withAvatarTag(["whatsapp", "meta_cloud"]),
        lastMessageAt: new Date()
      }
    });

    const lead = await prisma.lead.create({
      data: {
        tenantId: instance.tenantId,
        teamId: inboundTeam?.id ?? assignee?.teamId ?? null,
        assignedToId: assignee?.id ?? null,
        conversationId: conversation.id,
        company: parsed.customerName || customerPhone,
        contact: parsed.customerName || customerPhone,
        phone: customerPhone,
        origin: "WhatsApp Meta",
        status: "Novos leads",
        value: 0
      }
    });

    emitIntegrationEvent(instance.tenantId, "conversation.created", publicConversationPayload(conversation));
    emitIntegrationEvent(instance.tenantId, "lead.created", publicLeadPayload(lead));
  } else {
    const inboundTeam = await ensureInboundTeam(instance.tenantId);
    const assignee = await pickAssigneeForInbound(instance.tenantId, inboundTeam?.id);
    const priorTags = Array.isArray(conversation.tags) ? (conversation.tags as string[]) : [];
    if (conversation.status === "closed") {
      reopenedToInbound = true;
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          assignedToId: assignee?.id ?? null,
          teamId: inboundTeam?.id ?? assignee?.teamId ?? conversation.teamId ?? null,
          status: "open",
          tags: priorTags.filter((tag) => tag !== MENU_DONE_TAG)
        }
      });
    }
  }

  const duplicate = await prisma.message.findFirst({
    where: { conversationId: conversation.id, providerId: parsed.messageId }
  });
  if (duplicate) return { ok: true, skipped: "duplicate_meta_message", messageId: duplicate.id };

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "in",
      type: parsed.type === "text" ? "text" : parsed.type,
      text: preview,
      providerId: parsed.messageId,
      status: "received",
      raw: { webhook: rawBody as object, provider: "meta_cloud" } as Prisma.InputJsonValue
    }
  });

  const updatedConversation = await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      customerName: parsed.customerName || conversation.customerName,
      status: "open",
      lastMessageAt: new Date()
    },
    include: conversationListInclude
  });

  emitToTenant(instance.tenantId, "inbox:message", { conversation: updatedConversation, message });
  emitToTenant(instance.tenantId, "inbox:conversations", { action: "upsert", conversation: updatedConversation });
  emitIntegrationEvent(instance.tenantId, "message.created", publicMessagePayload(message));

  if (parsed.type === "text") {
    await processMenuBot({
      tenantId: instance.tenantId,
      conversationId: conversation.id,
      inboundText: parsed.text,
      isNewConversation,
      reopenedToInbound
    });
  }

  return { ok: true, messageId: message.id, conversationId: conversation.id };
}

async function ingestMetaStatusUpdate(parsed: { messageId: string; status: string }) {
  const message = await prisma.message.findFirst({ where: { providerId: parsed.messageId } });
  if (!message) return { ok: true, skipped: "message_not_found_for_status" };

  const mapped = mapMetaDeliveryStatus(parsed.status);
  const raw =
    message.raw && typeof message.raw === "object" && !Array.isArray(message.raw)
      ? (message.raw as Record<string, unknown>)
      : {};
  const updated = await prisma.message.update({
    where: { id: message.id },
    data: {
      status: mapped,
      raw: {
        ...raw,
        deliveryStatus: mapped,
        statusUpdatedAt: new Date().toISOString(),
        lastProviderStatus: parsed.status
      }
    }
  });

  const conversation = await prisma.conversation.findUnique({
    where: { id: message.conversationId },
    include: {
      assignedTo: { select: { id: true, name: true, role: true } },
      instance: { select: { id: true, name: true, label: true, status: true } },
      lead: { select: { id: true, company: true, status: true, value: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 }
    }
  });

  if (conversation) {
    emitToTenant(conversation.tenantId, "inbox:message", { conversation, message: updated });
  }

  return { ok: true, messageId: updated.id, status: mapped };
}

export async function handleEvolutionWebhook(body: unknown, tenantSlug?: string) {
  if (body && typeof body === "object") {
    const event = String((body as Record<string, unknown>).event ?? "");
    if (event === "messages.upsert" || event === "message.upsert") {
      const maybeReaction = await handleReactionEvent(body, tenantSlug);
      if ((maybeReaction as { skipped?: string }).skipped !== "no_reaction_payload") {
        return maybeReaction;
      }
    }
    if (event === "messages.update" || event === "message.update") {
      return handleMessageStatusUpdate(body as Record<string, unknown>, tenantSlug);
    }
  }

  const parsed = parseEvolutionWebhook(body);
  if (!parsed) {
    return { ok: true, skipped: "unsupported_or_update_event" };
  }

  const instance = await resolveWhatsAppInstance(parsed.instanceName, tenantSlug);

  if (!instance) {
    return { ok: true, skipped: "instance_not_registered", instance: parsed.instanceName };
  }

  const rawPhone = parsed.remoteJid.replace("@s.whatsapp.net", "");
  const customerPhone = normalizeWhatsAppNumber(rawPhone);
  const candidates = phoneCandidates(rawPhone);
  const preview = parsed.text ?? `[${parsed.type}]`;
  let avatarUrl = pickAvatarFromWebhook(body);
  const replyToProviderId = extractReplyProviderIdFromWebhook(body);

  let conversation = await prisma.conversation.findFirst({
    where: {
      tenantId: instance.tenantId,
      customerPhone: { in: candidates.length ? candidates : [customerPhone] },
      instanceId: instance.id
    }
  });

  let isNewConversation = false;
  let reopenedToInbound = false;

  if (!conversation) {
    isNewConversation = true;
    await assertWithinConversationQuota(instance.tenantId);
    const inboundTeam = await ensureInboundTeam(instance.tenantId);
    const assignee = await pickAssigneeForInbound(instance.tenantId, inboundTeam?.id);
    conversation = await prisma.conversation.create({
      data: {
        tenantId: instance.tenantId,
        instanceId: instance.id,
        assignedToId: assignee?.id ?? null,
        teamId: inboundTeam?.id ?? assignee?.teamId ?? null,
        customerName: parsed.customerName || customerPhone,
        customerPhone,
        status: "open",
        priority: "normal",
        tags: withAvatarTag(["whatsapp"], avatarUrl),
        lastMessageAt: new Date()
      }
    });

    const lead = await prisma.lead.create({
      data: {
        tenantId: instance.tenantId,
        teamId: inboundTeam?.id ?? assignee?.teamId ?? null,
        assignedToId: assignee?.id ?? null,
        conversationId: conversation.id,
        company: parsed.customerName || customerPhone,
        contact: parsed.customerName || customerPhone,
        phone: customerPhone,
        origin: "WhatsApp",
        status: "Novos leads",
        value: 0
      }
    });

    emitIntegrationEvent(instance.tenantId, "conversation.created", publicConversationPayload(conversation));
    emitIntegrationEvent(instance.tenantId, "lead.created", publicLeadPayload(lead));
  }

  if (!parsed.fromMe) {
    if (conversation.status === "closed") {
      const priorTags = Array.isArray(conversation.tags) ? (conversation.tags as string[]) : [];
      reopenedToInbound = true;
      const inboundTeam = await ensureInboundTeam(instance.tenantId);
      const assignee = await pickAssigneeForInbound(instance.tenantId, inboundTeam?.id);
      const nextTags = priorTags.filter((tag) => tag !== MENU_DONE_TAG);
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          assignedToId: assignee?.id ?? null,
          teamId: inboundTeam?.id ?? assignee?.teamId ?? conversation.teamId ?? null,
          status: "open",
          tags: nextTags
        }
      });
      await prisma.lead.updateMany({
        where: { conversationId: conversation.id },
        data: {
          assignedToId: assignee?.id ?? null,
          teamId: inboundTeam?.id ?? assignee?.teamId ?? conversation.teamId ?? null
        }
      });
    }
  }

  if (!avatarUrl) {
    const existingAvatar = avatarFromTags(conversation.tags);
    avatarUrl = existingAvatar;
  }
  if (!avatarUrl) {
    avatarUrl = await fetchAvatarWithProvider(parsed.instanceName, customerPhone);
  }

  if (parsed.fromMe) {
    const since = new Date(Date.now() - 3 * 60 * 1000);
    const duplicate = await prisma.message.findFirst({
      where: {
        conversationId: conversation.id,
        direction: "out",
        createdAt: { gte: since },
        OR: [
          { text: preview },
          ...(parsed.providerId ? [{ providerId: parsed.providerId }] : [])
        ]
      },
      orderBy: { createdAt: "desc" }
    });
    if (duplicate) {
      return { ok: true, skipped: "duplicate_outgoing_echo" };
    }
  }

  let mediaUrl = parsed.mediaUrl;
  let mediaBase64 = parsed.mediaBase64;

  if (!mediaBase64 && parsed.type !== "text" && parsed.providerId && body && typeof body === "object") {
    const data = ((body as Record<string, unknown>).data ?? body) as Record<string, unknown>;
    const key = (data.key ?? {}) as Record<string, unknown>;
    try {
      const provider = createEvolutionProvider();
      const fetched = await provider.getBase64FromMediaMessage(parsed.instanceName, key);
      if (typeof fetched === "string") mediaBase64 = fetched;
    } catch {
      /* evolution may not return base64 immediately */
    }
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: parsed.fromMe ? "out" : "in",
      type: parsed.type,
      text: preview,
      mediaUrl,
      providerId: parsed.providerId,
      status: parsed.status,
      raw: {
        webhook: body as object,
        replyToProviderId
      } as Prisma.InputJsonValue
    }
  });

  if (replyToProviderId) {
    const repliedTo = await prisma.message.findFirst({
      where: { conversationId: conversation.id, providerId: replyToProviderId }
    });
    if (repliedTo) {
      await prisma.message.update({
        where: { id: message.id },
        data: {
          raw: {
            webhook: body as object,
            replyToProviderId,
            replyTo: {
              id: repliedTo.id,
              type: repliedTo.type,
              text: repliedTo.text ?? `[${repliedTo.type}]`,
              direction: repliedTo.direction
            }
          } as Prisma.InputJsonValue
        }
      });
      message.raw = {
        webhook: body as object,
        replyToProviderId,
        replyTo: {
          id: repliedTo.id,
          type: repliedTo.type,
          text: repliedTo.text ?? `[${repliedTo.type}]`,
          direction: repliedTo.direction
        }
      };
    }
  }

  if (mediaBase64) {
    mediaUrl = await saveMediaBase64(instance.tenantId, message.id, mediaBase64, parsed.mimeType);
    await prisma.message.update({
      where: { id: message.id },
      data: { mediaUrl }
    });
    message.mediaUrl = mediaUrl;
  }

  const updatedConversation = await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      customerName: parsed.customerName || conversation.customerName,
      tags: withAvatarTag(conversation.tags, avatarUrl),
      status: parsed.fromMe ? "waiting_customer" : "open",
      lastMessageAt: new Date()
    },
    include: conversationListInclude
  });

  emitToTenant(instance.tenantId, "inbox:message", {
    conversation: updatedConversation,
    message
  });

  emitToTenant(instance.tenantId, "inbox:conversations", {
    action: "upsert",
    conversation: updatedConversation
  });

  emitIntegrationEvent(instance.tenantId, "message.created", publicMessagePayload(message));

  if (!parsed.fromMe && parsed.type === "text") {
    await processMenuBot({
      tenantId: instance.tenantId,
      conversationId: conversation.id,
      inboundText: parsed.text,
      isNewConversation,
      reopenedToInbound
    });
  }

  return { ok: true, messageId: message.id, conversationId: conversation.id };
}

export function handleMetaCloudWebhookVerify(query: Record<string, string | undefined>) {
  const mode = query["hub.mode"];
  const token = query["hub.verify_token"];
  const challenge = query["hub.challenge"];
  if (mode === "subscribe" && token && token === env.metaWhatsAppWebhookVerifyToken && challenge) {
    return { ok: true as const, challenge };
  }
  return { ok: false as const, error: "meta_webhook_verify_failed" };
}

export async function handleMetaCloudWebhook(body: unknown) {
  const events = iterateMetaWebhookEvents(body);
  if (!events.length) return { ok: true, skipped: "no_events" };

  const results = [];
  for (const event of events) {
    if (event.kind === "message") {
      const instance = await resolveMetaWhatsAppInstance(event.data.phoneNumberId);
      results.push(await ingestMetaInboundMessage(instance, event.data, body));
    } else {
      results.push(await ingestMetaStatusUpdate(event.data));
    }
  }

  return {
    ok: true,
    provider: "meta_cloud",
    processed: results.length,
    results
  };
}
