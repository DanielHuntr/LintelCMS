import { and, desc, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { usersTable } from "../users/users.table.js";
import { type ApiTokenRow, apiTokensTable, type NewApiTokenRow } from "./api-tokens.table.js";

/** Database reads and writes for API tokens, nothing else. */

export type ApiTokenWithCreator = ApiTokenRow & { creatorName: string | null };

export async function listApiTokenRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<ApiTokenWithCreator[]> {
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
  const [inserted] = await database.insert(apiTokensTable).values(token).returning();
  if (!inserted) {
    throw new Error("Saving the API token returned nothing");
  }
  return inserted;
}

export async function findApiTokenByHash(
  database: DatabaseOrTransaction,
  tokenHash: string,
): Promise<ApiTokenRow | undefined> {
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
): Promise<boolean> {
  const deleted = await database
    .delete(apiTokensTable)
    .where(and(eq(apiTokensTable.tenantId, tenantId), eq(apiTokensTable.id, tokenId)))
    .returning({ id: apiTokensTable.id });
  return deleted.length > 0;
}
