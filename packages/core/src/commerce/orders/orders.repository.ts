import { and, asc, count, desc, eq, gte, isNotNull, isNull, ne, or, type SQL } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import type { MarketPaymentProviderId } from "../payments/payment-provider.js";
import {
  type FulfilmentStatus,
  type NewOrderRow,
  type OrderEventRow,
  orderEventsTable as orderEventsDefinition,
  type OrderLineRow,
  orderLinesTable as orderLinesDefinition,
  type OrderRow,
  ordersTable as ordersDefinition,
  type PaymentStatus,
} from "./orders.table.js";
import { insertReturning } from "../../database/dialect/writes.js";
import { likeIgnoringCase } from "../../database/dialect/expressions.js";
import { tableFor } from "../../database/dialect/mysql-tables.js";

/** Database reads and writes for orders, their lines and their timeline. */

export interface OrderFilter {
  search?: string;
  paymentStatus?: PaymentStatus;
  fulfilmentStatus?: FulfilmentStatus;
  cancelled?: boolean;
  customerId?: string;
}

export async function insertOrder(
  database: DatabaseOrTransaction,
  order: NewOrderRow,
): Promise<OrderRow> {
  const ordersTable = tableFor(database, ordersDefinition);
  const [inserted] = await insertReturning(database, ordersTable, order);
  if (!inserted) throw new Error("Saving the order returned nothing");
  return inserted;
}

export async function insertOrderLines(
  database: DatabaseOrTransaction,
  lines: Array<typeof orderLinesDefinition.$inferInsert>,
): Promise<void> {
  const orderLinesTable = tableFor(database, orderLinesDefinition);
  if (lines.length > 0) {
    await database.insert(orderLinesTable).values(lines);
  }
}

export async function findOrderRow(
  database: DatabaseOrTransaction,
  orderId: string,
): Promise<OrderRow | undefined> {
  const ordersTable = tableFor(database, ordersDefinition);
  const [row] = await database
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.tenantId, DEFAULT_TENANT_ID), eq(ordersTable.id, orderId)))
    .limit(1);
  return row;
}

/** Locks the order until the transaction ends, so two refunds can't both pass the checks. */
export async function lockOrderRow(
  database: DatabaseOrTransaction,
  orderId: string,
): Promise<OrderRow | undefined> {
  const ordersTable = tableFor(database, ordersDefinition);
  const [row] = await database
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.tenantId, DEFAULT_TENANT_ID), eq(ordersTable.id, orderId)))
    .limit(1)
    .for("update");
  return row;
}

export async function findOrderRowByCheckout(
  database: DatabaseOrTransaction,
  checkoutId: string,
): Promise<OrderRow | undefined> {
  const ordersTable = tableFor(database, ordersDefinition);
  const [row] = await database
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.checkoutId, checkoutId))
    .limit(1);
  return row;
}

export async function findOrderRowByPaymentIntent(
  database: DatabaseOrTransaction,
  paymentIntentId: string,
): Promise<OrderRow | undefined> {
  const ordersTable = tableFor(database, ordersDefinition);
  const [row] = await database
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.stripePaymentIntentId, paymentIntentId))
    .limit(1);
  return row;
}

export async function listOrderRows(
  database: DatabaseOrTransaction,
  filter: OrderFilter,
  page: { page: number; perPage: number },
): Promise<{ rows: OrderRow[]; total: number }> {
  const ordersTable = tableFor(database, ordersDefinition);
  const where = orderConditions(database, filter);
  const rows = await database
    .select()
    .from(ordersTable)
    .where(where)
    .orderBy(desc(ordersTable.number))
    .limit(page.perPage)
    .offset((page.page - 1) * page.perPage);
  const [total] = await database.select({ value: count() }).from(ordersTable).where(where);
  return { rows, total: total?.value ?? 0 };
}

export async function updateOrderRow(
  database: DatabaseOrTransaction,
  orderId: string,
  changes: Partial<NewOrderRow>,
): Promise<void> {
  const ordersTable = tableFor(database, ordersDefinition);
  await database.update(ordersTable).set(changes).where(eq(ordersTable.id, orderId));
}

