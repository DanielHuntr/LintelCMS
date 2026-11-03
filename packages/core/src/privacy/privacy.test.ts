import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { ZipArchiveReader } from "../archives/zip-reader.js";
import { cartsTable } from "../commerce/carts/carts.table.js";
import { customersTable } from "../commerce/customers/customers.table.js";
import { ordersTable } from "../commerce/orders/orders.table.js";
import { formSubmissionsTable } from "../forms/forms.table.js";
import { definePlugin } from "../plugins/plugin-definition.js";
import { securityEventsTable } from "../security-log/security-events.table.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import type { PersonLookup } from "./personal-data-declaration.js";
import { usePrivacyTestServer } from "./privacy-test-server.js";
import { privacyRequestsTable } from "./privacy.table.js";

/**
 * A plugin that keeps a list of newsletter readers in memory, with the hooks Privacy uses.
 * It stands in for an add-on; the Bookings plugin's own tests cover one with a real table.
 */
const readers = new Map<string, { name: string; email: string }>();
const matches = (person: PersonLookup) => (reader: { name: string; email: string }) =>
  reader.email === person.email || reader.name.toLowerCase() === person.name?.toLowerCase();

const readersPlugin = definePlugin({
  id: "readers",
  name: "Readers",
  description: "A newsletter list.",
  personalData: {
    description: "The name and email of each newsletter reader.",
    tables: [
      {
        name: "readers",
        columns: [
          { name: "name", personalData: true },
          { name: "email", personalData: true },
          { name: "signed_up_at" },
        ],
      },
    ],
    async find({ person }) {
      return [...readers.entries()]
        .filter(([, reader]) => matches(person)(reader))
        .map(([id]) => ({ id, summary: "Newsletter reader", date: null }));
    },
    async export({ person }) {
      return [...readers.values()].filter(matches(person));
    },
    async erase({ person }) {
      const ids = [...readers.entries()].filter(([, reader]) => matches(person)(reader));
      for (const [id] of ids) readers.delete(id);
      return { deleted: ids.length };
    },
  },
});

/** An add-on with a table but nothing said about personal data: listed as not searchable. */
const silentPlugin = definePlugin({
  id: "silent",
  name: "Silent",
  description: "Keeps something of its own.",
  personalData: { tables: [{ name: "silent", columns: [{ name: "email", personalData: true }] }] },
});

const address = (name: string) => ({
  name,
  company: "",
  line1: "1 High Street",
  line2: "",
  city: "Bath",
  region: "",
  postalCode: "BA1 1AA",
  country: "GB",
  phone: "07700 900000",
});

