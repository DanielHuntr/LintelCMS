import { expect, it } from "vitest";
import { addTestEntry, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  findStoredSiteDesign,
  findStoredSiteDesignUpdatedAt,
  listEntriesUsingSiteDesign,
  saveStoredSiteDesign,
} from "./site-design.repository.js";

const SITE = "11111111-1111-4111-8111-111111111111";

describeOnEveryDatabase("Site design", (handle) => {
  it("saves a site's design", async () => {
    const { database } = handle;
    await saveStoredSiteDesign(database, SITE, { colours: ["#123456"] });
    expect(await findStoredSiteDesign(database, SITE)).toEqual({ colours: ["#123456"] });
    expect(await findStoredSiteDesignUpdatedAt(database, SITE)).toBeInstanceOf(Date);
  });

  it("finds entries that use a shared style or a variable", async () => {
    const { database } = handle;
    const styled = await addTestEntry(database, {
      slug: "styled",
      data: { design: { sharedStyle: "a" } },
    });
    const withVariable = await addTestEntry(database, {
      slug: "variable",
      data: { design: { colour: "var(--lintel-var-accent)" } },
    });
    await addTestEntry(database, { slug: "plain", data: { title: "Plain" } });

    const rows = await listEntriesUsingSiteDesign(database, styled.siteId);
    expect(rows.map((row) => row.id).sort()).toEqual([styled.id, withVariable.id].sort());
  });
});