export async function listOrderLineRows(
  database: DatabaseOrTransaction,
  orderId: string,
): Promise<OrderLineRow[]> {
  const orderLinesTable = tableFor(database, orderLinesDefinition);
  return database
    .select()
    .from(orderLinesTable)
    .where(eq(orderLinesTable.orderId, orderId))
    .orderBy(asc(orderLinesTable.position));
}

export async function updateOrderLineRow(
  database: DatabaseOrTransaction,
  lineId: string,
  changes: Partial<Pick<OrderLineRow, "fulfilledQuantity" | "refundedQuantity">>,
): Promise<void> {
  const orderLinesTable = tableFor(database, orderLinesDefinition);
  await database.update(orderLinesTable).set(changes).where(eq(orderLinesTable.id, lineId));
}

export async function insertOrderEvent(
  database: DatabaseOrTransaction,
  event: {
    orderId: string;
    kind: string;
    message: string;
    data?: Record<string, unknown>;
    createdBy?: string | null;
  },
): Promise<void> {
  const orderEventsTable = tableFor(database, orderEventsDefinition);
  await database.insert(orderEventsTable).values({ tenantId: DEFAULT_TENANT_ID, ...event });
}

export async function listOrderEventRows(
  database: DatabaseOrTransaction,
  orderId: string,
): Promise<OrderEventRow[]> {
  const orderEventsTable = tableFor(database, orderEventsDefinition);
  return database
    .select()
    .from(orderEventsTable)
    .where(eq(orderEventsTable.orderId, orderId))
    .orderBy(desc(orderEventsTable.createdAt), desc(orderEventsTable.id));
}

const LARGEST_ORDER_NUMBER = 2_147_483_647;

function orderConditions(database: DatabaseOrTransaction, filter: OrderFilter): SQL | undefined {
  const ordersTable = tableFor(database, ordersDefinition);
  const search = filter.search?.replace(/^#/, "").trim();
  const escaped = search?.replace(/[\\%_]/g, (character) => `\\${character}`);
  return and(
    eq(ordersTable.tenantId, DEFAULT_TENANT_ID),
    filter.paymentStatus ? eq(ordersTable.paymentStatus, filter.paymentStatus) : undefined,
    filter.fulfilmentStatus ? eq(ordersTable.fulfilmentStatus, filter.fulfilmentStatus) : undefined,
    filter.cancelled === true ? isNotNull(ordersTable.cancelledAt) : undefined,
    filter.cancelled === false ? isNull(ordersTable.cancelledAt) : undefined,
    filter.customerId ? eq(ordersTable.customerId, filter.customerId) : undefined,
    escaped
      ? or(
          likeIgnoringCase(database, ordersTable.email, `%${escaped}%`),
          isOrderNumber(search) ? eq(ordersTable.number, Number(search)) : undefined,
          likeIgnoringCase(database, ordersTable.name, `%${escaped}%`),
        )
      : undefined,
  );
}

/** Digits that fit the column: Postgres refuses to compare a bigger number with it. */
function isOrderNumber(search: string | undefined): boolean {
  return /^\d+$/.test(search ?? "") && Number(search) <= LARGEST_ORDER_NUMBER;
}

export async function countOrdersPaidSince(
  database: DatabaseOrTransaction,
  provider: MarketPaymentProviderId,
  since: Date,
): Promise<number> {
  const ordersTable = tableFor(database, ordersDefinition);
  const [total] = await database
    .select({ value: count() })
    .from(ordersTable)
    .where(and(eq(ordersTable.paymentProvider, provider), gte(ordersTable.paidAt, since)));
  return total?.value ?? 0;
}

/** Orders that still need sending, for the dashboard. */
export async function countUnfulfilledOrders(database: DatabaseOrTransaction): Promise<number> {
  const ordersTable = tableFor(database, ordersDefinition);
  const [total] = await database
    .select({ value: count() })
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.tenantId, DEFAULT_TENANT_ID),
        ne(ordersTable.fulfilmentStatus, "fulfilled"),
        ne(ordersTable.paymentStatus, "refunded"),
        isNull(ordersTable.cancelledAt),
        eq(ordersTable.isTest, false),
      ),
    );
  return total?.value ?? 0;
}
