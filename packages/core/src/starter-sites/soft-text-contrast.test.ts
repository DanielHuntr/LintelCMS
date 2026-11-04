import { colourTokens, starterSites } from "@lintel/builder-model";
import { contrastRatio, defaultTheme, themeStylesheet } from "@lintel/site-components";
import { describe, expect, it } from "vitest";

/**
 * The theme's soft grey sits on whatever paper a template lays down: clock place names, table
 * headings and form hints take the theme's colour directly, so a template can't change them.
 * Each template's light papers and dark papers have to leave it readable.
 */

const AA = 4.5;

function softText(colourScheme: "light" | "dark"): string {
  const stylesheet = themeStylesheet({ ...defaultTheme, colourScheme });
  const match = /--lintel-color-text-secondary: (#[0-9a-f]{6});/.exec(stylesheet);
  if (!match?.[1]) throw new Error("The theme has no soft text colour");
  return match[1];
}

/** Backgrounds light in light mode and dark in dark mode; bands of ink do the opposite. */
function papersOf(site: (typeof starterSites)[number]): Array<{ light: string; dark: string }> {
  const text = JSON.stringify(site);
  const pattern = /"background(?:Color)?":"light-dark\((#[0-9a-f]{6}), (#[0-9a-f]{6})\)"/g;
  return [...text.matchAll(pattern)]
    .map(([, light = "", dark = ""]) => ({ light, dark }))
    .filter(
      ({ light, dark }) =>
        contrastRatio(light, "#000000") > contrastRatio(light, "#ffffff") &&
        contrastRatio(dark, "#ffffff") > contrastRatio(dark, "#000000"),
    );
}

describe("the theme's soft text", () => {
  it.each(starterSites.map((site) => [site.id, site] as const))(
    "reads at AA on every paper of %s, in light and dark",
    (_id, site) => {
      const light = softText("light");
      const dark = softText("dark");
      for (const paper of papersOf(site)) {
        expect(contrastRatio(light, paper.light), `${light} on ${paper.light}`).toBeGreaterThan(AA);
        expect(contrastRatio(dark, paper.dark), `${dark} on ${paper.dark}`).toBeGreaterThan(AA);
      }
    },
  );

  it("leaves Relay's green readable on its darkest panel", () => {
    expect(contrastRatio("#1d754a", "#e9e8e1")).toBeGreaterThan(AA);
    const relay = JSON.stringify(starterSites.find((site) => site.id === "relay"));
    expect(relay).toContain("light-dark(#1d754a, #5fcf95)");
  });

  it("finds the tinted papers it is meant to check", () => {
    const papers = starterSites.flatMap(papersOf).map((paper) => paper.light);
    expect(papers).toContain("#f4efe6");
    expect(papers).toContain("#ebe2cd");
  });

  it("is the same colour the builder shows before the theme loads", () => {
    const token = colourTokens.find((entry) => entry.name === "lintel-color-text-secondary");
    expect(token?.fallback).toBe(softText("light"));
  });
});
