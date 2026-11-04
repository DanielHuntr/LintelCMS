import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { cartLinesTable, cartsTable } from "../commerce/carts/carts.table.js";
import { checkoutsTable, type NewCheckoutRow } from "../commerce/checkouts/checkouts.table.js";
import type { Address } from "../commerce/customers/address.schema.js";
import { customersTable } from "../commerce/customers/customers.table.js";
import { discountRedemptionsTable, discountsTable } from "../commerce/discounts/discounts.table.js";
import { marketsTable } from "../commerce/markets/markets.table.js";
import {
  type NewOrderRow,
  orderEventsTable,
  orderLinesTable,
  ordersTable,
} from "../commerce/orders/orders.table.js";
import { productsTable, variantsTable } from "../commerce/products/products.table.js";
import {
  archivedOrdersTable,
  type NewArchivedOrderRow,
} from "../commerce/shopify-import/shopify-import.table.js";
import type { Database } from "../database/client.js";
import { tableFor } from "../database/dialect/mysql-tables.js";
import { insertReturning } from "../database/dialect/writes.js";
import {
  formSubmissionNotesTable,
  formSubmissionsTable,
  formsTable,
} from "../forms/forms.table.js";
import { invitationsTable } from "../invitations/invitations.table.js";
import { rolesTable } from "../roles/roles.table.js";
import {
  type NewSecurityEvent,
  securityEventsTable,
} from "../security-log/security-events.table.js";
import { sessionsTable } from "../sessions/sessions.table.js";
import { addTestUser, describeOnEveryDatabase } from "../testing/every-database.js";
import { usersTable } from "../users/users.table.js";
import { webhookDeliveriesTable, webhooksTable } from "../webhooks/webhooks.table.js";
import {
  workflowRunsTable,
  workflowStepLogsTable,
  workflowsTable,
} from "../workflows/workflows.table.js";
import {
  anonymiseArchivedOrders,
  anonymiseCheckout,
  anonymiseCheckouts,
  anonymisedAddress,
  anonymiseOrders,
  anonymiseSecurityEvents,
  deleteCarts,
  deleteCustomers,
  deleteCustomersWithoutOrders,
  deleteFinishedWorkflowRuns,
  deleteInvitations,
  deleteSecurityEvents,
  deleteWebhookDeliveries,
  listArchivedOrdersByIds,
  listLinesOfOrders,
  listMatchingArchivedOrders,
  listMatchingCarts,
  listMatchingCustomers,
  listMatchingInvitations,
  listMatchingOrders,
  listMatchingSecurityEvents,
  listMatchingSubmissions,
  listMatchingUnfinishedCheckouts,
  listMatchingUsers,
  listMatchingWebhookDeliveries,
  listMatchingWorkflowRuns,
  listNotesOnSubmissions,
  listOrdersByIds,
  listSessionsOfUsers,
} from "./personal-data.repository.js";

const TENANT = "default";
const OTHER_TENANT = "other";
const EMAIL = "ada@example.com";
const NAME = "Ada Lovelace";
const byEmail = { email: EMAIL, name: null };
const byName = { email: null, name: NAME };
const nobody = { email: null, name: null };
const noon = new Date("2026-11-04T12:00:00.125Z");
const later = new Date("2026-11-04T13:00:00.125Z");

function addressOf(name: string): Address {
  return {
    name,
    company: "Analytical Engines",
    line1: "1 High Street",
    line2: "Flat 2",
    city: "Leeds",
    region: "West Yorkshire",
    postalCode: "LS1 1AA",
    country: "GB",
    phone: "0113 000 0000",
  };
}

const removedAddress = {
  name: "Removed",
  company: "",
  line1: "Removed",
  line2: "",
  city: "Removed",
  region: "West Yorkshire",
  postalCode: "",
  country: "GB",
  phone: "",
};

async function saved<Row>(rows: Row[]): Promise<Row> {
  const [row] = rows;
  if (!row) throw new Error("The test row was not saved.");
  return row;
}

async function addPerson(
  database: Database,
  values: { email: string; name: string; tenantId?: string },
) {
  return saved(await insertReturning(database, tableFor(database, usersTable), values));
}

async function addInvitation(database: Database, email: string, tenantId = TENANT) {
  const role = await saved(
    await insertReturning(database, tableFor(database, rolesTable), {
      tenantId,
      handle: `role-${randomUUID()}`,
      name: "Editor",
    }),
  );
  return saved(
    await insertReturning(database, tableFor(database, invitationsTable), {
      tenantId,
      email,
      roleId: role.id,
      tokenHash: randomUUID(),
      expiresAt: later,
    }),
  );
}

async function addForm(database: Database, name = "Contact") {
  return saved(
    await insertReturning(database, tableFor(database, formsTable), {
      handle: `form-${randomUUID()}`,
      name,
      fields: [],
      submitLabel: "Send",
      confirmation: {} as never,
      notifications: {} as never,
    }),
  );
}

