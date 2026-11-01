import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * Preview tokens let a website fetch one entry's unpublished draft without a session.
 * A token is `<payload>.<signature>`, both base64url: the payload says which entry and
 * until when, and the signature (HMAC-SHA256 with the site's preview secret) proves Lintel
 * made it. Nothing is stored per token, so they cost nothing to make and simply stop
 * working when they expire.
 */

/** Long enough to look around a page, short enough that a leaked link soon stops working. */
export const PREVIEW_TOKEN_LIFETIME_MS = 30 * 60 * 1000;

const payloadSchema = z.object({
  entryId: z.uuid(),
  /** When the token stops working, in milliseconds since 1970. */
  expiresAt: z.number().int(),
});

export type PreviewTokenPayload = z.infer<typeof payloadSchema>;

export type PreviewTokenCheck =
  { status: "valid"; payload: PreviewTokenPayload } | { status: "expired" } | { status: "invalid" };

/** A new random secret for signing tokens, kept in settings. */
export function generatePreviewSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function signPreviewToken(payload: PreviewTokenPayload, secret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signature(encoded, secret)}`;
}

/** Whether the token was made with this secret, and still has time left. */
export function checkPreviewToken(token: string, secret: string, now: Date): PreviewTokenCheck {
  const [encoded, givenSignature, ...rest] = token.split(".");
  if (!encoded || !givenSignature || rest.length > 0) {
    return { status: "invalid" };
  }
  if (!signaturesMatch(givenSignature, signature(encoded, secret))) {
    return { status: "invalid" };
  }

  const payload = payloadSchema.safeParse(parseJson(Buffer.from(encoded, "base64url").toString()));
  if (!payload.success) {
    return { status: "invalid" };
  }
  if (payload.data.expiresAt <= now.getTime()) {
    return { status: "expired" };
  }
  return { status: "valid", payload: payload.data };
}

function signature(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

/** Compares in constant time, so the response time doesn't hint at a correct prefix. */
function signaturesMatch(given: string, expected: string): boolean {
  const givenBytes = Buffer.from(given);
  const expectedBytes = Buffer.from(expected);
  return givenBytes.length === expectedBytes.length && timingSafeEqual(givenBytes, expectedBytes);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
