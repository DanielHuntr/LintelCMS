import { expect, it } from "vitest";
import {
  addTestEntry,
  addTestUser,
  describeOnEveryDatabase,
  findEntryRow,
} from "../testing/every-database.js";
import { reassignAuthorship } from "./authorship.repository.js";

describeOnEveryDatabase("Reassigning authorship", (handle) => {
  it("moves a person's entries to someone else, and counts them", async () => {
    const { database } = handle;
    const from = await addTestUser(database);
    const to = await addTestUser(database, "new@example.com");
    const entry = await addTestEntry(database, { createdBy: from.id, updatedBy: from.id });

    expect(await reassignAuthorship(database, from.id, to.id)).toBe(1);
    expect(await findEntryRow(database, entry.id)).toMatchObject({
      createdBy: to.id,
      updatedBy: to.id,
    });
    expect(await reassignAuthorship(database, from.id, to.id)).toBe(0);
  });
});
