import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env";

export function verifyMetaWebhookSignature(rawBody: string, signatureHeader: string | undefined) {
  const secret = env.metaWhatsAppAppSecret;
  if (!secret) {
    return env.isProduction ? false : true;
  }
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = signatureHeader.slice("sha256=".length);

  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
  } catch {
    return false;
  }
}
