import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Checks the `Stripe-Signature` header on a webhook, as Stripe documents it:
 *
 *   Stripe-Signature: t=1793500000,v1=5257a869e7ec...,v1=...
 *
 * Each `v1` is the HMAC-SHA256, in hex, of "<t>.<raw body>" keyed with the endpoint's
 * signing secret (whsec_...). Any one matching is enough (Stripe sends two while a secret is
 * being rolled). Signatures more than `toleranceSeconds` old are refused, so a captured
 * request can't be replayed later.
 */
export function verifyStripeSignature(
  rawBody: string,
  header: string,
  signingSecret: string,
  now: Date,
  toleranceSeconds = 300,
): boolean {
  const parts = header.split(",").map((part) => {
    const [key = "", ...value] = part.split("=");
    return { key: key.trim(), value: value.join("=").trim() };
  });
  const timestamp = Number(parts.find((part) => part.key === "t")?.value);
  if (!Number.isInteger(timestamp)) {
    return false;
  }
  if (Math.abs(now.getTime() / 1000 - timestamp) > toleranceSeconds) {
    return false;
  }
  const expected = Buffer.from(computeStripeSignature(rawBody, timestamp, signingSecret), "hex");
  return parts
    .filter((part) => part.key === "v1")
    .some((part) => {
      const received = Buffer.from(part.value, "hex");
      return received.length === expected.length && timingSafeEqual(received, expected);
    });
}

export function computeStripeSignature(
  rawBody: string,
  timestamp: number,
  signingSecret: string,
): string {
  return createHmac("sha256", signingSecret).update(`${timestamp}.${rawBody}`).digest("hex");
}
