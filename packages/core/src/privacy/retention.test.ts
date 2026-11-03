import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { cartsTable } from "../commerce/carts/carts.table.js";
import { ordersTable } from "../commerce/orders/orders.table.js";
import { formSubmissionsTable, formsTable } from "../forms/forms.table.js";
import { securityEventsTable } from "../security-log/security-events.table.js";
import { useTestDatabase } from "../testing/test-database.js";
import { usePrivacyTestServer } from "./privacy-test-server.js";
import { runRetentionRules } from "./retention.service.js";

const DAY = 24 * 60 * 60_000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

describe("retention rules", () => {
  const testDatabase = useTestDatabase();
  const privacy = usePrivacyTestServer(testDatabase);

  const run = () =>
    runRetentionRules({
      database: testDatabase.database,
      forms: privacy.server.forms.context,
    });

  async function oldAndNew() {
    const database = testDatabase.database;
    const contact = await privacy.createForm("Contact");
    const quotes = await privacy.createForm("Quotes");
    // Quotes keeps entries for ten years of its own, so the site-wide rule leaves it alone.
    await database
      .update(formsTable)
      .set({ retentionDays: 3650 })
      .where(eq(formsTable.id, quotes.id));
    for (const form of [contact, contact, quotes]) {
      await privacy.submit(form, {
        name: "Grace",
        email: "grace@example.com",
        message: "Hi",
        consent: "on",
      });
    }
    const submissions = await database.select().from(formSubmissionsTable);
    // One Contact entry and the Quotes entry are two years old.
    const [oldContact] = submissions.filter((row) => row.formId === contact.id);
    const [oldQuote] = submissions.filter((row) => row.formId === quotes.id);
    for (const row of [oldContact, oldQuote]) {
      await database
        .update(formSubmissionsTable)
        .set({ createdAt: daysAgo(730) })
        .where(eq(formSubmissionsTable.id, row?.id ?? ""));
    }

    const market = await privacy.createMarket();
    await database.insert(cartsTable).values([
      { tokenHash: "old", marketId: market.id, updatedAt: daysAgo(45) },
      { tokenHash: "new", marketId: market.id, updatedAt: daysAgo(2) },
    ]);
    await database.insert(securityEventsTable).values([
      { kind: "sign-in", actorEmail: "a@example.com", createdAt: daysAgo(120) },
      { kind: "sign-in", actorEmail: "a@example.com", createdAt: daysAgo(10) },
    ]);
    await database.insert(ordersTable).values({
      number: 1001,
      name: "#1001",
      checkoutId: crypto.randomUUID(),
      email: "grace@example.com",
      currency: "GBP",
      shippingAddress: {
        name: "Grace",
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
      paidAt: daysAgo(3000),
      createdAt: daysAgo(3000),
    });
  }

  it("starts with leftovers tidied and what people sent or bought kept", async () => {
    await oldAndNew();
    const response = await privacy.api("GET", "/privacy/retention");
    const rules = Object.fromEntries(
      (response.json().rules as Array<{ id: string }>).map((rule) => [rule.id, rule]),
    );
    expect(rules.formEntries).toMatchObject({
      enabled: false,
      days: 365,
      dueNow: 1,
      applies: true,
    });
    expect(rules.abandonedCarts).toMatchObject({ enabled: true, days: 30, dueNow: 1 });
    expect(rules.activityLogs).toMatchObject({ enabled: true, days: 90 });
    expect(rules.orders).toMatchObject({ enabled: false, days: 2555, dueNow: 1 });
    // The new basket is due 30 days after it was last changed: 28 days from now.
    const nextCart = new Date(rules.abandonedCarts.nextDueAt).getTime();
    expect(Math.round((nextCart - Date.now()) / DAY)).toBe(28);
  });

  it("runs only the rules that are on, and each only on what is past it", async () => {
    await oldAndNew();
    const database = testDatabase.database;

    expect(await run()).toMatchObject({ formEntries: 0, abandonedCarts: 1, orders: 0 });
    expect((await database.select().from(cartsTable)).map((cart) => cart.tokenHash)).toEqual([
      "new",
    ]);
    const events = await database
      .select()
      .from(securityEventsTable)
      .where(eq(securityEventsTable.actorEmail, "a@example.com"));
    expect(events).toHaveLength(1);
    expect(await database.$count(formSubmissionsTable)).toBe(3);

    const changed = await privacy.api("PUT", "/privacy/retention", {
      formEntries: { enabled: true, days: 365 },
      orders: { enabled: true, days: 2555 },
    });
    expect(changed.statusCode).toBe(200);

    expect(await run()).toMatchObject({ formEntries: 1, orders: 1 });
    // The form with its own retention keeps its old entry.
    expect(await database.$count(formSubmissionsTable)).toBe(2);
    const [order] = await database.select().from(ordersTable);
    expect(order).toMatchObject({ email: "", totalAmount: 1000 });
    // A second run finds nothing more to do.
    expect(await run()).toEqual({ formEntries: 0, abandonedCarts: 0, activityLogs: 0, orders: 0 });
  });

  it("offers a short list of lengths, and refuses others", async () => {
    const response = await privacy.api("PUT", "/privacy/retention", {
      formEntries: { enabled: true, days: 12 },
    });
    expect(response.statusCode).toBe(400);
    const unchanged = await privacy.api("GET", "/privacy/retention");
    expect(unchanged.json().rules[0]).toMatchObject({ choices: [90, 180, 365, 730] });
  });
});