async function addSubmission(
  database: Database,
  formId: string,
  values: Partial<typeof formSubmissionsTable.$inferInsert> = {},
) {
  return saved(
    await insertReturning(database, tableFor(database, formSubmissionsTable), {
      formId,
      values: {},
      ...values,
    }),
  );
}

async function addCustomer(database: Database, email = EMAIL, name = NAME, tenantId = TENANT) {
  return saved(
    await insertReturning(database, tableFor(database, customersTable), { email, name, tenantId }),
  );
}

let nextOrderNumber = 1000;

async function addOrder(database: Database, values: Partial<NewOrderRow> = {}) {
  nextOrderNumber += 1;
  return saved(
    await insertReturning(database, tableFor(database, ordersTable), {
      number: nextOrderNumber,
      name: `#${nextOrderNumber}`,
      checkoutId: randomUUID(),
      email: EMAIL,
      currency: "GBP",
      shippingAddress: addressOf(NAME),
      shippingLine: { rateId: "rate", name: "Post", amount: 0, taxAmount: 0 },
      subtotalAmount: 100,
      discountAmount: 0,
      shippingAmount: 0,
      taxAmount: 0,
      totalAmount: 100,
      taxesIncluded: true,
      paidAt: noon,
      ...values,
    }),
  );
}

async function addArchivedOrder(database: Database, values: Partial<NewArchivedOrderRow> = {}) {
  return saved(
    await insertReturning(database, tableFor(database, archivedOrdersTable), {
      name: `#${randomUUID()}`,
      email: EMAIL,
      currency: "GBP",
      shippingAddress: addressOf(NAME),
      placedAt: noon,
      ...values,
    }),
  );
}

async function addCheckout(database: Database, values: Partial<NewCheckoutRow> = {}) {
  return saved(
    await insertReturning(database, tableFor(database, checkoutsTable), {
      marketId: randomUUID(),
      email: EMAIL,
      shippingAddress: addressOf(NAME),
      currency: "GBP",
      lines: [],
      shippingLine: { rateId: "rate", name: "Post", amount: 0, taxAmount: 0 },
      subtotalAmount: 100,
      discountAmount: 0,
      shippingAmount: 0,
      taxAmount: 0,
      totalAmount: 100,
      taxesIncluded: true,
      taxCalculation: "manual",
      expiresAt: later,
      ...values,
    }),
  );
}

async function addMarket(database: Database) {
  return saved(
    await insertReturning(database, tableFor(database, marketsTable), {
      name: "UK",
      handle: `market-${randomUUID()}`,
      currency: "GBP",
    }),
  );
}

async function addCart(database: Database, values: Partial<typeof cartsTable.$inferInsert> = {}) {
  const market = await addMarket(database);
  return saved(
    await insertReturning(database, tableFor(database, cartsTable), {
      tokenHash: randomUUID(),
      marketId: market.id,
      ...values,
    }),
  );
}

async function addEvent(database: Database, values: Partial<NewSecurityEvent> = {}) {
  return saved(
    await insertReturning(database, tableFor(database, securityEventsTable), {
      kind: "sign-in",
      ...values,
    }),
  );
}

async function addWebhook(database: Database) {
  return saved(
    await insertReturning(database, tableFor(database, webhooksTable), {
      name: "Rebuild",
      url: "https://example.com/hook",
      events: [],
      secret: "secret",
    }),
  );
}

async function addDelivery(
  database: Database,
  webhookId: string,
  payload: Record<string, unknown>,
  values: Partial<typeof webhookDeliveriesTable.$inferInsert> = {},
) {
  return saved(
    await insertReturning(database, tableFor(database, webhookDeliveriesTable), {
      webhookId,
      event: "entry.published" as never,
      payload,
      ...values,
    }),
  );
}

async function addWorkflow(database: Database) {
  return saved(
    await insertReturning(database, tableFor(database, workflowsTable), {
      name: "Follow up",
      trigger: {} as never,
      steps: [],
      secret: "secret",
    }),
  );
}

async function addRun(
  database: Database,
  workflowId: string,
  context: Record<string, unknown>,
  values: Partial<typeof workflowRunsTable.$inferInsert> = {},
) {
  return saved(
    await insertReturning(database, tableFor(database, workflowRunsTable), {
      workflowId,
      workflowName: "Follow up",
      definition: { trigger: {}, steps: [] } as never,
      context,
      ...values,
    }),
  );
}

