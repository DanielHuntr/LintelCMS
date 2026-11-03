import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { TABLES_LEFT_OUT_OF_BACKUPS } from "../backups/table-order.js";
import { orderEventsTable, ordersTable } from "../commerce/orders/orders.table.js";
import { definePlugin } from "../plugins/plugin-definition.js";
import { securityEventsTable } from "../security-log/security-events.table.js";
import { useTestDatabase } from "../testing/test-database.js";
import { webhookDeliveriesTable, webhooksTable } from "../webhooks/webhooks.table.js";
import type { Trigger } from "../workflows/workflow-definition.schema.js";
import { workflowRunsTable, workflowsTable } from "../workflows/workflows.table.js";
import { usePrivacyTestServer } from "./privacy-test-server.js";
import { privacyRequestsTable } from "./privacy.table.js";
import { runRetentionRules } from "./retention.service.js";

/** The copies of a person's details that aren't in the obvious place. */

const failingPlugin = definePlugin({
  id: "failing",
  name: "Failing",
  description: "Can't erase anything.",
  personalData: {
    tables: [{ name: "failing", columns: [{ name: "email", personalData: true }] }],
    find: async () => [{ id: "f1", summary: "Something", date: null }],
    export: async () => [],
    erase: async () => {
      throw new Error("The other service is down");
    },
  },
});

const trigger = { type: "event", event: "form.submitted" } as unknown as Trigger;
const graceAnswers = { submission: { submitterEmail: "grace@example.com", fields: { a: "Hi" } } };
const DAY = 24 * 60 * 60_000;

describe("copies of a person's details", () => {
  const testDatabase = useTestDatabase();
  const privacy = usePrivacyTestServer(testDatabase);

  async function automationHistory(createdAt = new Date()) {
    const database = testDatabase.database;
    const [webhook] = await database
      .insert(webhooksTable)
      .values({ name: "CRM", url: "https://crm.test", events: [], secret: "s" })
      .returning();
    const [workflow] = await database
      .insert(workflowsTable)
      .values({ name: "Reply", trigger, steps: [], secret: "s" })
      .returning();
    if (!webhook || !workflow) throw new Error("Nothing was made.");
    await database.insert(webhookDeliveriesTable).values({
      webhookId: webhook.id,
      event: "form.submitted",
      payload: graceAnswers,
      status: "delivered",
      createdAt,
    });
    const run = {
      workflowId: workflow.id,
      workflowName: "Reply",
      definition: { trigger, steps: [] },
      context: graceAnswers,
      createdAt,
    };
    await database.insert(workflowRunsTable).values([
      { ...run, status: "succeeded", finishedAt: createdAt },
      { ...run, status: "waiting" },
    ]);
  }

  it("takes the person out of webhook and automation history, but not a run still going", async () => {
    await automationHistory();

    const found = await privacy.api("POST", "/privacy/people/find", {
      email: "grace@example.com",
      name: null,
    });
    expect(found.statusCode).toBe(200);
    expect(found.json().found).toEqual([
      expect.objectContaining({ kindId: "automation-history", items: expect.any(Array) }),
    ]);
    expect(found.json().found[0].items).toHaveLength(3);

    const erased = await privacy.api("POST", "/privacy/people/erase", {
      email: "grace@example.com",
    });
    expect(erased.json().parts).toEqual([
      expect.objectContaining({ deleted: 2, kept: 1, found: 3 }),
    ]);
    expect(erased.json().explanations).toEqual([expect.stringContaining("still running")]);
    const database = testDatabase.database;
    expect(await database.$count(webhookDeliveriesTable)).toBe(0);
    const runs = await database.select().from(workflowRunsTable);
    expect(runs.map((run) => run.status)).toEqual(["waiting"]);
  });

  it("doesn't take part of a value for the person", async () => {
    await automationHistory();
    const found = await privacy.api("POST", "/privacy/people/find", { email: "race@example.com" });
    expect(found.json().found).toEqual([]);
  });

  it("removes the email from an order's history", async () => {
    await testDatabase.database.insert(ordersTable).values({
      number: 1001,
      name: "#1001",
      checkoutId: crypto.randomUUID(),
      email: "grace@example.com",
      currency: "GBP",
      shippingAddress: {
        name: "Grace Hopper",
        company: "",
        line1: "1 High Street",
        line2: "",
        city: "Bath",
        region: "",
        postalCode: "BA1",
        country: "GB",
        phone: "",
      },
      shippingLine: { rateId: "standard", name: "Standard", amount: 0, taxAmount: 0 },
      subtotalAmount: 1000,
      discountAmount: 0,
      shippingAmount: 0,
      taxAmount: 0,
      totalAmount: 1000,
      taxesIncluded: true,
      paidAt: new Date(),
    });
    const [order] = await testDatabase.database.select().from(ordersTable);
    await testDatabase.database.insert(orderEventsTable).values({
      orderId: order?.id ?? "",
      kind: "placed",
      message: "Order placed by grace@example.com",
    });

    await privacy.api("POST", "/privacy/people/erase", { email: "grace@example.com" });

    const [event] = await testDatabase.database.select().from(orderEventsTable);
    expect(event?.message).toBe("Order placed by the customer");
  });

  it("finds and clears an email kept in a security event's details", async () => {
    await testDatabase.database.insert(securityEventsTable).values({
      kind: "user-invited",
      actorEmail: "owner@example.com",
      subjectName: "grace@example.com",
      details: { email: "grace@example.com", role: "Editor" },
    });

    await privacy.api("POST", "/privacy/people/erase", { email: "grace@example.com" });

    const [event] = await testDatabase.database
      .select()
      .from(securityEventsTable)
      .where(eq(securityEventsTable.kind, "user-invited"));
    expect(JSON.stringify(event)).not.toContain("grace");
  });

  it("tidies old webhook and automation history with the activity rule", async () => {
    await automationHistory(new Date(Date.now() - 120 * DAY));

    const done = await runRetentionRules({
      database: testDatabase.database,
      forms: privacy.server.forms.context,
    });

    expect(done.activityLogs).toBe(2);
    expect(await testDatabase.database.$count(webhookDeliveriesTable)).toBe(0);
    // The run still waiting is left alone, however old.
    expect(await testDatabase.database.$count(workflowRunsTable)).toBe(1);
  });

  it("keeps the record of requests out of backups, so a restore can't lose it", () => {
    expect(TABLES_LEFT_OUT_OF_BACKUPS).toContain("privacy_requests");
  });
});

describe("when erasing fails part way", () => {
  const testDatabase = useTestDatabase();
  const privacy = usePrivacyTestServer(testDatabase, [failingPlugin]);

  it("says where it stopped, and still records what was done", async () => {
    const form = await privacy.createForm("Contact");
    await privacy.submit(form, {
      name: "Grace",
      email: "grace@example.com",
      message: "Hi",
      consent: "on",
    });

    const response = await privacy.api("POST", "/privacy/people/erase", {
      email: "grace@example.com",
    });

    expect(response.statusCode).toBe(500);
    expect(response.json().message).toContain("Failing");
    const [record] = await testDatabase.database.select().from(privacyRequestsTable);
    expect(record?.parts).toEqual([
      expect.objectContaining({ source: "Form entries", deleted: 1 }),
    ]);
  });
});
