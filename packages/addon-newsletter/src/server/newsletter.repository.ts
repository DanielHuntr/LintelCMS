import { eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "@lintel/core/plugin";
import {
  type NewNewsletterConnectionRow,
  type NewsletterConnectionRow,
  newsletterConnectionTable,
} from "./newsletter.table.js";

/** Database reads and writes for the connection, nothing else. */

export async function findConnectionRow(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<NewsletterConnectionRow | undefined> {
  const [row] = await database
    .select()
    .from(newsletterConnectionTable)
    .where(eq(newsletterConnectionTable.tenantId, tenantId))
    .limit(1);
  return row;
}

/** Saves the tenant's one connection, replacing the one it had. */
export async function saveConnectionRow(
  database: DatabaseOrTransaction,
  row: NewNewsletterConnectionRow & { tenantId: string },
): Promise<NewsletterConnectionRow> {
  const { tenantId, ...values } = row;
  const [saved] = await database
    .insert(newsletterConnectionTable)
    .values({ ...values, tenantId })
    .onConflictDoUpdate({
      target: newsletterConnectionTable.tenantId,
      set: { ...values, updatedAt: new Date() },
    })
    .returning();
  return saved as NewsletterConnectionRow;
}

export async function deleteConnectionRow(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<void> {
  await database
    .delete(newsletterConnectionTable)
    .where(eq(newsletterConnectionTable.tenantId, tenantId));
}
