import { createHash, randomInt } from "node:crypto";

/**
 * Recovery codes look like "k7m2-9xqp": easy to read aloud and to type, with no letters
 * that look like numbers. Ten per set, each about 40 bits, used once each.
 */
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const RECOVERY_CODES_PER_SET = 10;

export function generateRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODES_PER_SET }, () => {
    const characters = Array.from(
      { length: 8 },
      () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
    );
    return `${characters.slice(0, 4).join("")}-${characters.slice(4).join("")}`;
  });
}

/** Spaces, dashes and capitals don't matter when a code is typed back in. */
export function hashRecoveryCode(code: string): string {
  const normalized = code.toLowerCase().replace(/[^a-z0-9]/g, "");
  return createHash("sha256").update(normalized).digest("hex");
}
