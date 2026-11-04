import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import type { Database } from "../database/client.js";
import { tableFor } from "../database/dialect/mysql-tables.js";
import { addTestUser, describeOnEveryDatabase } from "../testing/every-database.js";
import { usersTable } from "../users/users.table.js";
import { insertFormRow } from "./forms.repository.js";
import { formSubmissionNotesTable, type NewFormSubmissionRow } from "./forms.table.js";
import {
  deleteNoteRow,
  deleteSubmissionRows,
  findAssetIdsStillUsed,
  findExpiredSubmissionIds,
  findSubmissionIdsInForm,
  findSubmissionRow,
  insertNoteRow,
  insertSubmissionRow,
  listAllSubmissionRows,
  listNoteRows,
  listRecentSubmissionsWithToken,
  listSubmissionRows,
  listSubmissionRowsByEmail,
  lockFormSubmissions,
  type SubmissionListOptions,
  updateSubmissionFlags,
} from "./submissions.repository.js";

const TENANT = "default";
const OTHER_TENANT = "other";
const noon = new Date("2026-11-04T12:00:00.125Z");
const DAY = 24 * 60 * 60 * 1000;

function minutesAfterNoon(minutes: number): Date {
  return new Date(noon.getTime() + minutes * 60 * 1000);
}

function addForm(
  database: Database,
  handle = "contact",
  values: { tenantId?: string; retentionDays?: number | null; name?: string } = {},
) {
  return insertFormRow(database, {
    handle,
    name: "Contact",
    fields: [],
    submitLabel: "Send",
    confirmation: {} as never,
    notifications: {} as never,
    ...values,
  });
}

function addSubmission(
  database: Database,
  formId: string,
  values: Partial<NewFormSubmissionRow> = {},
) {
  return insertSubmissionRow(database, { formId, values: {}, ...values });
}

function list(options: Partial<SubmissionListOptions> = {}): SubmissionListOptions {
  return { filter: "all", limit: 50, offset: 0, ...options };
}

