import { and, desc, eq, inArray, isNotNull, ne, or, type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { cartsTable as cartsDefinition } from "../commerce/carts/carts.table.js";
import { checkoutsTable as checkoutsDefinition } from "../commerce/checkouts/checkouts.table.js";
import type { Address } from "../commerce/customers/address.schema.js";
import { customersTable as customersDefinition } from "../commerce/customers/customers.table.js";
import { discountRedemptionsTable as discountRedemptionsDefinition } from "../commerce/discounts/discounts.table.js";
import {
  orderEventsTable as orderEventsDefinition,
  orderLinesTable as orderLinesDefinition,
  ordersTable as ordersDefinition,
} from "../commerce/orders/orders.table.js";
import { archivedOrdersTable as archivedOrdersDefinition } from "../commerce/shopify-import/shopify-import.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import {
  formSubmissionNotesTable as formSubmissionNotesDefinition,
  formSubmissionsTable as formSubmissionsDefinition,
  formsTable as formsDefinition,
} from "../forms/forms.table.js";
import { invitationsTable as invitationsDefinition } from "../invitations/invitations.table.js";
import { securityEventsTable as securityEventsDefinition } from "../security-log/security-events.table.js";
import { sessionsTable as sessionsDefinition } from "../sessions/sessions.table.js";
import { usersTable as usersDefinition } from "../users/users.table.js";
import { webhookDeliveriesTable as webhookDeliveriesDefinition } from "../webhooks/webhooks.table.js";
import { workflowRunsTable as workflowRunsDefinition } from "../workflows/workflows.table.js";
import type { PersonLookup } from "./personal-data-declaration.js";
import { deleteReturning, updateReturning } from "../database/dialect/writes.js";
import { jsonAsText, jsonText } from "../database/dialect/expressions.js";
import { jsonObjectHoldsText } from "../database/dialect/json-expressions.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/**
 * Database reads and writes for finding, exporting and erasing one person's data in Lintel's
 * own tables, nothing else. Emails are compared lowercased; a name only as a whole name.
 */

function matchesText(column: AnyPgColumn | SQL, value: string): SQL {
  return sql`lower(trim(${column})) = ${value.trim().toLowerCase()}`;
}

/** Either the email or the name matches, whichever were given. */
function matchesPerson(
  person: PersonLookup,
  emailColumn: AnyPgColumn | SQL | null,
  nameColumn: AnyPgColumn | SQL | null,
): SQL {
  const conditions = [
    person.email && emailColumn ? matchesText(emailColumn, person.email) : undefined,
    person.name && nameColumn ? matchesText(nameColumn, person.name) : undefined,
  ].filter((condition): condition is SQL => condition !== undefined);
  return or(...conditions) ?? sql`false`;
}

const addressName = (database: DatabaseOrTransaction, column: AnyPgColumn) =>
  jsonText(database, column, "name");

/** An address with everything that could identify someone removed. The country stays for tax. */
export function anonymisedAddress(address: Address | null): Address | null {
  if (!address) return null;
  return {
    name: "Removed",
    company: "",
    line1: "Removed",
    line2: "",
    city: "Removed",
    region: address.region,
    postalCode: "",
    country: address.country,
    phone: "",
  };
}

// People who sign in -----------------------------------------------------------------------

export function listMatchingUsers(
  database: DatabaseOrTransaction,
  tenantId: string,
  person: PersonLookup,
) {
  const usersTable = tableFor(database, usersDefinition);
  return database
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.tenantId, tenantId),
        matchesPerson(person, usersTable.email, usersTable.name),
      ),
    );
}

export function listMatchingInvitations(
  database: DatabaseOrTransaction,
  tenantId: string,
  person: PersonLookup,
) {
  const invitationsTable = tableFor(database, invitationsDefinition);
  return database
    .select({
      id: invitationsTable.id,
      email: invitationsTable.email,
      createdAt: invitationsTable.createdAt,
    })
    .from(invitationsTable)
    .where(
      and(
        eq(invitationsTable.tenantId, tenantId),
        matchesPerson(person, invitationsTable.email, null),
      ),
    );
}

