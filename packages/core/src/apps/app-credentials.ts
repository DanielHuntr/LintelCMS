import { createHash, randomBytes } from "node:crypto";

/**
 * An app's credential is a client id and a client secret.
 *
 * - The **client id** (`app_` and 20 hex characters) is not secret: it is the audience of
 *   every session token, so an app can tell its tokens from another app's.
 * - The **client secret** (`lintelapp_` and 43 random characters) is what the app sends as
 *   `Authorization: Bearer <secret>`, and what signs its session tokens and webhooks.
 *
 * The secret's prefix can't be the start of an API token ("lintel_"), so a request's
 * bearer value says which kind it is without a second database lookup.
 */
const CLIENT_SECRET_PREFIX = "lintelapp_";
const VISIBLE_CHARACTERS = CLIENT_SECRET_PREFIX.length + 4;

export function generateClientId(): string {
  return `app_${randomBytes(10).toString("hex")}`;
}

export function generateClientSecret(): string {
  return `${CLIENT_SECRET_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function isClientSecret(bearer: string): boolean {
  return bearer.startsWith(CLIENT_SECRET_PREFIX);
}

/** Requests are matched to their app by this hash, so the lookup is by an indexed column. */
export function hashClientSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/** "lintelapp_3fA9", enough to tell secrets apart in the admin. */
export function visibleStartOfSecret(secret: string): string {
  return secret.slice(0, VISIBLE_CHARACTERS);
}
