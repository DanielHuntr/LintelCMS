import { and, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { userInterfaceLanguagesTable } from "./interface-languages.table.js";

/** Database reads and writes for each person's interface language, nothing else. */

export async function findUserInterfaceLanguage(
  database: DatabaseOrTransaction,
  tenantId: string,
  userId: string,
): Promise<string | undefined> {
  const [row] = await database
    .select({ language: userInterfaceLanguagesTable.language })
    .from(userInterfaceLanguagesTable)
    .where(
      and(
        eq(userInterfaceLanguagesTable.tenantId, tenantId),
        eq(userInterfaceLanguagesTable.userId, userId),
      ),
    )
    .limit(1);
  return row?.language;
}

export async function upsertUserInterfaceLanguage(
  database: DatabaseOrTransaction,
  tenantId: string,
  userId: string,
  language: string,
): Promise<void> {
  await database
    .insert(userInterfaceLanguagesTable)
    .values({ tenantId, userId, language })
    .onConflictDoUpdate({
      target: userInterfaceLanguagesTable.userId,
      set: { language, updatedAt: new Date() },
    });
}

export async function deleteUserInterfaceLanguage(
  database: DatabaseOrTransaction,
  tenantId: string,
  userId: string,
): Promise<void> {
  await database
    .delete(userInterfaceLanguagesTable)
    .where(
      and(
        eq(userInterfaceLanguagesTable.tenantId, tenantId),
        eq(userInterfaceLanguagesTable.userId, userId),
      ),
    );
}
