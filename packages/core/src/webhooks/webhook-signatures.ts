import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Every webhook request carries a signature, so the receiver can tell it came from this
 * Lintel and wasn't changed on the way:
 *
 *   Lintel-Signature: t=1793500000,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd
 *
 * `v1` is the HMAC-SHA256, in hex, of "<t>.<raw body>" with the webhook's secret. `t` is
 * when it was signed, in seconds; receivers should refuse old ones so a captured request
 * can't be replayed later.
 */
export const SIGNATURE_HEADER = "lintel-signature";

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

export function signWebhookBody(secret: string, body: string, signedAt: Date): string {
  const timestamp = Math.floor(signedAt.getTime() / 1000);
  return `t=${timestamp},v1=${computeSignature(secret, timestamp, body)}`;
}

/**
 * The check a receiver does, here so the tests and the README example stay honest.
 * Refuses signatures older than `toleranceSeconds`.
 */
export function verifyWebhookSignature(
  secret: string,
  body: string,
  header: string,
  now = new Date(),
  toleranceSeconds = 300,
): boolean {
  const parts = new Map(
    header.split(",").map((part) => {
      const [key = "", ...value] = part.split("=");
      return [key.trim(), value.join("=")] as const;
    }),
  );
  const timestamp = Number(parts.get("t"));
  const signature = parts.get("v1") ?? "";
  if (
    !Number.isInteger(timestamp) ||
    Math.abs(now.getTime() / 1000 - timestamp) > toleranceSeconds
  ) {
    return false;
  }
  const expected = Buffer.from(computeSignature(secret, timestamp, body), "hex");
  const received = Buffer.from(signature, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function computeSignature(secret: string, timestamp: number, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}
