import { env } from "../config/env";

type LogLevel = "info" | "warn" | "error";

function emit(level: LogLevel, event: string, detail?: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    service: "atlas-one-server",
    environment: env.nodeEnv,
    ...detail
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const appLog = {
  info: (event: string, detail?: Record<string, unknown>) => emit("info", event, detail),
  warn: (event: string, detail?: Record<string, unknown>) => emit("warn", event, detail),
  error: (event: string, detail?: Record<string, unknown>) => emit("error", event, detail)
};

/** @deprecated use appLog */
export const startupLog = appLog;
