import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import {
  recoveryCodesTable as recoveryCodesDefinition,
  type TwoFactorRow,
  twoFactorTable as twoFactorDefinition,
} from "./two-factor.table.js";
import { updateReturning, upsert } from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/** Database reads and writes for two-factor settings and recovery codes, nothing else. */

export async function findTwoFactorRow(
  database: DatabaseOrTransaction,
  userId: string,
): Promise<TwoFactorRow | undefined> {
  const twoFactorTable = tableFor(database, twoFactorDefinition);
  const [row] = await database
    .select()
    .from(twoFactorTable)
    .where(eq(twoFactorTable.userId, userId))
    .limit(1);
  return row;
}

export async function savePendingSecret(
  database: DatabaseOrTransaction,
  userId: string,
  pendingSecret: string,
): Promise<void> {
  const twoFactorTable = tableFor(database, twoFactorDefinition);
  await upsert(
    database,
    twoFactorTable,
    { userId, pendingSecret },
    { target: twoFactorTable.userId, set: { pendingSecret } },
  );
}

export async function updateTwoFactorRow(
  database: DatabaseOrTransaction,
  userId: string,
  changes: Partial<Pick<TwoFactorRow, "secret" | "pendingSecret" | "enabledAt" | "lastUsedStep">>,
): Promise<void> {
  const twoFactorTable = tableFor(database, twoFactorDefinition);
  await database.update(twoFactorTable).set(changes).where(eq(twoFactorTable.userId, userId));
}

/**
 * Records a code as used only if no later code was used first, so two requests with the
 * same code can't both get in.
 */
export async function claimTotpStep(
  database: DatabaseOrTransaction,
  userId: string,
  step: number,
  previousStep: number | null,
): Promise<boolean> {
  const twoFactorTable = tableFor(database, twoFactorDefinition);
  const claimed = await updateReturning(
    database,
    twoFactorTable,
    { lastUsedStep: step },
    and(
      eq(twoFactorTable.userId, userId),
      previousStep === null
        ? isNull(twoFactorTable.lastUsedStep)
        : eq(twoFactorTable.lastUsedStep, previousStep),
    ),
    { userId: twoFactorTable.userId },
  );
  return claimed.length > 0;
}

export async function deleteTwoFactorRow(database: DatabaseOrTransaction, userId: string) {
  const twoFactorTable = tableFor(database, twoFactorDefinition);
  await database.delete(twoFactorTable).where(eq(twoFactorTable.userId, userId));
}

export async function findEnabledTwoFactorUserIds(
  database: DatabaseOrTransaction,
  userIds: readonly string[],
): Promise<string[]> {
  const twoFactorTable = tableFor(database, twoFactorDefinition);
  if (userIds.length === 0) {
    return [];
  }
  const rows = await database
    .select({ userId: twoFactorTable.userId })
    .from(twoFactorTable)
    .where(and(inArray(twoFactorTable.userId, [...userIds]), isNotNull(twoFactorTable.enabledAt)));
  return rows.map((row) => row.userId);
}

export async function replaceRecoveryCodes(
  database: DatabaseOrTransaction,
  userId: string,
  codeHashes: readonly string[],
): Promise<void> {
  const recoveryCodesTable = tableFor(database, recoveryCodesDefinition);
  await database.delete(recoveryCodesTable).where(eq(recoveryCodesTable.userId, userId));
  await database
    .insert(recoveryCodesTable)
    .values(codeHashes.map((codeHash) => ({ userId, codeHash })));
}

export async function deleteRecoveryCodes(database: DatabaseOrTransaction, userId: string) {
  const recoveryCodesTable = tableFor(database, recoveryCodesDefinition);
  await database.delete(recoveryCodesTable).where(eq(recoveryCodesTable.userId, userId));
}

export async function countUnusedRecoveryCodes(
  database: DatabaseOrTransaction,
  userId: string,
): Promise<number> {
  const recoveryCodesTable = tableFor(database, recoveryCodesDefinition);
  const rows = await database
    .select({ id: recoveryCodesTable.id })
    .from(recoveryCodesTable)
    .where(and(eq(recoveryCodesTable.userId, userId), isNull(recoveryCodesTable.usedAt)));
  return rows.length;
}

/** Spends a recovery code; false if it doesn't exist or was used already. */
export async function useRecoveryCode(
  database: DatabaseOrTransaction,
  userId: string,
  codeHash: string,
  now: Date,
): Promise<boolean> {
  const recoveryCodesTable = tableFor(database, recoveryCodesDefinition);
  const used = await updateReturning(
    database,
    recoveryCodesTable,
    { usedAt: now },
    and(
      eq(recoveryCodesTable.userId, userId),
      eq(recoveryCodesTable.codeHash, codeHash),
      isNull(recoveryCodesTable.usedAt),
    ),
    { id: recoveryCodesTable.id },
  );
  return used.length > 0;
}
