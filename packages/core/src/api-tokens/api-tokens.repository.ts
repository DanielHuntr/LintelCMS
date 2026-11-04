import { and, desc, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { usersTable as usersDefinition } from "../users/users.table.js";
import {
  type ApiTokenRow,
  apiTokensTable as apiTokensDefinition,
  type NewApiTokenRow,
} from "./api-tokens.table.js";
import { deleteReturning, insertReturning } from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/** Database reads and writes for API tokens, nothing else. */

export type ApiTokenWithCreator = ApiTokenRow & { creatorName: string | null };

export async function listApiTokenRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<ApiTokenWithCreator[]> {
  const apiTokensTable = tableFor(database, apiTokensDefinition);
  const usersTable = tableFor(database, usersDefinition);
  const rows = await database
    .select({ token: apiTokensTable, creatorName: usersTable.name })
    .from(apiTokensTable)
    .leftJoin(usersTable, eq(usersTable.id, apiTokensTable.createdBy))
    .where(eq(apiTokensTable.tenantId, tenantId))
    .orderBy(desc(apiTokensTable.createdAt));
  return rows.map((row) => ({ ...row.token, creatorName: row.creatorName }));
}

export async function insertApiToken(
  database: DatabaseOrTransaction,
  token: NewApiTokenRow,
): Promise<ApiTokenRow> {
  const apiTokensTable = tableFor(database, apiTokensDefinition);
  const [inserted] = await insertReturning(database, apiTokensTable, token);
  if (!inserted) {
    throw new Error("Saving the API token returned nothing");
  }
  return inserted;
}

export async function findApiTokenByHash(
  database: DatabaseOrTransaction,
  tokenHash: string,
): Promise<ApiTokenRow | undefined> {
  const apiTokensTable = tableFor(database, apiTokensDefinition);
  const [token] = await database
    .select()
    .from(apiTokensTable)
    .where(eq(apiTokensTable.tokenHash, tokenHash))
    .limit(1);
  return token;
}

export async function recordApiTokenUse(
  database: DatabaseOrTransaction,
  tokenId: string,
  usedAt: Date,
): Promise<void> {
  const apiTokensTable = tableFor(database, apiTokensDefinition);
  await database
    .update(apiTokensTable)
    .set({ lastUsedAt: usedAt })
    .where(eq(apiTokensTable.id, tokenId));
}

/** True when a token was deleted. */
export async function deleteApiTokenRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  tokenId: string,
): Promise<{ id: string; name: string } | undefined> {
  const apiTokensTable = tableFor(database, apiTokensDefinition);
  const [deleted] = await deleteReturning(
    database,
    apiTokensTable,
    and(eq(apiTokensTable.tenantId, tenantId), eq(apiTokensTable.id, tokenId)),
    { id: apiTokensTable.id, name: apiTokensTable.name },
  );
  return deleted;
}
