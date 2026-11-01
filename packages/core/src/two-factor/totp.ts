import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Time-based one-time passwords (RFC 6238), the six-digit codes authenticator apps show.
 * SHA-1, 30-second steps and six digits, because that is what every app supports.
 */
const STEP_SECONDS = 30;
const DIGITS = 6;
const SECRET_BYTES = 20;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** A new random key, in the base32 form apps accept when typed in by hand. */
export function generateTotpSecret(): string {
  return encodeBase32(randomBytes(SECRET_BYTES));
}

/** The 30-second window a moment falls in. */
export function totpStepAt(now: Date): number {
  return Math.floor(now.getTime() / 1000 / STEP_SECONDS);
}

export function totpCodeForStep(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", decodeBase32(secret)).update(counter).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

/**
 * The step of a matching code, or undefined. Codes from one step either side are accepted,
 * since phone clocks drift and people take a moment to type. A step at or before
 * `lastUsedStep` is refused, so a code can't be used twice.
 */
export function verifyTotpCode(
  secret: string,
  code: string,
  now: Date,
  lastUsedStep: number | null,
): number | undefined {
  const typed = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(typed)) {
    return undefined;
  }
  const current = totpStepAt(now);
  for (const step of [current - 1, current, current + 1]) {
    if (lastUsedStep !== null && step <= lastUsedStep) {
      continue;
    }
    const expected = Buffer.from(totpCodeForStep(secret, step));
    if (timingSafeEqual(expected, Buffer.from(typed))) {
      return step;
    }
  }
  return undefined;
}

/** The address a QR code holds: apps read the site name, the account and the key from it. */
export function totpSetupUrl(issuer: string, accountName: string, secret: string): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const query = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${query}`;
}

function encodeBase32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function decodeBase32(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const character of clean) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
