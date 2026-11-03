import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Everything between Lintel and the PHP companion is signed with the target's shared
 * secret (HMAC-SHA256), matching `lintel-bridge.php`:
 *
 *   - files Lintel publishes for it (the catalogue, the forms) carry a signature, so
 *     editing them on the host can't change a price or a form;
 *   - requests Lintel sends it carry the time, a one-off nonce and a signature over both
 *     and the body; the companion refuses old requests and any nonce it has seen before.
 */

export interface SignedEnvelope {
  payload: string;
  signature: string;
}

export function hmacHex(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("hex");
}

/** A value as the companion reads it: JSON with its signature beside it. */
export function signEnvelope(secret: string, value: unknown): string {
  const payload = JSON.stringify(value);
  const envelope: SignedEnvelope = { payload, signature: hmacHex(secret, payload) };
  return `${JSON.stringify(envelope)}\n`;
}

export function openEnvelope(secret: string, text: string): unknown {
  const envelope = JSON.parse(text) as Partial<SignedEnvelope>;
  const payload = String(envelope.payload ?? "");
  const expected = Buffer.from(hmacHex(secret, payload));
  const received = Buffer.from(String(envelope.signature ?? ""));
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new Error("The signature doesn't match.");
  }
  return JSON.parse(payload);
}

/** Headers for a request to the companion. */
export function signedRequestHeaders(
  secret: string,
  action: string,
  body: string,
  now = new Date(),
): Record<string, string> {
  const timestamp = String(Math.floor(now.getTime() / 1000));
  const nonce = randomBytes(16).toString("hex");
  return {
    "x-lintel-timestamp": timestamp,
    "x-lintel-nonce": nonce,
    "x-lintel-signature": hmacHex(secret, `${timestamp}\n${nonce}\n${action}\n${body}`),
  };
}
