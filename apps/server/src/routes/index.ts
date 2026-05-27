import type { FastifyInstance } from "fastify";
import { healthController } from "../controllers/health.controller";
import { authRoutes } from "./auth.routes";
import { crmRoutes } from "./crm.routes";
import { dashboardRoutes } from "./dashboard.routes";
import { inboxRoutes } from "./inbox.routes";
import { whatsappRoutes } from "./whatsapp.routes";
import { adminRoutes } from "./admin.routes";
import { automationRoutes } from "./automation.routes";
import { campaignRoutes } from "./campaign.routes";
import { mediaRoutes } from "./media.routes";
import { paymentsRoutes } from "./payments.routes";
import { opsRoutes } from "./ops.routes";
import { v1Routes } from "./v1.routes";
import { integrationsAdminRoutes } from "./integrations-admin.routes";
import { billingRoutes } from "./billing.routes";
import { statusRoutes } from "./status.routes";

export async function registerRoutes(app: FastifyInstance) {
  app.get("/health", healthController);
  app.get("/api/health", healthController);
  await statusRoutes(app);
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(dashboardRoutes, { prefix: "/dashboard" });
  await app.register(opsRoutes, { prefix: "/ops" });
  await app.register(v1Routes, { prefix: "/v1" });
  await app.register(integrationsAdminRoutes, { prefix: "/admin/integrations" });
  await app.register(billingRoutes, { prefix: "/admin/billing" });
  await app.register(inboxRoutes, { prefix: "/inbox" });
  await app.register(crmRoutes, { prefix: "/crm" });
  await app.register(whatsappRoutes, { prefix: "/whatsapp" });
  await app.register(adminRoutes, { prefix: "/admin" });
  await app.register(automationRoutes, { prefix: "/automations" });
  await app.register(campaignRoutes, { prefix: "/campaigns" });
  await app.register(paymentsRoutes, { prefix: "/payments" });
  await app.register(mediaRoutes, { prefix: "/media" });
}