export function listSessionsOfUsers(database: DatabaseOrTransaction, userIds: readonly string[]) {
  const sessionsTable = tableFor(database, sessionsDefinition);
  if (userIds.length === 0) return Promise.resolve([]);
  return database
    .select({
      userAgent: sessionsTable.userAgent,
      lastUsedAt: sessionsTable.lastUsedAt,
    })
    .from(sessionsTable)
    .where(inArray(sessionsTable.userId, [...userIds]));
}

export async function deleteInvitations(
  database: DatabaseOrTransaction,
  ids: readonly string[],
): Promise<number> {
  const invitationsTable = tableFor(database, invitationsDefinition);
  if (ids.length === 0) return 0;
  const deleted = await deleteReturning(
    database,
    invitationsTable,
    inArray(invitationsTable.id, [...ids]),
    { id: invitationsTable.id },
  );
  return deleted.length;
}

// Form entries ------------------------------------------------------------------------------

/** A submission's answers include the name, as any whole answer. */
function answersInclude(database: DatabaseOrTransaction, name: string): SQL {
  const formSubmissionsTable = tableFor(database, formSubmissionsDefinition);
  return jsonObjectHoldsText(database, formSubmissionsTable.values, name);
}

export async function listMatchingSubmissions(
  database: DatabaseOrTransaction,
  tenantId: string,
  person: PersonLookup,
) {
  const formSubmissionsTable = tableFor(database, formSubmissionsDefinition);
  const formsTable = tableFor(database, formsDefinition);
  const conditions = [
    person.email ? eq(formSubmissionsTable.submitterEmail, person.email.toLowerCase()) : undefined,
    // Only the first email answer is kept in that column; a friend's address is in the answers.
    person.email ? answersInclude(database, person.email) : undefined,
    person.name ? answersInclude(database, person.name) : undefined,
  ].filter((condition): condition is SQL => condition !== undefined);
  return database
    .select({ submission: formSubmissionsTable, formName: formsTable.name })
    .from(formSubmissionsTable)
    .innerJoin(formsTable, eq(formsTable.id, formSubmissionsTable.formId))
    .where(and(eq(formSubmissionsTable.tenantId, tenantId), or(...conditions)))
    .orderBy(desc(formSubmissionsTable.createdAt));
}

export function listNotesOnSubmissions(
  database: DatabaseOrTransaction,
  submissionIds: readonly string[],
) {
  const formSubmissionNotesTable = tableFor(database, formSubmissionNotesDefinition);
  if (submissionIds.length === 0) return Promise.resolve([]);
  return database
    .select({
      submissionId: formSubmissionNotesTable.submissionId,
      body: formSubmissionNotesTable.body,
      createdAt: formSubmissionNotesTable.createdAt,
    })
    .from(formSubmissionNotesTable)
    .where(inArray(formSubmissionNotesTable.submissionId, [...submissionIds]));
}

// Shop ---------------------------------------------------------------------------------------

export function listMatchingCustomers(
  database: DatabaseOrTransaction,
  tenantId: string,
  person: PersonLookup,
) {
  const customersTable = tableFor(database, customersDefinition);
  return database
    .select()
    .from(customersTable)
    .where(
      and(
        eq(customersTable.tenantId, tenantId),
        matchesPerson(person, customersTable.email, customersTable.name),
      ),
    );
}

export async function deleteCustomers(
  database: DatabaseOrTransaction,
  ids: readonly string[],
): Promise<number> {
  const customersTable = tableFor(database, customersDefinition);
  if (ids.length === 0) return 0;
  const deleted = await deleteReturning(
    database,
    customersTable,
    inArray(customersTable.id, [...ids]),
    { id: customersTable.id },
  );
  return deleted.length;
}

