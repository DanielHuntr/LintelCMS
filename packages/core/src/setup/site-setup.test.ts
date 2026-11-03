import { describe, expect, it } from "vitest";
import { findGlobalSetOrFail } from "../globals/globals.service.js";
import { findNavigationOrFail } from "../navigation/navigation.service.js";
import { PluginCatalogue } from "../plugins/plugin-catalogue.js";
import { pluginRegistry } from "../plugins/plugins.registry.js";
import { findEnabledPluginIds } from "../plugins/plugins.service.js";
import { readSetting } from "../settings/settings.service.js";
import { readSiteSections } from "../site-sections/site-sections.service.js";
import { findOrCreateDefaultSite } from "../sites/sites.service.js";
import { useTestDatabase } from "../testing/test-database.js";
import { saveSiteChoices } from "./site-setup.service.js";
import { pluginsForSiteType } from "./site-presets.js";

describe("the site's name and kind", () => {
  const testDatabase = useTestDatabase();
  const builtInPlugins = new PluginCatalogue(pluginRegistry);

  it("saves the name and kind, and marks the site as set up", async () => {
    await saveSiteChoices(testDatabase.database, builtInPlugins, {
      siteName: "Brightside Bakery",
      siteType: "shop",
    });

    expect(await readSetting(testDatabase.database, "siteName")).toBe("Brightside Bakery");
    expect(await readSetting(testDatabase.database, "siteType")).toBe("shop");
    expect(await readSetting(testDatabase.database, "siteSetupCompleted")).toBe(true);
    expect(await findEnabledPluginIds(testDatabase.database)).toEqual([
      "commerce",
      "forms",
      "seo",
      "analytics",
    ]);
  });

  it("gives every site a Site settings global set and an empty main menu", async () => {
    await saveSiteChoices(testDatabase.database, builtInPlugins, {
      siteName: "Brightside",
      siteType: "blank",
    });

    expect((await findGlobalSetOrFail(testDatabase.database, "site_settings")).handle).toBe(
      "site_settings",
    );
    expect((await findNavigationOrFail(testDatabase.database, "main")).handle).toBe("main");
  });

  it("gives a new site a navigation and a footer, so it never goes live without a menu", async () => {
    await saveSiteChoices(testDatabase.database, builtInPlugins, {
      siteName: "Brightside",
      siteType: "blank",
    });
    const sections = await readSiteSections(
      testDatabase.database,
      await findOrCreateDefaultSite(testDatabase.database),
    );
    expect(sections.navigation?.id).toBe("site-navigation");
    expect(sections.footer?.id).toBe("site-footer");
  });

  it("can be saved again to change the choice", async () => {
    await saveSiteChoices(testDatabase.database, builtInPlugins, {
      siteName: "Brightside",
      siteType: "shop",
    });

    await saveSiteChoices(testDatabase.database, builtInPlugins, {
      siteName: "Brightside",
      siteType: "blog",
    });

    expect(await findEnabledPluginIds(testDatabase.database)).toEqual([
      "blog",
      "forms",
      "seo",
      "analytics",
    ]);
  });
});

describe("pluginsForSiteType", () => {
  it.each([
    ["business", ["forms", "seo", "analytics"]],
    ["blog", ["blog", "forms", "seo", "analytics"]],
    ["shop", ["commerce", "forms", "seo", "analytics"]],
    ["portfolio", ["forms", "seo", "analytics"]],
    ["blank", ["forms", "seo", "analytics"]],
  ] as const)("switches on forms, SEO tools and the extras for a %s site", (siteType, expected) => {
    expect(pluginsForSiteType(siteType)).toEqual(expected);
  });
});
