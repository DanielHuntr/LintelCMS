import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { customersTable } from "../commerce/customers/customers.table.js";
import { definePlugin } from "../plugins/plugin-definition.js";
import { useTestDatabase } from "../testing/test-database.js";
import { usePrivacyTestServer } from "./privacy-test-server.js";
import { insertReturning } from "../database/dialect/writes.js";

interface FoundItem {
  id: string;
  summary: string;
  email: string | null;
  date: string | null;
}

/** Two people can share a name. An email is who someone is; a name is only somewhere to start. */
describe("finding someone by name", () => {
  const testDatabase = useTestDatabase();
  const privacy = usePrivacyTestServer(testDatabase);

  async function twoPeople() {
    const rows = await insertReturning(testDatabase.database, customersTable, [
      { email: "sam.one@example.com", name: "Sam Lee", phone: "111" },
      { email: "sam.two@example.com", name: "Sam Lee", phone: "222" },
    ]);
    const [one, two] = rows;
    if (!one || !two) throw new Error("Two customers should have been made");
    return { one, two };
  }

  const remaining = async () =>
    (await testDatabase.database.select().from(customersTable)).map((row) => row.email);

  it("lists each match with enough to tell them apart", async () => {
    await twoPeople();
    const response = await privacy.api("POST", "/privacy/people/find", { name: "Sam Lee" });
    const items = response.json().found[0].items as FoundItem[];
    expect(items.map((item) => item.email).sort()).toEqual([
      "sam.one@example.com",
      "sam.two@example.com",
    ]);
    expect(items.every((item) => item.date !== null)).toBe(true);
  });

  it("won't export or erase by name without being told which records", async () => {
    await twoPeople();
    for (const action of ["export", "erase"]) {
      const response = await privacy.api("POST", `/privacy/people/${action}`, { name: "Sam Lee" });
      expect(response.statusCode, action).toBe(400);
    }
    const nothingTicked = await privacy.api("POST", "/privacy/people/erase", {
      name: "Sam Lee",
      selected: [],
    });
    expect(nothingTicked.statusCode).toBe(400);
    expect(await remaining()).toHaveLength(2);
  });

  it("erases only the records ticked", async () => {
    const { one } = await twoPeople();
    const response = await privacy.api("POST", "/privacy/people/erase", {
      name: "Sam Lee",
      selected: [{ kindId: "shop-customers", id: one.id }],
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().parts).toMatchObject([{ source: "Shop customers", deleted: 1 }]);
    expect(await remaining()).toEqual(["sam.two@example.com"]);
  });

  it("exports only the records ticked", async () => {
    const { two } = await twoPeople();
    const response = await privacy.api("POST", "/privacy/people/export", {
      name: "Sam Lee",
      selected: [{ kindId: "shop-customers", id: two.id }],
    });
    expect(response.statusCode, response.body).toBe(200);
    const files = unzipSync(new Uint8Array(response.rawPayload));
    const everything = strFromU8(files["personal-data.json"] ?? new Uint8Array());
    expect(everything).toContain("sam.two@example.com");
    expect(everything).not.toContain("sam.one@example.com");
  });

  it("goes by the email alone when given both", async () => {
    await twoPeople();
    const both = { email: "sam.one@example.com", name: "Sam Lee" };
    const found = (await privacy.api("POST", "/privacy/people/find", both)).json();
    expect(found.found[0].items).toHaveLength(1);

    await privacy.api("POST", "/privacy/people/erase", both);
    expect(await remaining()).toEqual(["sam.two@example.com"]);
  });
});

describe("an add-on that can't pick out single records", () => {
  const testDatabase = useTestDatabase();
  const erased: string[] = [];
  const plugin = definePlugin({
    id: "guestbook",
    name: "Guestbook",
    description: "Visitors sign it.",
    personalData: {
      tables: [{ name: "guestbook", columns: [{ name: "name", personalData: true }] }],
      find: async () => [
        { id: "a", summary: "Signed", date: null },
        { id: "b", summary: "Signed", date: null },
      ],
      export: async () => [{ name: "Sam Lee" }, { name: "Sam Lee" }],
      erase: async () => {
        erased.push("everything");
        return { deleted: 2 };
      },
    },
  });
  const privacy = usePrivacyTestServer(testDatabase, [plugin]);

  it("is refused rather than given more than was ticked", async () => {
    const response = await privacy.api("POST", "/privacy/people/erase", {
      name: "Sam Lee",
      selected: [{ kindId: "plugin:guestbook", id: "a" }],
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().message).toContain("Guestbook");
    expect(erased).toEqual([]);
  });

  it("is erased when everything it found is ticked", async () => {
    const response = await privacy.api("POST", "/privacy/people/erase", {
      name: "Sam Lee",
      selected: [
        { kindId: "plugin:guestbook", id: "a" },
        { kindId: "plugin:guestbook", id: "b" },
      ],
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(erased).toEqual(["everything"]);
  });
});
