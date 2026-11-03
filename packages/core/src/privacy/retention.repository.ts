import {
  and,
  count,
  eq,
  gte,
  isNotNull,
  isNull,
  lt,
  min,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { cartsTable } from "../commerce/carts/carts.table.js";
import { checkoutsTable } from "../commerce/checkouts/checkouts.table.js";
import { ordersTable } from "../commerce/orders/orders.table.js";
import { archivedOrdersTable } from "../commerce/shopify-import/shopify-import.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { formSubmissionsTable, formsTable } from "../forms/forms.table.js";
import { securityEventsTable } from "../security-log/security-events.table.js";
import { webhookDeliveriesTable } from "../webhooks/webhooks.table.js";
import { workflowRunsTable } from "../workflows/workflows.table.js";

/**
 * Database reads for the retention rules: what is past a rule's cutoff now, and when the
 * next thing will be. Each kind is described once (`RetainedKind`), so counting, previewing
 * and running all agree on what a rule covers.
 */

export interface RetainedKind {
  table: PgTable;
  id: AnyPgColumn;
  /** The date the rule counts from. */
  dated: AnyPgColumn;
  /** What else a row must be to be covered, besides being old enough. */
  covers: (tenantId: string) => SQL | undefined;
  /** Needed when the rule only covers rows of forms that have no retention of their own. */
  joinForms?: boolean;
}

export const retainedKinds = {
  formEntries: {
    table: formSubmissionsTable,
    id: formSubmissionsTable.id,
    dated: formSubmissionsTable.createdAt,
    covers: (tenantId: string) =>
      and(eq(formSubmissionsTable.tenantId, tenantId), isNull(formsTable.retentionDays)),
    joinForms: true,
  },
  carts: {
    table: cartsTable,
    id: cartsTable.id,
    dated: cartsTable.updatedAt,
    covers: (tenantId: string) => eq(cartsTable.tenantId, tenantId),
  },
  expiredCheckouts: {
    table: checkoutsTable,
    id: checkoutsTable.id,
    dated: checkoutsTable.createdAt,
    covers: (tenantId: string) =>
      and(
        eq(checkoutsTable.tenantId, tenantId),
        eq(checkoutsTable.status, "expired"),
        ne(checkoutsTable.email, ""),
      ),
  },
  securityEvents: {
    table: securityEventsTable,
    id: securityEventsTable.id,
    dated: securityEventsTable.createdAt,
    covers: (tenantId: string) => eq(securityEventsTable.tenantId, tenantId),
  },
  orders: {
    table: ordersTable,
    id: ordersTable.id,
    dated: ordersTable.createdAt,
    covers: (tenantId: string) =>
      and(eq(ordersTable.tenantId, tenantId), ne(ordersTable.email, "")),
  },
  archivedOrders: {
    table: archivedOrdersTable,
    id: archivedOrdersTable.id,
    dated: archivedOrdersTable.placedAt,
    covers: (tenantId: string) =>
      and(
        eq(archivedOrdersTable.tenantId, tenantId),
        // Some imported orders have an address but never had an email.
        or(
          ne(archivedOrdersTable.email, ""),
          sql`${archivedOrdersTable.shippingAddress} ->> 'name' <> 'Removed'`,
        ),
      ),
  },
  webhookDeliveries: {
    table: webhookDeliveriesTable,
    id: webhookDeliveriesTable.id,
    dated: webhookDeliveriesTable.createdAt,
    covers: (tenantId: string) =>
      and(
        eq(webhookDeliveriesTable.tenantId, tenantId),
        ne(webhookDeliveriesTable.status, "pending"),
      ),
  },
  // Runs about an entry are how its reviews are found, so they stay.
  workflowRuns: {
    table: workflowRunsTable,
    id: workflowRunsTable.id,
    dated: workflowRunsTable.createdAt,
    covers: (tenantId: string) =>
      and(
        eq(workflowRunsTable.tenantId, tenantId),
        isNotNull(workflowRunsTable.finishedAt),
        isNull(workflowRunsTable.entryId),
      ),
  },
} satisfies Record<string, RetainedKind>;

function fromKind<Selection extends Record<string, SQL | AnyPgColumn | SQL.Aliased>>(
  database: DatabaseOrTransaction,
  kind: RetainedKind,
  selection: Selection,
) {
  const query = database.select(selection).from(kind.table);
  return kind.joinForms
    ? query.innerJoin(formsTable, eq(formsTable.id, formSubmissionsTable.formId))
    : query;
}

/** How many rows are past the cutoff now. */
export async function countPastCutoff(
  database: DatabaseOrTransaction,
  kind: RetainedKind,
  tenantId: string,
  cutoff: Date,
): Promise<number> {
  const [row] = await fromKind(database, kind, { total: count() }).where(
    and(kind.covers(tenantId), lt(kind.dated, cutoff)),
  );
  return row?.total ?? 0;
}

/** The date of the oldest row not yet past the cutoff, or null when there is none. */
export async function findOldestKept(
  database: DatabaseOrTransaction,
  kind: RetainedKind,
  tenantId: string,
  cutoff: Date,
): Promise<Date | null> {
  const [row] = await fromKind(database, kind, { oldest: min(kind.dated) }).where(
    and(kind.covers(tenantId), gte(kind.dated, cutoff)),
  );
  const oldest = row?.oldest;
  return oldest ? new Date(oldest as Date | string) : null;
}

/** Up to `limit` ids of rows past the cutoff, for one run to delete or anonymise. */
export async function listIdsPastCutoff(
  database: DatabaseOrTransaction,
  kind: RetainedKind,
  tenantId: string,
  cutoff: Date,
  limit: number,
): Promise<string[]> {
  const rows = await fromKind(database, kind, { id: kind.id })
    .where(and(kind.covers(tenantId), lt(kind.dated, cutoff)))
    .limit(limit);
  return rows.map((row) => String(row.id));
}
