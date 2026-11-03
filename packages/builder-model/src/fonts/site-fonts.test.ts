import { describe, expect, it } from "vitest";
import { compileFontFaces } from "./page-fonts.js";
import {
  adobeProjectIdSchema,
  adobeStylesheetUrl,
  categoryFromGoogle,
  compileIncludedFontFaces,
  compileSiteFontFaces,
  familyValue,
  guessFontFromFileName,
  type ResolvedSiteFont,
} from "./site-fonts.js";

const lora: ResolvedSiteFont = {
  family: "Lora",
  category: "serif",
  source: "google",
  faces: [
    {
      src: "https://cms.example.com/media/a1/file",
      weight: "400",
      style: "normal",
      format: "woff2",
      unicodeRange: "U+0000-00FF, U+0131",
    },
  ],
};

describe("site fonts as CSS", () => {
  it("writes an @font-face rule for each file, with its character range", () => {
    expect(compileSiteFontFaces([lora])).toBe(
      [
        "@font-face {",
        "  font-family: 'Lora';",
        '  src: url("https://cms.example.com/media/a1/file") format("woff2");',
        "  font-weight: 400;",
        "  font-style: normal;",
        "  font-display: swap;",
        "  unicode-range: U+0000-00FF, U+0131;",
        "}",
      ].join("\n"),
    );
  });

  it("writes nothing for an Adobe font, whose stylesheet brings its files", () => {
    expect(
      compileSiteFontFaces([
        { family: "proxima-nova", category: "sans", source: "adobe", faces: [] },
      ]),
    ).toBe("");
  });

  it("leaves out anything that could break out of the rule", () => {
    const sneaky: ResolvedSiteFont = {
      ...lora,
      faces: [
        { ...lora.faces[0]!, src: '/a.woff2") format("x' },
        { ...lora.faces[0]!, unicodeRange: "U+0000; } body { color: red" },
        { ...lora.faces[0]!, weight: "bold" },
      ],
    };
    expect(compileSiteFontFaces([sneaky])).toBe("");
    expect(compileSiteFontFaces([{ ...lora, family: "Lora'; }" }])).toBe("");
  });

  it("declares every included font for the whole site", () => {
    const css = compileIncludedFontFaces();
    expect(css).toContain("font-family: 'Bebas Neue';");
    expect(css).toContain('url("/_lintel/fonts/inter-latin-700-normal.woff2")');
  });

  it("still writes page fonts the way it did", () => {
    expect(compileFontFaces([{ source: "catalogue", id: "anton" }])).toContain(
      "font-family: 'Anton';",
    );
  });

  it("names a fallback of the same kind", () => {
    expect(familyValue(lora)).toBe("'Lora', Georgia, serif");
  });
});

describe("Adobe Fonts projects", () => {
  it("accepts a project ID and builds Adobe's link from it", () => {
    const id = adobeProjectIdSchema.parse("  ABC1def ");
    expect(id).toBe("abc1def");
    expect(adobeStylesheetUrl(id)).toBe("https://use.typekit.net/abc1def.css");
  });

  it("refuses anything that isn't a project ID", () => {
    for (const value of ["", "abc", "abc1def.css", "https://evil.example/x", "abc def1"]) {
      expect(adobeProjectIdSchema.safeParse(value).success, value).toBe(false);
    }
  });
});

describe("guessing a font from its file name", () => {
  it.each([
    ["StudioSans-SemiBoldItalic.woff2", "Studio Sans", "600", "italic"],
    ["StudioSans-Regular.ttf", "Studio Sans", "400", "normal"],
    ["studio_sans_bold.otf", "studio", "700", "normal"],
    ["Brand Serif-ExtraLight.woff2", "Brand Serif", "200", "normal"],
    ["Display-900.woff2", "Display", "900", "normal"],
    ["Lovely.woff2", "Lovely", "400", "normal"],
    ["LovelyItalic.woff2", "Lovely", "400", "italic"],
  ])("%s", (fileName, family, weight, style) => {
    expect(guessFontFromFileName(fileName)).toEqual({ family, weight, style });
  });
});

describe("Google Fonts' kinds", () => {
  it("maps them onto Lintel's", () => {
    expect(categoryFromGoogle("handwriting")).toBe("script");
    expect(categoryFromGoogle("monospace")).toBe("mono");
    expect(categoryFromGoogle("sans-serif")).toBe("sans");
  });
});
