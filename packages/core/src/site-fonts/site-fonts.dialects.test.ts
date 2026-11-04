import { expect, it } from "vitest";
import { addTestSite, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  countSiteFontRows,
  deleteAdobeProjectRows,
  deleteSiteFontRow,
  findSiteFontRow,
  findSiteFontRowByFamily,
  insertSiteFontRow,
  listAllSiteFontRows,
  listSiteFontRows,
  updateSiteFontRow,
} from "./site-fonts.repository.js";

const TENANT = "default";

describeOnEveryDatabase("Site fonts", (handle) => {
  it("saves, finds, lists and counts fonts", async () => {
    const { database } = handle;
    const site = await addTestSite(database);
    const font = await insertSiteFontRow(database, {
      siteId: site.id,
      family: "Lora",
      source: "upload",
      files: [{ assetId: "a", weight: "400", style: "normal", format: "woff2" }],
    });
    await insertSiteFontRow(database, { siteId: site.id, family: "Inter", source: "google" });

    expect(font.category).toBe("sans");
    expect(font.files[0]?.format).toBe("woff2");
    expect((await findSiteFontRow(database, TENANT, site.id, font.id))?.family).toBe("Lora");
    expect(await listSiteFontRows(database, TENANT, site.id)).toHaveLength(2);
    expect(await listAllSiteFontRows(database, TENANT)).toHaveLength(2);
    expect(await countSiteFontRows(database, TENANT, site.id)).toBe(2);
  });

  it("finds a family whatever its case", async () => {
    const { database } = handle;
    const site = await addTestSite(database);
    await insertSiteFontRow(database, { siteId: site.id, family: "Lora", source: "upload" });
    const found = await findSiteFontRowByFamily(database, TENANT, site.id, "LORA");
    expect(found?.family).toBe("Lora");
  });

  it("changes a font and returns it", async () => {
    const { database } = handle;
    const site = await addTestSite(database);
    const font = await insertSiteFontRow(database, {
      siteId: site.id,
      family: "Lora",
      source: "upload",
    });
    const when = new Date("2026-11-04T10:00:00.250Z");
    const changed = await updateSiteFontRow(database, TENANT, font.id, {
      category: "serif",
      licenceConfirmedAt: when,
    });
    expect(changed.category).toBe("serif");
    expect(changed.licenceConfirmedAt).toEqual(when);
  });

  it("removes one font, and all of an Adobe project", async () => {
    const { database } = handle;
    const site = await addTestSite(database);
    const font = await insertSiteFontRow(database, {
      siteId: site.id,
      family: "Lora",
      source: "upload",
    });
    for (const family of ["One", "Two"]) {
      await insertSiteFontRow(database, {
        siteId: site.id,
        family,
        source: "adobe",
        sourceId: "project",
      });
    }
    await deleteSiteFontRow(database, TENANT, font.id);
    await deleteAdobeProjectRows(database, TENANT, site.id, "project");
    expect(await listSiteFontRows(database, TENANT, site.id)).toEqual([]);
  });
});
