import { describe, expect, it } from "vitest";
import { pluginRegistry } from "../plugins/plugins.registry.js";
import { builtInFeatures, pluginsForSiteType } from "./site-presets.js";

describe("site presets", () => {
  it("list the same built-in features, in the same order and with the same names, as the registry", () => {
    expect(builtInFeatures).toEqual(
      pluginRegistry.map((plugin) => ({ id: plugin.id, name: plugin.name })),
    );
  });

  it("switch on forms and SEO tools for every kind of site", () => {
    expect(pluginsForSiteType("blank")).toEqual(["forms", "seo", "analytics"]);
    expect(pluginsForSiteType("blog")).toEqual(["blog", "forms", "seo", "analytics"]);
    expect(pluginsForSiteType("shop")).toEqual(["commerce", "forms", "seo", "analytics"]);
  });
});