describe("Settings → Privacy", () => {
  const testDatabase = useTestDatabase();
  const privacy = usePrivacyTestServer(testDatabase, [readersPlugin, silentPlugin]);

  /** Grace has sent a form, bought something, left a basket and is on the newsletter. */
  async function graceEverywhere() {
    const form = await privacy.createForm("Contact");
    const sent = await privacy.submit(form, {
      name: "Grace Hopper",
      email: "Grace@Example.com",
      message: "Do you bake rye?",
      consent: "on",
    });
    expect(sent.statusCode).toBe(201);
    await privacy.submit(form, {
      name: "Ada Lovelace",
      email: "ada@example.com",
      message: "Hello",
      consent: "on",
    });
    const market = await privacy.createMarket();
    const database = testDatabase.database;
    await database
      .insert(customersTable)
      .values({ email: "grace@example.com", name: "Grace Hopper" });
    await database.insert(ordersTable).values({
      number: 1001,
      name: "#1001",
      checkoutId: crypto.randomUUID(),
      email: "grace@example.com",
      currency: "GBP",
      shippingAddress: address("Grace Hopper"),
      shippingLine: { rateId: "standard", name: "Standard", amount: 300, taxAmount: 0 },
      subtotalAmount: 1200,
      discountAmount: 0,
      shippingAmount: 300,
      taxAmount: 250,
      totalAmount: 1500,
      taxesIncluded: true,
      paidAt: new Date(),
    });
    await database.insert(cartsTable).values({
      tokenHash: "abc",
      marketId: market.id,
      email: "grace@example.com",
      shippingAddress: address("Grace Hopper"),
    });
    await database.insert(securityEventsTable).values({
      kind: "sign-in-failed",
      actorEmail: "grace@example.com",
      ipAddress: "203.0.113.9",
      userAgent: "Firefox",
    });
    readers.clear();
    readers.set("r1", { name: "Grace Hopper", email: "grace@example.com" });
    readers.set("r2", { name: "Ada Lovelace", email: "ada@example.com" });
  }

  it("maps where personal data lives, including add-ons and what can't be searched", async () => {
    const response = await privacy.api("GET", "/privacy/map");
    expect(response.statusCode).toBe(200);
    const kinds = response.json().kinds as Array<Record<string, unknown>>;
    const byId = new Map(kinds.map((kind) => [kind.id, kind]));

    expect(byId.get("form-entries")).toMatchObject({ inUse: true, searchable: true });
    expect(byId.get("shop-orders")).toMatchObject({ inUse: true, searchable: true });
    expect(byId.get("security-log")).toMatchObject({ inUse: true, searchable: true });
    expect(byId.get("backups")).toMatchObject({ searchable: false });
    expect(byId.get("plugin:readers")).toMatchObject({
      name: "Readers",
      description: "The name and email of each newsletter reader.",
      searchable: true,
      tables: [{ name: "readers", columns: ["name", "email"] }],
    });
    expect(byId.get("plugin:silent")).toMatchObject({ searchable: false, inUse: true });
    // Visitors isn't switched on here, so it's listed after everything in use.
    expect(byId.get("visitors")).toMatchObject({ inUse: false });
    expect(kinds.at(-1)?.inUse).toBe(false);
  });

  it("finds one person across forms, the shop, the security log and a plugin", async () => {
    await graceEverywhere();

    const byEmail = await privacy.api("POST", "/privacy/people/find", {
      email: " GRACE@example.com ",
    });
    expect(byEmail.statusCode).toBe(200);
    const found = byEmail.json().found as Array<{ kindId: string; items: unknown[] }>;
    expect(Object.fromEntries(found.map((kind) => [kind.kindId, kind.items.length]))).toEqual({
      "form-entries": 1,
      "shop-customers": 1,
      "shop-orders": 1,
      "shop-carts": 1,
      "security-log": 1,
      "plugin:readers": 1,
    });
    expect(byEmail.json().notSearched).toEqual([
      expect.objectContaining({ kindId: "plugin:silent", name: "Silent" }),
    ]);

    // A whole name finds the same form entry; part of one finds nothing.
    const byName = await privacy.api("POST", "/privacy/people/find", { name: "grace hopper" });
    expect(byName.json().found.map((kind: { kindId: string }) => kind.kindId)).toContain(
      "form-entries",
    );
    const partName = await privacy.api("POST", "/privacy/people/find", { name: "Grace" });
    expect(partName.json().found).toEqual([]);

    const nothing = await privacy.api("POST", "/privacy/people/find", {});
    expect(nothing.statusCode).toBe(400);
  });

  it("exports everything about the person as JSON and CSV in one zip, and records it", async () => {
    await graceEverywhere();

    const response = await privacy.api("POST", "/privacy/people/export", {
      email: "grace@example.com",
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("application/zip");
    expect(response.headers["content-disposition"]).toMatch(/personal-data-.*\.zip/);

    const folder = await mkdtemp(join(tmpdir(), "lintel-privacy-export-"));
    try {
      const path = join(folder, "export.zip");
      await writeFile(path, response.rawPayload);
      const archive = await ZipArchiveReader.open(path);
      expect(archive.listNames().sort()).toEqual([
        "form-entries.csv",
        "personal-data.json",
        "plugin-readers.csv",
        "security-log.csv",
        "shop-carts.csv",
        "shop-customers.csv",
        "shop-orders.csv",
      ]);
      const everything = (await archive.readJson("personal-data.json")) as {
        data: Record<string, Array<Record<string, unknown>>>;
      };
      const [entry] = everything.data["Form entries"] ?? [];
      expect(entry).toMatchObject({
        form: "Contact",
        page: "https://bakery.test/contact",
        answers: { name: "Grace Hopper", message: "Do you bake rye?" },
        consents: [
          {
            field: "consent",
            wording: "I agree to this site keeping my details to reply to me.",
            page: "https://bakery.test/contact",
          },
        ],
      });
      expect(everything.data.Readers).toEqual([
        { name: "Grace Hopper", email: "grace@example.com" },
      ]);
      expect((await archive.readBuffer("shop-orders.csv")).toString()).toContain("#1001");
    } finally {
      await rm(folder, { recursive: true, force: true });
    }

    const [record] = await testDatabase.database.select().from(privacyRequestsTable);
    expect(record).toMatchObject({ kind: "export", actorName: "Ana Editor" });
    expect(JSON.stringify(record)).not.toContain("grace");
  });

  it("erases by each kind's rule, keeping orders for tax without the person", async () => {
    await graceEverywhere();

    const response = await privacy.api("POST", "/privacy/people/erase", {
      email: "grace@example.com",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "Form entries", deleted: 1 }),
        expect.objectContaining({ source: "Shop customers", deleted: 1 }),
        expect.objectContaining({ source: "Orders", deleted: 0, anonymised: 1 }),
        expect.objectContaining({ source: "Baskets", deleted: 1 }),
        expect.objectContaining({ source: "Security log", anonymised: 1 }),
        expect.objectContaining({ source: "Readers", deleted: 1 }),
      ]),
    );

    const database = testDatabase.database;
    const submissions = await database.select().from(formSubmissionsTable);
    expect(submissions.map((row) => row.submitterEmail)).toEqual(["ada@example.com"]);
    const [order] = await database.select().from(ordersTable);
    expect(order).toMatchObject({
      email: "",
      totalAmount: 1500,
      shippingAddress: expect.objectContaining({ name: "Removed", phone: "", country: "GB" }),
    });
    expect(await database.select().from(cartsTable)).toEqual([]);
    const [event] = await database
      .select()
      .from(securityEventsTable)
      .where(eq(securityEventsTable.kind, "sign-in-failed"));
    expect(event).toMatchObject({ actorEmail: null, ipAddress: null, userAgent: null });
    expect([...readers.values()].map((reader) => reader.name)).toEqual(["Ada Lovelace"]);

    // Nothing is left to find, and the record of the erasure names nobody.
    const again = await privacy.api("POST", "/privacy/people/find", { email: "grace@example.com" });
    expect(again.json().found).toEqual([]);
    const requests = await privacy.api("GET", "/privacy/requests");
    expect(requests.json().requests[0]).toMatchObject({ kind: "erase", actorName: "Ana Editor" });
    expect(JSON.stringify(requests.json())).not.toMatch(/grace|Hopper/i);
  });

  it("keeps admin accounts, saying where to remove them", async () => {
    const response = await privacy.api("POST", "/privacy/people/erase", {
      email: "owner@example.com",
    });
    expect(response.json().parts).toEqual(
      expect.arrayContaining([expect.objectContaining({ source: "Admin accounts", kept: 1 })]),
    );
    const found = await privacy.api("POST", "/privacy/people/find", { email: "owner@example.com" });
    expect(found.json().found[0]).toMatchObject({ kindId: "accounts" });
  });

  it("is only for people with privacy:manage", async () => {
    await createTestUser(testDatabase.database, "editor@example.com", [["entries:*"]]);
    const cookies = await signInAndGetCookies(privacy.server, "editor@example.com");
    for (const [method, url] of [
      ["GET", "/privacy/map"],
      ["POST", "/privacy/people/find"],
      ["POST", "/privacy/people/erase"],
      ["GET", "/privacy/retention"],
    ] as const) {
      const response = await privacy.server.inject({
        method,
        url,
        cookies,
        payload: { email: "a@example.com" },
      });
      expect(response.statusCode).toBe(403);
    }
  });
});
