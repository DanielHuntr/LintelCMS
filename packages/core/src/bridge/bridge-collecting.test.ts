import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { formsTable, formSubmissionsTable } from "../forms/forms.table.js";
import type * as SubmissionsRepository from "../forms/submissions.repository.js";
import { bridgeReceiptsTable } from "../publishing/publishing.table.js";
import { useTestDatabase } from "../testing/test-database.js";
import { useStaticSiteTestServer } from "../testing/test-static-site.js";
import { pullFromBridge } from "./bridge-pull.service.js";

const failing = vi.hoisted(() => ({ nextInsert: false }));

vi.mock("../forms/submissions.repository.js", async (importActual) => {
  const actual = await importActual<typeof SubmissionsRepository>();
  return {
    ...actual,
    insertSubmissionRow: (...args: Parameters<typeof actual.insertSubmissionRow>) => {
      if (failing.nextInsert) {
        failing.nextInsert = false;
        throw new Error("The database went away");
      }
      return actual.insertSubmissionRow(...args);
    },
  };
});

/** What Lintel does with what a published site kept for it, with the site answered by hand. */
describe("collecting form entries from a published site", () => {
  const testDatabase = useTestDatabase();
  const lintel = useStaticSiteTestServer(testDatabase);

  function answersWith(values: Record<string, unknown>, handle: string): typeof fetch {
    return (async (input: string | URL | Request) => {
      if (!String(input).includes("action=pull")) return Response.json({ acknowledged: 1 });
      return Response.json({
        submissions: [
          {
            id: "abcdef0123456789",
            form: handle,
            values,
            receivedAt: new Date().toISOString(),
            sourceUrl: "https://bakery.test/contact",
          },
        ],
        orders: [],
      });
    }) as typeof fetch;
  }

  async function setUp() {
    const form = await lintel.createForm("Contact us");
    const options = { siteAddress: "https://bakery.test" };
    const created = await lintel.send("POST", "/publishing/targets", {
      name: "My hosting",
      kind: "zip",
      options,
    });
    expect(created.statusCode, created.body).toBe(201);
    return { form, target: { id: (created.json() as { id: string }).id, options } };
  }

  it("keeps the words of each consent box ticked, as the website does", async () => {
    const { form, target } = await setUp();
    const [saved] = await testDatabase.database
      .select()
      .from(formsTable)
      .where(eq(formsTable.id, form.id));
    const box = saved?.fields.find((field) => field.type === "consent");
    if (!box) throw new Error("The contact form should have a consent box");

    const fetcher = answersWith(
      { name: "Sam", email: "sam@example.com", message: "Hello", [box.handle]: "on" },
      form.handle,
    );
    const result = await pullFromBridge(lintel.api, target, "secret", fetcher);
    expect(result.submissions).toBe(1);

    const [entry] = await testDatabase.database.select().from(formSubmissionsTable);
    expect(entry?.consents).toMatchObject([
      { field: box.handle, wording: expect.stringContaining(box.label) as string },
    ]);
  });

  it("doesn't count an entry as received until it is saved", async () => {
    const { form, target } = await setUp();
    const fetcher = answersWith(
      { name: "Sam", email: "sam@example.com", message: "Hello" },
      form.handle,
    );

    failing.nextInsert = true;
    await expect(pullFromBridge(lintel.api, target, "secret", fetcher)).rejects.toThrow();
    expect(await testDatabase.database.select().from(bridgeReceiptsTable)).toEqual([]);

    const again = await pullFromBridge(lintel.api, target, "secret", fetcher);
    expect(again.submissions).toBe(1);
  });
});
