import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { isRedisReady } from "../../lib/redis";

export type StatusLevel = "operational" | "degraded" | "partial_outage" | "major_outage" | "maintenance";

export type StatusComponent = {
  id: string;
  name: string;
  status: StatusLevel;
  description?: string;
};

export type StatusIncident = {
  id: string;
  title: string;
  status: "investigating" | "identified" | "monitoring" | "resolved";
  impact: StatusLevel;
  startedAt: string;
  resolvedAt?: string;
  updates?: Array<{ at: string; message: string }>;
};

function incidentsPath(): string {
  const candidates = [
    resolve(process.cwd(), "infra/status/incidents.json"),
    resolve(process.cwd(), "../../infra/status/incidents.json"),
    resolve(process.cwd(), "../../../infra/status/incidents.json")
  ];
  return candidates.find((path) => existsSync(path)) ?? candidates[0]!;
}

async function readIncidents(): Promise<StatusIncident[]> {
  try {
    const raw = await readFile(incidentsPath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StatusIncident[]) : [];
  } catch {
    return [];
  }
}

async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function checkEvolution() {
  try {
    const response = await fetch(`${env.evolutionUrl.replace(/\/$/, "")}/`, {
      headers: env.evolutionApiKey ? { apikey: env.evolutionApiKey } : undefined,
      signal: AbortSignal.timeout(4000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

function overallFromComponents(components: StatusComponent[], incidents: StatusIncident[]): StatusLevel {
  const open = incidents.filter((item) => item.status !== "resolved");
  if (open.some((item) => item.impact === "major_outage")) return "major_outage";
  if (open.some((item) => item.impact === "partial_outage")) return "partial_outage";
  if (open.some((item) => item.impact === "maintenance")) return "maintenance";

  const levels = components.map((c) => c.status);
  if (levels.includes("major_outage")) return "major_outage";
  if (levels.includes("partial_outage")) return "partial_outage";
  if (levels.includes("degraded")) return "degraded";
  if (levels.includes("maintenance")) return "maintenance";
  return "operational";
}

export async function getPublicStatus() {
  const [database, evolution, redis, incidents] = await Promise.all([
    checkDatabase(),
    checkEvolution(),
    isRedisReady(),
    readIncidents()
  ]);

  const components: StatusComponent[] = [
    {
      id: "api",
      name: "API Atlas One",
      status: "operational",
      description: "Autenticacao, inbox, CRM e integracoes"
    },
    {
      id: "database",
      name: "Banco de dados",
      status: database ? "operational" : "major_outage"
    },
    {
      id: "whatsapp",
      name: "WhatsApp (Evolution)",
      status: evolution ? "operational" : "degraded",
      description: evolution ? undefined : "Provider WhatsApp indisponivel — inbox pode ser afetado"
    },
    {
      id: "queue",
      name: "Fila de webhooks (Redis)",
      status: env.redisUrl ? (redis ? "operational" : "degraded") : "operational",
      description: env.redisUrl ? undefined : "Redis opcional — entregas inline"
    }
  ];

  const overall = overallFromComponents(components, incidents);
  const openIncidents = incidents.filter((item) => item.status !== "resolved");

  return {
    ok: overall !== "major_outage" && database,
    overall,
    updatedAt: new Date().toISOString(),
    environment: env.nodeEnv,
    components,
    incidents: openIncidents,
    recentIncidents: incidents
      .filter((item) => item.status === "resolved")
      .slice(0, 10),
    monitors: {
      health: "/api/health",
      ready: "/api/ready",
      status: "/api/status"
    }
  };
}
