import { and, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import {
  type ConnectableProvider,
  paymentAccountsTable,
  paymentEventsTable,
  type SavedMollieCredentials,
  type SavedPayPalCredentials,
} from "./payment-accounts.table.js";

/** Database reads and writes for the saved PayPal and Mollie keys, and PayPal's events. */

export async function findSavedCredentials(
  database: DatabaseOrTransaction,
  provider: ConnectableProvider,
): Promise<SavedPayPalCredentials | SavedMollieCredentials | null> {
  const [row] = await database
    .select()
    .from(paymentAccountsTable)
    .where(
      and(
        eq(paymentAccountsTable.tenantId, DEFAULT_TENANT_ID),
        eq(paymentAccountsTable.provider, provider),
      ),
    )
    .limit(1);
  return row?.credentials ?? null;
}

export async function saveCredentials(
  database: DatabaseOrTransaction,
  provider: ConnectableProvider,
  credentials: SavedPayPalCredentials | SavedMollieCredentials,
): Promise<void> {
  await database
    .insert(paymentAccountsTable)
    .values({ tenantId: DEFAULT_TENANT_ID, provider, credentials })
    .onConflictDoUpdate({
      target: [paymentAccountsTable.tenantId, paymentAccountsTable.provider],
      set: { credentials, updatedAt: new Date() },
    });
}

export async function deleteCredentials(
  database: DatabaseOrTransaction,
  provider: ConnectableProvider,
): Promise<void> {
  await database
    .delete(paymentAccountsTable)
    .where(
      and(
        eq(paymentAccountsTable.tenantId, DEFAULT_TENANT_ID),
        eq(paymentAccountsTable.provider, provider),
      ),
    );
}

/** Records a webhook event id; false when it was already there. */
export async function recordPaymentEventIfNew(
  database: DatabaseOrTransaction,
  event: { provider: ConnectableProvider; eventId: string; type: string },
): Promise<boolean> {
  const inserted = await database
    .insert(paymentEventsTable)
    .values({ ...event, tenantId: DEFAULT_TENANT_ID })
    .onConflictDoNothing()
    .returning({ eventId: paymentEventsTable.eventId });
  return inserted.length > 0;
}
