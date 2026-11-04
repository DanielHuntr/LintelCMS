import { describe, expect, it } from "vitest";
import { parseRedirectCsv } from "./redirect-csv.js";
import { normaliseRedirectPath, toPathSchema } from "./redirects.schema.js";
import { adviseDescriptionLength, adviseTitleLength, applyTitleTemplate } from "./seo-titles.js";
import { buildSitemapXml } from "./sitemap.js";

describe("page titles", () => {
  it("fill in the template, and drop the separator when there is no site name", () => {
    expect(applyTitleTemplate("{title} | {siteName}", "About us", "Corner Bakery")).toBe(
      "About us | Corner Bakery",
    );
    expect(applyTitleTemplate("{title} | {siteName}", "About us", "")).toBe("About us");
    expect(applyTitleTemplate("{siteName} – {title}", "About us", " ")).toBe("About us");
    expect(applyTitleTemplate("{title} | {siteName}", "Acme", "Acme")).toBe("Acme");
  });

  it("get advice on their length", () => {
    expect(adviseTitleLength("")).toBe("missing");
    expect(adviseTitleLength("Home")).toBe("short");
    expect(adviseTitleLength("Opening hours | Corner Bakery")).toBe("good");
    expect(adviseTitleLength("x".repeat(61))).toBe("long");
    expect(adviseDescriptionLength("Fresh bread.")).toBe("short");
    expect(adviseDescriptionLength("x".repeat(120))).toBe("good");
    expect(adviseDescriptionLength("x".repeat(161))).toBe("long");
  });
});

describe("redirect addresses", () => {
  it("are tidied so the same address is always one rule", () => {
    expect(normaliseRedirectPath("/about/")).toBe("/about");
    expect(normaliseRedirectPath("about")).toBe("/about");
    expect(normaliseRedirectPath("https://example.com/a/b?x=1#top")).toBe("/a/b");
    expect(normaliseRedirectPath("/")).toBe("/");
  });

  it("never turn into another website's address", () => {
    expect(normaliseRedirectPath("//evil.example/x")).toBe("/evil.example/x");
    expect(normaliseRedirectPath("/\\evil.example")).toBe("/evil.example");
    expect(normaliseRedirectPath("\\\\evil.example")).toBe("/evil.example");
    expect(normaliseRedirectPath("/\t/evil.example")).toBe("/evil.example");
    expect(toPathSchema.parse("//evil.example")).toBe("/evil.example");
    expect(toPathSchema.safeParse("javascript:alert(1)").success).toBe(false);
    expect(toPathSchema.parse("https://other.example/page")).toBe("https://other.example/page");
  });

  it("are read from CSV with quotes, tabs and a heading line", () => {
    expect(parseRedirectCsv('from,to\n"/a,b",/c\n/d\t/e\t302\n')).toEqual([
      { line: 2, from: "/a,b", to: "/c", statusCode: undefined },
      { line: 3, from: "/d", to: "/e", statusCode: "302" },
    ]);
  });
});

describe("sitemaps", () => {
  it("escape addresses", () => {
    const xml = buildSitemapXml([
      {
        location: "https://example.com/fish&chips",
        lastModified: new Date("2026-11-01T00:00:00Z"),
      },
    ]);
    expect(xml).toContain("<loc>https://example.com/fish&amp;chips</loc>");
    expect(xml).toContain("<lastmod>2026-11-01T00:00:00.000Z</lastmod>");
  });
});