/** Customers of these ids with no order left: once their orders lose them, they're all that's left. */
export async function deleteCustomersWithoutOrders(
  database: DatabaseOrTransaction,
  ids: ReadonlyArray<string | null>,
): Promise<void> {
  const archivedOrdersTable = tableFor(database, archivedOrdersDefinition);
  const customersTable = tableFor(database, customersDefinition);
  const ordersTable = tableFor(database, ordersDefinition);
  const customerIds = [...new Set(ids.filter((id) => id !== null))];
  if (customerIds.length === 0) return;
  await database
    .delete(customersTable)
    .where(
      and(
        inArray(customersTable.id, customerIds),
        sql`not exists (select 1 from ${ordersTable} where ${ordersTable.customerId} = ${customersTable.id})`,
        sql`not exists (select 1 from ${archivedOrdersTable} where ${archivedOrdersTable.customerId} = ${customersTable.id})`,
      ),
    );
}

/** Orders still holding the person's details; ones already anonymised don't match. */
export function listMatchingOrders(
  database: DatabaseOrTransaction,
  tenantId: string,
  person: PersonLookup,
) {
  const ordersTable = tableFor(database, ordersDefinition);
  return database
    .select()
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.tenantId, tenantId),
        matchesPerson(
          person,
          ordersTable.email,
          addressName(database, ordersTable.shippingAddress),
        ),
      ),
    )
    .orderBy(desc(ordersTable.createdAt));
}

export function listLinesOfOrders(database: DatabaseOrTransaction, orderIds: readonly string[]) {
  const orderLinesTable = tableFor(database, orderLinesDefinition);
  if (orderIds.length === 0) return Promise.resolve([]);
  return database
    .select({
      orderId: orderLinesTable.orderId,
      productTitle: orderLinesTable.productTitle,
      variantTitle: orderLinesTable.variantTitle,
      quantity: orderLinesTable.quantity,
    })
    .from(orderLinesTable)
    .where(inArray(orderLinesTable.orderId, [...orderIds]));
}

export function listMatchingArchivedOrders(
  database: DatabaseOrTransaction,
  tenantId: string,
  person: PersonLookup,
) {
  const archivedOrdersTable = tableFor(database, archivedOrdersDefinition);
  return database
    .select()
    .from(archivedOrdersTable)
    .where(
      and(
        eq(archivedOrdersTable.tenantId, tenantId),
        matchesPerson(
          person,
          archivedOrdersTable.email,
          addressName(database, archivedOrdersTable.shippingAddress),
        ),
      ),
    );
}

/**
 * Removes the person from orders, keeping the orders themselves: the email goes, the address
 * keeps only its country and region (what tax records need). The checkouts the orders came
 * from and the discount codes they used are cleared the same way.
 */
export async function anonymiseOrders(
  database: DatabaseOrTransaction,
  orders: ReadonlyArray<{
    id: string;
    checkoutId: string;
    email: string;
    shippingAddress: Address;
  }>,
): Promise<number> {
  const orderEventsTable = tableFor(database, orderEventsDefinition);
  const ordersTable = tableFor(database, ordersDefinition);
  for (const order of orders) {
    // The order's history says who it was placed by and sent to, in words.
    if (order.email) {
      await database
        .update(orderEventsTable)
        .set({ message: sql`replace(${orderEventsTable.message}, ${order.email}, 'the customer')` })
        .where(eq(orderEventsTable.orderId, order.id));
    }
    await database
      .update(ordersTable)
      .set({
        email: "",
        customerId: null,
        shippingAddress: anonymisedAddress(order.shippingAddress) ?? order.shippingAddress,
      })
      .where(eq(ordersTable.id, order.id));
    await anonymiseCheckout(database, order.checkoutId);
  }
  return orders.length;
}

export async function anonymiseCheckout(database: DatabaseOrTransaction, checkoutId: string) {
  const checkoutsTable = tableFor(database, checkoutsDefinition);
  const discountRedemptionsTable = tableFor(database, discountRedemptionsDefinition);
  const [checkout] = await database
    .select({ shippingAddress: checkoutsTable.shippingAddress })
    .from(checkoutsTable)
    .where(eq(checkoutsTable.id, checkoutId));
  if (checkout) {
    await database
      .update(checkoutsTable)
      .set({
        email: "",
        shippingAddress: anonymisedAddress(checkout.shippingAddress) ?? checkout.shippingAddress,
      })
      .where(eq(checkoutsTable.id, checkoutId));
  }
  await database
    .update(discountRedemptionsTable)
    .set({ email: "" })
    .where(eq(discountRedemptionsTable.checkoutId, checkoutId));
}

