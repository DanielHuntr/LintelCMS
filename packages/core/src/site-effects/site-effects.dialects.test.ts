import { expect, it } from "vitest";
import { describeOnEveryDatabase } from "../testing/every-database.js";
import { findStoredSiteEffects, saveStoredSiteEffects } from "./site-effects.repository.js";

const SITE = "11111111-1111-4111-8111-111111111111";

describeOnEveryDatabase("Site effects", (handle) => {
  it("saves a site's own effects", async () => {
    const { database } = handle;
    expect(await findStoredSiteEffects(database, SITE)).toBeUndefined();
    await saveStoredSiteEffects(database, SITE, { cursor: "dot" });
    expect(await findStoredSiteEffects(database, SITE)).toEqual({ cursor: "dot" });
  });
});
