import { and, count, eq, gte, isNotNull, isNull, lt, min, ne, or, type SQL } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { cartsTable as cartsDefinition } from "../commerce/carts/carts.table.js";
import { checkoutsTable as checkoutsDefinition } from "../commerce/checkouts/checkouts.table.js";
import { ordersTable as ordersDefinition } from "../commerce/orders/orders.table.js";
import { archivedOrdersTable as archivedOrdersDefinition } from "../commerce/shopify-import/shopify-import.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import {
  formSubmissionsTable as formSubmissionsDefinition,
  formsTable as formsDefinition,
} from "../forms/forms.table.js";
import { securityEventsTable as securityEventsDefinition } from "../security-log/security-events.table.js";
import { webhookDeliveriesTable as webhookDeliveriesDefinition } from "../webhooks/webhooks.table.js";
import { workflowRunsTable as workflowRunsDefinition } from "../workflows/workflows.table.js";
import { columnFor, tableFor } from "../database/dialect/mysql-tables.js";
import { jsonText } from "../database/dialect/expressions.js";

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
  covers: (database: DatabaseOrTransaction, tenantId: string) => SQL | undefined;
  /** Needed when the rule only covers rows of forms that have no retention of their own. */
  joinForms?: boolean;
}

export const retainedKinds = {
  formEntries: {
    table: formSubmissionsDefinition,
    id: formSubmissionsDefinition.id,
    dated: formSubmissionsDefinition.createdAt,
    covers: (database: DatabaseOrTransaction, tenantId: string) =>
      and(
        eq(tableFor(database, formSubmissionsDefinition).tenantId, tenantId),
        isNull(tableFor(database, formsDefinition).retentionDays),
      ),
    joinForms: true,
  },
  carts: {
    table: cartsDefinition,
    id: cartsDefinition.id,
    dated: cartsDefinition.updatedAt,
    covers: (database: DatabaseOrTransaction, tenantId: string) =>
      eq(tableFor(database, cartsDefinition).tenantId, tenantId),
  },
  expiredCheckouts: {
    table: checkoutsDefinition,
    id: checkoutsDefinition.id,
    dated: checkoutsDefinition.createdAt,
    covers: (database: DatabaseOrTransaction, tenantId: string) =>
      and(
        eq(tableFor(database, checkoutsDefinition).tenantId, tenantId),
        eq(tableFor(database, checkoutsDefinition).status, "expired"),
        ne(tableFor(database, checkoutsDefinition).email, ""),
      ),
  },
  securityEvents: {
    table: securityEventsDefinition,
    id: securityEventsDefinition.id,
    dated: securityEventsDefinition.createdAt,
    covers: (database: DatabaseOrTransaction, tenantId: string) =>
      eq(tableFor(database, securityEventsDefinition).tenantId, tenantId),
  },
  orders: {
    table: ordersDefinition,
    id: ordersDefinition.id,
    dated: ordersDefinition.createdAt,
    covers: (database: DatabaseOrTransaction, tenantId: string) =>
      and(
        eq(tableFor(database, ordersDefinition).tenantId, tenantId),
        ne(tableFor(database, ordersDefinition).email, ""),
      ),
  },
  archivedOrders: {
    table: archivedOrdersDefinition,
    id: archivedOrdersDefinition.id,
    dated: archivedOrdersDefinition.placedAt,
    covers: (database: DatabaseOrTransaction, tenantId: string) =>
      and(
        eq(tableFor(database, archivedOrdersDefinition).tenantId, tenantId),
        // Some imported orders have an address but never had an email.
        or(
          ne(tableFor(database, archivedOrdersDefinition).email, ""),
          ne(
            jsonText(
              database,
              tableFor(database, archivedOrdersDefinition).shippingAddress,
              "name",
            ),
            "Removed",
          ),
        ),
      ),
  },
  webhookDeliveries: {
    table: webhookDeliveriesDefinition,
    id: webhookDeliveriesDefinition.id,
    dated: webhookDeliveriesDefinition.createdAt,
    covers: (database: DatabaseOrTransaction, tenantId: string) =>
      and(
        eq(tableFor(database, webhookDeliveriesDefinition).tenantId, tenantId),
        ne(tableFor(database, webhookDeliveriesDefinition).status, "pending"),
      ),
  },
  // Runs about an entry are how its reviews are found, so they stay.
  workflowRuns: {
    table: workflowRunsDefinition,
    id: workflowRunsDefinition.id,
    dated: workflowRunsDefinition.createdAt,
    covers: (database: DatabaseOrTransaction, tenantId: string) =>
      and(
        eq(tableFor(database, workflowRunsDefinition).tenantId, tenantId),
        isNotNull(tableFor(database, workflowRunsDefinition).finishedAt),
        isNull(tableFor(database, workflowRunsDefinition).entryId),
      ),
  },
} satisfies Record<string, RetainedKind>;

function fromKind<Selection extends Record<string, SQL | AnyPgColumn | SQL.Aliased>>(
  database: DatabaseOrTransaction,
  kind: RetainedKind,
  selection: Selection,
) {
  const query = database.select(selection).from(tableFor(database, kind.table));
  const forms = tableFor(database, formsDefinition);
  const submissions = tableFor(database, formSubmissionsDefinition);
  return kind.joinForms ? query.innerJoin(forms, eq(forms.id, submissions.formId)) : query;
}

/** How many rows are past the cutoff now. */
export async function countPastCutoff(
  database: DatabaseOrTransaction,
  kind: RetainedKind,
  tenantId: string,
  cutoff: Date,
): Promise<number> {
  const [row] = await fromKind(database, kind, { total: count() }).where(
    and(kind.covers(database, tenantId), lt(columnFor(database, kind.dated), cutoff)),
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
  const [row] = await fromKind(database, kind, {
    oldest: min(columnFor(database, kind.dated)),
  }).where(and(kind.covers(database, tenantId), gte(columnFor(database, kind.dated), cutoff)));
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
  const rows = await fromKind(database, kind, { id: columnFor(database, kind.id) })
    .where(and(kind.covers(database, tenantId), lt(columnFor(database, kind.dated), cutoff)))
    .limit(limit);
  return rows.map((row) => String(row.id));
}
