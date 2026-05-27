import Redis from "ioredis";
import { env } from "../config/env";

let client: Redis | null = null;

export function getRedis(): Redis | null {
  if (!env.redisUrl) return null;
  if (!client) {
    client = new Redis(env.redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000))
    });
    client.on("error", () => undefined);
  }
  return client;
}

export async function isRedisReady(): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    if (redis.status === "wait") await redis.connect();
    const pong = await redis.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}

export async function closeRedis() {
  if (client) {
    await client.quit().catch(() => undefined);
    client = null;
  }
}
