import { describe, expect, it } from "vitest";
import { pageAddress } from "./pageAddress.js";

describe("a page's address on the website", () => {
  const site = "http://localhost:3000";
  const entry = { slug: "about", publishedAt: "2026-03-05T10:00:00Z", locale: "en-GB" };

  it("fills in the route pattern, with the date it was published", () => {
    expect(pageAddress(site, "/{slug}", entry, "en-GB")).toBe("http://localhost:3000/about");
    expect(pageAddress(site, "/news/{year}/{month}/{slug}", entry, "en-GB")).toBe(
      "http://localhost:3000/news/2026/03/about",
    );
  });

  it("puts the home page at the root and other languages under their code", () => {
    expect(pageAddress(site, "/{slug}", { ...entry, slug: "home" }, "en-GB")).toBe(
      "http://localhost:3000/",
    );
    expect(pageAddress(site, "/{slug}", { ...entry, locale: "fr-FR" }, "en-GB")).toBe(
      "http://localhost:3000/fr-FR/about",
    );
    expect(pageAddress(site, "/{slug}", { ...entry, slug: "home", locale: "fr-FR" }, "en-GB")).toBe(
      "http://localhost:3000/fr-FR",
    );
  });
});
