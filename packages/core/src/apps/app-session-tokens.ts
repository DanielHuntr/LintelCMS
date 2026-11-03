import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

/**
 * Session tokens tell an app's embedded page who is looking at it. They are JWTs (RFC 7519)
 * signed with HMAC-SHA256 using the app's client secret, because every language has a JWT
 * library and HS256 needs only the secret the app already has: an app written in C#,
 * Python or PHP verifies them without anything from Lintel.
 *
 * They last five minutes. The page asks the admin for a fresh one when it runs out (see
 * `@lintel/app-bridge`), so a token copied out of a browser is soon useless.
 */
export const SESSION_TOKEN_LIFETIME_SECONDS = 5 * 60;

/** Allowance for clocks that are a little apart. */
const CLOCK_LEEWAY_SECONDS = 10;

export interface SessionTokenClaims {
  /** The Lintel API that issued it. */
  iss: string;
  /** The admin's origin: the page that embeds the app. */
  dest: string;
  /** The app's client id. */
  aud: string;
  /** The signed-in person's user id. */
  sub: string;
  /** The app's id in Lintel. */
  appId: string;
  /** What the app may do for this person: its scopes' permissions that they also have. */
  permissions: string[];
  iat: number;
  nbf: number;
  exp: number;
  /** Unique per token, so an app can refuse one it has already seen if it wants to. */
  jti: string;
}

export type SessionTokenSubject = Pick<
  SessionTokenClaims,
  "iss" | "dest" | "aud" | "sub" | "appId" | "permissions"
>;

export function signSessionToken(
  clientSecret: string,
  subject: SessionTokenSubject,
  now = new Date(),
): { token: string; expiresAt: Date } {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const claims: SessionTokenClaims = {
    ...subject,
    iat: issuedAt,
    nbf: issuedAt,
    exp: issuedAt + SESSION_TOKEN_LIFETIME_SECONDS,
    jti: randomUUID(),
  };
  const header = encodeJson({ alg: "HS256", typ: "JWT" });
  const payload = encodeJson(claims);
  const signature = sign(clientSecret, `${header}.${payload}`);
  return { token: `${header}.${payload}.${signature}`, expiresAt: new Date(claims.exp * 1000) };
}

export type SessionTokenCheck =
  | { valid: true; claims: SessionTokenClaims }
  | {
      valid: false;
      reason:
        | "malformed"
        | "wrong-algorithm"
        | "bad-signature"
        | "expired"
        | "not-yet-valid"
        | "wrong-audience";
    };

/**
 * The check an app does with every session token, here so the tests and the reference app
 * agree on it. Only HS256 is accepted: a token that names another algorithm (or "none") is
 * refused before its signature is looked at.
 */
export function verifySessionToken(
  clientSecret: string,
  token: string,
  expected: { clientId: string },
  now = new Date(),
): SessionTokenCheck {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false, reason: "malformed" };
  }
  const [header = "", payload = "", signature = ""] = parts;
  const decodedHeader = decodeJson(header);
  if (!decodedHeader || decodedHeader.alg !== "HS256") {
    return { valid: false, reason: decodedHeader ? "wrong-algorithm" : "malformed" };
  }
  const expectedSignature = Buffer.from(sign(clientSecret, `${header}.${payload}`));
  const receivedSignature = Buffer.from(signature);
  if (
    expectedSignature.length !== receivedSignature.length ||
    !timingSafeEqual(expectedSignature, receivedSignature)
  ) {
    return { valid: false, reason: "bad-signature" };
  }
  const claims = decodeJson(payload);
  if (!claims || !isClaims(claims)) {
    return { valid: false, reason: "malformed" };
  }
  const seconds = now.getTime() / 1000;
  if (claims.exp + CLOCK_LEEWAY_SECONDS < seconds) {
    return { valid: false, reason: "expired" };
  }
  if (claims.nbf - CLOCK_LEEWAY_SECONDS > seconds) {
    return { valid: false, reason: "not-yet-valid" };
  }
  if (claims.aud !== expected.clientId) {
    return { valid: false, reason: "wrong-audience" };
  }
  return { valid: true, claims };
}

function sign(secret: string, content: string): string {
  return createHmac("sha256", secret).update(content).digest("base64url");
}

function encodeJson(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeJson(part: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function isClaims(
  value: Record<string, unknown>,
): value is Record<string, unknown> & SessionTokenClaims {
  const strings = ["iss", "dest", "aud", "sub", "appId", "jti"];
  const numbers = ["iat", "nbf", "exp"];
  return (
    strings.every((key) => typeof value[key] === "string") &&
    numbers.every((key) => typeof value[key] === "number") &&
    Array.isArray(value.permissions) &&
    value.permissions.every((permission) => typeof permission === "string")
  );
}
