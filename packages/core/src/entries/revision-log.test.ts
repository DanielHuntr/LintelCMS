import { describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createTestUser } from "../testing/test-users.js";
import { createEntry } from "./entries.service.js";
import { OPEN_REVISION_LIFETIME_MS, recordEdit } from "./revision-log.js";
import { listRevisionsForEntry } from "./revisions.repository.js";

describe("the revision log", () => {
  const testDatabase = useTestDatabase();

  async function draftPage() {
    await ensurePagesCollection(testDatabase.database);
    const author = await createTestUser(testDatabase.database, "ana@example.com", [["*"]]);
    const entry = await createEntry(
      testDatabase.database,
      "pages",
      { data: { title: "About" } },
      { authorId: author.id, assetExists: async () => true },
    );
    return { entryId: entry.id, authorId: author.id };
  }

  it("starts a new revision once the open one is 30 minutes old", async () => {
    const { entryId, authorId } = await draftPage();
    const [first] = await listRevisionsForEntry(testDatabase.database, entryId);
    const justInTime = new Date(first!.createdAt.getTime() + OPEN_REVISION_LIFETIME_MS - 1000);
    const tooLate = new Date(first!.createdAt.getTime() + OPEN_REVISION_LIFETIME_MS + 1000);

    await recordEdit(testDatabase.database, {
      entryId,
      authorId,
      data: { title: "About us" },
      saveVersion: false,
      now: justInTime,
    });
    expect(await listRevisionsForEntry(testDatabase.database, entryId)).toHaveLength(1);

    await recordEdit(testDatabase.database, {
      entryId,
      authorId,
      data: { title: "About our team" },
      saveVersion: false,
      now: tooLate,
    });
    const revisions = await listRevisionsForEntry(testDatabase.database, entryId);
    expect(revisions).toHaveLength(2);
    expect(revisions.map((revision) => revision.isOpen)).toEqual([true, false]);
  });

  it("never gathers edits nobody made, such as imports", async () => {
    const { entryId } = await draftPage();
    for (const title of ["One", "Two"]) {
      await recordEdit(testDatabase.database, {
        entryId,
        authorId: null,
        data: { title },
        saveVersion: false,
      });
    }
    expect(await listRevisionsForEntry(testDatabase.database, entryId)).toHaveLength(3);
  });
});
