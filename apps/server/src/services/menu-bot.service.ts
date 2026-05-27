import { prisma } from "../lib/prisma";
import { sendMessage } from "./inbox.service";
import { ensureInboundTeam, pickAssigneeForTeam } from "./teams.service";

export const MENU_PENDING_TAG = "atlas-menu-pending";
export const MENU_DONE_TAG = "atlas-menu-done";

export type MenuBotOption = {
  digit: string;
  label: string;
  teamId?: string;
};

export type MenuBotSettings = {
  enabled: boolean;
  greeting: string;
  invalidReply: string;
  options: MenuBotOption[];
};

function settingsObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function parseMenuBotSettings(raw: unknown): MenuBotSettings {
  const settings = settingsObject(raw);
  const menu = settingsObject(settings.menuBot);
  const optionsRaw = Array.isArray(menu.options) ? menu.options : [];
  const options: MenuBotOption[] = optionsRaw
    .map((item): MenuBotOption | null => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const digit = typeof row.digit === "string" ? row.digit.trim() : String(row.digit ?? "").trim();
      const label = typeof row.label === "string" ? row.label.trim() : "";
      const teamId = typeof row.teamId === "string" ? row.teamId : undefined;
      if (!digit || !label) return null;
      return { digit, label, teamId };
    })
    .filter((item): item is MenuBotOption => item !== null);

  return {
    enabled: menu.enabled === true,
    greeting: typeof menu.greeting === "string" && menu.greeting.trim() ? menu.greeting.trim() : "Ola! Escolha uma opcao:",
    invalidReply:
      typeof menu.invalidReply === "string" && menu.invalidReply.trim()
        ? menu.invalidReply.trim()
        : "Opcao invalida. Responda apenas com o numero da opcao desejada.",
    options
  };
}

export async function getMenuBotSettings(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  const parsed = parseMenuBotSettings(tenant?.settings);
  const teams = await prisma.team.findMany({
    where: { tenantId },
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });
  return { ...parsed, teams };
}

export async function updateMenuBotSettings(tenantId: string, input: unknown) {
  const body = settingsObject(input);
  const current = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  if (!current) throw new Error("Empresa nao encontrada.");
  const merged = {
    ...settingsObject(current.settings),
    menuBot: {
      enabled: body.enabled === true,
      greeting: typeof body.greeting === "string" ? body.greeting.slice(0, 500) : "Ola! Escolha uma opcao:",
      invalidReply:
        typeof body.invalidReply === "string" ? body.invalidReply.slice(0, 300) : "Opcao invalida. Responda com o numero.",
      options: Array.isArray(body.options) ? body.options : []
    }
  };
  await prisma.tenant.update({ where: { id: tenantId }, data: { settings: merged } });
  return getMenuBotSettings(tenantId);
}

function buildMenuText(config: MenuBotSettings) {
  const lines = [config.greeting, ""];
  for (const option of config.options) {
    lines.push(`${option.digit} - ${option.label}`);
  }
  lines.push("", "Digite o numero da opcao desejada.");
  return lines.join("\n");
}

function tagList(tags: unknown) {
  return asStringArray(tags);
}

function withTags(tags: unknown, add: string[], remove: string[] = []) {
  const set = new Set(tagList(tags));
  for (const item of remove) set.delete(item);
  for (const item of add) set.add(item);
  return Array.from(set);
}

const botActor = { id: "menu-bot", name: "Robo Atlas", role: "system" };

async function markMenuDone(conversationId: string, tags: unknown) {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { tags: withTags(tags, [MENU_DONE_TAG], [MENU_PENDING_TAG]) }
  });
}