describeOnEveryDatabase("Personal data", (handle) => {
  it("takes everything identifying out of an address but the region and country", () => {
    expect(anonymisedAddress(null)).toBeNull();
    expect(anonymisedAddress(addressOf(NAME))).toEqual(removedAddress);
  });

  describe("people who sign in", () => {
    it("finds a person by email or whole name, ignoring case and spaces", async () => {
      const { database } = handle;
      const ada = await addPerson(database, { email: "ADA@Example.com", name: " ada lovelace " });
      const namesake = await addPerson(database, { email: "other@example.com", name: NAME });
      await addPerson(database, { email: "ada.l@example.com", name: "Ada" });
      await addPerson(database, { email: EMAIL, name: NAME, tenantId: OTHER_TENANT });

      expect(
        await listMatchingUsers(database, TENANT, { email: " Ada@EXAMPLE.com ", name: null }),
      ).toEqual([
        { id: ada.id, name: " ada lovelace ", email: "ADA@Example.com", createdAt: ada.createdAt },
      ]);
      const named = await listMatchingUsers(database, TENANT, byName);
      expect(named.map((row) => row.id).sort()).toEqual([ada.id, namesake.id].sort());
      const either = await listMatchingUsers(database, TENANT, {
        email: "other@example.com",
        name: "ADA",
      });
      expect(either).toHaveLength(2);
      expect(await listMatchingUsers(database, TENANT, { email: null, name: "Lovelace" })).toEqual(
        [],
      );
      expect(await listMatchingUsers(database, TENANT, nobody)).toEqual([]);
    });

    it("finds invitations by email only", async () => {
      const { database } = handle;
      const invitation = await addInvitation(database, "Ada@Example.com");
      await addInvitation(database, "grace@example.com");
      await addInvitation(database, EMAIL, OTHER_TENANT);

      expect(await listMatchingInvitations(database, TENANT, byEmail)).toEqual([
        { id: invitation.id, email: "Ada@Example.com", createdAt: invitation.createdAt },
      ]);
      const asName = { email: null, name: "Ada@Example.com" };
      expect(await listMatchingInvitations(database, TENANT, asName)).toEqual([]);
    });

    it("lists the sessions of the people asked about", async () => {
      const { database } = handle;
      const ada = await addTestUser(database);
      const grace = await addTestUser(database, "grace@example.com");
      const sessions = tableFor(database, sessionsTable);
      await database.insert(sessions).values([
        {
          userId: ada.id,
          tokenHash: "a",
          expiresAt: later,
          lastUsedAt: noon,
          userAgent: "Firefox",
        },
        { userId: ada.id, tokenHash: "b", expiresAt: later, lastUsedAt: later },
        { userId: grace.id, tokenHash: "c", expiresAt: later, userAgent: "Safari" },
      ]);

      const found = await listSessionsOfUsers(database, [ada.id]);
      expect(found).toHaveLength(2);
      expect(found).toEqual(
        expect.arrayContaining([
          { userAgent: "Firefox", lastUsedAt: noon },
          { userAgent: null, lastUsedAt: later },
        ]),
      );
      expect(await listSessionsOfUsers(database, [])).toEqual([]);
    });

    it("deletes invitations and counts the ones that were there", async () => {
      const { database } = handle;
      const gone = await addInvitation(database, EMAIL);
      const kept = await addInvitation(database, "grace@example.com");

      expect(await deleteInvitations(database, [])).toBe(0);
      expect(await deleteInvitations(database, [gone.id, randomUUID()])).toBe(1);
      expect(await deleteInvitations(database, [gone.id])).toBe(0);
      const invitations = tableFor(database, invitationsTable);
      const left = await database.select({ id: invitations.id }).from(invitations);
      expect(left).toEqual([{ id: kept.id }]);
    });
  });

  describe("form entries", () => {
    it("finds entries by the kept email or any whole answer, newest first", async () => {
      const { database } = handle;
      const form = await addForm(database, "Say hello");
      const kept = await addSubmission(database, form.id, {
        submitterEmail: EMAIL,
        values: { topics: ["a", "b"] },
        createdAt: noon,
      });
      const friend = await addSubmission(database, form.id, {
        submitterEmail: "grace@example.com",
        values: { friend: " ADA@example.com " },
        createdAt: later,
      });
      await addSubmission(database, form.id, { values: { message: `Ask ${EMAIL} first` } });
      await addSubmission(database, form.id, { submitterEmail: "grace@example.com" });
      await addSubmission(database, form.id, { tenantId: OTHER_TENANT, submitterEmail: EMAIL });

      const found = await listMatchingSubmissions(database, TENANT, {
        email: "Ada@Example.com",
        name: null,
      });
      expect(found.map((row) => row.submission.id)).toEqual([friend.id, kept.id]);
      expect(found[1]).toMatchObject({
        formName: "Say hello",
        submission: { values: { topics: ["a", "b"] }, isRead: false, createdAt: noon },
      });
    });

    it("finds a name among answers of every kind, and only as a whole answer", async () => {
      const { database } = handle;
      const form = await addForm(database);
      const named = await addSubmission(database, form.id, {
        values: {
          name: " ada LOVELACE ",
          age: 36,
          agreed: true,
          empty: null,
          topics: ["a"],
          nested: { deep: "value" },
        } as never,
      });
      await addSubmission(database, form.id, { values: { message: `Dear ${NAME},` } });
      await addSubmission(database, form.id, { values: { topics: [NAME] } });
      const counted = await addSubmission(database, form.id, { values: { age: 36 } });
      const ticked = await addSubmission(database, form.id, {
        values: { agreed: false },
      });

      const found = await listMatchingSubmissions(database, TENANT, byName);
      expect(found.map((row) => row.submission.id)).toEqual([named.id]);
      const asNumber = await listMatchingSubmissions(database, TENANT, { email: null, name: "36" });
      expect(asNumber.map((row) => row.submission.id).sort()).toEqual(
        [named.id, counted.id].sort(),
      );
      const asBoolean = await listMatchingSubmissions(database, TENANT, {
        email: null,
        name: "false",
      });
      expect(asBoolean.map((row) => row.submission.id)).toEqual([ticked.id]);
    });

    it("lists the notes on submissions", async () => {
      const { database } = handle;
      const form = await addForm(database);
      const submission = await addSubmission(database, form.id);
      const other = await addSubmission(database, form.id);
      const notes = tableFor(database, formSubmissionNotesTable);
      await database.insert(notes).values([
        { submissionId: submission.id, body: "Called back", createdAt: noon },
        { submissionId: other.id, body: "Elsewhere" },
      ]);

      expect(await listNotesOnSubmissions(database, [submission.id])).toEqual([
        { submissionId: submission.id, body: "Called back", createdAt: noon },
      ]);
      expect(await listNotesOnSubmissions(database, [])).toEqual([]);
    });
  });

  describe("shop", () => {
    it("finds customers by email or name, in one tenant", async () => {
      const { database } = handle;
      const customer = await addCustomer(database, "ADA@example.com", "ada lovelace");
      await addCustomer(database, "grace@example.com", "Grace");
      await addCustomer(database, EMAIL, NAME, OTHER_TENANT);

      const found = await listMatchingCustomers(database, TENANT, byEmail);
      expect(found.map((row) => row.id)).toEqual([customer.id]);
      expect(found[0]).toMatchObject({ addresses: [], phone: "" });
      const named = await listMatchingCustomers(database, TENANT, byName);
      expect(named.map((row) => row.id)).toEqual([customer.id]);
      expect(await listMatchingCustomers(database, TENANT, nobody)).toEqual([]);
    });

    it("deletes customers, leaving their orders without one", async () => {
      const { database } = handle;
      const gone = await addCustomer(database);
      const kept = await addCustomer(database, "grace@example.com", "Grace");
      const order = await addOrder(database, { customerId: gone.id });
      const archived = await addArchivedOrder(database, { customerId: gone.id });

      expect(await deleteCustomers(database, [])).toBe(0);
      expect(await deleteCustomers(database, [gone.id, randomUUID()])).toBe(1);

      const customers = tableFor(database, customersTable);
      expect(await database.select({ id: customers.id }).from(customers)).toEqual([
        { id: kept.id },
      ]);
      const [orderLeft] = await listOrdersByIds(database, [order.id]);
      expect(orderLeft?.customerId).toBeNull();
      const [archivedLeft] = await listArchivedOrdersByIds(database, [archived.id]);
      expect(archivedLeft?.customerId).toBeNull();
    });

    it("deletes only the customers no order or archived order holds", async () => {
      const { database } = handle;
      const free = await addCustomer(database);
      const ordered = await addCustomer(database, "b@example.com", "B");
      const archived = await addCustomer(database, "c@example.com", "C");
      const notAsked = await addCustomer(database, "d@example.com", "D");
      await addOrder(database, { customerId: ordered.id });
      await addArchivedOrder(database, { customerId: archived.id });

      await deleteCustomersWithoutOrders(database, []);
      await deleteCustomersWithoutOrders(database, [null]);
      const customers = tableFor(database, customersTable);
      expect(await database.select().from(customers)).toHaveLength(4);

      await deleteCustomersWithoutOrders(database, [
        free.id,
        free.id,
        null,
        ordered.id,
        archived.id,
      ]);
      const left = await database.select({ id: customers.id }).from(customers);
      expect(left.map((row) => row.id).sort()).toEqual(
        [ordered.id, archived.id, notAsked.id].sort(),
      );
    });

    it("finds orders by email or delivery name, newest first", async () => {
      const { database } = handle;
      const older = await addOrder(database, { createdAt: noon });
      const newer = await addOrder(database, {
        email: "someone@example.com",
        shippingAddress: addressOf(" ADA lovelace"),
        createdAt: later,
      });
      await addOrder(database, {
        email: "grace@example.com",
        shippingAddress: addressOf("Grace"),
      });
      await addOrder(database, { tenantId: OTHER_TENANT });

      const named = await listMatchingOrders(database, TENANT, byName);
      expect(named.map((row) => row.id)).toEqual([newer.id, older.id]);
      expect(named[1]).toMatchObject({
        shippingAddress: addressOf(NAME),
        discounts: [],
        isTest: false,
        paidAt: noon,
      });
      const found = await listMatchingOrders(database, TENANT, byEmail);
      expect(found.map((row) => row.id)).toEqual([older.id]);
      expect(await listMatchingOrders(database, TENANT, nobody)).toEqual([]);
    });

    it("lists what was bought on orders", async () => {
      const { database } = handle;
      const order = await addOrder(database);
      const other = await addOrder(database);
      const line = {
        productTitle: "Mug",
        variantTitle: "Blue",
        quantity: 2,
        unitAmount: 50,
        subtotalAmount: 100,
        discountAmount: 0,
        taxAmount: 0,
      };
      await database.insert(tableFor(database, orderLinesTable)).values([
        { ...line, orderId: order.id },
        { ...line, orderId: other.id, productTitle: "Plate" },
      ]);

      expect(await listLinesOfOrders(database, [order.id])).toEqual([
        { orderId: order.id, productTitle: "Mug", variantTitle: "Blue", quantity: 2 },
      ]);
      expect(await listLinesOfOrders(database, [])).toEqual([]);
    });

    it("finds archived orders, including ones with no address", async () => {
      const { database } = handle;
      const withAddress = await addArchivedOrder(database, { email: "x@example.com" });
      const withoutAddress = await addArchivedOrder(database, { shippingAddress: null });
      await addArchivedOrder(database, {
        email: "grace@example.com",
        shippingAddress: addressOf("Grace"),
      });
      await addArchivedOrder(database, { tenantId: OTHER_TENANT });

      const found = await listMatchingArchivedOrders(database, TENANT, byEmail);
      expect(found.map((row) => row.id)).toEqual([withoutAddress.id]);
      expect(found[0]).toMatchObject({ shippingAddress: null, placedAt: noon, lines: [] });
      const named = await listMatchingArchivedOrders(database, TENANT, byName);
      expect(named.map((row) => row.id)).toEqual([withAddress.id]);
    });

    it("takes the person out of orders, their history, checkouts and discount use", async () => {
      const { database } = handle;
      const customer = await addCustomer(database);
      const checkout = await addCheckout(database);
      const order = await addOrder(database, {
        checkoutId: checkout.id,
        customerId: customer.id,
      });
      const untouchedCheckout = await addCheckout(database, { email: "grace@example.com" });
      const untouched = await addOrder(database, {
        checkoutId: untouchedCheckout.id,
        email: "grace@example.com",
      });
      const events = tableFor(database, orderEventsTable);
      await database.insert(events).values([
        { orderId: order.id, kind: "placed", message: `Placed by ${EMAIL}, sent to ${EMAIL}` },
        { orderId: order.id, kind: "note", message: "Paid" },
        { orderId: untouched.id, kind: "placed", message: `Placed by ${EMAIL}` },
      ]);
      const discount = await saved(
        await insertReturning(database, tableFor(database, discountsTable), {
          title: "Ten off",
          method: "code",
          code: "TEN",
          kind: "percentage",
        } as never),
      );
      const redemptions = tableFor(database, discountRedemptionsTable);
      await database.insert(redemptions).values([
        { discountId: discount.id, checkoutId: checkout.id, email: EMAIL },
        { discountId: discount.id, checkoutId: untouchedCheckout.id, email: "grace@example.com" },
      ]);

      expect(await anonymiseOrders(database, [order])).toBe(1);

      const [changed] = await listOrdersByIds(database, [order.id]);
      expect(changed).toMatchObject({
        email: "",
        customerId: null,
        shippingAddress: removedAddress,
        totalAmount: 100,
      });
      const [kept] = await listOrdersByIds(database, [untouched.id]);
      expect(kept).toMatchObject({ email: "grace@example.com", shippingAddress: addressOf(NAME) });

      const messages = await database
        .select({ message: events.message })
        .from(events)
        .where(eq(events.orderId, order.id));
      expect(messages.map((row) => row.message).sort()).toEqual([
        "Paid",
        "Placed by the customer, sent to the customer",
      ]);
      const otherMessages = await database
        .select({ message: events.message })
        .from(events)
        .where(eq(events.orderId, untouched.id));
      expect(otherMessages).toEqual([{ message: `Placed by ${EMAIL}` }]);

      const checkouts = tableFor(database, checkoutsTable);
      const [checkoutLeft] = await database
        .select()
        .from(checkouts)
        .where(eq(checkouts.id, checkout.id));
      expect(checkoutLeft).toMatchObject({ email: "", shippingAddress: removedAddress });
      const [otherCheckout] = await database
        .select()
        .from(checkouts)
        .where(eq(checkouts.id, untouchedCheckout.id));
      expect(otherCheckout?.email).toBe("grace@example.com");

      const emails = await database.select({ email: redemptions.email }).from(redemptions);
      expect(emails.map((row) => row.email).sort()).toEqual(["", "grace@example.com"]);

      expect(await listMatchingOrders(database, TENANT, byEmail)).toEqual([]);
      const named = await listMatchingOrders(database, TENANT, byName);
      expect(named.map((row) => row.id)).toEqual([untouched.id]);
    });

    it("anonymises an order that has no email, and no orders at all", async () => {
      const { database } = handle;
      const order = await addOrder(database, { email: "" });
      const events = tableFor(database, orderEventsTable);
      await database.insert(events).values({ orderId: order.id, kind: "note", message: "Paid" });

      expect(await anonymiseOrders(database, [])).toBe(0);
      expect(await anonymiseOrders(database, [order])).toBe(1);

      const [changed] = await listOrdersByIds(database, [order.id]);
      expect(changed?.shippingAddress).toEqual(removedAddress);
      expect(await database.select({ message: events.message }).from(events)).toEqual([
        { message: "Paid" },
      ]);
    });

    it("clears a discount's use even when its checkout has gone", async () => {
      const { database } = handle;
      const discount = await saved(
        await insertReturning(database, tableFor(database, discountsTable), {
          title: "Ten off",
          method: "code",
          code: "TEN",
          kind: "percentage",
        } as never),
      );
      const checkoutId = randomUUID();
      const redemptions = tableFor(database, discountRedemptionsTable);
      await database
        .insert(redemptions)
        .values({ discountId: discount.id, checkoutId, email: EMAIL });

      await anonymiseCheckout(database, checkoutId);

      expect(await database.select({ email: redemptions.email }).from(redemptions)).toEqual([
        { email: "" },
      ]);
    });

    it("anonymises archived orders, an empty address staying empty", async () => {
      const { database } = handle;
      const customer = await addCustomer(database);
      const withAddress = await addArchivedOrder(database, { customerId: customer.id });
      const withoutAddress = await addArchivedOrder(database, { shippingAddress: null });
      const untouched = await addArchivedOrder(database, { email: "grace@example.com" });

      expect(await anonymiseArchivedOrders(database, [])).toBe(0);
      expect(await anonymiseArchivedOrders(database, [withAddress, withoutAddress])).toBe(2);

      const rows = await listArchivedOrdersByIds(database, [withAddress.id, withoutAddress.id]);
      expect(rows.find((row) => row.id === withAddress.id)).toMatchObject({
        email: "",
        customerId: null,
        shippingAddress: removedAddress,
      });
      expect(rows.find((row) => row.id === withoutAddress.id)).toMatchObject({
        email: "",
        shippingAddress: null,
      });
      const [kept] = await listArchivedOrdersByIds(database, [untouched.id]);
      expect(kept?.email).toBe("grace@example.com");
      expect(await listMatchingArchivedOrders(database, TENANT, byName)).toHaveLength(1);
    });

    it("finds baskets by email or delivery name, empty ones included", async () => {
      const { database } = handle;
      const byAddress = await addCart(database, { shippingAddress: addressOf(NAME) });
      const emailed = await addCart(database, { email: "ADA@example.com" });
      await addCart(database);
      await addCart(database, { email: "grace@example.com", shippingAddress: addressOf("Grace") });
      await addCart(database, { tenantId: OTHER_TENANT, email: EMAIL });

      const found = await listMatchingCarts(database, TENANT, byEmail);
      expect(found.map((row) => row.id)).toEqual([emailed.id]);
      expect(found[0]).toMatchObject({ shippingAddress: null, discountCodes: [], country: null });
      const named = await listMatchingCarts(database, TENANT, byName);
      expect(named.map((row) => row.id)).toEqual([byAddress.id]);
      expect(named[0]?.shippingAddress).toEqual(addressOf(NAME));
    });

    it("finds checkouts that never became an order", async () => {
      const { database } = handle;
      const open = await addCheckout(database);
      const expired = await addCheckout(database, {
        status: "expired",
        email: "x@example.com",
        shippingAddress: addressOf("ADA LOVELACE"),
      });
      await addCheckout(database, { status: "completed" });
      await addCheckout(database, { email: "grace@example.com", shippingAddress: addressOf("G") });
      await addCheckout(database, { tenantId: OTHER_TENANT });

      const found = await listMatchingUnfinishedCheckouts(database, TENANT, byEmail);
      expect(found.map((row) => row.id)).toEqual([open.id]);
      expect(found[0]).toMatchObject({ status: "open", taxesIncluded: true, discounts: [] });
      const named = await listMatchingUnfinishedCheckouts(database, TENANT, byName);
      expect(named.map((row) => row.id).sort()).toEqual([open.id, expired.id].sort());
    });

    it("empties checkouts of the person, keeping them and counting what it was given", async () => {
      const { database } = handle;
      const first = await addCheckout(database);
      const second = await addCheckout(database);
      const kept = await addCheckout(database);

      expect(await anonymiseCheckouts(database, [])).toBe(0);
      expect(await anonymiseCheckouts(database, [first.id, second.id, randomUUID()])).toBe(3);

      const checkouts = tableFor(database, checkoutsTable);
      const rows = await database.select().from(checkouts);
      expect(rows).toHaveLength(3);
      expect(rows.find((row) => row.id === first.id)).toMatchObject({
        email: "",
        shippingAddress: removedAddress,
        status: "open",
        totalAmount: 100,
      });
      expect(rows.find((row) => row.id === second.id)?.email).toBe("");
      expect(rows.find((row) => row.id === kept.id)?.email).toBe(EMAIL);
    });

    it("reads whole orders by id", async () => {
      const { database } = handle;
      const order = await addOrder(database);
      await addOrder(database);
      const archived = await addArchivedOrder(database);
      await addArchivedOrder(database);

      expect(await listOrdersByIds(database, [order.id, randomUUID()])).toEqual([order]);
      expect(await listOrdersByIds(database, [])).toEqual([]);
      expect(await listArchivedOrdersByIds(database, [archived.id, randomUUID()])).toEqual([
        archived,
      ]);
      expect(await listArchivedOrdersByIds(database, [])).toEqual([]);
    });

    it("deletes baskets with their lines", async () => {
      const { database } = handle;
      const gone = await addCart(database);
      const kept = await addCart(database);
      const product = await saved(
        await insertReturning(database, tableFor(database, productsTable), {
          title: "Mug",
          handle: "mug",
        }),
      );
      const variant = await saved(
        await insertReturning(database, tableFor(database, variantsTable), {
          productId: product.id,
          title: "Blue",
        }),
      );
      const lines = tableFor(database, cartLinesTable);
      await database.insert(lines).values([
        { cartId: gone.id, variantId: variant.id, quantity: 1 },
        { cartId: kept.id, variantId: variant.id, quantity: 2 },
      ]);

      expect(await deleteCarts(database, [])).toBe(0);
      expect(await deleteCarts(database, [gone.id, randomUUID()])).toBe(1);

      const carts = tableFor(database, cartsTable);
      expect(await database.select({ id: carts.id }).from(carts)).toEqual([{ id: kept.id }]);
      expect(await database.select({ quantity: lines.quantity }).from(lines)).toEqual([
        { quantity: 2 },
      ]);
    });
  });

  describe("security log", () => {
    it("finds events by who did it, who it was about and their details, newest first", async () => {
      const { database } = handle;
      const actor = await addEvent(database, { actorEmail: "ADA@example.com", createdAt: noon });
      const invited = await addEvent(database, {
        kind: "user-invited",
        subjectName: EMAIL,
        createdAt: new Date(noon.getTime() + 1),
      });
      const details = await addEvent(database, {
        kind: "email-changed",
        details: { from: "Ada@Example.com", attempts: 2, confirmed: true, reason: null },
        createdAt: later,
      });
      await addEvent(database, { details: { note: `was ${EMAIL}` } });
      await addEvent(database, { actorEmail: "grace@example.com" });
      await addEvent(database, { tenantId: OTHER_TENANT, actorEmail: EMAIL });

      const found = await listMatchingSecurityEvents(database, TENANT, byEmail);
      expect(found.map((row) => row.id)).toEqual([details.id, invited.id, actor.id]);
      expect(found[0]).toMatchObject({
        kind: "email-changed",
        details: { from: "Ada@Example.com", attempts: 2, confirmed: true, reason: null },
        createdAt: later,
      });
    });

    it("finds events by the name they're about, not by a name in their details", async () => {
      const { database } = handle;
      const named = await addEvent(database, { subjectName: "ada LOVELACE" });
      await addEvent(database, { details: { name: NAME } });

      const found = await listMatchingSecurityEvents(database, TENANT, byName);
      expect(found.map((row) => row.id)).toEqual([named.id]);
      expect(await listMatchingSecurityEvents(database, TENANT, nobody)).toEqual([]);
    });

    it("keeps what happened and when, and nothing about who", async () => {
      const { database } = handle;
      const user = await addTestUser(database);
      const gone = await addEvent(database, {
        actorId: user.id,
        actorEmail: EMAIL,
        subjectName: NAME,
        ipAddress: "127.0.0.1",
        userAgent: "Firefox",
        details: { from: EMAIL },
        createdAt: noon,
      });
      const kept = await addEvent(database, { actorEmail: "grace@example.com" });

      expect(await anonymiseSecurityEvents(database, [])).toBe(0);
      expect(await anonymiseSecurityEvents(database, [gone.id, randomUUID()])).toBe(1);

      const events = tableFor(database, securityEventsTable);
      const [changed] = await database.select().from(events).where(eq(events.id, gone.id));
      expect(changed).toMatchObject({
        kind: "sign-in",
        actorId: user.id,
        actorEmail: null,
        subjectName: null,
        ipAddress: null,
        userAgent: null,
        details: {},
        createdAt: noon,
      });
      const [other] = await database.select().from(events).where(eq(events.id, kept.id));
      expect(other?.actorEmail).toBe("grace@example.com");
      expect(await listMatchingSecurityEvents(database, TENANT, byEmail)).toEqual([]);
    });

    it("deletes events", async () => {
      const { database } = handle;
      const gone = await addEvent(database);
      const kept = await addEvent(database);

      expect(await deleteSecurityEvents(database, [])).toBe(0);
      expect(await deleteSecurityEvents(database, [gone.id, randomUUID()])).toBe(1);

      const events = tableFor(database, securityEventsTable);
      expect(await database.select({ id: events.id }).from(events)).toEqual([{ id: kept.id }]);
    });
  });

  describe("webhook and automation history", () => {
    it("finds deliveries holding the email or name as a whole value, newest first", async () => {
      const { database } = handle;
      const webhook = await addWebhook(database);
      const older = await addDelivery(
        database,
        webhook.id,
        { data: { answers: { email: "ADA@Example.com" } } },
        { createdAt: noon },
      );
      const newer = await addDelivery(
        database,
        webhook.id,
        { people: [{ name: NAME }], email: EMAIL },
        { createdAt: later },
      );
      await addDelivery(database, webhook.id, { note: `Ask ${EMAIL} first` });
      await addDelivery(database, webhook.id, { email: "grace@example.com" });
      await addDelivery(database, webhook.id, { email: EMAIL }, { tenantId: OTHER_TENANT });

      const found = await listMatchingWebhookDeliveries(database, TENANT, byEmail);
      expect(found.map((row) => row.id)).toEqual([newer.id, older.id]);
      expect(found[0]).toMatchObject({
        payload: { people: [{ name: NAME }], email: EMAIL },
        status: "pending",
        attemptCount: 0,
        nextAttemptAt: null,
        createdAt: later,
      });
      const named = await listMatchingWebhookDeliveries(database, TENANT, byName);
      expect(named.map((row) => row.id)).toEqual([newer.id]);
      expect(await listMatchingWebhookDeliveries(database, TENANT, nobody)).toEqual([]);
    });

    it("finds a name with a quote in it inside JSON", async () => {
      const { database } = handle;
      const webhook = await addWebhook(database);
      const quoted = 'Ada "Countess" Lovelace';
      const delivery = await addDelivery(database, webhook.id, { name: quoted });
      await addDelivery(database, webhook.id, { name: NAME });

      const found = await listMatchingWebhookDeliveries(database, TENANT, {
        email: null,
        name: quoted,
      });
      expect(found.map((row) => row.id)).toEqual([delivery.id]);
    });

    it("finds automation runs the same way", async () => {
      const { database } = handle;
      const workflow = await addWorkflow(database);
      const older = await addRun(
        database,
        workflow.id,
        { event: { email: "ADA@example.com" } },
        { createdAt: noon },
      );
      const newer = await addRun(
        database,
        workflow.id,
        { event: { answers: { name: "ada lovelace" } } },
        { createdAt: later },
      );
      await addRun(database, workflow.id, { event: { message: `Dear ${NAME},` } });
      await addRun(database, workflow.id, { event: { email: EMAIL } }, { tenantId: OTHER_TENANT });

      const found = await listMatchingWorkflowRuns(database, TENANT, { email: EMAIL, name: NAME });
      expect(found.map((row) => row.id)).toEqual([newer.id, older.id]);
      expect(found[1]).toMatchObject({
        context: { event: { email: "ADA@example.com" } },
        stepStates: {},
        finishedAt: null,
        isTest: false,
      });
      expect(await listMatchingWorkflowRuns(database, TENANT, nobody)).toEqual([]);
    });

    it("deletes deliveries", async () => {
      const { database } = handle;
      const webhook = await addWebhook(database);
      const gone = await addDelivery(database, webhook.id, {});
      const kept = await addDelivery(database, webhook.id, {});

      expect(await deleteWebhookDeliveries(database, [])).toBe(0);
      expect(await deleteWebhookDeliveries(database, [gone.id, randomUUID()])).toBe(1);

      const deliveries = tableFor(database, webhookDeliveriesTable);
      expect(await database.select({ id: deliveries.id }).from(deliveries)).toEqual([
        { id: kept.id },
      ]);
    });

    it("deletes only finished runs, with their step logs", async () => {
      const { database } = handle;
      const workflow = await addWorkflow(database);
      const finished = await addRun(database, workflow.id, {}, { finishedAt: noon });
      const going = await addRun(database, workflow.id, {});
      const logs = tableFor(database, workflowStepLogsTable);
      const log = { stepId: "a", stepType: "email", status: "succeeded", summary: "Sent" } as const;
      await database.insert(logs).values([
        { ...log, runId: finished.id },
        { ...log, runId: going.id },
      ]);

      expect(await deleteFinishedWorkflowRuns(database, [])).toBe(0);
      expect(await deleteFinishedWorkflowRuns(database, [finished.id, going.id])).toBe(1);

      const runs = tableFor(database, workflowRunsTable);
      expect(await database.select({ id: runs.id }).from(runs)).toEqual([{ id: going.id }]);
      expect(await database.select({ runId: logs.runId }).from(logs)).toEqual([
        { runId: going.id },
      ]);
    });
  });

  // Uppercase and lowercase outside plain English letters, as a name or email can have.
  it("finds a name with accented capitals whatever its case", async () => {
    const { database } = handle;
    const person = await addPerson(database, { email: "zoe@example.com", name: "ZOË MÜLLER" });
    const form = await addForm(database);
    const submission = await addSubmission(database, form.id, {
      values: { name: "ZOË MÜLLER" },
    });
    const webhook = await addWebhook(database);
    const delivery = await addDelivery(database, webhook.id, { name: "ZOË MÜLLER" });
    const lookup = { email: null, name: "zoë müller" };

    const users = await listMatchingUsers(database, TENANT, lookup);
    expect(users.map((row) => row.id)).toEqual([person.id]);
    const submissions = await listMatchingSubmissions(database, TENANT, lookup);
    expect(submissions.map((row) => row.submission.id)).toEqual([submission.id]);
    const deliveries = await listMatchingWebhookDeliveries(database, TENANT, lookup);
    expect(deliveries.map((row) => row.id)).toEqual([delivery.id]);
  });
});