export async function anonymiseArchivedOrders(
  database: DatabaseOrTransaction,
  orders: ReadonlyArray<{ id: string; shippingAddress: Address | null }>,
): Promise<number> {
  const archivedOrdersTable = tableFor(database, archivedOrdersDefinition);
  for (const order of orders) {
    await database
      .update(archivedOrdersTable)
      .set({
        email: "",
        customerId: null,
        shippingAddress: anonymisedAddress(order.shippingAddress),
      })
      .where(eq(archivedOrdersTable.id, order.id));
  }
  return orders.length;
}

/** Baskets and checkouts that never became an order. */
export function listMatchingCarts(
  database: DatabaseOrTransaction,
  tenantId: string,
  person: PersonLookup,
) {
  const cartsTable = tableFor(database, cartsDefinition);
  return database
    .select()
    .from(cartsTable)
    .where(
      and(
        eq(cartsTable.tenantId, tenantId),
        matchesPerson(person, cartsTable.email, addressName(database, cartsTable.shippingAddress)),
      ),
    );
}

export function listMatchingUnfinishedCheckouts(
  database: DatabaseOrTransaction,
  tenantId: string,
  person: PersonLookup,
) {
  const checkoutsTable = tableFor(database, checkoutsDefinition);
  return database
    .select()
    .from(checkoutsTable)
    .where(
      and(
        eq(checkoutsTable.tenantId, tenantId),
        ne(checkoutsTable.status, "completed"),
        matchesPerson(
          person,
          checkoutsTable.email,
          addressName(database, checkoutsTable.shippingAddress),
        ),
      ),
    );
}

/**
 * Unfinished checkouts may still hold stock or a discount code until they expire, so they're
 * emptied of the person rather than deleted from under the shop.
 */
export async function anonymiseCheckouts(
  database: DatabaseOrTransaction,
  checkoutIds: readonly string[],
): Promise<number> {
  for (const id of checkoutIds) await anonymiseCheckout(database, id);
  return checkoutIds.length;
}

// Security log -------------------------------------------------------------------------------

/** Some events keep an email in their details (an invitation, a changed address). */
function detailsInclude(database: DatabaseOrTransaction, value: string): SQL {
  const securityEventsTable = tableFor(database, securityEventsDefinition);
  return jsonObjectHoldsText(database, securityEventsTable.details, value);
}

export function listMatchingSecurityEvents(
  database: DatabaseOrTransaction,
  tenantId: string,
  person: PersonLookup,
) {
  const securityEventsTable = tableFor(database, securityEventsDefinition);
  return database
    .select()
    .from(securityEventsTable)
    .where(
      and(
        eq(securityEventsTable.tenantId, tenantId),
        or(
          matchesPerson(person, securityEventsTable.actorEmail, securityEventsTable.subjectName),
          // Invitations name the person by their email.
          matchesPerson(person, securityEventsTable.subjectName, null),
          person.email ? detailsInclude(database, person.email) : undefined,
        ),
      ),
    )
    .orderBy(desc(securityEventsTable.createdAt));
}

/** Keeps what happened and when; removes the email, name, IP address, browser and details. */
export async function anonymiseSecurityEvents(
  database: DatabaseOrTransaction,
  ids: readonly string[],
): Promise<number> {
  const securityEventsTable = tableFor(database, securityEventsDefinition);
  if (ids.length === 0) return 0;
  const updated = await updateReturning(
    database,
    securityEventsTable,
    { actorEmail: null, subjectName: null, ipAddress: null, userAgent: null, details: {} },
    inArray(securityEventsTable.id, [...ids]),
    { id: securityEventsTable.id },
  );
  return updated.length;
}

// Webhook and automation history ----------------------------------------------------------

/**
 * A JSON value holds the email or name as a whole value, in any case. Webhook deliveries and
 * automation runs keep a copy of the event that started them, form answers included.
 */
