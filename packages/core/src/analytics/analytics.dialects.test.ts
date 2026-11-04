import { expect, it } from "vitest";
import { addTestSite, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  deleteEventsBeforeDay,
  deleteSaltsExcept,
  findOrCreateSalt,
  insertEvent,
  listDailyFigures,
  listDaysWithEvents,
  listEventsForDay,
  listSiteIdsWithEvents,
  replaceDailyFigures,
} from "./analytics.repository.js";

const TENANT = "default";
const longPath = `/${"a-long-address/".repeat(25)}`;

describeOnEveryDatabase("Visitor counts", (handle) => {
  it("makes one salt a day, and forgets old ones", async () => {
    const { database } = handle;
    expect(await findOrCreateSalt(database, TENANT, "2026-11-03", "first")).toBe("first");
    expect(await findOrCreateSalt(database, TENANT, "2026-11-03", "second")).toBe("first");
    await findOrCreateSalt(database, TENANT, "2026-11-04", "third");
    await deleteSaltsExcept(database, TENANT, "2026-11-04");
    expect(await findOrCreateSalt(database, TENANT, "2026-11-03", "fourth")).toBe("fourth");
  });

  it("records visits, reads them by day, and deletes old ones", async () => {
    const { database } = handle;
    const { id: siteId } = await addTestSite(database);
    const visit = { siteId, kind: "pageview" as never, path: longPath, properties: { a: "b" } };
    await insertEvent(database, { ...visit, day: "2026-11-03" });
    await insertEvent(database, { ...visit, day: "2026-11-04" });

    const [event] = await listEventsForDay(database, TENANT, siteId, "2026-11-04");
    expect(event).toMatchObject({ path: longPath, properties: { a: "b" } });
    expect(await listSiteIdsWithEvents(database, TENANT, ["2026-11-04"])).toEqual([siteId]);
    expect(await listDaysWithEvents(database, TENANT)).toEqual(["2026-11-03", "2026-11-04"]);
    expect(await deleteEventsBeforeDay(database, TENANT, "2026-11-04")).toBe(1);
    expect(await listDaysWithEvents(database, TENANT)).toEqual(["2026-11-04"]);
  });

  it("replaces a day's figures, keeping a long address as a key", async () => {
    const { database } = handle;
    const { id: siteId } = await addTestSite(database);
    const day = "2026-11-04";
    const figures = {
      dimension: "page",
      key: longPath,
      visitors: 2,
      views: 3,
      durationMs: 0,
      durationCount: 0,
      conversions: 0,
      value: 0,
    } as never;
    await replaceDailyFigures(database, TENANT, siteId, day, [figures]);
    await replaceDailyFigures(database, TENANT, siteId, day, [figures]);
    const query = { tenantId: TENANT, siteId, fromDay: day, toDay: day };
    expect(await listDailyFigures(database, query)).toHaveLength(1);
    expect(await listDailyFigures(database, { ...query, key: longPath })).toHaveLength(1);
    await replaceDailyFigures(database, TENANT, siteId, day, []);
    expect(await listDailyFigures(database, query)).toEqual([]);
  });
});
