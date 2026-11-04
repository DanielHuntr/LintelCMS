import { describe, expect, it } from "vitest";
import { contrastRatio, readableOn, textColourOn } from "./colours.js";
import { themeStylesheet } from "./theme-stylesheet.js";
import { completeTheme, defaultTheme } from "./theme.js";

describe("themes", () => {
  it("fill in anything missing or unusable from the default", () => {
    expect(completeTheme({ brandColour: "#FF0000", fontPairing: "comic-sans" })).toEqual({
      ...defaultTheme,
      brandColour: "#ff0000",
    });
    expect(completeTheme({ brandColour: "red" }).brandColour).toBe(defaultTheme.brandColour);
  });

  it("become CSS custom properties on :root", () => {
    const css = themeStylesheet({ ...defaultTheme, colourScheme: "light" });
    expect(css).toContain("--lintel-color-brand: #7539fd;");
    expect(css).toContain("--lintel-font-heading: system-ui");
    expect(css).toContain("--lintel-space-4: 1rem;");
    expect(css).not.toContain("@media");
  });

  it("follow the visitor's device with a dark palette in a media query when set to auto", () => {
    const css = themeStylesheet(defaultTheme);
    expect(css).toContain("color-scheme: light dark;");
    expect(css).toMatch(/@media \(prefers-color-scheme: dark\) \{\n {2}:root \{/);
    expect(css).toContain("--lintel-color-background: #000000;");
  });

  it("scale spacing and corners with the theme", () => {
    const css = themeStylesheet({ ...defaultTheme, spacing: "airy", cornerStyle: "round" });
    expect(css).toContain("--lintel-space-4: 1.25rem;");
    expect(css).toContain("--lintel-radius-button: 999px;");
  });
});

describe("theme colours", () => {
  it("pick button text that reads well on the brand colour", () => {
    expect(textColourOn("#7539fd")).toBe("#ffffff");
    expect(textColourOn("#ffd60a")).toBe("#111113");
  });

  it("give small brand labels a tone that reads on the page and on panels", () => {
    const tones = (brandColour: string, colourScheme: "light" | "dark") => {
      const css = themeStylesheet({ ...defaultTheme, brandColour, colourScheme });
      const read = (name: string) =>
        new RegExp(`--lintel-color-${name}: (#[0-9a-f]{6});`).exec(css);
      return {
        text: read("brand-text")?.[1] ?? "",
        background: read("background")?.[1] ?? "",
        surface: read("surface")?.[1] ?? "",
      };
    };
    const brands = ["#14213d", "#1a1a2e", "#3b0d11", "#7539fd", "#f2c230", "#000000", "#ffffff"];
    for (const brand of brands) {
      for (const scheme of ["light", "dark"] as const) {
        const { text, background, surface } = tones(brand, scheme);
        expect(contrastRatio(text, background), `${brand} ${scheme}`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(text, surface), `${brand} ${scheme}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    // Links get the same tone: they sit on panels as well.
    const dark = themeStylesheet({ ...defaultTheme, brandColour: "#b1623f", colourScheme: "dark" });
    const link = /--lintel-color-link: (#[0-9a-f]{6});/.exec(dark)?.[1] ?? "";
    expect(contrastRatio(link, "#1c1c1e")).toBeGreaterThanOrEqual(4.5);
    // A brand that already reads well stays exactly as chosen.
    expect(tones("#14213d", "light").text).toBe("#14213d");
  });

  it("darken a pale brand colour for links on white, and lighten it on black", () => {
    const onWhite = readableOn("#ffd60a", "#ffffff");
    expect(contrastRatio(onWhite, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    const onBlack = readableOn("#3a0ca3", "#000000");
    expect(contrastRatio(onBlack, "#000000")).toBeGreaterThanOrEqual(4.5);
    expect(readableOn("#1d1d1f", "#ffffff")).toBe("#1d1d1f");
  });
});
