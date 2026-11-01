import { createHash, randomBytes } from "node:crypto";

/**
 * Tokens look like "lintel_" and 43 random characters. The prefix makes a leaked token
 * easy to spot in a code search or a secret scanner.
 */
const TOKEN_PREFIX = "lintel_";
const VISIBLE_CHARACTERS = TOKEN_PREFIX.length + 4;

export function generateApiTokenSecret(): string {
  return `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function hashApiTokenSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/** "lintel_3fA9", enough to tell tokens apart without being any use to an attacker. */
export function visibleStartOf(secret: string): string {
  return secret.slice(0, VISIBLE_CHARACTERS);
}

/** The token from `Authorization: Bearer <token>`, or undefined when there isn't one. */
export function readBearerToken(authorization: string | undefined): string | undefined {
  const match = authorization?.match(/^Bearer\s+(\S+)\s*$/i);
  return match?.[1];
}
