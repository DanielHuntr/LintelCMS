import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { LocalDiskStorage } from "../media/local-disk-storage.js";
import { useTestDatabase } from "../testing/test-database.js";
import { useFormsTestServer } from "../testing/test-forms.js";
import { formSubmissionsTable } from "./forms.table.js";
import { deleteExpiredSubmissions } from "./submissions.service.js";

function answers(name: string, email: string, message = "Hello") {
  return { name, email, message, consent: true };
}

describe("the submissions inbox", () => {
  const testDatabase = useTestDatabase();
  const forms = useFormsTestServer(testDatabase);

  async function contactFormWith(people: Array<[string, string, string?]>) {
    const form = await forms.createForm("Contact", "contact");
    for (const [name, email, message] of people) {
      expect((await forms.submit(form, answers(name, email, message))).statusCode).toBe(201);
    }
    return form;
  }

  it("lists submissions newest first, with unread counts on the form", async () => {
    const form = await contactFormWith([
      ["Ana", "ana@example.com"],
      ["Ben", "ben@example.com"],
    ]);

    const list = await forms.api("GET", `/forms/${form.id}/submissions`);
    expect(list.json().total).toBe(2);
    expect(
      list.json().submissions.map((item: { values: { name: string } }) => item.values.name),
    ).toEqual(["Ben", "Ana"]);
    const summary = await forms.api("GET", `/forms/${form.id}`);
    expect(summary.json()).toMatchObject({ submissionCount: 2, unreadCount: 2 });
    expect(summary.json().lastSubmittedAt).not.toBeNull();
  });

  it("marks as read, stars, filters and searches", async () => {
    const form = await contactFormWith([
      ["Ana", "ana@example.com", "About the kitchen"],
      ["Ben", "ben@example.com", "About the garden"],
    ]);
    const { submissions } = (await forms.api("GET", `/forms/${form.id}/submissions`)).json();
    const ben = submissions[0].id;

    const changed = await forms.api("PATCH", `/forms/${form.id}/submissions/${ben}`, {
      isRead: true,
      isStarred: true,
    });
    expect(changed.json()).toMatchObject({ isRead: true, isStarred: true, notes: [] });

    const names = async (query: string) =>
      (await forms.api("GET", `/forms/${form.id}/submissions?${query}`))
        .json()
        .submissions.map((item: { values: { name: string } }) => item.values.name);
    expect(await names("filter=unread")).toEqual(["Ana"]);
    expect(await names("filter=starred")).toEqual(["Ben"]);
    expect(await names("search=kitchen")).toEqual(["Ana"]);
    expect(await names("search=BEN%40")).toEqual(["Ben"]);
    expect(await names("search=100%25")).toEqual([]);
  });

  it("keeps notes on a submission, with who wrote them", async () => {
    const form = await contactFormWith([["Ana", "ana@example.com"]]);
    const [submission] = (await forms.api("GET", `/forms/${form.id}/submissions`)).json()
      .submissions;
    const url = `/forms/${form.id}/submissions/${submission.id}`;

    const added = await forms.api("POST", `${url}/notes`, { body: "Called back on Monday" });
    expect(added.statusCode).toBe(201);
    const [note] = added.json().notes;
    expect(note).toMatchObject({ body: "Called back on Monday", author: { name: "Ana Editor" } });

    const removed = await forms.api("DELETE", `${url}/notes/${note.id}`);
    expect(removed.json().notes).toEqual([]);
    expect((await forms.api("POST", `${url}/notes`, { body: "  " })).statusCode).toBe(400);
  });

  it("exports a spreadsheet that's safe to open", async () => {
    const form = await contactFormWith([
      ["Ana, the first", "ana@example.com", '=HYPERLINK("http://evil")'],
      ["Ben", "ben@example.com", "Line one\nline two"],
    ]);

    const response = await forms.api("GET", `/forms/${form.id}/export`);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toContain("contact-submissions.csv");
    const lines = response.body.replace(/^\uFEFF/, "").split("\r\n");
    expect(lines[0]).toBe(
      "Submitted at,Your name,Email address,Phone number,Message,I agree to this site keeping my details to reply to me.,Read,Starred",
    );
    expect(lines[1]).toContain(
      '"Ana, the first",ana@example.com,,"\'=HYPERLINK(""http://evil"")",yes,no,no',
    );
    expect(response.body).toContain('"Line one\nline two"');
  });

  it("deletes a submission", async () => {
    const form = await contactFormWith([["Ana", "ana@example.com"]]);
    const [submission] = (await forms.api("GET", `/forms/${form.id}/submissions`)).json()
      .submissions;

    const deleted = await forms.api("DELETE", `/forms/${form.id}/submissions/${submission.id}`);
    expect(deleted.statusCode).toBe(204);
    expect(
      (await forms.api("GET", `/forms/${form.id}/submissions/${submission.id}`)).statusCode,
    ).toBe(404);
  });

  it("deletes submissions older than the form keeps them", async () => {
    const form = await contactFormWith([
      ["Ana", "ana@example.com"],
      ["Ben", "ben@example.com"],
    ]);
    await forms.api("PATCH", `/forms/${form.id}`, { retentionDays: 30 });
    const [newest, oldest] = (await forms.api("GET", `/forms/${form.id}/submissions`)).json()
      .submissions;
    await testDatabase.database
      .update(formSubmissionsTable)
      .set({ createdAt: new Date(Date.now() - 31 * 24 * 60 * 60_000) })
      .where(eq(formSubmissionsTable.id, oldest.id));

    const deleted = await deleteExpiredSubmissions({
      database: testDatabase.database,
      media: {
        database: testDatabase.database,
        storage: new LocalDiskStorage(join(tmpdir(), "lintel-forms-retention")),
        cacheFolder: join(tmpdir(), "lintel-forms-retention-cache"),
        publicApiUrl: "http://api.test",
        usageFinder: { findEntriesUsingAsset: async () => [] },
      },
    });

    expect(deleted).toBe(1);
    const left = (await forms.api("GET", `/forms/${form.id}/submissions`)).json().submissions;
    expect(left.map((item: { id: string }) => item.id)).toEqual([newest.id]);
  });

  it("exports and erases one person's data across every form", async () => {
    const contact = await contactFormWith([
      ["Ana", "ana@example.com"],
      ["Ben", "ben@example.com"],
    ]);
    const newsletter = await forms.createForm("Newsletter", "newsletter");
    await forms.submit(newsletter, { email: "ANA@example.com", consent: "on" });

    const exported = await forms.api("POST", "/forms/privacy/export", {
      email: " Ana@Example.com ",
    });
    expect(exported.json().email).toBe("ana@example.com");
    expect(
      exported
        .json()
        .submissions.map((item: { form: { handle: string } }) => item.form.handle)
        .sort(),
    ).toEqual(["contact", "newsletter"]);

    const erased = await forms.api("POST", "/forms/privacy/erase", { email: "ana@example.com" });
    expect(erased.json()).toEqual({ deleted: 2 });
    const left = (await forms.api("GET", `/forms/${contact.id}/submissions`)).json();
    expect(left.submissions.map((item: { values: { name: string } }) => item.values.name)).toEqual([
      "Ben",
    ]);
  });
});
