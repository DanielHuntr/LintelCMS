import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { recoveryCodesTable, type TwoFactorRow, twoFactorTable } from "./two-factor.table.js";

/** Database reads and writes for two-factor settings and recovery codes, nothing else. */

export async function findTwoFactorRow(
  database: DatabaseOrTransaction,
  userId: string,
): Promise<TwoFactorRow | undefined> {
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
  await database
    .insert(twoFactorTable)
    .values({ userId, pendingSecret })
    .onConflictDoUpdate({ target: twoFactorTable.userId, set: { pendingSecret } });
}

export async function updateTwoFactorRow(
  database: DatabaseOrTransaction,
  userId: string,
  changes: Partial<Pick<TwoFactorRow, "secret" | "pendingSecret" | "enabledAt" | "lastUsedStep">>,
): Promise<void> {
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
  const claimed = await database
    .update(twoFactorTable)
    .set({ lastUsedStep: step })
    .where(
      and(
        eq(twoFactorTable.userId, userId),
        previousStep === null
          ? isNull(twoFactorTable.lastUsedStep)
          : eq(twoFactorTable.lastUsedStep, previousStep),
      ),
    )
    .returning({ userId: twoFactorTable.userId });
  return claimed.length > 0;
}

export async function deleteTwoFactorRow(database: DatabaseOrTransaction, userId: string) {
  await database.delete(twoFactorTable).where(eq(twoFactorTable.userId, userId));
}

export async function findEnabledTwoFactorUserIds(
  database: DatabaseOrTransaction,
  userIds: readonly string[],
): Promise<string[]> {
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
  await database.delete(recoveryCodesTable).where(eq(recoveryCodesTable.userId, userId));
  await database
    .insert(recoveryCodesTable)
    .values(codeHashes.map((codeHash) => ({ userId, codeHash })));
}

export async function deleteRecoveryCodes(database: DatabaseOrTransaction, userId: string) {
  await database.delete(recoveryCodesTable).where(eq(recoveryCodesTable.userId, userId));
}

export async function countUnusedRecoveryCodes(
  database: DatabaseOrTransaction,
  userId: string,
): Promise<number> {
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
  const used = await database
    .update(recoveryCodesTable)
    .set({ usedAt: now })
    .where(
      and(
        eq(recoveryCodesTable.userId, userId),
        eq(recoveryCodesTable.codeHash, codeHash),
        isNull(recoveryCodesTable.usedAt),
      ),
    )
    .returning({ id: recoveryCodesTable.id });
  return used.length > 0;
}
