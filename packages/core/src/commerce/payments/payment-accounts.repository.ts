import { and, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import {
  type ConnectableProvider,
  paymentAccountsTable as paymentAccountsDefinition,
  paymentEventsTable as paymentEventsDefinition,
  type SavedMollieCredentials,
  type SavedPayPalCredentials,
} from "./payment-accounts.table.js";
import { insertIfNewReturning, upsert } from "../../database/dialect/writes.js";
import { tableFor } from "../../database/dialect/mysql-tables.js";

/** Database reads and writes for the saved PayPal and Mollie keys, and PayPal's events. */

export async function findSavedCredentials(
  database: DatabaseOrTransaction,
  provider: ConnectableProvider,
): Promise<SavedPayPalCredentials | SavedMollieCredentials | null> {
  const paymentAccountsTable = tableFor(database, paymentAccountsDefinition);
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
  const paymentAccountsTable = tableFor(database, paymentAccountsDefinition);
  await upsert(
    database,
    paymentAccountsTable,
    { tenantId: DEFAULT_TENANT_ID, provider, credentials },
    {
      target: [paymentAccountsTable.tenantId, paymentAccountsTable.provider],
      set: { credentials, updatedAt: new Date() },
    },
  );
}

export async function deleteCredentials(
  database: DatabaseOrTransaction,
  provider: ConnectableProvider,
): Promise<void> {
  const paymentAccountsTable = tableFor(database, paymentAccountsDefinition);
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
  const paymentEventsTable = tableFor(database, paymentEventsDefinition);
  const inserted = await insertIfNewReturning(
    database,
    paymentEventsTable,
    { ...event, tenantId: DEFAULT_TENANT_ID },
    {},
    { eventId: paymentEventsTable.eventId },
  );
  return inserted.length > 0;
}
