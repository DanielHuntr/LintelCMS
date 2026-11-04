import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { cartsTable } from "../commerce/carts/carts.table.js";
import { checkoutsTable, type NewCheckoutRow } from "../commerce/checkouts/checkouts.table.js";
import type { Address } from "../commerce/customers/address.schema.js";
import { marketsTable } from "../commerce/markets/markets.table.js";
import { type NewOrderRow, ordersTable } from "../commerce/orders/orders.table.js";
import {
  archivedOrdersTable,
  type NewArchivedOrderRow,
} from "../commerce/shopify-import/shopify-import.table.js";
import type { Database } from "../database/client.js";
import { tableFor } from "../database/dialect/mysql-tables.js";
import { insertReturning } from "../database/dialect/writes.js";
import { formSubmissionsTable, formsTable } from "../forms/forms.table.js";
import { securityEventsTable } from "../security-log/security-events.table.js";
import { describeOnEveryDatabase } from "../testing/every-database.js";
import { webhookDeliveriesTable, webhooksTable } from "../webhooks/webhooks.table.js";
import { workflowRunsTable, workflowsTable } from "../workflows/workflows.table.js";
import {
  countPastCutoff,
  findOldestKept,
  listIdsPastCutoff,
  type RetainedKind,
  retainedKinds,
} from "./retention.repository.js";

const TENANT = "default";
const OTHER_TENANT = "other";
const cutoff = new Date("2026-11-04T12:00:00.125Z");
const justBefore = new Date(cutoff.getTime() - 1);
const longBefore = new Date("2024-02-29T08:30:00.500Z");
const justAfter = new Date(cutoff.getTime() + 1);
const longAfter = new Date("2027-01-01T00:00:00.000Z");
const beyondEverything = new Date("2030-01-01T00:00:00.000Z");
const beforeEverything = new Date("2000-01-01T00:00:00.000Z");

const address: Address = {
  name: "Ada Lovelace",
  company: "",
  line1: "1 High Street",
  line2: "",
  city: "Leeds",
  region: "",
  postalCode: "",
  country: "GB",
  phone: "",
};

async function saved<Row>(rows: Row[]): Promise<Row> {
  const [row] = rows;
  if (!row) throw new Error("The test row was not saved.");
  return row;
}

async function addForm(database: Database, retentionDays: number | null = null) {
  return saved(
    await insertReturning(database, tableFor(database, formsTable), {
      handle: `form-${randomUUID()}`,
      name: "Contact",
      fields: [],
      submitLabel: "Send",
      confirmation: {} as never,
      notifications: {} as never,
      retentionDays,
    }),
  );
}

async function addSubmission(
  database: Database,
  formId: string,
  createdAt: Date,
  tenantId = TENANT,
) {
  return saved(
    await insertReturning(database, tableFor(database, formSubmissionsTable), {
      tenantId,
      formId,
      values: {},
      createdAt,
    }),
  );
}

async function addCart(
  database: Database,
  updatedAt: Date,
  tenantId = TENANT,
  createdAt = updatedAt,
) {
  const market = await saved(
    await insertReturning(database, tableFor(database, marketsTable), {
      name: "UK",
      handle: `market-${randomUUID()}`,
      currency: "GBP",
    }),
  );
  return saved(
    await insertReturning(database, tableFor(database, cartsTable), {
      tenantId,
      tokenHash: randomUUID(),
      marketId: market.id,
      createdAt,
      updatedAt,
    }),
  );
}

async function addCheckout(database: Database, values: Partial<NewCheckoutRow>) {
  return saved(
    await insertReturning(database, tableFor(database, checkoutsTable), {
      marketId: randomUUID(),
      status: "expired",
      email: "ada@example.com",
      shippingAddress: address,
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
      expiresAt: cutoff,
      ...values,
    }),
  );
}

async function addEvent(database: Database, createdAt: Date, tenantId = TENANT) {
  return saved(
    await insertReturning(database, tableFor(database, securityEventsTable), {
      tenantId,
      kind: "sign-in",
      createdAt,
    }),
  );
}

let nextOrderNumber = 1000;

async function addOrder(database: Database, values: Partial<NewOrderRow>) {
  nextOrderNumber += 1;
  return saved(
    await insertReturning(database, tableFor(database, ordersTable), {
      number: nextOrderNumber,
      name: `#${nextOrderNumber}`,
      checkoutId: randomUUID(),
      email: "ada@example.com",
      currency: "GBP",
      shippingAddress: address,
      shippingLine: { rateId: "rate", name: "Post", amount: 0, taxAmount: 0 },
      subtotalAmount: 100,
      discountAmount: 0,
      shippingAmount: 0,
      taxAmount: 0,
      totalAmount: 100,
      taxesIncluded: true,
      paidAt: cutoff,
      ...values,
    }),
  );
}

