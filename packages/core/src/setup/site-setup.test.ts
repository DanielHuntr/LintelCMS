import { describe, expect, it } from "vitest";
import { findEnabledPluginIds } from "../plugins/plugins.service.js";
import { readSetting } from "../settings/settings.service.js";
import { useTestDatabase } from "../testing/test-database.js";
import { saveSiteChoices } from "./site-setup.service.js";
import { pluginsForSiteType } from "./site-presets.js";

describe("the site's name and kind", () => {
  const testDatabase = useTestDatabase();

  it("saves the name and kind, and marks the site as set up", async () => {
    await saveSiteChoices(testDatabase.database, {
      siteName: "Brightside Bakery",
      siteType: "shop",
    });

    expect(await readSetting(testDatabase.database, "siteName")).toBe("Brightside Bakery");
    expect(await readSetting(testDatabase.database, "siteType")).toBe("shop");
    expect(await readSetting(testDatabase.database, "siteSetupCompleted")).toBe(true);
    expect(await findEnabledPluginIds(testDatabase.database)).toEqual(["commerce", "forms", "seo"]);
  });

  it("can be saved again to change the choice", async () => {
    await saveSiteChoices(testDatabase.database, { siteName: "Brightside", siteType: "shop" });

    await saveSiteChoices(testDatabase.database, { siteName: "Brightside", siteType: "blog" });

    expect(await findEnabledPluginIds(testDatabase.database)).toEqual(["blog", "forms", "seo"]);
  });
});

describe("pluginsForSiteType", () => {
  it.each([
    ["business", ["forms", "seo"]],
    ["blog", ["blog", "forms", "seo"]],
    ["shop", ["commerce", "forms", "seo"]],
    ["portfolio", ["forms", "seo"]],
    ["blank", ["forms", "seo"]],
  ] as const)("switches on forms, SEO tools and the extras for a %s site", (siteType, expected) => {
    expect(pluginsForSiteType(siteType)).toEqual(expected);
  });
});