export async function processMenuBot(params: {
  tenantId: string;
  conversationId: string;
  inboundText?: string | null;
  isNewConversation: boolean;
  reopenedToInbound: boolean;
}) {
  const tenant = await prisma.tenant.findUnique({ where: { id: params.tenantId }, select: { settings: true } });
  const config = parseMenuBotSettings(tenant?.settings);
  if (!config.enabled || !config.options.length) return { handled: false };

  const conversation = await prisma.conversation.findFirst({
    where: { tenantId: params.tenantId, id: params.conversationId },
    include: { lead: true }
  });
  if (!conversation) return { handled: false };

  // Conversa ja atribuida a um humano: robô nao responde
  if (conversation.assignedToId) {
    if (!tagList(conversation.tags).includes(MENU_DONE_TAG)) {
      await markMenuDone(conversation.id, conversation.tags);
    }
    return { handled: false };
  }

  const tags = tagList(conversation.tags);
  const digit = (params.inboundText ?? "").trim().match(/^[1-9]$/)?.[0] ?? null;
  const matched = digit ? config.options.find((item) => item.digit === digit) : null;

  // Conversa ja atendida: robô não interfere
  if (tags.includes(MENU_DONE_TAG) && !params.reopenedToInbound) {
    return { handled: false };
  }

  // Conversas antigas sem tag de URA concluida: marcar como concluida e seguir
  if (!params.isNewConversation && !params.reopenedToInbound && !tags.includes(MENU_PENDING_TAG)) {
    await markMenuDone(conversation.id, conversation.tags);
    return { handled: false };
  }

  // Cliente escolheu uma opcao valida
  if (matched && (tags.includes(MENU_PENDING_TAG) || params.isNewConversation || params.reopenedToInbound)) {
    let teamId = matched.teamId ?? null;
    if (teamId) {
      const team = await prisma.team.findFirst({ where: { tenantId: params.tenantId, id: teamId } });
      if (!team) teamId = null;
    }
    if (!teamId) {
      const inbound = await ensureInboundTeam(params.tenantId);
      teamId = inbound?.id ?? null;
    }
    const assignee = await pickAssigneeForTeam(params.tenantId, teamId);
    const team = teamId
      ? await prisma.team.findFirst({ where: { id: teamId }, select: { name: true } })
      : null;

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        teamId,
        assignedToId: assignee?.id ?? null,
        status: "open",
        tags: withTags(conversation.tags, [MENU_DONE_TAG], [MENU_PENDING_TAG])
      }
    });
    await prisma.lead.updateMany({
      where: { conversationId: conversation.id },
      data: { teamId, assignedToId: assignee?.id ?? null }
    });

    const confirmation = `Perfeito! Voce foi direcionado para *${team?.name ?? matched.label}*. Em instantes um atendente vai continuar o atendimento.`;
    await sendMessage(params.tenantId, conversation.id, { text: confirmation }, botActor);
    return { handled: true, routed: team?.name ?? matched.label };
  }

  // Primeiro contato ou conversa reaberta apos fechamento: enviar menu uma vez
  if ((params.isNewConversation || params.reopenedToInbound) && !tags.includes(MENU_PENDING_TAG)) {
    await sendMessage(params.tenantId, conversation.id, { text: buildMenuText(config) }, botActor);
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { tags: withTags(conversation.tags, [MENU_PENDING_TAG], [MENU_DONE_TAG]) }
    });
    return { handled: true, sent: "menu" };
  }

  // Aguardando escolha do cliente
  if (tags.includes(MENU_PENDING_TAG)) {
    if (digit && !matched) {
      await sendMessage(params.tenantId, conversation.id, { text: `${config.invalidReply}\n\n${buildMenuText(config)}` }, botActor);
      return { handled: true, sent: "invalid" };
    }
    // Texto livre enquanto aguarda opcao: lembrar no maximo 1x a cada 10 min
    if (!digit) {
      const lastReminder = tags.find((tag) => tag.startsWith("atlas-menu-reminder:"));
      const lastAt = lastReminder ? Number(lastReminder.split(":")[1]) : 0;
      const cooldownMs = 10 * 60 * 1000;
      if (lastAt && Date.now() - lastAt < cooldownMs) {
        return { handled: false };
      }
      await sendMessage(
        params.tenantId,
        conversation.id,
        { text: `${config.invalidReply}\n\nResponda com o numero de uma das opcoes do menu.` },
        botActor
      );
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          tags: withTags(
            conversation.tags,
            [`atlas-menu-reminder:${Date.now()}`],
            lastReminder ? [lastReminder] : []
          )
        }
      });
      return { handled: true, sent: "reminder" };
    }
  }

  return { handled: false };
}