async function addArchivedOrder(database: Database, values: Partial<NewArchivedOrderRow>) {
  return saved(
    await insertReturning(database, tableFor(database, archivedOrdersTable), {
      name: `#${randomUUID()}`,
      email: "ada@example.com",
      currency: "GBP",
      shippingAddress: address,
      placedAt: cutoff,
      ...values,
    }),
  );
}

async function addDelivery(
  database: Database,
  values: Partial<typeof webhookDeliveriesTable.$inferInsert>,
) {
  const webhook = await saved(
    await insertReturning(database, tableFor(database, webhooksTable), {
      name: "Rebuild",
      url: "https://example.com/hook",
      events: [],
      secret: "secret",
    }),
  );
  return saved(
    await insertReturning(database, tableFor(database, webhookDeliveriesTable), {
      webhookId: webhook.id,
      event: "entry.published" as never,
      payload: {},
      status: "delivered",
      ...values,
    }),
  );
}

async function addRun(database: Database, values: Partial<typeof workflowRunsTable.$inferInsert>) {
  const workflow = await saved(
    await insertReturning(database, tableFor(database, workflowsTable), {
      name: "Follow up",
      trigger: {} as never,
      steps: [],
      secret: "secret",
    }),
  );
  return saved(
    await insertReturning(database, tableFor(database, workflowRunsTable), {
      workflowId: workflow.id,
      workflowName: "Follow up",
      definition: { trigger: {}, steps: [] } as never,
      context: {},
      finishedAt: cutoff,
      ...values,
    }),
  );
}

type AddRow = (database: Database, date: Date, tenantId: string) => Promise<{ id: string }>;

/** Each kind, with a way to add a row it covers, dated as the rule counts. */
const everyKind: Array<{ name: string; kind: RetainedKind; add: AddRow }> = [
  {
    name: "form entries",
    kind: retainedKinds.formEntries,
    add: async (database, date, tenantId) =>
      addSubmission(database, (await addForm(database)).id, date, tenantId),
  },
  { name: "carts", kind: retainedKinds.carts, add: addCart },
  {
    name: "expired checkouts",
    kind: retainedKinds.expiredCheckouts,
    add: (database, createdAt, tenantId) => addCheckout(database, { createdAt, tenantId }),
  },
  { name: "security events", kind: retainedKinds.securityEvents, add: addEvent },
  {
    name: "orders",
    kind: retainedKinds.orders,
    add: (database, createdAt, tenantId) => addOrder(database, { createdAt, tenantId }),
  },
  {
    name: "archived orders",
    kind: retainedKinds.archivedOrders,
    add: (database, placedAt, tenantId) => addArchivedOrder(database, { placedAt, tenantId }),
  },
  {
    name: "webhook deliveries",
    kind: retainedKinds.webhookDeliveries,
    add: (database, createdAt, tenantId) => addDelivery(database, { createdAt, tenantId }),
  },
  {
    name: "workflow runs",
    kind: retainedKinds.workflowRuns,
    add: (database, createdAt, tenantId) => addRun(database, { createdAt, tenantId }),
  },
];

