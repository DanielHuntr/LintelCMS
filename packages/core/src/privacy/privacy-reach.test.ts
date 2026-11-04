import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { customersTable } from "../commerce/customers/customers.table.js";
import { ordersTable } from "../commerce/orders/orders.table.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { formsTable } from "../forms/forms.table.js";
import { useTestDatabase } from "../testing/test-database.js";
import { coreSources } from "./core-sources.js";
import { usePrivacyTestServer } from "./privacy-test-server.js";
import { runRetentionRules, updateRetentionRules } from "./retention.service.js";

const DAY = 24 * 60 * 60_000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

function address(name: string) {
  return {
    name,
    company: "",
    line1: "1 High Street",
    line2: "",
    city: "Bath",
    region: "",
    postalCode: "BA1",
    country: "GB",
    phone: "",
  };
}

function question(handle: string, type: "email" | "shortText") {
  return {
    id: handle,
    handle,
    type,
    label: handle,
    helpText: "",
    placeholder: "",
    required: false,
    options: {},
  };
}

/** Places the privacy tools have to reach that aren't the obvious column. */
describe("how far the privacy tools reach", () => {
  const testDatabase = useTestDatabase();
  const privacy = usePrivacyTestServer(testDatabase);

  async function order(
    number: number,
    email: string,
    customerId: string | null,
    overrides: { placed?: Date; currency?: string; totalAmount?: number } = {},
  ) {
    const placed = overrides.placed ?? new Date();
    await testDatabase.database.insert(ordersTable).values({
      number,
      name: `#${number}`,
      checkoutId: crypto.randomUUID(),
      customerId,
      email,
      currency: overrides.currency ?? "GBP",
      shippingAddress: address("Grace Hopper"),
      shippingLine: { rateId: "standard", name: "Standard", amount: 0, taxAmount: 0 },
      subtotalAmount: 1000,
      discountAmount: 0,
      shippingAmount: 0,
      taxAmount: 0,
      totalAmount: overrides.totalAmount ?? 1000,
      taxesIncluded: true,
      paidAt: placed,
      createdAt: placed,
    });
  }

  async function customer(email: string) {
    const [row] = await testDatabase.database
      .insert(customersTable)
      .values({ email, name: "Grace Hopper", phone: "01225 000000", addresses: [address("Grace")] })
      .returning();
    if (!row) throw new Error("No customer was made.");
    return row;
  }

  it("finds someone by an email that isn't the form's first email answer", async () => {
    const form = await privacy.createForm("Refer a friend");
    await testDatabase.database
      .update(formsTable)
      .set({
        fields: [
          question("email", "email"),
          question("friend", "email"),
          question("other", "shortText"),
        ],
      })
      .where(eq(formsTable.id, form.id));
    const sent = await privacy.submit(form, {
      email: "ada@example.com",
      friend: "Grace@Example.com",
      other: "ben@example.com",
    });
    expect(sent.statusCode, sent.body).toBeLessThan(300);

    for (const email of ["grace@example.com", "ben@example.com"]) {
      const found = (await privacy.api("POST", "/privacy/people/find", { email })).json();
      expect(found.found.map((kind: { kindId: string }) => kind.kindId)).toContain("form-entries");
    }
  });

  it("takes the customer away with their last old order when the orders rule runs", async () => {
    const gone = await customer("grace@example.com");
    const stays = await customer("ada@example.com");
    await order(1001, "grace@example.com", gone.id, { placed: daysAgo(3000) });
    await order(1002, "ada@example.com", stays.id, { placed: daysAgo(3000) });
    await order(1003, "ada@example.com", stays.id);
    await updateRetentionRules(testDatabase.database, { orders: { enabled: true, days: 2555 } });

    await runRetentionRules({
      database: testDatabase.database,
      forms: privacy.server.forms.context,
    });

    const customers = await testDatabase.database.select().from(customersTable);
    expect(customers.map((row) => row.email)).toEqual(["ada@example.com"]);
    const orders = await testDatabase.database.select().from(ordersTable);
    const byName = new Map(orders.map((row) => [row.name, row]));
    expect(byName.get("#1001")).toMatchObject({ email: "", customerId: null });
    expect(byName.get("#1002")).toMatchObject({ email: "", customerId: null });
    expect(byName.get("#1003")).toMatchObject({ customerId: stays.id });
  });

  it("exports totals in the order's own currency", async () => {
    await order(1001, "grace@example.com", null, { currency: "JPY", totalAmount: 5000 });
    await order(1002, "grace@example.com", null, { totalAmount: 1250 });
    const orders = coreSources({
      database: testDatabase.database,
      enabledPlugins: [],
      plugins: [],
      addons: [],
      forms: privacy.server.forms.context,
    }).find((source) => source.id === "shop-orders");
    const rows = await orders?.hooks?.export({
      database: testDatabase.database,
      tenantId: DEFAULT_TENANT_ID,
      person: { email: "grace@example.com", name: null },
    });
    const totals = new Map(rows?.map((row) => [row.order, row.total]));
    expect(totals.get("#1001")).toBe(5000);
    expect(totals.get("#1002")).toBe(12.5);
  });
});
