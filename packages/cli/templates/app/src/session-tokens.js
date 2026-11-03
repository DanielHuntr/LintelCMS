import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Checking the session token the Lintel admin gives the app's page. It is a JWT signed
 * with HS256 and the app's client secret, so any JWT library works too. The steps:
 *
 * 1. Split "header.payload.signature" and refuse any algorithm but HS256.
 * 2. Work out HMAC-SHA256 of "header.payload" with the client secret; compare in constant time.
 * 3. Check `exp` and `nbf` (with a few seconds' allowance) and that `aud` is this app's id.
 *
 * @typedef {object} LintelSession
 * @property {string} userId The person's user id in Lintel.
 * @property {string} appId The app's id in Lintel.
 * @property {string[]} permissions What the app may do for this person.
 * @property {string} adminOrigin The Lintel admin showing the page.
 */

const LEEWAY_SECONDS = 10;

/**
 * @param {string} token
 * @param {{ clientId: string, clientSecret: string }} app
 * @returns {LintelSession | undefined}
 */
export function verifySessionToken(token, app, now = new Date()) {
  const [header, payload, signature, ...rest] = token.split(".");
  if (!header || !payload || !signature || rest.length > 0) return undefined;
  if (readJson(header)?.alg !== "HS256") return undefined;

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
  };
}

/** The token from "Authorization: Bearer <token>". */
export function readBearer(authorization) {
  return authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
}

function readJson(part) {
  try {
    const value = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    return typeof value === "object" && value !== null ? value : undefined;
  } catch {
    return undefined;
  }
}
