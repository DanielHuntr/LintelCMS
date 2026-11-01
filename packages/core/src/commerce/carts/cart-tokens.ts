import { createHash, randomBytes } from "node:crypto";

/**
 * A cart is opened with a random token the storefront keeps (in a cookie or local storage).
 * Only its SHA-256 is stored, as with session tokens, so the database alone can't open carts.
 */
export function generateCartToken(): string {
  return `cart_${randomBytes(24).toString("base64url")}`;
}

export function hashCartToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
