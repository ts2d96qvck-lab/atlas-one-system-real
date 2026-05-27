import { prisma } from "./prisma";

export async function assertUserInTenant(tenantId: string, userId: string | null | undefined) {
  if (!userId) return;
  const user = await prisma.user.findFirst({ where: { tenantId, id: userId, status: "active" } });
  if (!user) throw new Error("Usuario invalido para esta empresa");
}

export async function assertTeamInTenant(tenantId: string, teamId: string | null | undefined) {
  if (!teamId) return;
  const team = await prisma.team.findFirst({ where: { tenantId, id: teamId } });
  if (!team) throw new Error("Departamento invalido para esta empresa");
}

export async function assertConversationInTenant(tenantId: string, conversationId: string | null | undefined) {
  if (!conversationId) return;
  const conversation = await prisma.conversation.findFirst({ where: { tenantId, id: conversationId } });
  if (!conversation) throw new Error("Conversa invalida para esta empresa");
}

export async function assertInstanceInTenant(tenantId: string, instanceName: string) {
  const instance = await prisma.whatsAppInstance.findFirst({ where: { tenantId, name: instanceName } });
  if (!instance) throw new Error("Instancia WhatsApp invalida para esta empresa");
  return instance;
}

export async function assertLeadInTenant(tenantId: string, leadId: string | null | undefined) {
  if (!leadId) return;
  const lead = await prisma.lead.findFirst({ where: { tenantId, id: leadId } });
  if (!lead) throw new Error("Lead invalido para esta empresa");
}

export async function assertAutomationInTenant(tenantId: string, automationId: string | null | undefined) {
  if (!automationId) return;
  const row = await prisma.automation.findFirst({ where: { tenantId, id: automationId } });
  if (!row) throw new Error("Automacao invalida para esta empresa");
}

export async function validateLeadRelations(
  tenantId: string,
  data: { assignedToId?: string | null; teamId?: string | null; conversationId?: string | null }
) {
  await assertUserInTenant(tenantId, data.assignedToId ?? undefined);
  await assertTeamInTenant(tenantId, data.teamId ?? undefined);
  await assertConversationInTenant(tenantId, data.conversationId ?? undefined);
}
