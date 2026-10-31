import { describe, expect, it } from "vitest";
import { pluginsForSiteType } from "./sitePresets.js";

describe("pluginsForSiteType", () => {
  it.each([
    ["business", ["forms", "seo"]],
    ["blog", ["blog", "seo"]],
    ["shop", ["commerce", "seo", "forms"]],
    ["portfolio", ["forms", "seo"]],
    ["blank", []],
  ] as const)("switches on the right plugins for a %s site", (siteType, plugins) => {
    expect(pluginsForSiteType(siteType)).toEqual(plugins);
  });

  it("hands out a copy, so changing one choice can't change the preset", () => {
    pluginsForSiteType("blog").push("commerce");
    expect(pluginsForSiteType("blog")).toEqual(["blog", "seo"]);
  });
});
