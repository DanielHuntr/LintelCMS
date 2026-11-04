import { and, desc, eq, gt, isNull } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import {
  type NewOneTimeToken,
  type OneTimeToken,
  type OneTimeTokenPurpose,
  oneTimeTokensTable as oneTimeTokensDefinition,
} from "./one-time-tokens.table.js";
import { updateReturning } from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/** Database reads and writes for one-time tokens, nothing else. */

export async function insertOneTimeToken(
  database: DatabaseOrTransaction,
  token: NewOneTimeToken,
): Promise<void> {
  const oneTimeTokensTable = tableFor(database, oneTimeTokensDefinition);
  await database.insert(oneTimeTokensTable).values(token);
}

export async function findUnusedOneTimeToken(
  database: DatabaseOrTransaction,
  purpose: OneTimeTokenPurpose,
  tokenHash: string,
  now: Date,
): Promise<OneTimeToken | undefined> {
  const oneTimeTokensTable = tableFor(database, oneTimeTokensDefinition);
  const [token] = await database
    .select()
    .from(oneTimeTokensTable)
    .where(
      and(
        eq(oneTimeTokensTable.tokenHash, tokenHash),
        eq(oneTimeTokensTable.purpose, purpose),
        isNull(oneTimeTokensTable.usedAt),
        gt(oneTimeTokensTable.expiresAt, now),
      ),
    )
    .limit(1);
  return token;
}

/**
 * Marks the token used and returns it, in one statement, so two requests racing with the
 * same link can't both succeed.
 */
export async function markOneTimeTokenUsed(
  database: DatabaseOrTransaction,
  purpose: OneTimeTokenPurpose,
  tokenHash: string,
  now: Date,
): Promise<OneTimeToken | undefined> {
  const oneTimeTokensTable = tableFor(database, oneTimeTokensDefinition);
  const [token] = await updateReturning(
    database,
    oneTimeTokensTable,
    { usedAt: now },
    and(
      eq(oneTimeTokensTable.tokenHash, tokenHash),
      eq(oneTimeTokensTable.purpose, purpose),
      isNull(oneTimeTokensTable.usedAt),
      gt(oneTimeTokensTable.expiresAt, now),
    ),
  );
  return token;
}

export async function deleteOneTimeTokensForUser(
  database: DatabaseOrTransaction,
  userId: string,
  purpose: OneTimeTokenPurpose,
): Promise<void> {
  const oneTimeTokensTable = tableFor(database, oneTimeTokensDefinition);
  await database
    .delete(oneTimeTokensTable)
    .where(and(eq(oneTimeTokensTable.userId, userId), eq(oneTimeTokensTable.purpose, purpose)));
}

export async function countRecentOneTimeTokens(
  database: DatabaseOrTransaction,
  userId: string,
  purpose: OneTimeTokenPurpose,
  since: Date,
): Promise<number> {
  const oneTimeTokensTable = tableFor(database, oneTimeTokensDefinition);
  const rows = await database
    .select({ id: oneTimeTokensTable.id })
    .from(oneTimeTokensTable)
    .where(
      and(
        eq(oneTimeTokensTable.userId, userId),
        eq(oneTimeTokensTable.purpose, purpose),
        gt(oneTimeTokensTable.createdAt, since),
      ),
    );
  return rows.length;
}

export async function findLatestUnusedOneTimeTokenForUser(
  database: DatabaseOrTransaction,
  userId: string,
  purpose: OneTimeTokenPurpose,
  now: Date,
): Promise<OneTimeToken | undefined> {
  const oneTimeTokensTable = tableFor(database, oneTimeTokensDefinition);
  const [token] = await database
    .select()
    .from(oneTimeTokensTable)
    .where(
      and(
        eq(oneTimeTokensTable.userId, userId),
        eq(oneTimeTokensTable.purpose, purpose),
        isNull(oneTimeTokensTable.usedAt),
        gt(oneTimeTokensTable.expiresAt, now),
      ),
    )
    .orderBy(desc(oneTimeTokensTable.createdAt))
    .limit(1);
  return token;
}
