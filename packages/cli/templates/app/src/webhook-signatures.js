import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Checking a webhook from Lintel. The Lintel-Signature header looks like
 * "t=1793500000,v1=<hex>", where v1 is HMAC-SHA256 of "<t>.<raw body>" with the app's
 * client secret. Check the raw body exactly as it arrived, before parsing it, and refuse
 * old signatures so a captured request can't be sent again.
 */
const TOLERANCE_SECONDS = 300;

/**
 * @param {string} rawBody
 * @param {string | undefined} signatureHeader
 * @param {string} clientSecret
 */
export function verifyWebhook(rawBody, signatureHeader, clientSecret, now = new Date()) {
  if (!signatureHeader) return false;
  const parts = new Map(
    signatureHeader.split(",").map((part) => {
      const [key = "", value = ""] = part.trim().split("=", 2);
      return [key, value];
    }),
  );
  const timestamp = Number(parts.get("t"));
  if (
    !Number.isInteger(timestamp) ||
    Math.abs(now.getTime() / 1000 - timestamp) > TOLERANCE_SECONDS
  ) {
    return false;
  }
  const expected = createHmac("sha256", clientSecret).update(`${timestamp}.${rawBody}`).digest();
  const received = Buffer.from(parts.get("v1") ?? "", "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}
