import { expect, it } from "vitest";
import type { Database } from "../database/client.js";
import { tableFor } from "../database/dialect/mysql-tables.js";
import { describeOnEveryDatabase } from "../testing/every-database.js";
import {
  deleteFormRow,
  findFormRowByHandle,
  findFormRowById,
  insertFormRow,
  listFormHandles,
  listFormRows,
  updateFormRow,
} from "./forms.repository.js";
import { formSubmissionsTable } from "./forms.table.js";

const TENANT = "default";

function addForm(database: Database, handle = "contact") {
  return insertFormRow(database, {
    handle,
    name: "Contact",
    fields: [],
    submitLabel: "Send",
    confirmation: {} as never,
    notifications: {} as never,
  });
}

describeOnEveryDatabase("Forms", (handle) => {
  it("counts all and unread submissions, and a form with none", async () => {
    const { database } = handle;
    const form = await addForm(database);
    await addForm(database, "empty");
    const submissions = tableFor(database, formSubmissionsTable);
    const lastSubmittedAt = new Date("2026-11-04T10:00:00.000Z");
    await database.insert(submissions).values([
      { formId: form.id, values: {}, isRead: true },
      { formId: form.id, values: {}, createdAt: lastSubmittedAt },
    ]);

    const found = await findFormRowById(database, TENANT, form.id);
    expect(found).toMatchObject({ submissionCount: 2, unreadCount: 1 });
    expect(new Date(found?.lastSubmittedAt ?? 0).getTime()).toBeGreaterThanOrEqual(
      lastSubmittedAt.getTime(),
    );

    const rows = await listFormRows(database, TENANT);
    const empty = rows.find((row) => row.handle === "empty");
    expect(empty).toMatchObject({ submissionCount: 0, unreadCount: 0, lastSubmittedAt: null });
  });

  it("finds, changes and deletes a form", async () => {
    const { database } = handle;
    const form = await addForm(database);
    await updateFormRow(database, TENANT, form.id, { name: "Say hello" });
    expect((await findFormRowByHandle(database, TENANT, "contact"))?.name).toBe("Say hello");
    expect(await listFormHandles(database, TENANT)).toEqual(["contact"]);
    await deleteFormRow(database, TENANT, form.id);
    expect(await listFormHandles(database, TENANT)).toEqual([]);
  });
});
