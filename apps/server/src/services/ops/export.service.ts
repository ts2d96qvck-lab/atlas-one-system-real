import { prisma } from "../../lib/prisma";
import { rowsToCsv } from "./csv.util";
import { resolveTenantScope } from "./scope.util";

function formatDate(value?: Date | null) {
  if (!value) return "";
  return value.toISOString();
}

function formatDecimal(value: unknown) {
  return String(Number(value ?? 0));
}

export async function exportLeadsCsv(
  tenantId: string,
  scope?: { userId?: string; role?: string }
) {
  const { leadWhere } = await resolveTenantScope(tenantId, scope);
  const leads = await prisma.lead.findMany({
    where: leadWhere,
    orderBy: { updatedAt: "desc" },
    take: 5000,
    select: {
      company: true,
      contact: true,
      phone: true,
      email: true,
      origin: true,
      status: true,
      value: true,
      expectedCloseDate: true,
      closedAt: true,
      lostAt: true,
      createdAt: true,
      updatedAt: true,
      assignedTo: { select: { name: true } }
    }
  });

  const rows: string[][] = [
    [
      "Empresa",
      "Contato",
      "Telefone",
      "E-mail",
      "Origem",
      "Status",
      "Valor",
      "Responsavel",
      "Previsao fechamento",
      "Fechado em",
      "Perdido em",
      "Criado em",
      "Atualizado em"
    ]
  ];

  for (const lead of leads) {
    rows.push([
      lead.company,
      lead.contact,
      lead.phone,
      lead.email ?? "",
      lead.origin,
      lead.status,
      formatDecimal(lead.value),
      lead.assignedTo?.name ?? "",
      formatDate(lead.expectedCloseDate),
      formatDate(lead.closedAt),
      formatDate(lead.lostAt),
      formatDate(lead.createdAt),
      formatDate(lead.updatedAt)
    ]);
  }

  return rowsToCsv(rows);
}

export async function exportConversationsCsv(
  tenantId: string,
  scope?: { userId?: string; role?: string }
) {
  const { conversationWhere } = await resolveTenantScope(tenantId, scope);
  const conversations = await prisma.conversation.findMany({
    where: conversationWhere,
    orderBy: { lastMessageAt: "desc" },
    take: 5000,
    select: {
      customerName: true,
      customerPhone: true,
      status: true,
      priority: true,
      lastMessageAt: true,
      createdAt: true,
      updatedAt: true,
      assignedTo: { select: { name: true } },
      instance: { select: { label: true, name: true } },
      team: { select: { name: true } },
      _count: { select: { messages: true } }
    }
  });

  const rows: string[][] = [
    [
      "Cliente",
      "Telefone",
      "Status",
      "Prioridade",
      "Responsavel",
      "Departamento",
      "WhatsApp",
      "Mensagens",
      "Ultima mensagem",
      "Criado em",
      "Atualizado em"
    ]
  ];

  for (const row of conversations) {
    rows.push([
      row.customerName,
      row.customerPhone,
      row.status,
      row.priority,
      row.assignedTo?.name ?? "",
      row.team?.name ?? "",
      row.instance?.label ?? row.instance?.name ?? "",
      String(row._count.messages),
      formatDate(row.lastMessageAt),
      formatDate(row.createdAt),
      formatDate(row.updatedAt)
    ]);
  }

  return rowsToCsv(rows);
}

export async function exportMessagesCsv(
  tenantId: string,
  scope?: { userId?: string; role?: string },
  range?: { from?: Date; to?: Date }
) {
  const { conversationWhere } = await resolveTenantScope(tenantId, scope);
  const createdAt =
    range?.from || range?.to
      ? {
          ...(range.from ? { gte: range.from } : {}),
          ...(range.to ? { lte: range.to } : {})
        }
      : undefined;

  const messages = await prisma.message.findMany({
    where: {
      ...(createdAt ? { createdAt } : {}),
      conversation: conversationWhere
    },
    orderBy: { createdAt: "desc" },
    take: 10000,
    select: {
      direction: true,
      type: true,
      text: true,
      status: true,
      createdAt: true,
      conversation: {
        select: {
          customerName: true,
          customerPhone: true,
          assignedTo: { select: { name: true } }
        }
      }
    }
  });

  const rows: string[][] = [
    ["Cliente", "Telefone", "Responsavel", "Direcao", "Tipo", "Status", "Texto", "Data"]
  ];

  for (const message of messages) {
    rows.push([
      message.conversation.customerName,
      message.conversation.customerPhone,
      message.conversation.assignedTo?.name ?? "",
      message.direction,
      message.type,
      message.status,
      message.text ?? "",
      formatDate(message.createdAt)
    ]);
  }

  return rowsToCsv(rows);
}