describeOnEveryDatabase("Retention", (handle) => {
  describe.each(everyKind)("$name", ({ kind, add }) => {
    it("counts and lists what is past the cutoff, the moment itself not included", async () => {
      const { database } = handle;
      const past = [
        await add(database, longBefore, TENANT),
        await add(database, justBefore, TENANT),
      ];
      await add(database, cutoff, TENANT);
      await add(database, justAfter, TENANT);
      const elsewhere = await add(database, longBefore, OTHER_TENANT);

      expect(await countPastCutoff(database, kind, TENANT, cutoff)).toBe(2);
      const ids = await listIdsPastCutoff(database, kind, TENANT, cutoff, 10);
      expect(ids.sort()).toEqual(past.map((row) => row.id).sort());
      expect(await listIdsPastCutoff(database, kind, TENANT, cutoff, 1)).toHaveLength(1);

      expect(await countPastCutoff(database, kind, OTHER_TENANT, cutoff)).toBe(1);
      const otherIds = await listIdsPastCutoff(database, kind, OTHER_TENANT, cutoff, 10);
      expect(otherIds).toEqual([elsewhere.id]);

      expect(await countPastCutoff(database, kind, TENANT, beforeEverything)).toBe(0);
      expect(await listIdsPastCutoff(database, kind, TENANT, beforeEverything, 10)).toEqual([]);
    });

    it("gives the oldest date kept, the moment itself included, or nothing", async () => {
      const { database } = handle;
      await add(database, justBefore, TENANT);
      await add(database, longAfter, TENANT);
      await add(database, cutoff, TENANT);
      await add(database, justAfter, OTHER_TENANT);

      const oldest = await findOldestKept(database, kind, TENANT, cutoff);
      expect(oldest).toBeInstanceOf(Date);
      expect(oldest).toEqual(cutoff);
      expect(await findOldestKept(database, kind, OTHER_TENANT, cutoff)).toEqual(justAfter);
      expect(await findOldestKept(database, kind, TENANT, justAfter)).toEqual(longAfter);
      expect(await findOldestKept(database, kind, TENANT, beyondEverything)).toBeNull();
    });
  });

  it("leaves form entries to their form's own days when it has them", async () => {
    const { database } = handle;
    const keptByRule = await addForm(database);
    const ownDays = await addForm(database, 30);
    const covered = await addSubmission(database, keptByRule.id, longBefore);
    await addSubmission(database, ownDays.id, longBefore);
    const kind = retainedKinds.formEntries;

    expect(await countPastCutoff(database, kind, TENANT, cutoff)).toBe(1);
    expect(await listIdsPastCutoff(database, kind, TENANT, cutoff, 10)).toEqual([covered.id]);

    await addSubmission(database, ownDays.id, justAfter);
    expect(await findOldestKept(database, kind, TENANT, cutoff)).toBeNull();
  });

  it("dates carts by their last change, not when they were made", async () => {
    const { database } = handle;
    await addCart(database, justAfter, TENANT, longBefore);
    const abandoned = await addCart(database, justBefore, TENANT, longAfter);
    const kind = retainedKinds.carts;

    expect(await listIdsPastCutoff(database, kind, TENANT, cutoff, 10)).toEqual([abandoned.id]);
    expect(await findOldestKept(database, kind, TENANT, cutoff)).toEqual(justAfter);
  });

  it("covers only checkouts that expired and still hold an email", async () => {
    const { database } = handle;
    const covered = await addCheckout(database, { createdAt: longBefore });
    await addCheckout(database, { createdAt: longBefore, status: "open" });
    await addCheckout(database, { createdAt: longBefore, status: "completed" });
    await addCheckout(database, { createdAt: longBefore, status: "needs_review" });
    await addCheckout(database, { createdAt: longBefore, email: "" });
    const kind = retainedKinds.expiredCheckouts;

    expect(await countPastCutoff(database, kind, TENANT, cutoff)).toBe(1);
    expect(await listIdsPastCutoff(database, kind, TENANT, cutoff, 10)).toEqual([covered.id]);
  });

  it("covers only orders that still hold an email", async () => {
    const { database } = handle;
    const covered = await addOrder(database, { createdAt: longBefore });
    await addOrder(database, { createdAt: longBefore, email: "" });
    const kind = retainedKinds.orders;

    expect(await countPastCutoff(database, kind, TENANT, cutoff)).toBe(1);
    expect(await listIdsPastCutoff(database, kind, TENANT, cutoff, 10)).toEqual([covered.id]);
  });

  it("covers archived orders holding an email or a name not yet removed", async () => {
    const { database } = handle;
    const placedAt = longBefore;
    const removed = { ...address, name: "Removed" };
    const withEmail = await addArchivedOrder(database, { placedAt, shippingAddress: null });
    const withName = await addArchivedOrder(database, { placedAt, email: "" });
    const removedWithEmail = await addArchivedOrder(database, {
      placedAt,
      shippingAddress: removed,
    });
    await addArchivedOrder(database, { placedAt, email: "", shippingAddress: removed });
    await addArchivedOrder(database, { placedAt, email: "", shippingAddress: null });
    const kind = retainedKinds.archivedOrders;

    expect(await countPastCutoff(database, kind, TENANT, cutoff)).toBe(3);
    const ids = await listIdsPastCutoff(database, kind, TENANT, cutoff, 10);
    expect(ids.sort()).toEqual([withEmail.id, withName.id, removedWithEmail.id].sort());
  });

  it("leaves webhook deliveries still to be sent", async () => {
    const { database } = handle;
    const delivered = await addDelivery(database, { createdAt: longBefore });
    const failed = await addDelivery(database, { createdAt: longBefore, status: "failed" });
    await addDelivery(database, { createdAt: longBefore, status: "pending" });
    const kind = retainedKinds.webhookDeliveries;

    expect(await countPastCutoff(database, kind, TENANT, cutoff)).toBe(2);
    const ids = await listIdsPastCutoff(database, kind, TENANT, cutoff, 10);
    expect(ids.sort()).toEqual([delivered.id, failed.id].sort());
  });

  it("covers only finished workflow runs that aren't about an entry", async () => {
    const { database } = handle;
    const covered = await addRun(database, { createdAt: longBefore });
    await addRun(database, { createdAt: longBefore, finishedAt: null });
    await addRun(database, { createdAt: longBefore, entryId: randomUUID() });
    const kind = retainedKinds.workflowRuns;

    expect(await countPastCutoff(database, kind, TENANT, cutoff)).toBe(1);
    expect(await listIdsPastCutoff(database, kind, TENANT, cutoff, 10)).toEqual([covered.id]);
    expect(await findOldestKept(database, kind, TENANT, beforeEverything)).toEqual(longBefore);
  });
});
