import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Checking the session token Lintel gives the app's page. This uses nothing from Lintel on
 * purpose: it is the same few steps an app in any language takes (or a JWT library does).
 *
 * 1. Split "header.payload.signature" and refuse any algorithm but HS256.
 * 2. Recompute HMAC-SHA256 of "header.payload" with the client secret, compare in
 *    constant time.
 * 3. Check `exp` and `nbf` (with a few seconds' allowance), and that `aud` is this app's
 *    client id.
 */
export interface LintelSession {
  /** The person's user id in Lintel. */
  userId: string;
  appId: string;
  /** What the app may do for this person. */
  permissions: string[];
  /** The Lintel admin that embeds the page. */
  adminOrigin: string;
  expiresAt: Date;
}

const LEEWAY_SECONDS = 10;

export function verifySessionToken(
  token: string,
  app: { clientId: string; clientSecret: string },
  now = new Date(),
): LintelSession | undefined {
  const [header, payload, signature, ...rest] = token.split(".");
  if (!header || !payload || !signature || rest.length > 0) {
    return undefined;
  }
  if (readJson(header)?.alg !== "HS256") {
    return undefined;
  }
  const expected = createHmac("sha256", app.clientSecret).update(`${header}.${payload}`).digest();
  const received = Buffer.from(signature, "base64url");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return undefined;
  }
  const claims = readJson(payload);
  const seconds = now.getTime() / 1000;
  if (
    !claims ||
    typeof claims.exp !== "number" ||
    typeof claims.nbf !== "number" ||
    claims.exp + LEEWAY_SECONDS < seconds ||
    claims.nbf - LEEWAY_SECONDS > seconds ||
    claims.aud !== app.clientId ||
    typeof claims.sub !== "string" ||
    typeof claims.appId !== "string" ||
    typeof claims.dest !== "string" ||
    !Array.isArray(claims.permissions)
  ) {
    return undefined;
  }
  return {
    userId: claims.sub,
    appId: claims.appId,
    permissions: claims.permissions.filter((permission) => typeof permission === "string"),
    adminOrigin: claims.dest,
    expiresAt: new Date(claims.exp * 1000),
  };
}

/** The token from `Authorization: Bearer <token>`. */
export function readBearer(authorization: string | undefined): string | undefined {
  return authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
}

function readJson(part: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    return typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}
