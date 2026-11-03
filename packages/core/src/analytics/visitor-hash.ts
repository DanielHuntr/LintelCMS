import { createHash, randomBytes } from "node:crypto";
import type { DatabaseOrTransaction } from "../database/client.js";
import { deleteSaltsExcept, findOrCreateSalt } from "./analytics.repository.js";

/**
 * How one visitor is told apart from another for a single day, without cookies or anything
 * kept in their browser:
 *
 *   hash = SHA-256(today's random salt, site, address, browser)
 *
 * The address and browser are read from the request and thrown away; only the hash is kept.
 * The salt is random, made each day and deleted when the day is over, so a hash can't be
 * turned back into an address (there is nothing left to try guesses against), and the same
 * person gets an unrelated hash tomorrow. See docs/decisions/0042-built-in-visitor-counts.md.
 */

export interface VisitorFingerprintParts {
  siteId: string;
  ipAddress: string;
  userAgent: string;
}

export function hashVisitor(salt: string, parts: VisitorFingerprintParts): string {
  return createHash("sha256")
    .update(salt)
    .update("\u0000")
    .update(parts.siteId)
    .update("\u0000")
    .update(parts.ipAddress)
    .update("\u0000")
    .update(parts.userAgent)
    .digest("hex")
    .slice(0, 32);
}

/** Salts already read this process, by tenant and day, so most visits cost no query. */
const knownSalts = new Map<string, string>();

export async function saltForDay(
  database: DatabaseOrTransaction,
  tenantId: string,
  day: string,
): Promise<string> {
  const cacheKey = `${tenantId}\u0000${day}`;
  const known = knownSalts.get(cacheKey);
  if (known) return known;
  const salt = await findOrCreateSalt(database, tenantId, day, randomBytes(32).toString("hex"));
  // A new day: forget yesterday's salt here and in the database.
  for (const key of knownSalts.keys()) {
    if (key.startsWith(`${tenantId}\u0000`)) knownSalts.delete(key);
  }
  knownSalts.set(cacheKey, salt);
  await deleteSaltsExcept(database, tenantId, day);
  return salt;
}

/** For tests, and when the database is switched: salts are read again. */
export function forgetKnownSalts(): void {
  knownSalts.clear();
}
