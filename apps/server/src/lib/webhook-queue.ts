import { getRedis } from "./redis";
import { attemptDelivery } from "../services/integrations/webhook-dispatcher.service";

const QUEUE_KEY = "atlas:webhook:deliveries";

export async function enqueueWebhookDelivery(deliveryId: string) {
  const redis = getRedis();
  if (!redis) return false;
  try {
    await redis.rpush(QUEUE_KEY, deliveryId);
    return true;
  } catch {
    return false;
  }
}

export async function processWebhookQueueBatch(limit = 10) {
  const redis = getRedis();
  if (!redis) return 0;

  let processed = 0;
  for (let i = 0; i < limit; i += 1) {
    const deliveryId = await redis.lpop(QUEUE_KEY);
    if (!deliveryId) break;
    await attemptDelivery(deliveryId);
    processed += 1;
  }
  return processed;
}