describeOnEveryDatabase("Form submissions", (handle) => {
  it("saves a submission with its JSON as sent and the rest as defaults", async () => {
    const { database } = handle;
    const form = await addForm(database);
    const consent = { field: "ok", wording: "Yes", givenAt: noon.toISOString(), page: null };
    const assetId = randomUUID();
    const answers = {
      name: "Zoë “Ada” O'Neil",
      topics: ["a", "b"],
      age: 42,
      agreed: true,
      none: null,
    };
    const saved = await insertSubmissionRow(database, {
      formId: form.id,
      values: answers as never,
      assetIds: [assetId],
      consents: [consent],
      createdAt: noon,
    });

    expect(saved).toMatchObject({
      tenantId: TENANT,
      formId: form.id,
      values: answers,
      assetIds: [assetId],
      consents: [consent],
      submitterEmail: null,
      sourceUrl: null,
      tokenHash: null,
      isRead: false,
      isStarred: false,
      createdAt: noon,
    });

    const bare = await addSubmission(database, form.id);
    expect(bare).toMatchObject({ assetIds: [], consents: [], values: {} });
    expect(bare.createdAt).toBeInstanceOf(Date);
  });

  it("refuses a submission to a form that doesn't exist", async () => {
    const { database } = handle;
    await expect(addSubmission(database, randomUUID())).rejects.toThrow();
  });

  it("makes a second transaction wait for the form's lock", async () => {
    const { database } = handle;
    const form = await addForm(database);
    const steps: string[] = [];
    let letGo = () => {};
    const released = new Promise<void>((resolve) => {
      letGo = resolve;
    });
    let sayHeld = () => {};
    const held = new Promise<void>((resolve) => {
      sayHeld = resolve;
    });

    const first = database.transaction(async (transaction) => {
      await lockFormSubmissions(transaction, form.id);
      sayHeld();
      await released;
      steps.push("first finished");
    });
    await held;
    const second = database.transaction(async (transaction) => {
      await lockFormSubmissions(transaction, form.id);
      steps.push("second has the lock");
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(steps).toEqual([]);
    letGo();
    await Promise.all([first, second]);
    expect(steps).toEqual(["first finished", "second has the lock"]);
  });

  it("gives the lock up when a transaction fails, and can take it twice", async () => {
    const { database } = handle;
    const form = await addForm(database);
    await expect(
      database.transaction(async (transaction) => {
        await lockFormSubmissions(transaction, form.id);
        throw new Error("Stopped");
      }),
    ).rejects.toThrow("Stopped");

    await database.transaction(async (transaction) => {
      await lockFormSubmissions(transaction, form.id);
      await lockFormSubmissions(transaction, form.id);
      await insertSubmissionRow(transaction, { formId: form.id, values: {} });
    });
    expect(await listAllSubmissionRows(database, TENANT, form.id)).toHaveLength(1);
  });

  // The built-in database has one connection, so its transactions always take turns.
  it.skipIf(handle.name === "built-in")("doesn't hold up another form's lock", async () => {
    const { database } = handle;
    const [form, otherForm] = [await addForm(database), await addForm(database, "other")];
    await database.transaction(async (transaction) => {
      await lockFormSubmissions(transaction, form.id);
      await database.transaction((other) => lockFormSubmissions(other, otherForm.id));
    });
  });

  it("finds recent submissions by form, token and time, the moment itself included", async () => {
    const { database } = handle;
    const form = await addForm(database);
    const otherForm = await addForm(database, "other");
    const atTheMoment = await addSubmission(database, form.id, {
      tokenHash: "token",
      createdAt: noon,
    });
    const after = await addSubmission(database, form.id, {
      tokenHash: "token",
      createdAt: minutesAfterNoon(1),
    });
    await addSubmission(database, form.id, {
      tokenHash: "token",
      createdAt: new Date(noon.getTime() - 1),
    });
    await addSubmission(database, form.id, { tokenHash: "another", createdAt: noon });
    await addSubmission(database, form.id, { createdAt: noon });
    await addSubmission(database, otherForm.id, { tokenHash: "token", createdAt: noon });

    const found = await listRecentSubmissionsWithToken(database, form.id, "token", noon);
    expect(found.map((row) => row.id).sort()).toEqual([atTheMoment.id, after.id].sort());
    expect(await listRecentSubmissionsWithToken(database, form.id, "TOKEN", noon)).toEqual([]);
  });

  it("lists newest first, ties by id, and pages with the whole total", async () => {
    const { database } = handle;
    const form = await addForm(database);
    const oldest = await addSubmission(database, form.id, { createdAt: minutesAfterNoon(-5) });
    const newest = await addSubmission(database, form.id, { createdAt: minutesAfterNoon(5) });
    const tied = [
      await addSubmission(database, form.id, { createdAt: noon }),
      await addSubmission(database, form.id, { createdAt: noon }),
    ];
    const tiedByIdDescending = tied
      .map((row) => row.id)
      .sort()
      .reverse();

    const all = await listSubmissionRows(database, TENANT, form.id, list());
    expect(all.total).toBe(4);
    expect(all.rows.map((row) => row.id)).toEqual([newest.id, ...tiedByIdDescending, oldest.id]);

    const secondPage = await listSubmissionRows(
      database,
      TENANT,
      form.id,
      list({ limit: 2, offset: 1 }),
    );
    expect(secondPage.total).toBe(4);
    expect(secondPage.rows.map((row) => row.id)).toEqual(tiedByIdDescending);

    const pastTheEnd = await listSubmissionRows(database, TENANT, form.id, list({ offset: 10 }));
    expect(pastTheEnd).toEqual({ rows: [], total: 4 });
  });

  it("filters unread and starred, and keeps to one tenant and form", async () => {
    const { database } = handle;
    const form = await addForm(database);
    const otherForm = await addForm(database, "other");
    const unread = await addSubmission(database, form.id);
    const starred = await addSubmission(database, form.id, { isRead: true, isStarred: true });
    await addSubmission(database, otherForm.id);
    await addSubmission(database, form.id, { tenantId: OTHER_TENANT });

    const unreadList = await listSubmissionRows(
      database,
      TENANT,
      form.id,
      list({ filter: "unread" }),
    );
    expect(unreadList.rows.map((row) => row.id)).toEqual([unread.id]);
    expect(unreadList.total).toBe(1);

    const starredList = await listSubmissionRows(
      database,
      TENANT,
      form.id,
      list({ filter: "starred" }),
    );
    expect(starredList.rows).toHaveLength(1);
    expect(starredList.rows[0]).toMatchObject({ id: starred.id, isRead: true, isStarred: true });

    expect((await listSubmissionRows(database, TENANT, form.id, list())).total).toBe(2);
    expect((await listSubmissionRows(database, OTHER_TENANT, form.id, list())).total).toBe(1);
  });

  it("searches every answer and the email, ignoring case, with % and _ as themselves", async () => {
    const { database } = handle;
    const form = await addForm(database);
    const byAnswer = await addSubmission(database, form.id, {
      values: { message: "Please call Ada Lovelace", topics: ["Engines"] },
    });
    const byEmail = await addSubmission(database, form.id, {
      values: { message: "Hello" },
      submitterEmail: "grace@example.com",
    });
    const percent = await addSubmission(database, form.id, { values: { message: "Save 50% now" } });
    const underscore = await addSubmission(database, form.id, { values: { code: "a_b" } });
    await addSubmission(database, form.id, { values: { message: "Save 500 now", code: "axb" } });

    const idsFor = async (search: string) => {
      const { rows, total } = await listSubmissionRows(database, TENANT, form.id, list({ search }));
      expect(total).toBe(rows.length);
      return rows.map((row) => row.id);
    };
    expect(await idsFor("ADA LOVE")).toEqual([byAnswer.id]);
    expect(await idsFor("engines")).toEqual([byAnswer.id]);
    expect(await idsFor("GRACE@")).toEqual([byEmail.id]);
    expect(await idsFor("50%")).toEqual([percent.id]);
    expect(await idsFor("a_b")).toEqual([underscore.id]);
    expect(await idsFor("nobody at all")).toEqual([]);
  });

  it("searches within a filter", async () => {
    const { database } = handle;
    const form = await addForm(database);
    await addSubmission(database, form.id, { values: { message: "Ada" }, isRead: true });
    const unread = await addSubmission(database, form.id, { values: { message: "Ada" } });
    await addSubmission(database, form.id, { values: { message: "Grace" } });

    const found = await listSubmissionRows(
      database,
      TENANT,
      form.id,
      list({ filter: "unread", search: "ada" }),
    );
    expect(found.total).toBe(1);
    expect(found.rows[0]?.id).toBe(unread.id);
  });

  it("lists everything of a form oldest first for the export", async () => {
    const { database } = handle;
    const form = await addForm(database);
    const otherForm = await addForm(database, "other");
    const newest = await addSubmission(database, form.id, { createdAt: minutesAfterNoon(5) });
    const tied = [
      await addSubmission(database, form.id, { createdAt: noon }),
      await addSubmission(database, form.id, { createdAt: noon }),
    ];
    await addSubmission(database, otherForm.id);
    await addSubmission(database, form.id, { tenantId: OTHER_TENANT });

    const rows = await listAllSubmissionRows(database, TENANT, form.id);
    expect(rows.map((row) => row.id)).toEqual([...tied.map((row) => row.id).sort(), newest.id]);
    expect(await listAllSubmissionRows(database, TENANT, randomUUID())).toEqual([]);
  });

  it("finds one submission only through its own tenant and form", async () => {
    const { database } = handle;
    const form = await addForm(database);
    const otherForm = await addForm(database, "other");
    const submission = await addSubmission(database, form.id, {
      values: { message: "Hello" },
      createdAt: noon,
    });

    expect(await findSubmissionRow(database, TENANT, form.id, submission.id)).toEqual(submission);
    expect(await findSubmissionRow(database, TENANT, otherForm.id, submission.id)).toBeUndefined();
    expect(await findSubmissionRow(database, OTHER_TENANT, form.id, submission.id)).toBeUndefined();
    expect(await findSubmissionRow(database, TENANT, form.id, randomUUID())).toBeUndefined();
  });

  it("changes only the flags it's given, on the tenant's own submissions", async () => {
    const { database } = handle;
    const form = await addForm(database);
    const first = await addSubmission(database, form.id, {
      isStarred: true,
      updatedAt: minutesAfterNoon(-60),
    });
    const second = await addSubmission(database, form.id);
    const untouched = await addSubmission(database, form.id);
    const elsewhere = await addSubmission(database, form.id, { tenantId: OTHER_TENANT });

    await updateSubmissionFlags(database, TENANT, [first.id, second.id, elsewhere.id], {
      isRead: true,
    });
    const changed = await findSubmissionRow(database, TENANT, form.id, first.id);
    expect(changed).toMatchObject({ isRead: true, isStarred: true });
    expect(changed?.updatedAt.getTime()).toBeGreaterThan(minutesAfterNoon(-60).getTime());
    expect((await findSubmissionRow(database, TENANT, form.id, second.id))?.isRead).toBe(true);
    expect((await findSubmissionRow(database, TENANT, form.id, untouched.id))?.isRead).toBe(false);
    const other = await findSubmissionRow(database, OTHER_TENANT, form.id, elsewhere.id);
    expect(other?.isRead).toBe(false);

    await updateSubmissionFlags(database, TENANT, [first.id], { isStarred: false, isRead: false });
    expect(await findSubmissionRow(database, TENANT, form.id, first.id)).toMatchObject({
      isRead: false,
      isStarred: false,
    });

    await updateSubmissionFlags(database, TENANT, [], { isRead: true });
    expect((await findSubmissionRow(database, TENANT, form.id, first.id))?.isRead).toBe(false);
  });

  it("deletes submissions with their notes and gives back what they held", async () => {
    const { database } = handle;
    const author = await addTestUser(database);
    const form = await addForm(database);
    const assetId = randomUUID();
    const gone = await addSubmission(database, form.id, {
      values: { message: "Hello", topics: ["a"] },
      assetIds: [assetId],
    });
    const kept = await addSubmission(database, form.id);
    const elsewhere = await addSubmission(database, form.id, { tenantId: OTHER_TENANT });
    await insertNoteRow(database, {
      tenantId: TENANT,
      submissionId: gone.id,
      authorId: author.id,
      body: "Called back",
    });

    expect(await deleteSubmissionRows(database, TENANT, [])).toEqual([]);
    const deleted = await deleteSubmissionRows(database, TENANT, [gone.id, elsewhere.id]);
    expect(deleted).toHaveLength(1);
    expect(deleted[0]).toMatchObject({
      id: gone.id,
      values: { message: "Hello", topics: ["a"] },
      assetIds: [assetId],
      isRead: false,
    });

    const left = await listAllSubmissionRows(database, TENANT, form.id);
    expect(left.map((row) => row.id)).toEqual([kept.id]);
    const notes = tableFor(database, formSubmissionNotesTable);
    expect(await database.select().from(notes)).toEqual([]);
    expect(await findSubmissionRow(database, OTHER_TENANT, form.id, elsewhere.id)).toBeDefined();
  });

  it("says which ids are in a form", async () => {
    const { database } = handle;
    const form = await addForm(database);
    const otherForm = await addForm(database, "other");
    const inside = await addSubmission(database, form.id);
    const outside = await addSubmission(database, otherForm.id);
    const elsewhere = await addSubmission(database, form.id, { tenantId: OTHER_TENANT });

    const asked = [inside.id, outside.id, elsewhere.id, randomUUID()];
    expect(await findSubmissionIdsInForm(database, TENANT, form.id, asked)).toEqual([inside.id]);
    expect(await findSubmissionIdsInForm(database, TENANT, form.id, [])).toEqual([]);
  });

  it("finds submissions past their own form's days, to the millisecond", async () => {
    const { database } = handle;
    const week = await addForm(database, "week", { retentionDays: 7 });
    const month = await addForm(database, "month", { retentionDays: 30 });
    const forever = await addForm(database, "forever");
    const justOver = await addSubmission(database, week.id, {
      createdAt: new Date(noon.getTime() - 7 * DAY - 1),
    });
    await addSubmission(database, week.id, { createdAt: new Date(noon.getTime() - 7 * DAY) });
    await addSubmission(database, month.id, { createdAt: new Date(noon.getTime() - 8 * DAY) });
    const longGone = await addSubmission(database, month.id, {
      createdAt: new Date(noon.getTime() - 31 * DAY),
    });
    await addSubmission(database, forever.id, { createdAt: new Date(noon.getTime() - 900 * DAY) });
    await addSubmission(database, week.id, {
      tenantId: OTHER_TENANT,
      createdAt: new Date(noon.getTime() - 900 * DAY),
    });

    const found = await findExpiredSubmissionIds(database, TENANT, noon, 10);
    expect(found.sort()).toEqual([justOver.id, longGone.id].sort());
    expect(await findExpiredSubmissionIds(database, TENANT, noon, 1)).toHaveLength(1);
    const otherTenant = await findExpiredSubmissionIds(database, OTHER_TENANT, noon, 10);
    expect(otherTenant).toHaveLength(1);
  });

  it("treats a form keeping nothing as past it at once", async () => {
    const { database } = handle;
    const form = await addForm(database, "nothing", { retentionDays: 0 });
    const before = await addSubmission(database, form.id, {
      createdAt: new Date(noon.getTime() - 1),
    });
    await addSubmission(database, form.id, { createdAt: noon });
    expect(await findExpiredSubmissionIds(database, TENANT, noon, 10)).toEqual([before.id]);
  });

  it("lists one person's submissions across forms, newest first", async () => {
    const { database } = handle;
    const first = await addForm(database, "first", { name: "First form" });
    const second = await addForm(database, "second", { name: "Second form" });
    const older = await addSubmission(database, first.id, {
      values: { topics: ["a"] },
      submitterEmail: "ada@example.com",
      isStarred: true,
      createdAt: noon,
    });
    const newer = await addSubmission(database, second.id, {
      submitterEmail: "ada@example.com",
      createdAt: minutesAfterNoon(1),
    });
    await addSubmission(database, first.id, { submitterEmail: "grace@example.com" });
    await addSubmission(database, first.id, {
      tenantId: OTHER_TENANT,
      submitterEmail: "ada@example.com",
    });

    const rows = await listSubmissionRowsByEmail(database, TENANT, "ada@example.com");
    expect(rows.map((row) => row.id)).toEqual([newer.id, older.id]);
    expect(rows[1]).toMatchObject({
      formHandle: "first",
      formName: "First form",
      values: { topics: ["a"] },
      isStarred: true,
      createdAt: noon,
    });
    expect(rows[0]).toMatchObject({ formHandle: "second", formName: "Second form" });
    expect(await listSubmissionRowsByEmail(database, TENANT, "no@example.com")).toEqual([]);
  });

  it("finds files still held, in the list of files or only in the answers", async () => {
    const { database } = handle;
    const form = await addForm(database);
    const [listed, mentioned, unused, otherTenants] = [
      randomUUID(),
      randomUUID(),
      randomUUID(),
      randomUUID(),
    ];
    await addSubmission(database, form.id, { assetIds: [randomUUID(), listed] });
    await addSubmission(database, form.id, { values: { photo: { assetId: mentioned } } as never });
    await addSubmission(database, form.id, { tenantId: OTHER_TENANT, assetIds: [otherTenants] });

    const used = await findAssetIdsStillUsed(database, TENANT, [
      listed,
      mentioned,
      unused,
      otherTenants,
    ]);
    expect([...used].sort()).toEqual([listed, mentioned].sort());
    expect(await findAssetIdsStillUsed(database, TENANT, [])).toEqual(new Set());
  });

  it("saves notes and lists them oldest first with their author's name", async () => {
    const { database } = handle;
    const author = await addTestUser(database);
    const form = await addForm(database);
    const submission = await addSubmission(database, form.id);
    const otherSubmission = await addSubmission(database, form.id);
    await insertNoteRow(database, {
      tenantId: TENANT,
      submissionId: otherSubmission.id,
      authorId: author.id,
      body: "Elsewhere",
    });
    const notes = tableFor(database, formSubmissionNotesTable);
    await database.insert(notes).values([
      { submissionId: submission.id, authorId: author.id, body: "Later", createdAt: noon },
      {
        submissionId: submission.id,
        authorId: author.id,
        body: "Earlier",
        createdAt: minutesAfterNoon(-1),
      },
      { tenantId: OTHER_TENANT, submissionId: submission.id, body: "Not ours" },
    ]);

    const rows = await listNoteRows(database, TENANT, submission.id);
    expect(rows.map((row) => row.body)).toEqual(["Earlier", "Later"]);
    expect(rows[1]).toMatchObject({
      tenantId: TENANT,
      submissionId: submission.id,
      authorId: author.id,
      authorName: "Ada",
      createdAt: noon,
    });
  });

  it("keeps a note when its author goes, with no name", async () => {
    const { database } = handle;
    const author = await addTestUser(database);
    const form = await addForm(database);
    const submission = await addSubmission(database, form.id);
    await insertNoteRow(database, {
      tenantId: TENANT,
      submissionId: submission.id,
      authorId: author.id,
      body: "Called back",
    });

    const users = tableFor(database, usersTable);
    await database.delete(users).where(eq(users.id, author.id));

    expect(await listNoteRows(database, TENANT, submission.id)).toMatchObject([
      { body: "Called back", authorId: null, authorName: null },
    ]);
  });

  it("deletes a note only through its own tenant and submission", async () => {
    const { database } = handle;
    const author = await addTestUser(database);
    const form = await addForm(database);
    const submission = await addSubmission(database, form.id);
    const otherSubmission = await addSubmission(database, form.id);
    await insertNoteRow(database, {
      tenantId: TENANT,
      submissionId: submission.id,
      authorId: author.id,
      body: "Called back",
    });
    const [note] = await listNoteRows(database, TENANT, submission.id);
    const noteId = note?.id ?? "";

    expect(await deleteNoteRow(database, OTHER_TENANT, submission.id, noteId)).toBe(false);
    expect(await deleteNoteRow(database, TENANT, otherSubmission.id, noteId)).toBe(false);
    expect(await listNoteRows(database, TENANT, submission.id)).toHaveLength(1);
    expect(await deleteNoteRow(database, TENANT, submission.id, noteId)).toBe(true);
    expect(await deleteNoteRow(database, TENANT, submission.id, noteId)).toBe(false);
    expect(await listNoteRows(database, TENANT, submission.id)).toEqual([]);
  });
});
