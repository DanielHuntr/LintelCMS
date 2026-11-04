import { expect, it } from "vitest";
import { describeOnEveryDatabase } from "../testing/every-database.js";
import {
  deleteDraftSiteSections,
  findDraftSiteSections,
  findPreviousSiteSections,
  findStoredSiteSections,
  saveDraftSiteSections,
  savePreviousSiteSections,
  saveStoredSiteSections,
  saveStoredSiteSectionsIfMissing,
} from "./site-sections.repository.js";

const SITE = "11111111-1111-4111-8111-111111111111";

describeOnEveryDatabase("Site sections", (handle) => {
  it("keeps the live, draft and previous sections apart", async () => {
    const { database } = handle;
    expect(await saveStoredSiteSectionsIfMissing(database, SITE, { a: 1 })).toBe(true);
    expect(await saveStoredSiteSectionsIfMissing(database, SITE, { a: 2 })).toBe(false);
    await saveStoredSiteSections(database, SITE, { a: 3 });
    await saveDraftSiteSections(database, SITE, { b: 1 });
    await savePreviousSiteSections(database, SITE, { c: 1 });

    expect(await findStoredSiteSections(database, SITE)).toEqual({ a: 3 });
    expect(await findDraftSiteSections(database, SITE)).toEqual({ b: 1 });
    expect(await findPreviousSiteSections(database, SITE)).toEqual({ c: 1 });

    await deleteDraftSiteSections(database, SITE);
    expect(await findDraftSiteSections(database, SITE)).toBeUndefined();
  });
});
