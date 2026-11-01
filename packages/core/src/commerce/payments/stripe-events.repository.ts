import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { stripeEventsTable } from "./stripe-events.table.js";

/**
 * Records a Stripe event id; false when it was already there. Run in the same transaction
 * as the event's work, so the id and the work are saved together or not at all.
 */
export async function recordStripeEventIfNew(
  database: DatabaseOrTransaction,
  event: { id: string; type: string },
): Promise<boolean> {
  const inserted = await database
    .insert(stripeEventsTable)
    .values({ id: event.id, type: event.type, tenantId: DEFAULT_TENANT_ID })
    .onConflictDoNothing()
    .returning({ id: stripeEventsTable.id });
  return inserted.length > 0;
}