function jsonIncludes(
  database: DatabaseOrTransaction,
  column: AnyPgColumn,
  person: PersonLookup,
): SQL {
  const conditions = [person.email, person.name]
    .filter((value): value is string => value !== null)
    .map((value) => JSON.stringify(value.trim().toLowerCase()))
    .map((quoted) => sql`position(${quoted} in lower(${jsonAsText(database, column)})) > 0`);
  return or(...conditions) ?? sql`false`;
}

export function listMatchingWebhookDeliveries(
  database: DatabaseOrTransaction,
  tenantId: string,
  person: PersonLookup,
) {
  const webhookDeliveriesTable = tableFor(database, webhookDeliveriesDefinition);
  return database
    .select()
    .from(webhookDeliveriesTable)
    .where(
      and(
        eq(webhookDeliveriesTable.tenantId, tenantId),
        jsonIncludes(database, webhookDeliveriesTable.payload, person),
      ),
    )
    .orderBy(desc(webhookDeliveriesTable.createdAt));
}

export function listMatchingWorkflowRuns(
  database: DatabaseOrTransaction,
  tenantId: string,
  person: PersonLookup,
) {
  const workflowRunsTable = tableFor(database, workflowRunsDefinition);
  return database
    .select()
    .from(workflowRunsTable)
    .where(
      and(
        eq(workflowRunsTable.tenantId, tenantId),
        jsonIncludes(database, workflowRunsTable.context, person),
      ),
    )
    .orderBy(desc(workflowRunsTable.createdAt));
}

export async function deleteWebhookDeliveries(
  database: DatabaseOrTransaction,
  ids: readonly string[],
): Promise<number> {
  const webhookDeliveriesTable = tableFor(database, webhookDeliveriesDefinition);
  if (ids.length === 0) return 0;
  const deleted = await deleteReturning(
    database,
    webhookDeliveriesTable,
    inArray(webhookDeliveriesTable.id, [...ids]),
    { id: webhookDeliveriesTable.id },
  );
  return deleted.length;
}

/** Only finished runs: a run still going needs what it holds. Its step logs go with it. */
export async function deleteFinishedWorkflowRuns(
  database: DatabaseOrTransaction,
  ids: readonly string[],
): Promise<number> {
  const workflowRunsTable = tableFor(database, workflowRunsDefinition);
  if (ids.length === 0) return 0;
  const deleted = await deleteReturning(
    database,
    workflowRunsTable,
    and(inArray(workflowRunsTable.id, [...ids]), isNotNull(workflowRunsTable.finishedAt)),
    { id: workflowRunsTable.id },
  );
  return deleted.length;
}

// Retention: whole rows by id ---------------------------------------------------------------

export function listOrdersByIds(database: DatabaseOrTransaction, ids: readonly string[]) {
  const ordersTable = tableFor(database, ordersDefinition);
  if (ids.length === 0) return Promise.resolve([]);
  return database
    .select()
    .from(ordersTable)
    .where(inArray(ordersTable.id, [...ids]));
}

export function listArchivedOrdersByIds(database: DatabaseOrTransaction, ids: readonly string[]) {
  const archivedOrdersTable = tableFor(database, archivedOrdersDefinition);
  if (ids.length === 0) return Promise.resolve([]);
  return database
    .select()
    .from(archivedOrdersTable)
    .where(inArray(archivedOrdersTable.id, [...ids]));
}

export async function deleteCarts(
  database: DatabaseOrTransaction,
  ids: readonly string[],
): Promise<number> {
  const cartsTable = tableFor(database, cartsDefinition);
  if (ids.length === 0) return 0;
  const deleted = await deleteReturning(database, cartsTable, inArray(cartsTable.id, [...ids]), {
    id: cartsTable.id,
  });
  return deleted.length;
}

export async function deleteSecurityEvents(
  database: DatabaseOrTransaction,
  ids: readonly string[],
): Promise<number> {
  const securityEventsTable = tableFor(database, securityEventsDefinition);
  if (ids.length === 0) return 0;
  const deleted = await deleteReturning(
    database,
    securityEventsTable,
    inArray(securityEventsTable.id, [...ids]),
    { id: securityEventsTable.id },
  );
  return deleted.length;
}
