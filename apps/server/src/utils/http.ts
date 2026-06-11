import type { FastifyReply } from "fastify";
import { env } from "../config/env";
import { appLog } from "../lib/app-log";

type SendErrorOptions = {
  requestId?: string;
  /** When true, include a safe `message` field even in production (login/validation). */
  exposeMessage?: boolean;
};

export function sendError(
  reply: FastifyReply,
  statusCode: number,
  message: string,
  details?: unknown,
  options?: SendErrorOptions
) {
  if (statusCode >= 500) {
    appLog.error("api_error", {
      requestId: options?.requestId,
      statusCode,
      message,
      details: details instanceof Error ? details.message : details
    });
  }

  const detailText =
    typeof details === "string"
      ? details
      : details instanceof Error
        ? details.message
        : undefined;

  const exposeDetails = options?.exposeMessage || (!env.isProduction && details !== undefined);
  const safeMessage = detailText && (options?.exposeMessage || !env.isProduction) ? detailText : undefined;

  return reply.status(statusCode).send({
    error: message,
    ...(safeMessage ? { message: safeMessage } : {}),
    ...(options?.requestId ? { requestId: options.requestId } : {}),
    ...(exposeDetails && detailText && !safeMessage
      ? { details: detailText }
      : exposeDetails && details !== undefined && !detailText
        ? { details: details instanceof Error ? details.message : details }
        : {})
  });
}

export function clientMessage(error: unknown, fallback: string) {
  if (env.isProduction) return fallback;
  return error instanceof Error ? error.message : fallback;
}

const INTERNAL_ERROR_PATTERN = /prisma|invocation in|\.ts:\d+|Unique constraint failed/i;

/** Safe client-facing detail — never exposes ORM paths or stack fragments. */
export function safeClientMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  const message = error.message.trim();
  if (!message || INTERNAL_ERROR_PATTERN.test(message)) return fallback;
  return message.length > 240 ? fallback : message;
}
