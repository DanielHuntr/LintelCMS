import { expect, it } from "vitest";
import { addTestEntry, describeOnEveryDatabase } from "../testing/every-database.js";
import { findDueScheduledEntryIds, publishIfStillDue } from "./entry-publishing.repository.js";
import { listEntriesScheduledBetween } from "./scheduled-entries.repository.js";

const due = new Date("2026-11-04T10:00:00.000Z");
const after = new Date("2026-11-04T11:00:00.000Z");

describeOnEveryDatabase("Scheduled entries", (handle) => {
  it("lists what is coming up, with its title", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database, {
      status: "scheduled",
      scheduledFor: due,
      data: { title: "Launch" },
    });
    const rows = await listEntriesScheduledBetween(database, {
      tenantId: "default",
      siteId: entry.siteId,
      from: due,
      to: after,
      limit: 10,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: "Launch", scheduledFor: due });
  });

  it("publishes a due entry once, keeping its scheduled time", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database, {
      status: "scheduled",
      scheduledFor: due,
      data: { title: "Launch" },
    });
    expect(await findDueScheduledEntryIds(database, after)).toEqual([entry.id]);

    const published = await publishIfStillDue(database, entry.id, after, undefined);
    expect(published).toMatchObject({
      status: "published",
      publishedAt: due,
      scheduledFor: null,
      publishedData: { title: "Launch" },
    });
    expect(await publishIfStillDue(database, entry.id, after, undefined)).toBeUndefined();
  });

  it("publishes the saved revision's values when given them", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database, { status: "scheduled", scheduledFor: due });
    const published = await publishIfStillDue(database, entry.id, after, { title: "Revised" });
    expect(published?.publishedData).toEqual({ title: "Revised" });
  });
});
