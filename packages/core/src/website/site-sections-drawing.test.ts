import { describe, expect, it } from "vitest";
import { isPageAddress } from "./site-sections-drawing.js";

const site = {
  defaultLocale: "en-GB",
  locales: [
    { code: "en-GB", name: "English" },
    { code: "fr", name: "French" },
  ],
  pathPrefix: "/shop",
};

describe("which typed addresses in the navigation and footer get the site's language", () => {
  it("gives them to the site's pages", () => {
    expect(isPageAddress("/about", site)).toBe(true);
    expect(isPageAddress("/shop/about", site)).toBe(true);
    expect(isPageAddress("/about?tab=team#people", site)).toBe(true);
  });

  it("leaves Lintel's own files, files and addresses that already have a language alone", () => {
    expect(isPageAddress("/_lintel/files/menu.pdf", site)).toBe(false);
    expect(isPageAddress("/shop/_lintel/site.css", site)).toBe(false);
    expect(isPageAddress("/menu.pdf", site)).toBe(false);
    expect(isPageAddress("/images/loaf.webp?w=720", site)).toBe(false);
    expect(isPageAddress("/fr/about", site)).toBe(false);
    expect(isPageAddress("/shop/FR/about", site)).toBe(false);
  });
});
