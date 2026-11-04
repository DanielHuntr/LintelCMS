import { expect, it } from "vitest";
import { addTestEntry, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  closeOpenRevisions,
  findLatestRevision,
  findLatestRevisionOfKind,
  findRevisionForEntry,
  insertRevision,
  listRevisionsForEntry,
  updateOpenRevision,
} from "./revisions.repository.js";

const at = new Date("2026-11-04T10:00:00.125Z");
const later = new Date("2026-11-04T11:00:00.125Z");

describeOnEveryDatabase("Revisions", (handle) => {
  it("saves revisions and finds the latest of each kind", async () => {
    const { database } = handle;
    const { id: entryId } = await addTestEntry(database);
    const first = await insertRevision(database, {
      entryId,
      authorId: null,
      kind: "published",
      data: { title: "One" },
      at,
    });
    expect(first.createdAt).toEqual(at);
    await insertRevision(database, {
      entryId,
      authorId: null,
      kind: "edited",
      data: { title: "Two" },
      isOpen: true,
      at: later,
    });
    expect((await findLatestRevision(database, entryId))?.data).toEqual({ title: "Two" });
    const published = await findLatestRevisionOfKind(database, entryId, "published");
    expect(published?.id).toBe(first.id);
    expect(await listRevisionsForEntry(database, entryId)).toHaveLength(2);
    const found = await findRevisionForEntry(database, entryId, first.id);
    expect(found?.data).toEqual({ title: "One" });
  });

  it("changes an open revision and closes it", async () => {
    const { database } = handle;
    const { id: entryId } = await addTestEntry(database);
    const revision = await insertRevision(database, {
      entryId,
      authorId: null,
      kind: "edited",
      data: {},
      isOpen: true,
    });
    await updateOpenRevision(database, revision.id, {
      data: { title: "New" },
      isOpen: true,
      updatedAt: later,
    });
    await closeOpenRevisions(database, entryId);
    expect(await findLatestRevision(database, entryId)).toMatchObject({
      data: { title: "New" },
      isOpen: false,
      updatedAt: later,
    });
  });
});
