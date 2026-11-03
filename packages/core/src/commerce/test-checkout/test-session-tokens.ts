import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * The signed tokens behind a test session. Two kinds, each only good for its own job:
 *
 *   launch    in the link the admin opens: lasts five minutes, and is only ever swapped for
 *             a session
 *   session   in the website's cookie: lasts two hours, and is what makes this one browser
 *             a test shopper
 *
 * A token is `<payload>.<signature>`, both base64url. Nothing is stored, so there is no
 * site-wide state that could be left on: a browser without a good token is an ordinary
 * visitor. The key is derived from the install's signing secret, so these tokens can't be
 * swapped with preview tokens signed by the same secret.
 */

export const TEST_SESSION_COOKIE = "lintel_shop_test";
/** How the website tells the API, inside the process, that the visitor has a session. */
export const TEST_SESSION_HEADER = "lintel-shop-test";

export const LAUNCH_TOKEN_LIFETIME_MS = 5 * 60 * 1000;
export const SESSION_TOKEN_LIFETIME_MS = 2 * 60 * 60 * 1000;

const tokenKinds = ["launch", "session"] as const;
type TestTokenKind = (typeof tokenKinds)[number];

const payloadSchema = z.object({
  kind: z.enum(tokenKinds),
  /** Who started it, for the log. */
  userId: z.uuid(),
  /** When the token stops working, in milliseconds since 1970. */
  expiresAt: z.number().int(),
});

export type TestTokenPayload = z.infer<typeof payloadSchema>;

export type TestTokenCheck =
  { status: "valid"; payload: TestTokenPayload } | { status: "expired" } | { status: "invalid" };

export function signTestToken(payload: TestTokenPayload, signingSecret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signature(encoded, signingSecret)}`;
}

/** Whether the token is this kind, was made with this secret, and has time left. */
export function checkTestToken(
  token: string,
  kind: TestTokenKind,
  signingSecret: string,
  now: Date,
): TestTokenCheck {
  const [encoded, givenSignature, ...rest] = token.split(".");
  if (!encoded || !givenSignature || rest.length > 0) return { status: "invalid" };
  if (!signaturesMatch(givenSignature, signature(encoded, signingSecret))) {
    return { status: "invalid" };
  }
  const payload = payloadSchema.safeParse(parseJson(Buffer.from(encoded, "base64url").toString()));
  if (!payload.success || payload.data.kind !== kind) return { status: "invalid" };
  if (payload.data.expiresAt <= now.getTime()) return { status: "expired" };
  return { status: "valid", payload: payload.data };
}

function signature(encodedPayload: string, signingSecret: string): string {
  const key = createHmac("sha256", signingSecret).update("lintel shop test session").digest();
  return createHmac("sha256", key).update(encodedPayload).digest("base64url");
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
