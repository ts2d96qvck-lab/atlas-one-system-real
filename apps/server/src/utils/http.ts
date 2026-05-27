import type { FastifyReply } from "fastify";
import { env } from "../config/env";
import { appLog } from "../lib/app-log";

export function sendError(reply: FastifyReply, statusCode: number, message: string, details?: unknown) {
  if (statusCode >= 500) {
    appLog.error("api_error", {
      statusCode,
      message,
      details: details instanceof Error ? details.message : details
    });
  }

  const exposeDetails = !env.isProduction && details !== undefined;
  return reply.status(statusCode).send({
    error: message,
    ...(exposeDetails
      ? { details: details instanceof Error ? details.message : details }
      : {})
  });
}

export function clientMessage(error: unknown, fallback: string) {
  if (env.isProduction) return fallback;
  return error instanceof Error ? error.message : fallback;
}
