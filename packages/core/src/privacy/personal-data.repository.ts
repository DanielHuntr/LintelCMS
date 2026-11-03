import { and, desc, eq, inArray, ne, or, type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { cartsTable } from "../commerce/carts/carts.table.js";
import { checkoutsTable } from "../commerce/checkouts/checkouts.table.js";
import type { Address } from "../commerce/customers/address.schema.js";
import { customersTable } from "../commerce/customers/customers.table.js";
import { discountRedemptionsTable } from "../commerce/discounts/discounts.table.js";
import { orderLinesTable, ordersTable } from "../commerce/orders/orders.table.js";
import { archivedOrdersTable } from "../commerce/shopify-import/shopify-import.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import {
  formSubmissionNotesTable,
  formSubmissionsTable,
  formsTable,
} from "../forms/forms.table.js";
import { invitationsTable } from "../invitations/invitations.table.js";
import { securityEventsTable } from "../security-log/security-events.table.js";
import { usersTable } from "../users/users.table.js";
import type { PersonLookup } from "./personal-data-declaration.js";

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

const addressName = (column: AnyPgColumn) => sql`${column} ->> 'name'`;

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

export async function deleteInvitations(
  database: DatabaseOrTransaction,
  ids: readonly string[],
): Promise<number> {
  if (ids.length === 0) return 0;
  const deleted = await database
    .delete(invitationsTable)
    .where(inArray(invitationsTable.id, [...ids]))
    .returning({ id: invitationsTable.id });
  return deleted.length;
}

// Form entries ------------------------------------------------------------------------------

/** A submission's answers include the name, as any whole answer. */
function answersInclude(name: string): SQL {
  return sql`exists (select 1 from jsonb_each_text(${formSubmissionsTable.values}) as answer where lower(trim(answer.value)) = ${name.trim().toLowerCase()})`;
}

export async function listMatchingSubmissions(
  database: DatabaseOrTransaction,
  tenantId: string,
  person: PersonLookup,
) {
  const conditions = [
    person.email ? eq(formSubmissionsTable.submitterEmail, person.email.toLowerCase()) : undefined,
    person.name ? answersInclude(person.name) : undefined,
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
  if (ids.length === 0) return 0;
  const deleted = await database
    .delete(customersTable)
    .where(inArray(customersTable.id, [...ids]))
    .returning({ id: customersTable.id });
  return deleted.length;
}

/** Orders still holding the person's details; ones already anonymised don't match. */
export function listMatchingOrders(
  database: DatabaseOrTransaction,
  tenantId: string,
  person: PersonLookup,
) {
  return database
    .select()
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.tenantId, tenantId),
        matchesPerson(person, ordersTable.email, addressName(ordersTable.shippingAddress)),
      ),
    )
    .orderBy(desc(ordersTable.createdAt));
}

export function listLinesOfOrders(database: DatabaseOrTransaction, orderIds: readonly string[]) {
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
  return database
    .select()
    .from(archivedOrdersTable)
    .where(
      and(
        eq(archivedOrdersTable.tenantId, tenantId),
        matchesPerson(
          person,
          archivedOrdersTable.email,
          addressName(archivedOrdersTable.shippingAddress),
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
  orders: ReadonlyArray<{ id: string; checkoutId: string; shippingAddress: Address }>,
): Promise<number> {
  for (const order of orders) {
    await database
      .update(ordersTable)
      .set({
        email: "",
        shippingAddress: anonymisedAddress(order.shippingAddress) ?? order.shippingAddress,
      })
      .where(eq(ordersTable.id, order.id));
    await anonymiseCheckout(database, order.checkoutId);
  }
  return orders.length;
}

export async function anonymiseCheckout(database: DatabaseOrTransaction, checkoutId: string) {
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
  for (const order of orders) {
    await database
      .update(archivedOrdersTable)
      .set({ email: "", shippingAddress: anonymisedAddress(order.shippingAddress) })
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
  return database
    .select()
    .from(cartsTable)
    .where(
      and(
        eq(cartsTable.tenantId, tenantId),
        matchesPerson(person, cartsTable.email, addressName(cartsTable.shippingAddress)),
      ),
    );
}

export function listMatchingUnfinishedCheckouts(
  database: DatabaseOrTransaction,
  tenantId: string,
  person: PersonLookup,
) {
  return database
    .select()
    .from(checkoutsTable)
    .where(
      and(
        eq(checkoutsTable.tenantId, tenantId),
        ne(checkoutsTable.status, "completed"),
        matchesPerson(person, checkoutsTable.email, addressName(checkoutsTable.shippingAddress)),
      ),
    );
}

export async function deleteCartsAndCheckouts(
  database: DatabaseOrTransaction,
  cartIds: readonly string[],
  checkouts: ReadonlyArray<{ id: string; shippingAddress: Address }>,
): Promise<number> {
  let deleted = 0;
  if (cartIds.length > 0) {
    const rows = await database
      .delete(cartsTable)
      .where(inArray(cartsTable.id, [...cartIds]))
      .returning({ id: cartsTable.id });
    deleted += rows.length;
  }
  // Unfinished checkouts may still hold stock or a discount code until they expire, so
  // they're emptied of the person rather than deleted from under the shop.
  for (const checkout of checkouts) {
    await anonymiseCheckout(database, checkout.id);
    deleted += 1;
  }
  return deleted;
}

// Security log -------------------------------------------------------------------------------

export function listMatchingSecurityEvents(
  database: DatabaseOrTransaction,
  tenantId: string,
  person: PersonLookup,
) {
  return database
    .select()
    .from(securityEventsTable)
    .where(
      and(
        eq(securityEventsTable.tenantId, tenantId),
        matchesPerson(person, securityEventsTable.actorEmail, securityEventsTable.subjectName),
      ),
    )
    .orderBy(desc(securityEventsTable.createdAt));
}

/** Keeps what happened and when; removes the email, name, IP address and browser. */
export async function anonymiseSecurityEvents(
  database: DatabaseOrTransaction,
  ids: readonly string[],
): Promise<number> {
  if (ids.length === 0) return 0;
  const updated = await database
    .update(securityEventsTable)
    .set({ actorEmail: null, subjectName: null, ipAddress: null, userAgent: null })
    .where(inArray(securityEventsTable.id, [...ids]))
    .returning({ id: securityEventsTable.id });
  return updated.length;
}

// Retention: whole rows by id ---------------------------------------------------------------

export function listOrdersByIds(database: DatabaseOrTransaction, ids: readonly string[]) {
  if (ids.length === 0) return Promise.resolve([]);
  return database
    .select()
    .from(ordersTable)
    .where(inArray(ordersTable.id, [...ids]));
}

export function listArchivedOrdersByIds(database: DatabaseOrTransaction, ids: readonly string[]) {
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
  if (ids.length === 0) return 0;
  const deleted = await database
    .delete(cartsTable)
    .where(inArray(cartsTable.id, [...ids]))
    .returning({ id: cartsTable.id });
  return deleted.length;
}

export async function deleteSecurityEvents(
  database: DatabaseOrTransaction,
  ids: readonly string[],
): Promise<number> {
  if (ids.length === 0) return 0;
  const deleted = await database
    .delete(securityEventsTable)
    .where(inArray(securityEventsTable.id, [...ids]))
    .returning({ id: securityEventsTable.id });
  return deleted.length;
}
