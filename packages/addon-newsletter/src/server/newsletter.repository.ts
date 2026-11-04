import { eq } from "drizzle-orm";
import { type DatabaseOrTransaction, tableFor, upsertReturning } from "@lintel/core/plugin";
import {
  type NewNewsletterConnectionRow,
  type NewsletterConnectionRow,
  newsletterConnectionTable as newsletterConnectionDefinition,
} from "./newsletter.table.js";

/** Database reads and writes for the connection, nothing else. */

export async function findConnectionRow(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<NewsletterConnectionRow | undefined> {
  const connections = tableFor(database, newsletterConnectionDefinition);
  const [row] = await database
    .select()
    .from(connections)
    .where(eq(connections.tenantId, tenantId))
    .limit(1);
  return row;
}

/** Saves the tenant's one connection, replacing the one it had. */
export async function saveConnectionRow(
  database: DatabaseOrTransaction,
  row: NewNewsletterConnectionRow & { tenantId: string },
): Promise<NewsletterConnectionRow> {
  const connections = tableFor(database, newsletterConnectionDefinition);
  const { tenantId, ...values } = row;
  const [saved] = await upsertReturning(
    database,
    connections,
    { ...values, tenantId },
    { target: connections.tenantId, set: { ...values, updatedAt: new Date() } },
  );
  return saved as NewsletterConnectionRow;
}

export async function deleteConnectionRow(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<void> {
  const connections = tableFor(database, newsletterConnectionDefinition);
  await database.delete(connections).where(eq(connections.tenantId, tenantId));
}
